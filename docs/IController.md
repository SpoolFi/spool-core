# IController









## Methods

### getAllStrategies

```solidity
function getAllStrategies() external view returns (address[])
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address[] | undefined

### getStrategiesCount

```solidity
function getStrategiesCount() external view returns (uint8)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined

### strategies

```solidity
function strategies(uint256 i) external view returns (address)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| i | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### supportedUnderlying

```solidity
function supportedUnderlying(contract IERC20 underlying) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| underlying | contract IERC20 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### validStrategy

```solidity
function validStrategy(address strategy) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### validVault

```solidity
function validVault(address vault) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| vault | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### verifyStrategies

```solidity
function verifyStrategies(address[] _strategies) external view
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _strategies | address[] | undefined



## Events

### ControllerInitialized

```solidity
event ControllerInitialized(address spool, address vaultFactory)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| spool  | address | undefined |
| vaultFactory  | address | undefined |

### FeeChanged

```solidity
event FeeChanged(uint96 previous, uint96 next)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previous  | uint96 | undefined |
| next  | uint96 | undefined |

### StrategyAdded

```solidity
event StrategyAdded(address strategy)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy  | address | undefined |

### StrategyRemoved

```solidity
event StrategyRemoved(address strategy)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy  | address | undefined |

### VaultCreated

```solidity
event VaultCreated(address vault, address[] strategies)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| vault  | address | undefined |
| strategies  | address[] | undefined |



