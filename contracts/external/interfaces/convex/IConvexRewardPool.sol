// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../../../external/@openzeppelin/token/ERC20/IERC20.sol";

struct RewardType {
    address reward_token;
    uint128 reward_integral;
    uint128 reward_remaining;
}

interface IConvexRewardPool {
    function rewards(uint256) external view returns (RewardType memory);

    function getReward(address) external;

    function rewardLength() external view returns (uint256);

    function extraRewards(uint256 i) external view returns (address);

    function balanceOf(address account) external view returns (uint256);

    function withdraw(uint256 amount, bool claim) external returns(bool);

    function withdrawAll(bool claim) external;
}
