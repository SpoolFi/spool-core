// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../external/@openzeppelin/token/ERC20/IERC20.sol";

interface IController {
    /* ========== FUNCTIONS ========== */

    function strategies(uint256 i) external view returns (address);

    function validStrategy(address strategy) external view returns (bool);

    function validVault(address vault) external view returns (bool);

    function getStrategiesCount() external view returns(uint8);

    function supportedUnderlying(IERC20 underlying)
        external
        view
        returns (bool);

    function getAllStrategies() external view returns (address[] memory);

    function verifyStrategies(address[] calldata _strategies) external view;

    /* ========== EVENTS ========== */

    // event VaultCreated(
    //     address vault,
    //     string name,
    //     int8 riskTolerance,
    //     IERC20 underlying,
    //     address[] _strategies,
    //     uint256[] proportions
    // );
    event VaultCreated(address vault, address[] strategies);
    event StrategyAdded(address strategy);
    event StrategyRemoved(address strategy);
    event FeeChanged(uint96 previous, uint96 next);
    event ControllerInitialized(address spool, address vaultFactory);
}
