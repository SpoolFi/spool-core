// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

import "../external/@openzeppelin/token/ERC20/IERC20.sol";

interface IFeeHandler {
    function payFees(
        IERC20 underlying,
        uint256 profit,
        address riskProvider,
        address vaultOwner,
        uint16 vaultFee
    ) external returns (uint256 feesPaid);

    function setRiskProviderFee(address riskProvider, uint16 fee) external;
}
