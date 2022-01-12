// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../../external/@openzeppelin/token/ERC20/IERC20.sol";

interface IRewardDrip {
    /* ========== STRUCTS ========== */

    // The reward configuration struct, containing all the necessary data of a typical Synthetix StakingReward contract
    struct RewardConfiguration {
        uint32 rewardsDuration;
        uint32 periodFinish;
        uint192 rewardRate; // rewards per second multiplied by accuracy
        uint32 lastUpdateTime;
        uint224 rewardPerTokenStored;
        mapping(address => uint256) userRewardPerTokenPaid;
        mapping(address => uint256) rewards;
    }

    /* ========== FUNCTIONS ========== */

    function getActiveRewards(address account) external;

    /* ========== EVENTS ========== */
    
    event TokenAdded(IERC20 token);
    event RewardAdded(IERC20 token, uint256 reward);
    event RewardPaid(IERC20 token, address indexed user, uint256 reward);
    event RewardsDurationUpdated(IERC20 token, uint256 newDuration);
}
