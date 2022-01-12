// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IFundsTransfer {
    function transferToSpool(
        address transferFrom,
        uint256 amount
    ) external;
}
