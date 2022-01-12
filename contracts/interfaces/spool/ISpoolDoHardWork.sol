// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface ISpoolDoHardWork {
    /* ========== EVENTS ========== */

    event Worked(
        address indexed strategy
    );

    event DoHardWorkCompleted(uint256 indexed index);
}
