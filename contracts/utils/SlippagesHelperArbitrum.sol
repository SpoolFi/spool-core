// FOR TESTING PURPOSES ONLY. Will NOT be used in production.

// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../external/@openzeppelin/token/ERC20/IERC20.sol";
import "../external/@openzeppelin/token/ERC20/utils/SafeERC20.sol";
import "../external/interfaces/balancer/IBalancerVault.sol";
import "../external/interfaces/balancer/IStablePool.sol";
import "../external/interfaces/curve/ICurvePool.sol";
import "../external/interfaces/curve/IStableSwap2Pool.sol";
import "../external/interfaces/yearn/IYearnTokenVault.sol";
import "../interfaces/IBaseStrategy.sol";
import "../interfaces/IStrategyContractHelper.sol";
import "../interfaces/IStrategyRegistry.sol";
import "./interfaces/strategies/IAbracadabraMetapoolStrategy.sol";
import "./interfaces/strategies/IBalancerStrategy.sol";
import "./interfaces/strategies/IYearnMetapoolStrategy.sol";
import "./interfaces/strategies/IConvexSharedStrategy.sol";
import "./interfaces/strategies/ICurveStrategyBase.sol";
import "./interfaces/strategies/ICurve2poolStrategy.sol";
import "./interfaces/strategies/IConvexSharedMetapoolStrategy.sol";
import "../libraries/Math.sol";
import "../libraries/Max/128Bit.sol";
import "../shared/BaseStorage.sol";

struct Slippage {
    uint256 protocol; // protocol level slippage
    uint256 lp;       // lp level slippage (0 means no slippage)
    bool isDeposit;   // whether the strategy will be depositing or withdrawing
    bool canProcess;  // if there are deposits or withdrawals to process
    uint256 balance;  // underlying balance of the strategy
    uint256 price;    // price of the lp token of the strategy
}

/// @notice Test Helper contracts for determining DoHardWork slippages for the strategy types that require it.
contract SlippagesHelperArbitrum is BaseStorage {
    using Max128Bit for uint128;
    using SafeERC20 for IERC20;

    IStrategyRegistry private immutable strategyRegistry;

    constructor (IStrategyRegistry _strategyRegistry) {
        strategyRegistry = _strategyRegistry;
    }

    function get2PoolSlippage(ICurveStrategyBase[] calldata _strategies, uint128[] calldata reallocateSharesToWithdraw, RewardSlippages[] calldata rewardSlippages) external returns(Slippage[8] memory slippages){
        require(_strategies.length == 8, "get2PoolSlippage: invalid strategies length");

        Slippage[2] memory abraSlippages = _getAbracadabraSlippage(_strategies[0:2], reallocateSharesToWithdraw[0:2], rewardSlippages);
        Slippage[2] memory curveSlippages = _getCurve2PoolSlippage(_strategies[2:4], reallocateSharesToWithdraw[2:4], rewardSlippages);
        Slippage[2] memory yearnSlippages = _getYearnMetapoolSlippage(_strategies[4:6], reallocateSharesToWithdraw[4:6]);
        Slippage[2] memory convex2poolSlippages = _getConvex2PoolSlippage(_strategies[6:], reallocateSharesToWithdraw[6:], rewardSlippages);

        slippages = [abraSlippages[0], abraSlippages[1], curveSlippages[0], curveSlippages[1], yearnSlippages[0], yearnSlippages[1], convex2poolSlippages[0], convex2poolSlippages[1]];
    }

    function getBalancerSlippage(IBalancerStrategy strategy_, uint128 reallocateSharesToWithdraw) external returns(Slippage memory slippage){
        IBalancerStrategy strategy = IBalancerStrategy(strategyRegistry.getImplementation(address(strategy_)));
        Strategy storage strategyStorage = strategies[address(strategy_)];

        IBalancerVault vault = IBalancerVault( strategy.vault() );
        IERC20 underlying = IERC20( strategy.underlying() );
        IStablePool pool = IStablePool( strategy.pool() );
        bytes32 poolId = strategy.poolId();
        uint256 nCoin = strategy.nCoin();

        (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(strategy_), reallocateSharesToWithdraw);
        if(amount==0) return slippage;
        if(isDeposit){
            slippage = _balancerDeposit(pool, vault, poolId, nCoin, underlying, amount);
        }else {
                uint256 totalLp = strategyStorage.lpTokens;
                uint256 bptTokenWithdraw = (totalLp * amount) / strategyStorage.totalShares;

                slippage = _balancerWithdraw(vault, poolId, nCoin, underlying, bptTokenWithdraw);
        }
        return slippage;
    }

    function getStrategyBalance(address _strategy) external returns(uint128){
        return _getStrategyBalance(_strategy);
    }

    function getStrategyPrice(address _strategy) external returns(uint256){
        return _getStrategyPrice(_strategy);
    }

    function matchDepositsAndWithdrawals(address _strategy, uint128 reallocateSharesToWithdraw) public returns(uint128, bool){
        Strategy storage strategy = strategies[_strategy];
        uint128 strategyTotalShares = strategy.totalShares;
        uint128 pendingSharesToWithdraw = strategy.pendingUser.sharesToWithdraw.get();
        uint128 userDeposit = strategy.pendingUser.deposit.get();

        // CALCULATE THE ACTION

        // if withdrawing for reallocating, add shares to total withdraw shares
        if (reallocateSharesToWithdraw > 0) {
            pendingSharesToWithdraw += reallocateSharesToWithdraw;
        }

        // total deposit received from users + compound reward (if there are any)
        uint128 totalPendingDeposit = userDeposit;
        
        // add compound reward (pendingDepositReward) to deposit
        uint128 withdrawalReward = 0;
        if (strategy.pendingDepositReward > 0) {
            uint128 pendingDepositReward = strategy.pendingDepositReward;

            totalPendingDeposit += pendingDepositReward;

            // calculate compound reward (withdrawalReward) for users withdrawing in this batch
            if (pendingSharesToWithdraw > 0 && strategyTotalShares > 0) {
                withdrawalReward = Math.getProportion128(pendingSharesToWithdraw, pendingDepositReward, strategyTotalShares);

                // substract withdrawal reward from total deposit
                totalPendingDeposit -= withdrawalReward;
            }
        }

        // if there is no pending deposit or withdrawals, return
        if (totalPendingDeposit == 0 && pendingSharesToWithdraw == 0) {
            return (0,false);
        }

        uint128 pendingWithdrawalAmount = 0;
        if (pendingSharesToWithdraw > 0) {
            address stratImpl = strategyRegistry.getImplementation(address(_strategy));
            uint128 strategyBalance = _getStrategyBalance(stratImpl);
            pendingWithdrawalAmount =
            Math.getProportion128(strategyBalance, pendingSharesToWithdraw, strategyTotalShares);
        }

        // ACTION: DEPOSIT OR WITHDRAW
        if (totalPendingDeposit > pendingWithdrawalAmount) { // DEPOSIT
            return(totalPendingDeposit - pendingWithdrawalAmount, true);
        } else if (totalPendingDeposit < pendingWithdrawalAmount) { // WITHDRAW
            uint128 stratSharesToWithdraw = Math.getProportion128Unchecked(
                (pendingWithdrawalAmount - totalPendingDeposit),
                pendingSharesToWithdraw,
                pendingWithdrawalAmount
            );
            return(stratSharesToWithdraw, false);
        } 
        return (0, false);
    }
    function _balancerDeposit(IStablePool pool, IBalancerVault vault, bytes32 poolId, uint nCoin, IERC20 underlying, uint amount) internal returns(Slippage memory slippage) {
        slippage.isDeposit = true;
        slippage.canProcess = true;
        (IAsset[] memory _assets,,) = vault.getPoolTokens(poolId);
        uint256[] memory _maxAmountsIn = new uint256[](_assets.length);
        uint256[] memory _amountsIn = new uint256[](_assets.length);
    
        _maxAmountsIn[nCoin] = amount;
        _amountsIn[nCoin] = amount;
    
        bytes memory _userData = abi.encode(
            IStablePool.JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT,
            _amountsIn,
            0
        );
    
        JoinPoolRequest memory poolRequest = JoinPoolRequest({
            assets : _assets,
            maxAmountsIn : _maxAmountsIn,
            userData : _userData,
            fromInternalBalance : false
        });
    
        // deposit underlying
        underlying.safeApprove(address(vault), amount);
        uint256 bptTokenBefore = pool.balanceOf(address(this));
        vault.joinPool(poolId, address(this), address(this), poolRequest);
        uint256 bptTokenNew = pool.balanceOf(address(this)) - bptTokenBefore;
        underlying.safeApprove(address(vault), 0);
    
        slippage.protocol = bptTokenNew;
    }

    function _getAbracadabraSlippage(ICurveStrategyBase[] calldata _strategies, uint128[] calldata reallocateSharesToWithdraw, RewardSlippages[] calldata rewardSlippages) private returns(Slippage[2] memory slippages) {
        for(uint i=0; i < 2; i++) {
            address strat = strategyRegistry.getImplementation(address(_strategies[i]));
            _claimRewards(strat, rewardSlippages[i]);

            uint stratBalance = _getStrategyBalance(strat);
            uint stratPrice = _getStrategyPrice(strat);

            (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(_strategies[i]), reallocateSharesToWithdraw[i]);
            if(isDeposit){ // Deposit
                slippages[i] = _abraDeposit(_strategies[i], amount);
            }else { // Withdraw
                slippages[i] = _abraWithdraw(_strategies[i], amount);
                }
            slippages[i].balance = stratBalance;
            slippages[i].price = stratPrice;
        }
    }

    function _abraDeposit(ICurveStrategyBase strat, uint amount) private returns(Slippage memory slippage) {
        IERC20 underlying = IERC20( strat.underlying() );
        IDepositZap depositZap = (IConvexSharedMetapoolStrategy(address( strat ))).depositZap();
        underlying.safeApprove(address( depositZap ), amount);
        slippage = _metapool3Deposit(strat, depositZap, amount);
    }

    function _abraWithdraw(ICurveStrategyBase strat, uint amount) private returns(Slippage memory slippage) {
        IERC20 underlying = IERC20( strat.underlying() );
        IDepositZap depositZap = (IConvexSharedMetapoolStrategy(address( strat ))).depositZap();
        address lpHelper  = IAbracadabraMetapoolStrategy(address( strat )).farmHelper();
        slippage = _metapoolWithdraw(strat, depositZap, amount, underlying, IStrategyContractHelper(lpHelper));
    }

    function _getConvex2PoolSlippage(ICurveStrategyBase[] memory _strategies, uint128[] memory reallocateSharesToWithdraw, RewardSlippages[] calldata rewardSlippages) internal returns(Slippage[2] memory slippages){

        for(uint i=0; i < 2; i++){
            address strat = strategyRegistry.getImplementation(address(_strategies[i]));
            _claimRewards(strat, rewardSlippages[i+6]);

            uint stratBalance = _getStrategyBalance(strat);
            uint stratPrice = _getStrategyPrice(strat);
            (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(_strategies[i]), reallocateSharesToWithdraw[i]);

            if(isDeposit){
                slippages[i] = _convexDeposit(_strategies[i], amount);
            }else {
                slippages[i] = _convexWithdraw(_strategies[i], amount);
            }
            slippages[i].balance = stratBalance;
            slippages[i].price = stratPrice;
        }
    }

    function _convexDeposit(ICurveStrategyBase strat, uint amount) private returns(Slippage memory slippage) {
        ICurvePool pool = ICurvePool(strat.pool());
        IERC20 underlying = IERC20(strat.underlying());
        underlying.safeApprove(address(pool), amount);
        slippage = _2poolDeposit(strat, IStableSwap2Pool(address(pool)), amount);
        underlying.safeApprove(address(pool), 0);
    }

    function _convexWithdraw(ICurveStrategyBase strat, uint amount) private returns(Slippage memory slippage) {
        ICurvePool pool = ICurvePool(strat.pool());
        IERC20 underlying = IERC20(strat.underlying());
        address lpHelper = IConvexSharedStrategy(address(strat)).boosterHelper();
        slippage = _2poolWithdraw(strat, pool, amount, underlying, lpHelper);
    }

    function _getCurve2PoolSlippage(ICurveStrategyBase[] calldata _strategies, uint128[] calldata reallocateSharesToWithdraw, RewardSlippages[] calldata rewardSlippages) private returns(Slippage[2] memory slippages) {
        for(uint i=0; i < 2; i++) {
            address strat = strategyRegistry.getImplementation(address(_strategies[i]));
            _claimRewards(strat, rewardSlippages[i+2]);

            uint stratBalance = _getStrategyBalance(strat);
            uint stratPrice = _getStrategyPrice(strat);

            (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(_strategies[i]), reallocateSharesToWithdraw[i]);
            if(isDeposit){ // Deposit
                slippages[i] = _curveDeposit(_strategies[i], amount);
            }else { // Withdrawal
                slippages[i] = _curveWithdraw(_strategies[i], amount);
            }
            slippages[i].balance = stratBalance;
            slippages[i].price = stratPrice;
        }
    }

    function _curveDeposit(ICurveStrategyBase strat, uint amount) private returns(Slippage memory slippage) {
        IERC20 underlying = IERC20( strat.underlying() );
        address pool = strat.pool();
        underlying.safeApprove(pool, amount);
        slippage = _2poolDeposit(strat, IStableSwap2Pool(pool), amount);
    }

    function _curveWithdraw(ICurveStrategyBase strat, uint amount) private returns(Slippage memory slippage) {
        IERC20 underlying = IERC20( strat.underlying() );
        address pool = strat.pool();
        address lpHelper  = ICurve2poolStrategy(address( strat )).gaugeHelper();
        slippage = _2poolWithdraw(strat, ICurvePool(pool), amount, underlying, lpHelper);
    }

    function _getYearnMetapoolSlippage(ICurveStrategyBase[] calldata _strategies, uint128[] calldata reallocateSharesToWithdraw) internal returns(Slippage[2] memory slippages) {
        // Yearn Metapool
        for(uint i=0; i < 2; i++) {
            address strat = strategyRegistry.getImplementation(address(_strategies[i]));
            IERC20 underlying = IERC20( _strategies[i].underlying() );
            IERC20 lpToken = IERC20( _strategies[i].lpToken() );
            IYearnTokenVault vault = IYearnTokenVault( IYearnMetapoolStrategy(strat).vault() );
            uint stratBalance = _getStrategyBalance(strat);
            uint stratPrice = _getStrategyPrice(strat);

            (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(_strategies[i]), reallocateSharesToWithdraw[i]);
            if(isDeposit){ // Deposit
                slippages[i] = _yearnDeposit(_strategies[i], vault, underlying, lpToken, amount);
            }else { // Withdrawal
                slippages[i] = _yearnWithdraw(_strategies[i], vault, underlying, lpToken, amount);
            }
            slippages[i].balance = stratBalance;
            slippages[i].price = stratPrice;
        }
    }


    function _2poolDeposit(ICurveStrategyBase strategy, IStableSwap2Pool pool, uint256 amount) internal returns(Slippage memory slippage) {
        if(amount==0) return slippage;
        
        slippage.canProcess = true;
        slippage.isDeposit = true;
        uint256[2] memory amounts;
        amounts[uint128(strategy.nCoin())] = amount;
        uint lpBefore = IERC20(strategy.lpToken()).balanceOf(address(this));
        pool.add_liquidity(amounts, 0);
        uint newLp = IERC20(strategy.lpToken()).balanceOf(address(this)) - lpBefore;
        slippage.protocol = newLp;
        
        return slippage;
    }


    function _metapool3Deposit(ICurveStrategyBase strategy, IDepositZap depositZap, uint256 amount) internal returns(Slippage memory slippage) {
        if(amount==0) return slippage;
        
        slippage.canProcess = true;
        slippage.isDeposit = true;
        uint256[3] memory amounts;
        amounts[uint128(strategy.nCoin())] = amount;
        address lpToken = strategy.lpToken();
        uint lpBefore = IERC20(lpToken).balanceOf(address(this));
        depositZap.add_liquidity(lpToken, amounts, 0);
        uint newLp = IERC20(strategy.lpToken()).balanceOf(address(this)) - lpBefore;
        slippage.protocol = newLp;
        
        return slippage;
    }

    function _yearnDeposit(ICurveStrategyBase strat, IYearnTokenVault vault, IERC20 underlying, IERC20 lpToken, uint256 amount) internal returns(Slippage memory slippage) {
        slippage.isDeposit = true;
        slippage.canProcess = true;

        IYearnMetapoolStrategy strategy = IYearnMetapoolStrategy(address(strat));
        IDepositZap depositZap = IDepositZap( strategy.depositZap() );

        underlying.safeApprove(address(depositZap), amount);
        slippage = _metapool3Deposit(strat, depositZap, amount);
        if(slippage.protocol==0) return slippage;

        uint amountProtocol = slippage.protocol;

        lpToken.safeApprove(address(vault), amountProtocol);
        uint256 yearnTokenBefore = vault.balanceOf(address(this));
        vault.deposit(amountProtocol, address(this));
        slippage.lp = vault.balanceOf(address(this)) - yearnTokenBefore;
    }


    function _balancerWithdraw(IBalancerVault vault, bytes32 poolId, uint256 nCoin, IERC20 underlying, uint amount) internal returns(Slippage memory slippage) {
        slippage.canProcess = true;

        (IAsset[] memory _assets,,) = vault.getPoolTokens(poolId);
        uint256[] memory _minAmountsOut = new uint256[](_assets.length);

        bytes memory _userData = abi.encode(
            IStablePool.ExitKind.EXACT_BPT_IN_FOR_ONE_TOKEN_OUT,
            amount,
            nCoin
        );

        ExitPoolRequest memory poolRequest = ExitPoolRequest({
            assets : _assets,
            minAmountsOut : _minAmountsOut,
            userData : _userData,
            toInternalBalance : false
        });

        // withdraw idle tokens from vault
        uint256 underlyingBefore = underlying.balanceOf(address(this));
        vault.exitPool(poolId, address(this), address(this), poolRequest);
        uint256 underlyingWithdrawn = underlying.balanceOf(address(this)) - underlyingBefore;
        slippage.protocol = underlyingWithdrawn;
}

    
    function _2poolWithdraw(ICurveStrategyBase strategy, ICurvePool pool, uint256 amount, IERC20, address lpHandler) internal returns(Slippage memory slippage) {
        Strategy storage strategyStorage = strategies[address(strategy)];
        if(amount==0) return slippage;
        slippage.canProcess = true;
        int128 nCoin = strategy.nCoin();
        uint256 totalLp = strategyStorage.lpTokens;
        uint256 withdrawLp = (totalLp * amount) / strategyStorage.totalShares;

        (bool success, bytes memory data) = lpHandler.call(abi.encodeWithSignature("withdraw(uint256)", withdrawLp));

        if (!success) revert(_getRevertMsg(data));

        uint redeemable = pool.calc_withdraw_one_coin(withdrawLp, nCoin);
        pool.remove_liquidity_one_coin(withdrawLp, nCoin, 0);

        slippage.protocol = redeemable;
        return slippage;
    }

    function _metapoolWithdraw(ICurveStrategyBase strategy, IDepositZap depositZap, uint256 amount, IERC20, IStrategyContractHelper lpHandler) internal returns(Slippage memory slippage) {
        Strategy storage strategyStorage = strategies[address(strategy)];
        if(amount==0) return slippage;
        slippage.canProcess = true;
        int128 nCoin = strategy.nCoin();
        address lpToken = strategy.lpToken();
        uint256 totalLp = strategyStorage.lpTokens;
        uint256 withdrawLp = (totalLp * amount) / strategyStorage.totalShares;

        lpHandler.withdraw(withdrawLp);

        uint redeemable = depositZap.calc_withdraw_one_coin(lpToken, withdrawLp, nCoin);
        IERC20(lpToken).safeApprove(address( depositZap ), withdrawLp);
        depositZap.remove_liquidity_one_coin(lpToken, withdrawLp, nCoin, 0);
        IERC20(lpToken).safeApprove(address( depositZap ), 0);

        slippage.protocol = redeemable;
        return slippage;
    }

    function _yearnWithdraw(ICurveStrategyBase strat, IYearnTokenVault vault, IERC20 underlying, IERC20 lpToken, uint256 amount) internal returns(Slippage memory slippage) {
        if(amount==0) return slippage;
        slippage.canProcess = true;

        IYearnMetapoolStrategy strategy = IYearnMetapoolStrategy(address(strat));
        IDepositZap depositZap = IDepositZap( strategy.depositZap() );

        Strategy storage strategyStorage = strategies[address( strat )];
        int128 nCoin = strat.nCoin();
        uint256 yearnTokenBalance = strategyStorage.lpTokens;
        uint256 yearnTokenWithdraw = (yearnTokenBalance * amount) / strategyStorage.totalShares;
        uint lpBalanceBefore = lpToken.balanceOf(address(this));
        slippage.lp = _yearnWithdrawGetMaxLoss(vault, yearnTokenWithdraw);
        uint withdrawnLp = lpToken.balanceOf(address(this)) - lpBalanceBefore;

        uint underlyingBalanceBefore = underlying.balanceOf(address(this));
        lpToken.safeApprove(address( depositZap ), withdrawnLp);
        depositZap.remove_liquidity_one_coin(address(lpToken), withdrawnLp, nCoin, 0);
        lpToken.safeApprove(address( depositZap ), 0);
        uint underlyingBalance = underlying.balanceOf(address(this)) - underlyingBalanceBefore;

        slippage.protocol = underlyingBalance;
    }

    function _yearnWithdrawGetMaxLoss(IYearnTokenVault vault, uint amount) private returns(uint bp) {
        // Find the lowest possible value for basis points within the vault, by trying
        // until the call succeeds.
        bp = 1;
        bool bpFound = false;
        while(!bpFound){
            try vault.withdraw(amount, address(this), bp){
                bpFound = true;
            }catch{
                bp+=1;
            }
        }
    }

    function _getRevertMsg(bytes memory _returnData) internal pure returns (string memory) {
        // if the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_returnData.length < 68) return "SILENT";
        assembly {
        // slice the sig hash
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string)); // all that remains is the revert string
    }

    function _getStrategyBalance(address _strategy) private returns(uint128){
       (bool success, bytes memory result) = _strategy.delegatecall(abi.encodeWithSelector(IBaseStrategy.getStrategyBalance.selector));
        if (!success) revert(_getRevertMsg(result));
        return abi.decode(result, (uint128));
    }

    function _getStrategyPrice(address _strategy) private returns(uint128){
       (bool success, bytes memory result) = _strategy.delegatecall(abi.encodeWithSelector(IBaseStrategy.getStrategyPrice.selector));
        if (!success) revert(_getRevertMsg(result));
        return abi.decode(result, (uint128));
    }

    function _claimRewards(address _strategy, RewardSlippages calldata rewardSlippage) private {
        if(rewardSlippage.doClaim){
            (bool success, bytes memory result) = _strategy.delegatecall(abi.encodeWithSelector(IBaseStrategy.claimRewards.selector, rewardSlippage.swapData));
            if (!success) revert(_getRevertMsg(result));
        }
    }

}
