// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IBoosterV2 {
    struct PoolInfo {
        address lptoken;
        address gauge;
        address rewards;
        bool shutdown;
        address factory;
    }

    function poolLength() external view returns (uint256);

    function poolInfo(uint256 i) external view returns (PoolInfo memory);

    function deposit(uint256 pid, uint256 lp) external;

    function withdrawTo(uint256 pid, uint256 lp, address to) external;
}
