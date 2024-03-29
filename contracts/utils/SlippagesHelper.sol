// FOR TESTING PURPOSES ONLY. Will NOT be used in production.

// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../external/@openzeppelin/token/ERC20/IERC20.sol";
import "../external/@openzeppelin/token/ERC20/utils/SafeERC20.sol";
import "../external/interfaces/idle-finance/IIdleToken.sol";
import "../external/interfaces/curve/ICurvePool.sol";
import "../external/interfaces/curve/ILiquidityGauge.sol";
import "../external/interfaces/curve/IStableSwap2Pool.sol";
import "../external/interfaces/curve/IStableSwap3Pool.sol";
import "../external/interfaces/curve/IStableSwap4Pool.sol";
import "../external/interfaces/yearn/IYearnTokenVault.sol";
import "../interfaces/IBaseStrategy.sol";
import "../interfaces/INotionalStrategyContractHelper.sol";
import "../interfaces/IStrategyContractHelper.sol";
import "../interfaces/IStrategyRegistry.sol";
import "./interfaces/strategies/IIdleStrategy.sol";
import "./interfaces/strategies/INotionalStrategy.sol";
import "./interfaces/strategies/IYearnStrategy.sol";
import "./interfaces/strategies/ICurveStrategyBase.sol";
import "./interfaces/strategies/ICurve3poolStrategy.sol";
import "./interfaces/strategies/IConvexSharedStrategy.sol";
import "./interfaces/strategies/IConvexSharedMetapoolStrategy.sol";
import "../libraries/Math.sol";
import "../libraries/Max/128Bit.sol";
import "../shared/BaseStorage.sol";

struct Slippage {
    uint256 slippage; // value to be used as argument for DHW
    bool isDeposit;   // whether the strategy will be depositing or withdrawing
    bool canProcess;  // if there are deposits or withdrawals to process
    uint256 balance;  // underlying balance of the strategy
    uint256 price;  // price of the lp token of the strategy
}

/// @notice Test Helper contracts for determining DoHardWork slippages for the strategy types that require it.
contract SlippagesHelper is BaseStorage {
    using Max128Bit for uint128;
    using SafeERC20 for IERC20;

    IStrategyRegistry private immutable strategyRegistry;

    uint256 constant STRATS_PER_TYPE = 3;

    constructor (IStrategyRegistry _strategyRegistry) {
        strategyRegistry = _strategyRegistry;
    }

    function get3PoolSlippage(ICurveStrategyBase[] memory _strategies, uint128[] memory reallocateSharesToWithdraw) external returns(Slippage[9] memory){
        require(_strategies.length == STRATS_PER_TYPE * 3, "get3PoolSlippage: invalid strategies length");
        Slippage[STRATS_PER_TYPE * 3] memory slippages;

        for(uint i=0; i < _strategies.length; i++){
            address strat = strategyRegistry.getImplementation(address(_strategies[i]));
            ICurveStrategyBase strategy = ICurveStrategyBase(strat);
            ICurvePool pool = ICurvePool(strategy.pool());

            IERC20 underlying = IERC20( strategy.underlying() );
            uint stratBalance = _getStrategyBalance(strat);
            uint stratPrice = _getStrategyPrice(strat);
            (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(_strategies[i]), reallocateSharesToWithdraw[i]);

            if(isDeposit){
                if (i < (_strategies.length / 3)) {
                    IDepositZap depositZap = IConvexSharedMetapoolStrategy(strat).depositZap();
                    underlying.safeApprove(address(depositZap), amount);
                    slippages[i] = _metapoolDeposit(_strategies[i], depositZap, amount);
                }else {
                    underlying.safeApprove(address(pool), amount);
                    slippages[i] = _3poolDeposit(_strategies[i], IStableSwap3Pool(address(pool)), amount);
                }
            }else {
                address lpHelper;
                if (i < (_strategies.length / 3)) {
                    IDepositZap depositZap = IConvexSharedMetapoolStrategy(strat).depositZap();
                    lpHelper  = IConvexSharedStrategy(strat).boosterHelper();
                    slippages[i] = _metapoolWithdraw(_strategies[i], depositZap, amount, underlying, IStrategyContractHelper(lpHelper));
                }
                else if (i < ( (_strategies.length / 3)*2)) {
                    lpHelper  = IConvexSharedStrategy(strat).boosterHelper();
                    slippages[i] = _3poolWithdraw(_strategies[i], pool, amount, underlying, lpHelper);
                } else {
                    lpHelper = ICurve3poolStrategy(strat).liquidityGauge();
                    slippages[i] = _3poolWithdraw(_strategies[i], pool, amount, underlying, lpHelper);
                }
            }
            slippages[i].balance = stratBalance;
            slippages[i].price = stratPrice;
        }

        return slippages;
    }

    function getConvex2PoolSlippage(ICurveStrategyBase[] memory _strategies, uint128[] memory reallocateSharesToWithdraw) external returns(Slippage[1] memory){
        Slippage[1] memory slippages;

        for(uint i=0; i < _strategies.length; i++){
            address strat = strategyRegistry.getImplementation(address(_strategies[i]));
            ICurveStrategyBase strategy = ICurveStrategyBase(strat);
            ICurvePool pool = ICurvePool(strategy.pool());

            IERC20 underlying = IERC20(strategy.underlying());
            uint stratBalance = _getStrategyBalance(strat);
            uint stratPrice = _getStrategyPrice(strat);
            (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(_strategies[i]), reallocateSharesToWithdraw[i]);

            if(isDeposit){
                underlying.safeApprove(address(pool), amount);
                slippages[i] = _2poolDeposit(_strategies[i], IStableSwap2Pool(address(pool)), amount);
                underlying.safeApprove(address(pool), 0);
            }else {
                address lpHelper = IConvexSharedStrategy(strat).boosterHelper();
                slippages[i] = _2poolWithdraw(_strategies[i], pool, amount, underlying, lpHelper);
            }
            slippages[i].balance = stratBalance;
            slippages[i].price = stratPrice;
        }

        return slippages;
    }

    function getConvex4PoolSlippage(ICurveStrategyBase[] memory _strategies, uint128[] memory reallocateSharesToWithdraw) external returns(Slippage[3] memory){
        Slippage[3] memory slippages;

        for(uint i=0; i < _strategies.length; i++){
            address strat = strategyRegistry.getImplementation(address(_strategies[i]));
            ICurveStrategyBase strategy = ICurveStrategyBase(strat);
            ICurvePool pool = ICurvePool(strategy.pool());

            IERC20 underlying = IERC20( strategy.underlying() );
            uint stratBalance = _getStrategyBalance(strat);
            uint stratPrice = _getStrategyPrice(strat);
            (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(_strategies[i]), reallocateSharesToWithdraw[i]);

            if(isDeposit){
                underlying.safeApprove(address(pool), amount);
                slippages[i] = _4poolDeposit(_strategies[i], IStableSwap4Pool(address(pool)), amount);
                underlying.safeApprove(address(pool), 0);
            }else {
                IStrategyContractHelper lpHelper = IStrategyContractHelper(IConvexSharedStrategy(strat).boosterHelper());
                slippages[i] = _4poolWithdraw(_strategies[i], pool, amount, underlying, lpHelper);
            }
            slippages[i].balance = stratBalance;
            slippages[i].price = stratPrice;
        }

        return slippages;
    }

    function getIdleSlippage(IIdleStrategy strategy_, uint128 reallocateSharesToWithdraw) external returns(Slippage memory slippage){
        IIdleStrategy strategy = IIdleStrategy(strategyRegistry.getImplementation(address(strategy_)));
        Strategy storage strategyStorage = strategies[address(strategy_)];

        IIdleToken idleToken = IIdleToken(strategy.idleToken());
        IERC20 underlying = IERC20(strategy.underlying());

        (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(strategy_), reallocateSharesToWithdraw);
        if(amount==0) return slippage;
        slippage.canProcess = true;
        if(isDeposit){
            slippage.isDeposit = true;
            underlying.safeApprove(address(idleToken), amount);
            // NOTE: Middle Flag is unused so can be anything
            uint256 mintedIdleAmount = idleToken.mintIdleToken(
                amount,
                true,
                address(this)
            );

            slippage.slippage = mintedIdleAmount;
        } else {

            uint256 idleTokensTotal = idleToken.balanceOf(address(this));
            uint256 redeemIdleAmount = (idleTokensTotal * amount) / strategyStorage.totalShares;
            // withdraw idle tokens from vault
            uint256 undelyingBefore = underlying.balanceOf(address(this));
            idleToken.redeemIdleToken(redeemIdleAmount);
            uint256 underlyingWithdrawn = underlying.balanceOf(address(this)) - undelyingBefore;
            slippage.slippage = underlyingWithdrawn;
        }

        return slippage;
    }

    function getNotionalSlippage(INotionalStrategy strategy_, uint128 reallocateSharesToWithdraw) external returns(Slippage memory slippage){
        INotionalStrategy strategy = INotionalStrategy(strategyRegistry.getImplementation(address(strategy_)));
        Strategy storage strategyStorage = strategies[address(strategy_)];

        INotionalStrategyContractHelper strategyHelper = INotionalStrategyContractHelper(strategy.strategyHelper());
        IERC20 underlying = IERC20(strategy.underlying());
        INToken nToken = INToken(strategy.nToken());

        (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(strategy_), reallocateSharesToWithdraw);
        if(amount==0) return slippage;
        slippage.canProcess = true;
        if(isDeposit){
            slippage.isDeposit = true;
            // deposit underlying
            underlying.safeTransfer(address(strategyHelper), amount);

            uint256 nTokenBalanceNew = strategyHelper.deposit(amount);
            slippage.slippage = nTokenBalanceNew;
        }else {
            uint256 nTokenBalance = nToken.balanceOf(address(strategyHelper));
            uint256 nTokenWithdraw = (nTokenBalance * amount) / strategyStorage.totalShares;

            uint256 underlyingWithdrawn = strategyHelper.withdraw(nTokenWithdraw);
            slippage.slippage = underlyingWithdrawn;
        }

        return slippage;
    }

    function getYearnSlippage(IYearnStrategy strategy_, uint128 reallocateSharesToWithdraw) external returns(Slippage memory slippage){
        address strat = strategyRegistry.getImplementation(address(strategy_));
        IYearnStrategy strategy = IYearnStrategy(strat);
        Strategy storage strategyStorage = strategies[address(strategy_)];

        IYearnTokenVault vault = IYearnTokenVault( strategy.vault() );
        IERC20 underlying = IERC20( strategy.underlying() );
        slippage.balance = _getStrategyBalance(strat);
        slippage.price = _getStrategyPrice(strat);

        (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(strategy_), reallocateSharesToWithdraw);
        if(amount==0) return slippage;
        slippage.canProcess = true;
        if(isDeposit){
            slippage.isDeposit = true;
            // deposit underlying
            underlying.safeApprove(address(vault), amount);
            uint256 yearnTokenBefore = vault.balanceOf(address(this));
            vault.deposit(amount, address(this));
            uint256 yearnTokenNew = vault.balanceOf(address(this)) - yearnTokenBefore;

            slippage.slippage = yearnTokenNew;
        }else {
            uint256 yearnTokenBalance = vault.balanceOf(address(this));
            uint256 yearnTokenWithdraw = (yearnTokenBalance * amount) / strategyStorage.totalShares;
            // Find the lowest possible value for basis points within the vault, by trying
            // until the call succeeds.
            uint bp = 1;
            bool bpFound = false;
            while(!bpFound){
                try vault.withdraw(yearnTokenWithdraw, address(this), bp){
                    bpFound = true;
                }catch{
                    bp+=1;
                }
            }
            slippage.slippage = bp;
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

    function _2poolDeposit(ICurveStrategyBase strategy, IStableSwap2Pool pool, uint256 amount) internal returns(Slippage memory slippage) {
        if(amount==0) return slippage;
        
        slippage.canProcess = true;
        slippage.isDeposit = true;
        uint256[2] memory amounts;
        amounts[uint128(strategy.nCoin())] = amount;
        uint lpBefore = IERC20(strategy.lpToken()).balanceOf(address(this));
        pool.add_liquidity(amounts, 0);
        uint newLp = IERC20(strategy.lpToken()).balanceOf(address(this)) - lpBefore;
        slippage.slippage = newLp;
        
        return slippage;
    }

    function _3poolDeposit(ICurveStrategyBase strategy, IStableSwap3Pool pool, uint256 amount) internal returns(Slippage memory slippage) {
        if(amount==0) return slippage;
        
        slippage.canProcess = true;
        slippage.isDeposit = true;
        uint256[3] memory amounts;
        amounts[uint128(strategy.nCoin())] = amount;
        uint lpBefore = IERC20(strategy.lpToken()).balanceOf(address(this));
        pool.add_liquidity(amounts, 0);
        uint newLp = IERC20(strategy.lpToken()).balanceOf(address(this)) - lpBefore;
        slippage.slippage = newLp;
        
        return slippage;
    }

    function _4poolDeposit(ICurveStrategyBase strategy, IStableSwap4Pool pool, uint256 amount) internal returns(Slippage memory slippage) {
        if(amount==0) return slippage;
        
        slippage.canProcess = true;
        slippage.isDeposit = true;
        uint256[4] memory amounts;
        amounts[uint128(strategy.nCoin())] = amount;
        uint lpBefore = IERC20(strategy.lpToken()).balanceOf(address(this));
        pool.add_liquidity(amounts, 0);
        uint newLp = IERC20(strategy.lpToken()).balanceOf(address(this)) - lpBefore;
        slippage.slippage = newLp;
        
        return slippage;
    }

    function _metapoolDeposit(ICurveStrategyBase strategy, IDepositZap depositZap, uint256 amount) internal returns(Slippage memory slippage) {
        if(amount==0) return slippage;
        
        slippage.canProcess = true;
        slippage.isDeposit = true;
        uint256[4] memory amounts;
        amounts[uint128(strategy.nCoin())] = amount;
        address lpToken = strategy.lpToken();
        uint lpBefore = IERC20(lpToken).balanceOf(address(this));
        depositZap.add_liquidity(lpToken, amounts, 0);
        uint newLp = IERC20(strategy.lpToken()).balanceOf(address(this)) - lpBefore;
        slippage.slippage = newLp;
        
        return slippage;
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

        slippage.slippage = redeemable;
        return slippage;
    }
    
    function _3poolWithdraw(ICurveStrategyBase strategy, ICurvePool pool, uint256 amount, IERC20, address lpHandler) internal returns(Slippage memory slippage) {
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

        slippage.slippage = redeemable;
        return slippage;
    }

    function _4poolWithdraw(ICurveStrategyBase strategy, ICurvePool pool, uint256 amount, IERC20, IStrategyContractHelper lpHandler) internal returns(Slippage memory slippage) {
        Strategy storage strategyStorage = strategies[address(strategy)];
        if(amount==0) return slippage;
        slippage.canProcess = true;
        int128 nCoin = strategy.nCoin();
        address lpToken = strategy.lpToken();
        uint256 totalLp = strategyStorage.lpTokens;
        uint256 withdrawLp = (totalLp * amount) / strategyStorage.totalShares;

        lpHandler.withdraw(withdrawLp);

        uint redeemable = pool.calc_withdraw_one_coin(withdrawLp, nCoin);
        IERC20(lpToken).safeApprove(address(pool), withdrawLp);
        pool.remove_liquidity_one_coin(withdrawLp, nCoin, 0);
        IERC20(lpToken).safeApprove(address(pool), 0);

        slippage.slippage = redeemable;
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

        slippage.slippage = redeemable;
        return slippage;
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

}
