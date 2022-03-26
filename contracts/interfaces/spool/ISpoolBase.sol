// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface ISpoolBase {
    /* ========== FUNCTIONS ========== */

    function getCompletedGlobalIndex() external view returns(uint24);

    function getActiveGlobalIndex() external view returns(uint24);

    function isMidReallocation() external view returns (bool);

    /* ========== EVENTS ========== */

    event ReallocationProportionsUpdated(
        uint24 indexed index,
        bytes32 reallocationTableHash
    );

    event ReallocationProportionsUpdatedWithTable(
        uint24 indexed index,
        bytes32 reallocationTableHash,
        uint256[][] reallocationProportions
    );
    
    event DoHardWorkCompleted(uint24 indexed index);

    event SetAllocationProvider(address actor, bool isAllocationProvider);
    event SetIsDoHardWorker(address actor, bool isDoHardWorker);
}
