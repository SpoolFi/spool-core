// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.11;

import "../interfaces/IStrategyRegistry.sol";
import "../interfaces/IController.sol";
import "../shared/SpoolOwnable.sol";

/**
 * @notice A registry of strategies used by the system.
 * @dev Strategies can be added by spool owner or controller and upgraded by admin.
 */
contract StrategyRegistry is SpoolOwnable, IStrategyRegistry {
    /* ========== STATE VARIABLES ========== */

    /// @notice Contract that is allowed to upgrade strategies
    address public admin;

    /// @notice Spool Controller contract
    IController internal immutable controller;

    /// @notice Strategy implementation address mapping
    mapping(address => address) public override strategyImplementations;

    /**
     * @notice Sets the initial immutable values of the contract.
     *
     * @param _admin Admin contract address
     * @param _controller The controller implementation
     * @param _spoolOwner Spool owner contract
     */
    constructor(address _admin, IController _controller, ISpoolOwner _spoolOwner)
        SpoolOwnable(_spoolOwner)
    {
        _setAdmin(_admin);
        controller = _controller;
    }

    /* ========== EXTERNAL FUNCTION ========== */

    /**
     * @notice Upgrade the strategy implementation with the address encoded in the data parameter.
     * Requirements:
     *   - caller has to be admin
     */
    function upgradeToAndCall(address strategy, bytes calldata data) ifAdmin external {
        (address newImpl) = abi.decode(data, (address));
        strategyImplementations[strategy] = newImpl;
        emit StrategyUpgraded(strategy, newImpl);
    }

    /**
     * @notice Changes the admin of the strategy registry.
     */
    function changeAdmin(address newAdmin) external ifAdmin {
        _changeAdmin(newAdmin);
    }

    function addStrategy(address strategy) onlyControllerOrOwner external {
        strategyImplementations[strategy] = strategy;
        emit StrategyRegistered(strategy);
    }

    /* ========== INTERNAL FUNCTION ========== */

    function _ifAdmin() view internal {
        require(
            msg.sender == admin,
            "StrategyRegistry::_ifAdmin: Can only be invoked by admin"
        );
    }

    /**
     * @notice Changes the admin of the strategy registry.
     *
     * Emits an {AdminChanged} event.
     */
    function _changeAdmin(address newAdmin) internal {
        emit AdminChanged(admin, newAdmin);
        _setAdmin(newAdmin);
    }

    /**
     * @notice Stores a new address in the admin slot.
     */
    function _setAdmin(address newAdmin) internal {
        require(
            newAdmin != address(0),
            "StrategyRegistry::_setAdmin: newAdmin cannot be zero address."
        );
        admin = newAdmin;
    }

    /**
    * @notice Ensures that the caller is the controller or Spool owner
     */
    function _onlyControllerOrOwner() internal view {
        require(
            msg.sender == address(controller) || isSpoolOwner(),
            "StrategyRegistry::_onlyControllerOrOwner: Only controller or Spool owner"
        );
    }

    /* ========== MODIFIERS ========== */

    /**
     * @notice Throws if called by anyone else other than the admin
     */
    modifier ifAdmin() {
        _ifAdmin();
        _;
    }

    /**
     * @notice Throws if called by anyone else other than the controller or Spool owner
     */
    modifier onlyControllerOrOwner() {
        _onlyControllerOrOwner();
        _;
    }
}
