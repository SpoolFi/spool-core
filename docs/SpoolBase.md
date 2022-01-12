# SpoolBase





Implementation of the {ISpoolBase} interface.

*This implementation acts as the central code execution point of the Spool system and is responsible for maintaining the balance sheet of each vault based on the asynchronous deposit and withdraw system, redeeming vault shares and withdrawals and performing doHardWork.*

## Methods

### forceOneTxDoHardWork

```solidity
function forceOneTxDoHardWork() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### getActiveGlobalIndex

```solidity
function getActiveGlobalIndex() external view returns (uint24)
```

Returns next possible index to interact with




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint24 | undefined

### getCompletedGlobalIndex

```solidity
function getCompletedGlobalIndex() external view returns (uint24)
```

Retruns completed index (all strategies in the do hard work have been processed)




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint24 | undefined

### getStratVaultShares

```solidity
function getStratVaultShares(address strat, address vault) external view returns (uint128)
```

Returns strategy shares belonging to a vauld



#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | undefined
| vault | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined

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

### isMidReallocation

```solidity
function isMidReallocation() external view returns (bool _isMidReallocation)
```

Returns whether spool is mid reallocation




#### Returns

| Name | Type | Description |
|---|---|---|
| _isMidReallocation | bool | undefined

### reallocationIndex

```solidity
function reallocationIndex() external view returns (uint24)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint24 | undefined

### setAllocationProvider

```solidity
function setAllocationProvider(address user, bool _isAllocationProvider) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user | address | undefined
| _isAllocationProvider | bool | undefined

### setAwaitingEmergencyWithdraw

```solidity
function setAwaitingEmergencyWithdraw(address strat, bool isAwaiting) external nonpayable
```

Set awaiting emergency withdraw flag for the strategy.

*Only for emergency case where withdrawing the first time doesn&#39;t fully work. Requirements: - the caller must be the Spool owner (Spool DAO)*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | strategy to set
| isAwaiting | bool | undefined

### setDoHardWorker

```solidity
function setDoHardWorker(address user, bool _isDoHardWorker) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| user | address | undefined
| _isDoHardWorker | bool | undefined

### setForceOneTxDoHardWork

```solidity
function setForceOneTxDoHardWork(bool doForce) external nonpayable
```

Set the flag to force do hard work to be executed in one transaction.



#### Parameters

| Name | Type | Description |
|---|---|---|
| doForce | bool | undefined

### setLogReallocationProportions

```solidity
function setLogReallocationProportions(bool doLog) external nonpayable
```

Set the flag to log reallocation proportions on change. NOTE: Used for offchain execution to get the new reallocation table.



#### Parameters

| Name | Type | Description |
|---|---|---|
| doLog | bool | undefined

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



## Events

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



