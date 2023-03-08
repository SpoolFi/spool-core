// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity 0.8.11;

interface IEToken {
  function allowance ( address holder, address spender ) external view returns ( uint256 );
  function approve ( address spender, uint256 amount ) external returns ( bool );
  function approveSubAccount ( uint256 subAccountId, address spender, uint256 amount ) external returns ( bool );
  function balanceOf ( address account ) external view returns ( uint256 );
  function balanceOfUnderlying ( address account ) external view returns ( uint256 );
  function burn ( uint256 subAccountId, uint256 amount ) external;
  function convertBalanceToUnderlying ( uint256 balance ) external view returns ( uint256 );
  function convertUnderlyingToBalance ( uint256 underlyingAmount ) external view returns ( uint256 );
  function decimals (  ) external pure returns ( uint8 );
  function deposit ( uint256 subAccountId, uint256 amount ) external;
  function donateToReserves ( uint256 subAccountId, uint256 amount ) external;
  function mint ( uint256 subAccountId, uint256 amount ) external;
  function moduleGitCommit (  ) external view returns ( bytes32 );
  function moduleId (  ) external view returns ( uint256 );
  function name (  ) external view returns ( string memory );
  function reserveBalance (  ) external view returns ( uint256 );
  function reserveBalanceUnderlying (  ) external view returns ( uint256 );
  function symbol (  ) external view returns ( string memory );
  function totalSupply (  ) external view returns ( uint256 );
  function totalSupplyUnderlying (  ) external view returns ( uint256 );
  function touch (  ) external;
  function transfer ( address to, uint256 amount ) external returns ( bool );
  function transferFrom ( address from, address to, uint256 amount ) external returns ( bool );
  function transferFromMax ( address from, address to ) external returns ( bool );
  function underlyingAsset (  ) external view returns ( address );
  function withdraw ( uint256 subAccountId, uint256 amount ) external;
}

