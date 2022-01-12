# IBaseSpool









## Methods

### addStrategy

```solidity
function addStrategy(address strat) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | undefined

### disableStrategy

```solidity
function disableStrategy(address strategy, bool skipDisable) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy | address | undefined
| skipDisable | bool | undefined

### emergencyWithdraw

```solidity
function emergencyWithdraw(address strat, address withdrawRecipient, uint256[] data) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | undefined
| withdrawRecipient | address | undefined
| data | uint256[] | undefined

### getActiveGlobalIndex

```solidity
function getActiveGlobalIndex() external view returns (uint24)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint24 | undefined

### getCompletedGlobalIndex

```solidity
function getCompletedGlobalIndex() external view returns (uint24)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint24 | undefined

### getUnderlying

```solidity
function getUnderlying(address strat) external nonpayable returns (uint128)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined

### getVaultTotalUnderlyingAtIndex

```solidity
function getVaultTotalUnderlyingAtIndex(address strat, uint256 index) external view returns (uint128)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | undefined
| index | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined

### isMidReallocation

```solidity
function isMidReallocation() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### redeem

```solidity
function redeem(address strat, uint256 index) external nonpayable returns (uint128, uint128)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | undefined
| index | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined
| _1 | uint128 | undefined

### redeemReallocation

```solidity
function redeemReallocation(address[] vaultStrategies, uint256 depositProportions, uint256 index) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| vaultStrategies | address[] | undefined
| depositProportions | uint256 | undefined
| index | uint256 | undefined

### redeemUnderlying

```solidity
function redeemUnderlying(uint128 amount) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| amount | uint128 | undefined

### runDisableStrategy

```solidity
function runDisableStrategy(address strategy) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy | address | undefined



## Events

### DebtClaim

```solidity
event DebtClaim(address vault, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| vault  | address | undefined |
| amount  | uint256 | undefined |

### DoHardWorkCompleted

```solidity
event DoHardWorkCompleted(uint256 indexed index)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| index `indexed` | uint256 | undefined |

### FeesDistributed

```solidity
event FeesDistributed(uint256 fees)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| fees  | uint256 | undefined |

### ReallocationProportionsUpdated

```solidity
event ReallocationProportionsUpdated(uint256 indexed index, bytes32 reallocationTableHash)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| index `indexed` | uint256 | undefined |
| reallocationTableHash  | bytes32 | undefined |

### ReallocationProportionsUpdatedWithTable

```solidity
event ReallocationProportionsUpdatedWithTable(uint256 indexed index, bytes32 reallocationTableHash, uint256[][] reallocationProportions)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| index `indexed` | uint256 | undefined |
| reallocationTableHash  | bytes32 | undefined |
| reallocationProportions  | uint256[][] | undefined |

### RewardBufferChanged

```solidity
event RewardBufferChanged(address strategy, uint256 buffer)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy  | address | undefined |
| buffer  | uint256 | undefined |

### RewardConfigurationChanged

```solidity
event RewardConfigurationChanged(uint256 previousEpoch, uint256 previousReward, uint256 nextEpoch, uint256 nextReward)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousEpoch  | uint256 | undefined |
| previousReward  | uint256 | undefined |
| nextEpoch  | uint256 | undefined |
| nextReward  | uint256 | undefined |

### Worked

```solidity
event Worked(address indexed strategy)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy `indexed` | address | undefined |



