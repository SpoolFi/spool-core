// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.11;

interface IIdleStrategy {
  function disable (  ) external;
  function emergencyWithdraw ( address recipient, uint256[] memory data ) external;
  function getStrategyBalance (  ) external view returns ( uint128 );
  function getStrategyUnderlyingWithRewards (  ) external view returns ( uint128 );
  function globalIndex (  ) external view returns ( uint24 );
  function idleToken (  ) external view returns ( address );
  function initialize (  ) external;
  function isAllocationProvider ( address ) external view returns ( bool );
  function isDoHardWorker ( address ) external view returns ( bool );
  function oneShare (  ) external view returns ( uint256 );
  function processDeposit ( uint256[] memory slippages ) external;
  function reallocationIndex (  ) external view returns ( uint24 );
  function underlying (  ) external view returns ( address );
  function withdrawalDoHardWorksLeft (  ) external view returns ( uint8 );
}
