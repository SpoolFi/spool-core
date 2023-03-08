// SPDX-License-Identifier: MIT

import "../../@openzeppelin/token/ERC20/IERC20.sol";

pragma solidity 0.8.11;

interface IStakingRewards {
  function acceptOwnership() external;
  function balanceOf(address account) external view returns(uint256);
  function earned(address account) external view returns(uint256);
  function exit(uint256 subAccountId) external;
  function exit() external;
  function getReward() external;
  function getRewardForDuration() external view returns(uint256);
  function lastPauseTime() external view returns(uint256);
  function lastTimeRewardApplicable() external view returns(uint256);
  function lastUpdateTime() external view returns(uint256);
  function nominateNewOwner(address _owner) external;
  function nominatedOwner() external view returns(address);
  function notifyRewardAmount(uint256 reward) external;
  function owner() external view returns(address);
  function paused() external view returns(bool);
  function periodFinish() external view returns(uint256);
  function recoverERC20(address tokenAddress, uint256 tokenAmount) external;
  function rewardPerToken() external view returns(uint256);
  function rewardPerTokenStored() external view returns(uint256);
  function rewardRate() external view returns(uint256);
  function rewards(address) external view returns(uint256);
  function rewardsDistribution() external view returns(address);
  function rewardsDuration() external view returns(uint256);
  function rewardsToken() external view returns(IERC20);
  function setPaused(bool _paused) external;
  function setRewardsDistribution(address _rewardsDistribution) external;
  function setRewardsDuration(uint256 _rewardsDuration) external;
  function stake(uint256 subAccountId, uint256 amount) external;
  function stake(uint256 amount) external;
  function stakingToken() external view returns(address);
  function totalSupply() external view returns(uint256);
  function userRewardPerTokenPaid(address) external view returns(uint256);
  function withdraw(uint256 amount) external;
  function withdraw(uint256 subAccountId, uint256 amount) external;
}

