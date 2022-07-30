// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;

interface IMorphoStrategy {
  function MANTISSA () external view returns ( uint256 );
  function cToken () external view returns ( address );
  function getStrategyBalance () external view returns ( uint128 );
  function morpho () external view returns ( address );
  function strategyHelper () external view returns ( address );
  function underlying () external view returns ( address );
}
