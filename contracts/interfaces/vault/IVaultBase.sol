// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IVaultBase {
    /* ========== STRUCTS ========== */

    struct User {
        uint128 instantDeposit; // used for calculating rewards
        uint128 activeDeposit; // users deposit after deposit process and claim
        uint128 owed; // users owed underlying amount after withdraw has been processed and claimed
        uint128 withdrawnDeposits; // users withdrawn deposit, used to calculate performance fees
        uint128 shares; // users shares after deposit process and claim
    }

    /* ========== EVENTS ========== */

    event Deposit(address indexed member, uint256 indexed globalIndex, uint256 indexed vaultIndex, uint256 amount);
    event Withdrawal(address indexed member, uint256 indexed globalIndex, uint256 indexed vaultIndex, uint256 shares);
    event LazyWithdrawal(address indexed member, uint256 indexed vaultIndex, uint256 shares);
    event LazyWithdrawalProcess(uint256 indexed globalIndex, uint256 indexed vaultIndex, uint256 shares);

    event DebtClaim(address indexed member, uint256 amount);
    event FeesExtracted(address indexed member, address beneficiary, uint256 fees);
    event AllocationChanged(uint256[] previous, uint256[] next);
}
