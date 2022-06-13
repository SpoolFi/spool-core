// FOR TESTING PURPOSES ONLY. Will NOT be used in production.

// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../external/@openzeppelin/token/ERC20/IERC20.sol";
import "../external/@openzeppelin/token/ERC20/utils/SafeERC20.sol";
import "../external/interfaces/idle-finance/IIdleToken.sol";
import "../external/interfaces/curve/ICurvePool.sol";
import "../external/interfaces/curve/ILiquidityGauge.sol";
import "../external/interfaces/curve/IStableSwap3Pool.sol";
import "../external/interfaces/yearn/IYearnTokenVault.sol";
import "../interfaces/IBaseStrategy.sol";
import "../interfaces/IStrategyRegistry.sol";
import "./interfaces/strategies/IIdleStrategy.sol";
import "./interfaces/strategies/IYearnStrategy.sol";
import "./interfaces/strategies/ICurveStrategyBase.sol";
import "./interfaces/strategies/ICurve3poolStrategy.sol";
import "./interfaces/strategies/IConvexSharedStrategy.sol";
import "../libraries/Math.sol";
import "../libraries/Max/128Bit.sol";
import "../shared/BaseStorage.sol";

struct Slippage {
    uint256 slippage; // value to be used as argument for DHW
    bool isDeposit;   // whether the strategy will be depositing or withdrawing
    bool canProcess;  // if there are deposits or withdrawals to process
    uint256 balance;  // underlying balance of the strategy
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

    function get3PoolSlippage(ICurveStrategyBase[] memory _strategies, uint128[] memory reallocateSharesToWithdraw) external returns(Slippage[6] memory){
        require(_strategies.length == STRATS_PER_TYPE * 2, "get3PoolSlippage: invalid strategies length");
        Slippage[STRATS_PER_TYPE * 2] memory slippages;

        for(uint i=0; i < _strategies.length; i++){
            address strat = strategyRegistry.getImplementation(address(_strategies[i]));
            ICurveStrategyBase strategy = ICurveStrategyBase(strat);
            ICurvePool pool = ICurvePool(strategy.pool());

            IERC20 underlying = IERC20( strategy.underlying() );
            uint stratBalance = _getStrategyBalance(strat);
            (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(_strategies[i]), reallocateSharesToWithdraw[i]);

            if(isDeposit){
                underlying.safeApprove(address(pool), amount);
                slippages[i] = _3poolDeposit(_strategies[i], IStableSwap3Pool(address(pool)), amount);
                underlying.safeApprove(address(pool), 0);
            }else {
                address lpHelper;
                // first half are Convex, second half are Curve.
                if (i < (_strategies.length / 2)) {
                    lpHelper  = address(IConvexSharedStrategy(strat).boosterHelper());
                } else {
                    lpHelper = address(ICurve3poolStrategy(strat).liquidityGauge());
                }
                slippages[i] = _3poolWithdraw(_strategies[i], pool, amount, underlying, lpHelper);
            }
            slippages[i].balance = stratBalance;
        }

        return slippages;
    }

    function getIdleSlippage(IIdleStrategy strategy_, uint128 reallocateSharesToWithdraw) external returns(Slippage memory slippage){
        IIdleStrategy strategy = IIdleStrategy(strategyRegistry.getImplementation(address(strategy_)));
        Strategy storage strategyStorage = strategies[address(strategy_)];

        IIdleToken idleToken = IIdleToken(strategy.idleToken());
        IERC20 underlying = IERC20(strategy.underlying());

        (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(strategy), reallocateSharesToWithdraw);
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

    function getYearnSlippage(IYearnStrategy strategy_, uint128 reallocateSharesToWithdraw) external returns(Slippage memory slippage){
        IYearnStrategy strategy = IYearnStrategy(strategyRegistry.getImplementation(address(strategy_)));
        Strategy storage strategyStorage = strategies[address(strategy_)];

        IYearnTokenVault vault = IYearnTokenVault( strategy.vault() );
        IERC20 underlying = IERC20( strategy.underlying() );

        (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(strategy), reallocateSharesToWithdraw);
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
}
