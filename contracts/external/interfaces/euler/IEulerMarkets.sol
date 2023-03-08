// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity 0.8.11;

struct AssetConfig {
    // Packed slot: 20 + 1 + 4 + 4 + 3 = 32
    address eTokenAddress;
    bool borrowIsolated;
    uint32 collateralFactor;
    uint32 borrowFactor;
    uint24 twapWindow;
}

interface IEulerMarkets {
  function activateMarket ( address underlying ) external returns ( address );
  function activatePToken ( address underlying ) external returns ( address );
  function eTokenToDToken ( address eToken ) external view returns ( address dTokenAddr );
  function eTokenToUnderlying ( address eToken ) external view returns ( address underlying );
  function enterMarket ( uint256 subAccountId, address newMarket ) external;
  function exitMarket ( uint256 subAccountId, address oldMarket ) external;
  function getEnteredMarkets ( address account ) external view returns ( address[] memory );
  function getPricingConfig ( address underlying ) external view returns ( uint16 pricingType, uint32 pricingParameters, address pricingForwarded );
  function interestAccumulator ( address underlying ) external view returns ( uint256 );
  function interestRate ( address underlying ) external view returns ( int96 );
  function interestRateModel ( address underlying ) external view returns ( uint256 );
  function moduleGitCommit (  ) external view returns ( bytes32 );
  function moduleId (  ) external view returns ( uint256 );
  function reserveFee ( address underlying ) external view returns ( uint32 );
  function underlyingToAssetConfig ( address underlying ) external view returns ( AssetConfig memory );
  function underlyingToAssetConfigUnresolved ( address underlying ) external view returns ( AssetConfig memory config );
  function underlyingToDToken ( address underlying ) external view returns ( address );
  function underlyingToEToken ( address underlying ) external view returns ( address );
  function underlyingToPToken ( address underlying ) external view returns ( address );
}

