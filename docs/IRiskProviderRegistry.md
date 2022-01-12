# IRiskProviderRegistry









## Methods

### getRisk

```solidity
function getRisk(address riskProvider, address strategy) external view returns (uint8)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| riskProvider | address | undefined
| strategy | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined

### getRisks

```solidity
function getRisks(address riskProvider, address[] strategies) external view returns (uint8[])
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| riskProvider | address | undefined
| strategies | address[] | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8[] | undefined

### isProvider

```solidity
function isProvider(address provider) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| provider | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined



## Events

### ProviderAdded

```solidity
event ProviderAdded(address provider)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| provider  | address | undefined |

### ProviderRemoved

```solidity
event ProviderRemoved(address provider)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| provider  | address | undefined |

### RiskAssessed

```solidity
event RiskAssessed(address indexed provider, address indexed strategy, uint8 riskScore)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| provider `indexed` | address | undefined |
| strategy `indexed` | address | undefined |
| riskScore  | uint8 | undefined |

### RiskProviderRegistryInitialized

```solidity
event RiskProviderRegistryInitialized(address feeHandler)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| feeHandler  | address | undefined |



