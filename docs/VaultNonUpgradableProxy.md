# VaultNonUpgradableProxy





This contract is a non-upgradable proxy for Spool vault implementation.

*It is used to lower the gas cost of vault creation. The contract holds vault specific immutable variables.*

## Methods

### riskProvider

```solidity
function riskProvider() external view returns (address)
```

Vault risk provider address




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### riskTolerance

```solidity
function riskTolerance() external view returns (int8)
```

A number from -10 to 10 indicating the risk tolerance of the vault




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int8 | undefined

### underlying

```solidity
function underlying() external view returns (contract IERC20)
```

Vault underlying asset




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined

### vaultImplementation

```solidity
function vaultImplementation() external view returns (address)
```

The address of vault implementation




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined




