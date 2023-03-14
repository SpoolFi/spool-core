// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.11;

import "../../curve/base/CurveStrategy2CoinsBase.sol";
import "../MultipleRewardStrategy.sol";

import "../../../external/interfaces/convex/IBoosterV2.sol";
import "../../../external/interfaces/convex/IConvexRewardPool.sol";
import "../../../interfaces/IStrategyContractHelper.sol";

/**
 * @notice Convex strategy implementation (V2)
 */
contract ConvexShared2poolStrategyV2 is CurveStrategy2CoinsBase, MultipleRewardStrategy {
    using SafeERC20 for IERC20;

    /* ========== CONSTANT VARIABLES ========== */

    /// @notice There are 2 base reward tokens: CRV and CVX
    uint256 internal constant BASE_REWARDS_COUNT = 2;

    /* ========== STATE VARIABLES ========== */

    /// @notice Convex booster contract
    IBoosterV2 public immutable booster;
    /// @notice booster pool id
    uint256 public immutable pid;
    /// @notice Reward pool contract
    IConvexRewardPool public immutable crvRewards;
    /// @notice Reward token contract
    IERC20 public immutable rewardToken;
    /// @notice CVX token, reward token
    IERC20 public immutable cvxToken;
    /// @notice Booster helper contract
    IStrategyContractHelper public immutable boosterHelper;

    /* ========== CONSTRUCTOR ========== */


    /**
     * @notice Set initial values
     * @param _booster Booster contract
     * @param _boosterPoolId Booster pool id
     * @param _pool Stable swap pool contract
     * @param _lpToken LP token contract
     * @param _underlying Underlying asset
     * @param _boosterDeposit Strategy contract helper
     */
    constructor(
        IBoosterV2 _booster,
        uint256 _boosterPoolId,
        address _pool,
        IERC20 _lpToken,
        IERC20 _underlying,
        IStrategyContractHelper _boosterDeposit,
        address _self
    )
        BaseStrategy(_underlying, 0, 1, 1, 1, false, true, _self)
        CurveStrategyBaseV2(_pool, _lpToken)
        SwapHelper(Protocol.UNISWAP)
    {
        require(address(_booster) != address(0), "ConvexShared2poolStrategyV2::constructor: Booster address cannot be 0");
        booster = _booster;
        pid = _boosterPoolId;

        IBoosterV2.PoolInfo memory cvxPool = _booster.poolInfo(_boosterPoolId);

        require(cvxPool.lptoken == address(_lpToken), "ConvexShared2poolStrategyV2::constructor: Booster and curve lp tokens not the same");

        crvRewards = IConvexRewardPool(cvxPool.rewards);
        RewardType memory crvReward = crvRewards.rewards(0);
        RewardType memory cvxReward = crvRewards.rewards(1);

        rewardToken = IERC20(crvReward.reward_token);
        cvxToken = IERC20(cvxReward.reward_token);

        boosterHelper = _boosterDeposit;
    }

    /* ========== VIEW FUNCTIONS ========== */

    function getStrategyPrice() public view override returns(uint128) {
        return _lpToCoin(ONE_LP_UNIT);
    }

    /* ========== OVERRIDDEN FUNCTIONS ========== */

    /**
     * @dev Dynamically return slippage length
     * @return Reward slippage slots
     */
    function _getRewardSlippageSlots() internal view override returns(uint256) {
        return _extraRewardsLength() + BASE_REWARDS_COUNT;
    }

    /**
     * @dev Transfers lp tokens to helper contract, to deposit them into booster
     */
    function _handleDeposit(uint256 lp) internal override {
        lpToken.safeTransfer(address(boosterHelper), lp);

        boosterHelper.deposit(lp);
    }

    /**
     * @dev Withdraw lp tokens from helper contract
     */
    function _handleWithdrawal(uint256 lp) internal override {

        boosterHelper.withdraw(lp);
    }

    /**
     * @dev Handle emergency withdrawal
     * @param data Values to perform emergency withdraw
     */
    function _handleEmergencyWithdrawal(address, uint256[] calldata data) internal override {
        // NOTE: withdrawAll removes all lp tokens from the liquidity gauge,
        //       including the tokens from the other strategies in the same pool
        uint256 value = data.length > 0 ? data[0] : 0;

        if (value == 0) {
            boosterHelper.withdraw(_lpBalance());
            strategies[self].lpTokens = 0;
        } else {
            (bool withdrawAll, uint256 lpTokens) = _getSlippageAction(value);

            if (withdrawAll) {
                boosterHelper.withdrawAll();
                strategies[self].lpTokens = 0;
            } else {
                boosterHelper.withdraw(lpTokens);

                if (lpTokens >= strategies[self].lpTokens) {
                    strategies[self].lpTokens = 0;
                } else {
                    strategies[self].lpTokens -= lpTokens;
                }
            }
        }
    }

    /**
     * @dev Claim multiple rewards
     * @param shares Shares to claim
     * @param swapData Swap slippage and path array
     * @return rewards array of claimed rewards
     */
    function _claimMultipleRewards(uint128 shares, SwapData[] calldata swapData) internal override returns(Reward[] memory rewards) {
        if (swapData.length > 0) {
            uint256 extraRewardCount = _extraRewardsLength();

            rewards = new Reward[](extraRewardCount + BASE_REWARDS_COUNT);

            address[] memory rewardTokens = _getRewardAddresses(extraRewardCount);
            _claimStrategyRewards(rewardTokens);

            Strategy storage strategy = strategies[self];
            for (uint256 i = 0; i < rewardTokens.length; i++) {

                if (swapData[i].slippage > 0) {
                    uint256 rewardTokenAmount = strategy.pendingRewards[rewardTokens[i]];

                    if (rewardTokenAmount > 0) {
                        uint256 claimedAmount = _getRewardClaimAmount(shares, rewardTokenAmount);

                        if (rewardTokenAmount > claimedAmount) {
                            // if we don't swap all the tokens (fast withdraw), store the amount left 
                            uint256 rewardAmountLeft = rewardTokenAmount - claimedAmount;
                            strategy.pendingRewards[rewardTokens[i]] = rewardAmountLeft;
                        } else {
                            strategy.pendingRewards[rewardTokens[i]] = 0;
                        }

                        rewards[i] = Reward(claimedAmount, IERC20(rewardTokens[i]));
                    }
                }
            }
        }
    }

    /* ========== PRIVATE FUNCTIONS ========== */

    /**
     * @dev Claim strategy rewards
     * @param rewardTokens Reward tokens
     */
    function _claimStrategyRewards(address[] memory rewardTokens) private {
        (
            uint256[] memory rewardTokenAmounts,
            bool didClaimNewRewards
        ) = boosterHelper.claimRewards(rewardTokens, true);

        if (didClaimNewRewards) {
            Strategy storage strategy = strategies[self];

            for(uint256 i = 0; i < rewardTokens.length; i++) {
                if (rewardTokenAmounts[i] > 0) {
                    strategy.pendingRewards[rewardTokens[i]] += rewardTokenAmounts[i];
                }
            }
        }
    }

    /**
     * @dev Get reward addresses
     * @param extraRewardCount Extra reward count
     * @return Reward addresses
     */
    function _getRewardAddresses(uint256 extraRewardCount) private view returns(address[] memory) {
        address[] memory rewardAddresses = new address[](extraRewardCount + BASE_REWARDS_COUNT);
        rewardAddresses[0] = address(rewardToken);
        rewardAddresses[1] = address(cvxToken);

        for (uint256 i = 0; i < extraRewardCount; i++) {
            uint index = i + BASE_REWARDS_COUNT;
            rewardAddresses[index] = crvRewards.rewards(index).reward_token;
        }

        return rewardAddresses;
    }

    function _extraRewardsLength() private view returns(uint256) {
        return crvRewards.rewardLength() - BASE_REWARDS_COUNT;
    }
}
