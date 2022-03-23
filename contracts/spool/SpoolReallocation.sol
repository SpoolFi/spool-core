// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

// extends
import "../interfaces/spool/ISpoolReallocation.sol";
import "./SpoolDoHardWork.sol";

// libraries
import "../libraries/Bitwise.sol";

// other imports
import "../interfaces/IVault.sol";

/**
 * @notice Spool part of implementation dealing with the reallocation of assets
 *
 * @dev
 * Allocation provider can update vault allocation across strategies.
 * This requires vault to withdraw from some and deposit to other strategies.
 * This happens across multiple vaults. The system handles all vault reallocations
 * at once and optimizes it between eachother and users.
 *
 */
abstract contract SpoolReallocation is ISpoolReallocation, SpoolDoHardWork {
    using Bitwise for uint256;

    /* ========== SET REALLOCATION ========== */

    /**
     * @notice Set vaults to reallocate on next do hard work
     */
    function reallocateVaults(
        VaultData[] memory vaults,
        address[] memory strategies,
        uint256[][] memory reallocationProportions
    ) external onlyAllocationProvider {
        require(vaults.length > 0, "NOVRLC");

        uint24 activeGlobalIndex = getActiveGlobalIndex();

        // If reallocation was already initialized before,
        // verify state and parameters before continuing
        if (reallocationIndex > 0) {
            // If reallocation was started for index and table hash is 0,
            // the reallocation was canceled. Prevent from setting it in same index again.
            require(reallocationTableHash != 0, "RLCSTP");
            // check if reallocation can still be set for same global index as before
            require(reallocationIndex == activeGlobalIndex, "RLCINP");
            // verifies strategies agains current reallocation strategies hash
            _verifyReallocationStrategies(strategies);
            _verifyReallocationProportions(reallocationProportions);
        } else { // if new reallocation, init empty reallocation shares table
            // verifies all system strategies using Controller contract
            _verifyStrategies(strategies);
            // hash and save strategies
            // this strategies hash is then used to verify strategies during the reallocation
            // if the strat is exploited and removed from the system, this hash is used to be consistent
            // with reallocation table ordering as system strategies change.
            _hashReallocationStrategies(strategies);
            reallocationIndex = activeGlobalIndex;
            reallocationProportions = new uint256[][](strategies.length);

            for (uint256 i = 0; i < strategies.length; i++) {
                reallocationProportions[i] = new uint256[](strategies.length);
            }
        }

        // loop over vaults
        for (uint128 i = 0; i < vaults.length; i++) {
            // check if address is a valid vault
            _isVault(vaults[i].vault);

            // reallocate vault
            //address[] memory vaultStrategies = _buildVaultStrategiesArray(vaults[i].strategiesBitwise, vaults[i].strategiesCount, strategies);
            (uint256[] memory withdrawProportions, uint256 depositProportions) = 
                IVault(vaults[i].vault).reallocate(
                    _buildVaultStrategiesArray(vaults[i].strategiesBitwise, vaults[i].strategiesCount, strategies),
                    vaults[i].newProportions,
                    getCompletedGlobalIndex(), // NOTE: move to var if call stack not too deeep
                    activeGlobalIndex);

            // withdraw and deposit from vault strategies
            for (uint128 j = 0; j < vaults[i].strategiesCount; j++) {
                if (withdrawProportions[j] > 0) {
                    uint256 withdrawStratIndex = vaults[i].strategiesBitwise.get8BitUintByIndex(j);

                    (uint128 newSharesWithdrawn) = 
                        _reallocateVaultStratWithdraw(
                            vaults[i].vault,
                            strategies[withdrawStratIndex],
                            withdrawProportions[j],
                            activeGlobalIndex
                        );

                    _updateDepositReallocationForStrat(
                        newSharesWithdrawn,
                        vaults[i],
                        depositProportions,
                        reallocationProportions[withdrawStratIndex]
                    );
                }
            }
        }        

        // Hash reallocation proportions
        _hashReallocationProportions(reallocationProportions);
    }

    function _reallocateVaultStratWithdraw(
        address vaultAddress,
        address strat, 
        uint256 vaultProportion,
        uint256 index
    )
        private returns (uint128 newSharesWithdrawn)
    {
        Strategy storage strategy = strategies[strat];
        Vault storage vault = strategy.vaults[vaultAddress];
        VaultBatch storage vaultBatch = vault.vaultBatches[index];

        // calculate new shares to withdraw
        uint128 unwithdrawnVaultShares = vault.shares - vaultBatch.withdrawnShares;

        // if strategy wasn't executed in current batch yet, also substract unprocessed withdrawal shares in current batch
        if(!_isNextStrategyIndex(strategy, index)) {
            VaultBatch storage vaultBatchPrevious = vault.vaultBatches[index - 1];
            unwithdrawnVaultShares -= vaultBatchPrevious.withdrawnShares;
        }

        // return data
        newSharesWithdrawn = Math.getProportion128(unwithdrawnVaultShares, vaultProportion, ACCURACY);

        // save to storage
        vault.withdrawnReallocationShares = newSharesWithdrawn;
    }

    function _isNextStrategyIndex(
        Strategy storage strategy,
        uint256 interactingIndex
    ) internal view returns (bool isNextStrategyIndex) {
        if (strategy.index + 1 == interactingIndex) {
            isNextStrategyIndex = true;
        }
    }

    function _updateDepositReallocationForStrat(
        uint128 sharesWithdrawn,
        VaultData memory vaultData,
        uint256 depositProportions,
        uint256[] memory stratReallocationProportions
    ) private pure {
        // sharesToDeposit = sharesWithdrawn * deposit_strat%
        uint128 sharesWithdrawnleft = sharesWithdrawn;
        uint128 lastDepositedIndex = 0;
        for (uint128 i = 0; i < vaultData.strategiesCount; i++) {

            uint256 stratDepositProportion = depositProportions.get14BitUintByIndex(i);
            if (stratDepositProportion > 0) {
                uint256 globalStratIndex = vaultData.strategiesBitwise.get8BitUintByIndex(i);
                uint128 withdrawnSharesForStrat = Math.getProportion128(sharesWithdrawn, stratDepositProportion, FULL_PERCENT);
                stratReallocationProportions[globalStratIndex] += withdrawnSharesForStrat;
                sharesWithdrawnleft -= withdrawnSharesForStrat;
                lastDepositedIndex = i;
            }
        }

        // add shares left from rounding error to last deposit strat
        stratReallocationProportions[lastDepositedIndex] += sharesWithdrawnleft;
    }

    /* ========== SHARED ========== */

    function _buildVaultStrategiesArray(
        uint256 bitwiseAddressIndexes,
        uint8 strategiesCount,
        address[] memory strategies
    ) private pure returns(address[] memory vaultStrategies) {
        vaultStrategies = new address[](strategiesCount);

        for (uint128 i = 0; i < strategiesCount; i++) {
            uint256 stratIndex = bitwiseAddressIndexes.get8BitUintByIndex(i);
            vaultStrategies[i] = strategies[stratIndex];
        }
    }
}