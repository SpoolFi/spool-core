
// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IEulerStrategy {
    function eToken() external view returns (address);
    function euler() external view returns (address);
    function getStrategyBalance() external view returns (uint128);
    function underlying() external view returns (address);
}
