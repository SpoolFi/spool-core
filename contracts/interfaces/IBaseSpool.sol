// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IBaseSpool {
    /* ========== FUNCTIONS ========== */

    function redeem(address strat, uint256 index) external returns (uint128, uint128);

    function redeemUnderlying(uint128 amount) external;

    function redeemReallocation(address[] calldata vaultStrategies, uint256 depositProportions, uint256 index) external;

    function getVaultTotalUnderlyingAtIndex(address strat, uint256 index) external view returns(uint128);

    function getUnderlying(address strat) external returns (uint128);

    function getCompletedGlobalIndex() external view returns(uint24);

    function getActiveGlobalIndex() external view returns(uint24);

    function isMidReallocation() external view returns (bool);

    function addStrategy(address strat) external;

    function disableStrategy(address strategy, bool skipDisable) external;

    function runDisableStrategy(address strategy) external;

    function emergencyWithdraw(
        address strat,
        address withdrawRecipient,
        uint256[] calldata data
    ) external;

    /* ========== EVENTS ========== */

    event Worked(
        address indexed strategy
    );
    event DebtClaim(address vault, uint256 amount);
    event FeesDistributed(uint256 fees);
    event RewardBufferChanged(address strategy, uint256 buffer);
    event RewardConfigurationChanged(
        uint256 previousEpoch,
        uint256 previousReward,
        uint256 nextEpoch,
        uint256 nextReward
    );

    event DoHardWorkCompleted(uint256 indexed index);

    event ReallocationProportionsUpdated(
        uint256 indexed index,
        bytes32 reallocationTableHash
    );

    event ReallocationProportionsUpdatedWithTable(
        uint256 indexed index,
        bytes32 reallocationTableHash,
        uint256[][] reallocationProportions
    );
}
