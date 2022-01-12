# BaseStorage









## Methods

### forceOneTxDoHardWork

```solidity
function forceOneTxDoHardWork() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### isAllocationProvider

```solidity
function isAllocationProvider(address) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### isDoHardWorker

```solidity
function isDoHardWorker(address) external view returns (bool)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### reallocationIndex

```solidity
function reallocationIndex() external view returns (uint24)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint24 | undefined

### strategies

```solidity
function strategies(address) external view returns (uint128 totalShares, uint24 index, bool isRemoved, struct Pending pendingUser, struct Pending pendingUserNext, uint128 pendingDepositReward, uint256 lpTokens, bool isInDepositPhase, uint128 optimizedSharesWithdrawn, uint128 pendingRedistributeDeposit, uint128 pendingRedistributeOptimizedDeposit, uint256 emergencyPending)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| totalShares | uint128 | undefined
| index | uint24 | undefined
| isRemoved | bool | undefined
| pendingUser | Pending | undefined
| pendingUserNext | Pending | undefined
| pendingDepositReward | uint128 | undefined
| lpTokens | uint256 | undefined
| isInDepositPhase | bool | undefined
| optimizedSharesWithdrawn | uint128 | undefined
| pendingRedistributeDeposit | uint128 | undefined
| pendingRedistributeOptimizedDeposit | uint128 | undefined
| emergencyPending | uint256 | undefined

### withdrawalDoHardWorksLeft

```solidity
function withdrawalDoHardWorksLeft() external view returns (uint8)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined




