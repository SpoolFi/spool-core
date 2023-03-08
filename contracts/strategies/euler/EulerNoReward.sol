// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.11;

import "../../external/@openzeppelin/token/ERC20/utils/SafeERC20.sol";
import "../NoRewardStrategy.sol";
import "../../external/interfaces/euler/IEToken.sol";

/**
 * @notice Euler without rewards Strategy implementation
 */
contract EulerNoReward is NoRewardStrategy {
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    /// @notice Euler main contract
    address public immutable euler;

    /// @notice Euler token for this underlying
    IEToken public immutable eToken;

    /* ========== CONSTRUCTOR ========== */

    /**
     * @notice Set initial values
     * @param _euler Euler main contract
     * @param _eToken Euler token contract for underlying
     * @param _underlying Underlying asset
     */
    constructor(
        address _euler,
        IEToken _eToken,
        IERC20 _underlying,
        address _self
    )
        NoRewardStrategy(_underlying, 1, 1, 1, false, _self)
    {
        require(address(_euler) != address(0), "EulerNoReward::constructor: Euler address cannot be 0");
        require(_eToken.underlyingAsset() == address(underlying), "EulerNoReward::constructor: Underlying mismatch");

        euler = _euler;
        eToken = _eToken;
    }

    /* ========== VIEWS ========== */

    /**
     * @notice Get strategy balance
     * @return Strategy balance
     */
    function getStrategyBalance() public view override returns(uint128) {
        uint eTokenAmount = eToken.balanceOf(address(this));
        return SafeCast.toUint128(_getEulerTokenValue(eTokenAmount));
    }

    /* ========== OVERRIDDEN FUNCTIONS ========== */

    /**
     * @notice Deposit
     * @param amount Amount to deposit
     * @param slippages Slippages array
     * @return Minted eToken amount in underlying
     */
    function _deposit(uint128 amount, uint256[] memory slippages) internal override returns(uint128) {
        (bool isDeposit, uint256 slippage) = _getSlippageAction(slippages[0]);
        require(isDeposit, "EulerNoReward::_deposit: Withdraw slippage provided");

        // deposit underlying
        underlying.safeApprove(euler, amount);

        uint256 eTokenTokenBefore = eToken.balanceOf(address(this));
        eToken.deposit(0, amount);
        uint256 eTokenNew = eToken.balanceOf(address(this)) - eTokenTokenBefore;
        _resetAllowance(underlying, euler);

        require(
            eTokenNew >= slippage,
            "EulerNoReward::_deposit: Insufficient eToken Amount Minted"
        );

        emit Slippage(self, underlying, true, amount, eTokenNew);
        
        return SafeCast.toUint128(_getEulerTokenValue(eTokenNew));
    }

    /**
     * @notice Withdraw
     * @param shares Shares to withdraw
     * @param slippages Slippages array
     * @return Underlying withdrawn
     */
    function _withdraw(uint128 shares, uint256[] memory slippages) internal override returns(uint128) {
        (bool isDeposit, uint256 slippage) = _getSlippageAction(slippages[0]);
        require(!isDeposit, "EulerNoReward::_withdraw: Deposit slippage provided");

        uint256 underlyingValue = eToken.balanceOfUnderlying(address(this));
        uint256 underlyingWithdraw = (underlyingValue * shares) / strategies[self].totalShares;

        // withdraw  underlying from vault
        uint256 underlyingBefore = underlying.balanceOf(address(this));
        eToken.withdraw(0, underlyingWithdraw);
        uint256 underlyingWithdrawn = underlying.balanceOf(address(this)) - underlyingBefore;

        require(
            underlyingWithdrawn >= slippage,
            "EulerNoReward::_withdraw: Insufficient withdrawn amount"
        );
        
        emit Slippage(self, underlying, false, shares, underlyingWithdrawn);

        return SafeCast.toUint128(underlyingWithdrawn);
    }

    /**
     * @notice Emergency withdraw
     * @param recipient Address to withdraw to
     */
    function _emergencyWithdraw(address recipient, uint256[] calldata) internal override {
        uint256 underlyingBefore = underlying.balanceOf(address(this));
        eToken.withdraw(0, type(uint256).max);
        uint256 underlyingWithdrawn = underlying.balanceOf(address(this)) - underlyingBefore;
        underlying.safeTransfer(recipient, underlyingWithdrawn);
    }

    /* ========== PRIVATE FUNCTIONS ========== */

    function _getEulerTokenValue(uint256 eTokenTokenAmount) private view returns(uint256) {
        if (eTokenTokenAmount == 0)
            return 0;
        return eToken.convertBalanceToUnderlying(eTokenTokenAmount);
    }
}
