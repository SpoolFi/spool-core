// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

// extends
import "../interfaces/spool/ISpoolDoHardWork.sol";
import "./SpoolStrategy.sol";

/**
 * @notice Spool part of implementation dealing with the do hard work
 *
 * @dev
 * Do hard work is the process of interacting with other protocols.
 * This process aggregates many actions together to act in as optimized
 * manner as possible. It optimizes for underlying assets and gas cost.
 *
 * Do hard work (DHW) is executed periodically. As users are depositing
 * and withdrawing, these actions are stored in the buffer system.
 * When executed the deposits and withdrawals are matched against
 * eachother to minimize slippage and protocol fees. This means that
 * for a normal DHW only deposit or withdrawal is executed and never
 * both in the same index. Both can only be if the DHW is processing
 * the reallocation as well.
 *
 * Each strategy DHW is executed once per index and then incremented.
 * When all strategies are incremented to the same index, the batch
 * is considered complete. As soon as a new batch starts (first strategy
 * in the new batch is processed) global index is incremented.
 *
 * Global index is always one more or equal to the strategy index.
 * This constraints the system so that all strategy DHWs have to be
 * executed to complete the batch.
 *
 * Do hard work can only be executed by the whitelisted addresses.
 * The whitelisting can be done only by the Spool DAO.
 *
 * Do hard work actions:
 * - deposit
 * - withdrawal
 * - compound rewards
 * - reallocate assets across protocols
 *
 */
abstract contract SpoolDoHardWork is ISpoolDoHardWork, SpoolStrategy {

    /* ========== DO HARD WORK ========== */

    /**
     * @notice Executes do hard work of specified strategies.
     * 
     * @dev
     * Requirements:
     *
     * - caller must be a valid do hard worker
     * - provided strategies must be valid
     * - reallocation is not pending for current index
     * - at least one sttrategy must be processed
     */
    function batchDoHardWork(
        uint256[] memory stratIndexes,
        uint256[][] memory slippages,
        RewardSlippages[] memory rewardSlippages,
        address[] memory allStrategies
    ) 
        external
        onlyDoHardWorker
        verifyStrategies(allStrategies)
    {
        // update global index if this are first strategies in index
        if (_isBatchComplete()) {
            globalIndex++;
            doHardWorksLeft = uint8(allStrategies.length);
        }

        // verify reallocation is not set for the current index
        if (reallocationIndex == globalIndex) {
            // if reallocation is set, verify it was disabled
            require(reallocationTableHash == 0, "RLC");
            // if yes, reset reallocation index
            reallocationIndex = 0;
        }
        
        require(
            stratIndexes.length > 0 &&
            stratIndexes.length == slippages.length &&
            stratIndexes.length == rewardSlippages.length,
            "BIPT"
        );

        // check if DHW is forcen to be executen on one transaction
        if (forceOneTxDoHardWork) {
            require(stratIndexes.length == allStrategies.length, "1TX");
        }

        // go over withdrawals and deposits
        for (uint256 i = 0; i < stratIndexes.length; i++) {
            address stratAddress = allStrategies[stratIndexes[i]];
            _doHardWork(stratAddress, slippages[i], rewardSlippages[i]);
            _updatePending(stratAddress);
            _finishStrategyDoHardWork(stratAddress);  
        }

        _updateDoHardWorksLeft(stratIndexes.length);

        // if DHW for index finished
        _finishDhw(false);
    }

    /**
     * @notice Process strategy DHW, deposit wnd withdraw
     * @dev Only executed when there is no reallocation for the DHW
     */
    function _doHardWork(
        address strat,
        uint256[] memory slippages,
        RewardSlippages memory rewardSlippages
    ) private {
        Strategy storage strategy = strategies[strat];

        // Check if strategy wasn't exected in current index yet
        require(strategy.index < globalIndex, "SFIN");

        _process(strat, slippages, rewardSlippages.doClaim, rewardSlippages.swapData);
    }

    /* ========== DO HARD WORK when REALLOCATING ========== */

    /**
     * @notice Executes do hard work of specified strategies if reallocation is in progress.
     * 
     * @dev
     * Requirements:
     *
     * - caller must be a valid do hard worker
     * - provided strategies must be valid
     * - reallocation is pending for current index
     * - at least one strategy must be processed
     */
    function batchDoHardWorkReallocation(
        ReallocationWithdrawData memory withdrawData,
        ReallocationData memory depositData,
        address[] memory allStrategies,
        bool isOneTransaction
    ) external onlyDoHardWorker verifyReallocationStrategies(allStrategies) {
        if (_isBatchComplete()) {
            globalIndex++;
            
            doHardWorksLeft = uint8(allStrategies.length);
            withdrawalDoHardWorksLeft = uint8(allStrategies.length);
        }

        // verify reallocation is set for the current index, and not disabled
        require(
            reallocationIndex == globalIndex &&
            reallocationTableHash != 0,
            "XNRLC"
        );

        // add all indexes if DHW is in one transaction
        if (isOneTransaction) {
            require(
                    withdrawData.stratIndexes.length == allStrategies.length &&
                    depositData.stratIndexes.length == allStrategies.length,
                    "1TX"
                );
        } else {
            require(!forceOneTxDoHardWork, "F1TX");
            
            require(withdrawData.stratIndexes.length > 0 || depositData.stratIndexes.length > 0, "NOSTR");
        }

        // execute deposits and withdrawals
        _batchDoHardWorkReallocation(withdrawData, depositData, allStrategies);

        // update if DHW for index finished
        _finishDhw(true);
    }

    function _batchDoHardWorkReallocation(
        ReallocationWithdrawData memory withdrawData,
        ReallocationData memory depositData,
        address[] memory allStrategies
    ) private {
        // WITHDRAWALS
        if (withdrawData.stratIndexes.length > 0) {
            // check parameters
            require(
                withdrawData.stratIndexes.length == withdrawData.slippages.length && 
                withdrawalDoHardWorksLeft >= withdrawData.stratIndexes.length,
                "BWI"
            );
            
            _verifyReallocationProportions(withdrawData.reallocationProportions);

            PriceData[] memory spotPrices = _getPriceData(withdrawData, allStrategies);

            _processWithdraw(
                withdrawData,
                allStrategies,
                spotPrices
            );

            _updateWithdrawalDohardWorksleft(withdrawData.stratIndexes.length);
        }

        // check if withdrawal phase was finished before starting deposit
        require(
            !(depositData.stratIndexes.length > 0 && withdrawalDoHardWorksLeft > 0),
            "WNF"
        );

        // DEPOSITS
        if (depositData.stratIndexes.length > 0) {
            // check parameters
            require(
                doHardWorksLeft >= depositData.stratIndexes.length &&
                depositData.stratIndexes.length == depositData.slippages.length,
                "BDI"
            );

            // go over deposits
            for (uint128 i = 0; i < depositData.stratIndexes.length; i++) {
                uint256 stratIndex = depositData.stratIndexes[i];
                address stratAddress = allStrategies[stratIndex];
                Strategy storage strategy = strategies[stratAddress];
                _notRemoved(stratAddress);
                require(strategy.isInDepositPhase, "SWNP");

                // deposit
                _doHardWorkDeposit(stratAddress, depositData.slippages[stratIndex]);
                _finishStrategyDoHardWork(stratAddress);

                strategy.isInDepositPhase = false;
            }

            _updateDoHardWorksLeft(depositData.stratIndexes.length);
        }
    }

    function _processWithdraw(
        ReallocationWithdrawData memory withdrawData,
        address[] memory allStrategies,
        PriceData[] memory spotPrices
    ) private {
        ReallocationShares memory reallocation = _optimizeReallocation(withdrawData, spotPrices);

        // go over withdrawals
        for (uint256 i = 0; i < withdrawData.stratIndexes.length; i++) {
            uint256 stratIndex = withdrawData.stratIndexes[i];
            address stratAddress = allStrategies[stratIndex];
            Strategy storage strategy = strategies[stratAddress];
            _notRemoved(stratAddress);
            require(!strategy.isInDepositPhase, "SWP");

            uint128 withdrawnReallocationReceived;
            {
                uint128 sharesToWithdraw = reallocation.totalSharesWithdrawn[stratIndex] - reallocation.optimizedShares[stratIndex];

                ProcessReallocationData memory processReallocationData = ProcessReallocationData(
                    sharesToWithdraw,
                    reallocation.optimizedShares[stratIndex],
                    reallocation.optimizedWithdraws[stratIndex]
                );
                
                // withdraw reallocation / returns non-optimized withdrawn amount
                withdrawnReallocationReceived = _doHardWorkReallocation(stratAddress, withdrawData.slippages[stratIndex], processReallocationData);
            }            

            // reallocate withdrawn to other strategies
            _depositReallocatedAmount(
                reallocation.totalSharesWithdrawn[stratIndex],
                withdrawnReallocationReceived,
                reallocation.optimizedWithdraws[stratIndex],
                allStrategies,
                withdrawData.reallocationProportions[stratIndex]
            );

            _updatePending(stratAddress);

            strategy.isInDepositPhase = true;
        }
    }

    /**
     * @notice Process strategy DHW, including reallocation 
     * @dev Only executed when reallocation is set for the DHW
     */
    function _doHardWorkReallocation(
        address strat,
        uint256[] memory slippages,
        ProcessReallocationData memory processReallocationData
    ) private returns(uint128){
        Strategy storage strategy = strategies[strat];

        // Check if strategy wasn't exected in current index yet
        require(strategy.index < globalIndex, "SFIN");

        uint128 withdrawnReallocationReceived = _processReallocation(strat, slippages, processReallocationData);

        return withdrawnReallocationReceived;
    }

    /**
     * @notice Process deposit collected form the reallocation
     * @dev Only executed when reallocation is set for the DHW
     */
    function _doHardWorkDeposit(
        address strat,
        uint256[] memory slippages
    ) private {
        _processDeposit(strat, slippages);
    }

    /**
     * @notice Calculate amount of shares that can be swapped between a pair of strategies
     *
     * @dev
     * Returns:
     * - amount of optimized collateral amount for each strategy
     * - amount of optimized shares for each strategy
     * - total non-optimized amount of shares for each strategy
     */
    function _optimizeReallocation(
        ReallocationWithdrawData memory withdrawData,
        PriceData[] memory priceData
    ) private pure returns (ReallocationShares memory) {
        uint128[] memory optimizedWithdraws = new uint128[](withdrawData.reallocationProportions.length);
        uint128[] memory optimizedShares = new uint128[](withdrawData.reallocationProportions.length);
        uint128[] memory totalShares = new uint128[](withdrawData.reallocationProportions.length);
        
        for (uint128 i = 0; i < withdrawData.reallocationProportions.length; i++) {
            for (uint128 j = i + 1; j < withdrawData.reallocationProportions.length; j++) {
                // if both strategies are depositing to eachother, optimize
                if (withdrawData.reallocationProportions[i][j] > 0 && withdrawData.reallocationProportions[j][i] > 0) {
                    uint128 amountI = uint128(withdrawData.reallocationProportions[i][j] * priceData[i].totalValue / priceData[i].totalShares);
                    uint128 amountJ = uint128(withdrawData.reallocationProportions[j][i] * priceData[j].totalValue / priceData[j].totalShares);

                    uint128 optimizedAmount;
                    
                    if (amountI > amountJ) {
                        optimizedAmount = amountJ;
                    } else {
                        optimizedAmount = amountI;
                    }

                    optimizedWithdraws[i] += optimizedAmount;
                    optimizedWithdraws[j] += optimizedAmount;
                }

                unchecked {
                    totalShares[i] += uint128(withdrawData.reallocationProportions[i][j]);
                    totalShares[j] += uint128(withdrawData.reallocationProportions[j][i]);
                }
            }

            if (optimizedWithdraws[i] > 0) {
                optimizedShares[i] = Math.getProportion128(optimizedWithdraws[i], priceData[i].totalShares, priceData[i].totalValue);
            }
        }

        ReallocationShares memory reallocationShares = ReallocationShares(
            optimizedWithdraws,
            optimizedShares,
            totalShares
        );
        
        return reallocationShares;
    }

    function _getPriceData(
        ReallocationWithdrawData memory withdrawData,
        address[] memory allStrategies
    ) private returns(PriceData[] memory) {
        PriceData[] memory spotPrices = new PriceData[](allStrategies.length);

        for (uint128 i = 0; i < allStrategies.length; i++) {
            // claim rewards before getting the price
            if (withdrawData.rewardSlippages[i].doClaim) {
                _claimRewards(allStrategies[i], withdrawData.rewardSlippages[i].swapData);
            }
            
            for (uint128 j = 0; j < allStrategies.length; j++) {
                // if a strategy is withdrawing in reallocation get its spot price
                if (withdrawData.reallocationProportions[i][j] > 0) {
                    // if strategy is removed treat it's value as 0
                    if (!strategies[allStrategies[i]].isRemoved) {
                        spotPrices[i].totalValue = _getStratValue(allStrategies[i]);
                    }

                    spotPrices[i].totalShares = strategies[allStrategies[i]].totalShares;

                    require(
                        spotPrices[i].totalValue >= withdrawData.priceSlippages[i].min &&
                        spotPrices[i].totalValue <= withdrawData.priceSlippages[i].max,
                        "BPRC"
                    );
                
                    break;
                }
            }
        }

        return spotPrices;
    }

    function _depositReallocatedAmount(
        uint128 reallocateSharesToWithdraw,
        uint128 withdrawnReallocationReceived,
        uint128 optimizedWithdraw,
        address[] memory _strategies,
        uint256[] memory stratReallocationShares
    ) private {
        for (uint256 i = 0; i < stratReallocationShares.length; i++) {
            if (stratReallocationShares[i] > 0) {
                Strategy storage depositStrategy = strategies[_strategies[i]];

                // add actual withdrawn deposit
                depositStrategy.pendingReallocateDeposit +=
                    Math.getProportion128(withdrawnReallocationReceived, stratReallocationShares[i], reallocateSharesToWithdraw);

                // add optimized deposit
                depositStrategy.pendingReallocateOptimizedDeposit +=
                    Math.getProportion128(optimizedWithdraw, stratReallocationShares[i], reallocateSharesToWithdraw);
            }
        }
    }

    /* ========== SHARED FUNCTIONS ========== */

    /**
     * @notice After strategy DHW is complete increment strategy index
     */
    function _finishStrategyDoHardWork(address strat) private {
        Strategy storage strategy = strategies[strat];
        
        strategy.index++;

        emit DoHardWorkStrategyCompleted(strat, strategy.index);
    }

    /**
     * @notice After strategy DHW process update strategy pending values
     * @dev set pending next as pending and reset pending next
     */
    function _updatePending(address strat) private {
        Strategy storage strategy = strategies[strat];

        Pending memory pendingUserNext = strategy.pendingUserNext;
        strategy.pendingUser = pendingUserNext;
        
        if (
            pendingUserNext.deposit != Max128Bit.ZERO || 
            pendingUserNext.sharesToWithdraw != Max128Bit.ZERO
        ) {
            strategy.pendingUserNext = Pending(Max128Bit.ZERO, Max128Bit.ZERO);
        }
    }

    function _updateDoHardWorksLeft(uint256 processedCount) private {
        doHardWorksLeft -= uint8(processedCount);
    }

    function _updateWithdrawalDohardWorksleft(uint256 processedCount) private {
        withdrawalDoHardWorksLeft -= uint8(processedCount);
    }

    function _hashReallocationProportions(uint256[][] memory reallocationProportions) internal {
        reallocationTableHash = Hash.hashReallocationTable(reallocationProportions);
        if (logReallocationTable) {
            emit ReallocationProportionsUpdatedWithTable(reallocationIndex, reallocationTableHash, reallocationProportions);
        } else {
            emit ReallocationProportionsUpdated(reallocationIndex, reallocationTableHash);
        }
    }

    function _hashReallocationStrategies(address[] memory strategies) internal {
        reallocationStrategiesHash = Hash.hashStrategies(strategies);
    }
}