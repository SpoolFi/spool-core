
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
import "./interfaces/strategies/IIdleStrategy.sol";
import "./interfaces/strategies/IYearnStrategy.sol";
import "./interfaces/strategies/ICurveStrategyBase.sol";
import "./interfaces/strategies/ICurve3poolStrategy.sol";
import "./interfaces/strategies/IConvexSharedStrategy.sol";
import "../libraries/Math.sol";
import "../libraries/Max/128Bit.sol";
import "../shared/BaseStorage.sol";
import "hardhat/console.sol";

struct Slippage {
    uint256 slippage;
    bool isDeposit;
    bool canProcess;
    int256 basisPoints;
    uint256 balance;
}

contract SlippagesHelper is BaseStorage {
    using Max128Bit for uint128;
    using SafeERC20 for IERC20;

    function _3poolDeposit(ICurveStrategyBase strategy, IStableSwap3Pool pool, uint256 amount) internal returns(Slippage memory slippage) {
        console.log('##### 3POOL SLIPPAGE DEPOSIT ##### ', address(strategy));
        if(amount==0) return slippage;
        
        slippage.canProcess = true;
        slippage.isDeposit = true;
        uint256[3] memory amounts;
        amounts[uint128(strategy.nCoin())] = amount;
        uint lpBefore = IERC20(strategy.lpToken()).balanceOf(address(this));
        pool.add_liquidity(amounts, 0);
        uint newLp = IERC20(strategy.lpToken()).balanceOf(address(this)) - lpBefore;
        slippage.slippage = newLp;
        console.log('3POOL: newLp: ', newLp);
        slippage.basisPoints = calculateDiff(newLp, amount);
        
        return slippage;
    }
    
    function _3poolWithdraw(ICurveStrategyBase strategy, ICurvePool pool, uint256 amount, IERC20, address lpHandler) internal returns(Slippage memory slippage) {
        console.log('##### 3POOL SLIPPAGE WITHDRAW ##### ', address(strategy));
        console.log('lpHandler in helper: %s', lpHandler);
        if(amount==0) return slippage;
        slippage.canProcess = true;
        int128 nCoin = strategy.nCoin();
        uint256 totalLp = strategies[address(strategy)].lpTokens;
        uint256 withdrawLp = (totalLp * amount) / strategies[address(strategy)].totalShares;
        console.log('totalLp in helper: %s', totalLp);
        console.log('withdrawLp in helper: %s', withdrawLp);
        console.log('strat total shares: %s', strategies[address(strategy)].totalShares);

        (bool success, bytes memory data) = lpHandler.call(abi.encodeWithSignature("withdraw(uint256)", withdrawLp));

        if (!success) revert(_getRevertMsg(data));
        
        console.log('did withdrawLp in helper: %s', withdrawLp);
        uint redeemable = pool.calc_withdraw_one_coin(withdrawLp, nCoin);
        console.log('remove liq one coin..');
        pool.remove_liquidity_one_coin(withdrawLp, nCoin, 0);

        slippage.slippage = redeemable;
        console.log('amount: %s : ', amount);
        console.log('redeemable: %s :', redeemable);
        slippage.basisPoints = calculateDiff(redeemable, amount);
        console.log('done withdraw 3pool..');
        return slippage;
    }

    function get3PoolSlippage(ICurveStrategyBase[] memory _strategies, uint128[] memory reallocateSharesToWithdraw) external returns(Slippage[6] memory){
        ICurvePool pool = ICurvePool(_strategies[0].pool());

        Slippage[6] memory slippages;

        for(uint i=0; i < _strategies.length; i++){
            ICurveStrategyBase strategy = _strategies[i];
            IERC20 underlying = IERC20( strategy.underlying() );
            uint stratBalance = _getStrategyBalance(address(strategy));
            (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(strategy), reallocateSharesToWithdraw[i]);

            if(isDeposit){
                console.log('DEPOSITING:', amount);
                underlying.safeApprove(address(pool), amount);
                slippages[i] = _3poolDeposit(strategy, IStableSwap3Pool(address(pool)), amount);
                underlying.safeApprove(address(pool), 0);
            }else {
                console.log('WITHDRAWING:', amount);
                console.log('is convex:', (i < 3) ? "true" : "false");
                address lpHelper;
                if (i < 3) {
                    console.log('is convex:', i);
                    lpHelper  = address(IConvexSharedStrategy(address(_strategies[i])).boosterHelper());
                } else {
                    console.log('is curve:', i);
                    lpHelper = address(ICurve3poolStrategy(address(_strategies[i])).liquidityGauge());
                }
                slippages[i] = _3poolWithdraw(strategy, pool, amount, underlying, lpHelper);
            }
            slippages[i].balance = stratBalance;
            console.log('stratBalance: %s', stratBalance);
        }

        return slippages;
    }

    function getIdleSlippage(IIdleStrategy strategy, uint128 reallocateSharesToWithdraw) external returns(Slippage memory slippage){
        console.log('##### IDLE SLIPPAGE ##### ', address(strategy));
        console.log('pendingDepositReward: %s', strategies[address(strategy)].pendingUser.deposit.get());
        IIdleToken idleToken = IIdleToken( strategy.idleToken() );
        IERC20 underlying = IERC20( strategy.underlying() );

        (uint128 amount, bool isDeposit) = matchDepositsAndWithdrawals(address(strategy), reallocateSharesToWithdraw);
        if(amount==0) return slippage;
        slippage.canProcess = true;
        if(isDeposit){
            console.log('idle amount: %s', amount);
            slippage.isDeposit = true;
            underlying.safeApprove(address(idleToken), amount);
            // NOTE: Middle Flag is unused so can be anything
            uint256 mintedIdleAmount = idleToken.mintIdleToken(
                amount,
                true,
                address(this)
            );

            slippage.slippage = mintedIdleAmount;
            console.log('mintedIdleAmount: %s', mintedIdleAmount);
            slippage.basisPoints = calculateDiff(mintedIdleAmount, amount);
        } else {

            uint256 idleTokensTotal = idleToken.balanceOf(address(this));
            uint256 redeemIdleAmount = (idleTokensTotal * amount) / strategies[address(strategy)].totalShares;
            // withdraw idle tokens from vault
            uint256 undelyingBefore = underlying.balanceOf(address(this));
            console.log('underlyingBefore: %s', undelyingBefore);
            idleToken.redeemIdleToken(redeemIdleAmount);
            uint256 underlyingWithdrawn = underlying.balanceOf(address(this)) - undelyingBefore;
            console.log('underlyingWithdrawn: %s', underlyingWithdrawn);
            console.log('redeemIdleAmount: %s', redeemIdleAmount);
            slippage.basisPoints = calculateDiff(underlyingWithdrawn, redeemIdleAmount);
            slippage.slippage = underlyingWithdrawn;
        }

        return slippage;
    }

    function getYearnSlippage(IYearnStrategy strategy, uint128 reallocateSharesToWithdraw) external returns(Slippage memory slippage){
        console.log('##### YEARN SLIPPAGE ##### ', address(strategy));
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
            slippage.basisPoints = calculateDiff(yearnTokenNew, amount);

            slippage.slippage = yearnTokenNew;
            console.log('yearnTokenNew: %s', yearnTokenNew);
        }else {
            uint256 yearnTokenBalance = vault.balanceOf(address(this));
            uint256 yearnTokenWithdraw = (yearnTokenBalance * amount) / strategies[address(strategy)].totalShares;
            uint256 undelyingBefore = underlying.balanceOf(address(this));
            uint bp = 1;
            bool bpFound = false;
            while(!bpFound){
                try vault.withdraw(yearnTokenWithdraw, address(this), bp){
                    console.log('found bp: %s', bp );
                    bpFound = true;
                }catch{
                    bp+=1;
                }
            }
            uint256 undelyingWithdrawn = underlying.balanceOf(address(this)) - undelyingBefore;
            slippage.basisPoints = calculateDiff(undelyingWithdrawn, yearnTokenWithdraw);
            slippage.slippage = bp;
            console.log('bp: %s', bp);
        }

        return slippage;
    }


    function matchDepositsAndWithdrawals(address _strategy, uint128 reallocateSharesToWithdraw) public returns(uint128, bool){
        console.log('in match deposit and withdrawals..');
        Strategy storage strategy = strategies[_strategy];
        uint128 strategyTotalShares = strategy.totalShares;
        uint128 pendingSharesToWithdraw = strategy.pendingUser.sharesToWithdraw.get();
        uint128 userDeposit = strategy.pendingUser.deposit.get();
        console.log('reallocateSharesToWithdraw: %s', reallocateSharesToWithdraw);
        console.log('strategyTotalShares: %s', strategyTotalShares);
        console.log('pendingSharesToWithdraw: %s', pendingSharesToWithdraw);
        console.log('userDeposit: %s', userDeposit);

        // CALCULATE THE ACTION

        // if withdrawing for reallocating, add shares to total withdraw shares
        if (reallocateSharesToWithdraw > 0) {
            pendingSharesToWithdraw += reallocateSharesToWithdraw;
        }
        console.log('done adding rellocation shares..');

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

            // Reset pendingDepositReward
            strategy.pendingDepositReward = 0;
        }
        console.log('done add rewards..');

        // if there is no pending deposit or withdrawals, fail
        if (totalPendingDeposit == 0 && pendingSharesToWithdraw == 0) {
            console.log('returning no deposit..');
            return (0,false);
        }

        uint128 pendingWithdrawalAmount = 0;
        if (pendingSharesToWithdraw > 0) {
            console.log('having pending withdraw shares..');
            uint128 strategyBalance = _getStrategyBalance(_strategy);
            console.log('strategyBalance: %s', strategyBalance);
            console.log('strategyTotalShares: %s', strategyTotalShares);
            pendingWithdrawalAmount = 
                Math.getProportion128(strategyBalance, pendingSharesToWithdraw, strategyTotalShares);
        }

        // ACTION: DEPOSIT OR WITHDRAW
        console.log('totalPendingDeposit: %s', totalPendingDeposit);
        console.log('pendingWithdrawalAmount: %s', pendingWithdrawalAmount);
        if (totalPendingDeposit > pendingWithdrawalAmount) { // DEPOSIT
            console.log('returning deposit..');
            return(totalPendingDeposit - pendingWithdrawalAmount, true);
        } else if (totalPendingDeposit < pendingWithdrawalAmount) { // WITHDRAW
            uint128 stratSharesToWithdraw = Math.getProportion128Unchecked(
                    (pendingWithdrawalAmount - totalPendingDeposit),
                    pendingSharesToWithdraw,
                    pendingWithdrawalAmount
                );
            console.log('stratSharesToWithdraw: %s', stratSharesToWithdraw);
            return(stratSharesToWithdraw, false);
        } 
        return (0, false);
    }

    function getStrategyBalance(address _strategy) external returns(uint128){
        return _getStrategyBalance(_strategy);
    }

    function calculateDiff(uint realAmount, uint originalAmount) private pure returns(int256){
        uint maxBasisPoints = 10000;
        uint baseline = 10 ** 36;
        bool higherOriginalAmount = originalAmount >= realAmount;
        uint numerator = (higherOriginalAmount) ? realAmount : originalAmount;
        uint denominator = (higherOriginalAmount) ? originalAmount : realAmount;

        uint result = maxBasisPoints - ((((numerator*baseline)/denominator)*maxBasisPoints)/baseline);

        return (higherOriginalAmount) ? int( result ) : int(result) * -1;
    }

    function _getStrategyBalance(address _strategy) private returns(uint128){
       (bool success, bytes memory result) = _strategy.delegatecall(abi.encodeWithSelector(IBaseStrategy.getStrategyBalance.selector));
        if (!success) revert(_getRevertMsg(result));
        return abi.decode(result, (uint128));
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
}
