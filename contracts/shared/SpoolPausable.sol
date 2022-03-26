// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../interfaces/IController.sol";

abstract contract SpoolPausable {
    /* ========== STATE VARIABLES ========== */

    /// @notice The controller contract that is consulted for system's validity
    IController public immutable controller;

    constructor(IController _controller) {
        require(
            address(_controller) != address(0),
            "SpoolPausable::constructor: Controller contract address cannot be 0"
        );

        controller = _controller;
    }

    /* ========== MODIFIERS ========== */

    /// @notice Throws if system is paused
    modifier systemNotPaused() {
        controller.checkPaused();
        _;
    }
}
