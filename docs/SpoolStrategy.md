# SpoolStrategy





Spool part of implementation dealing with strategy related processing



## Methods

### addStrategy

```solidity
function addStrategy(address strat) external nonpayable
```

Adds and initializes a new strategy

*Requirements: - the caller must be the controller - reallcation must not be pending - strategy shouldn&#39;t be previously removed*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | undefined

### disableStrategy

```solidity
function disableStrategy(address strat, bool skipDisable) external nonpayable
```

Disables a strategy by liquidating all actively deployed funds within it to its underlying collateral.

*This function is invoked whenever a strategy is disabled at the controller level as an emergency. Requirements: - the caller must be the controller - the reallocation shouldn&#39;t be pending - strategy shouldn&#39;t be previously removed*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | strategy being disabled
| skipDisable | bool | flag to skip executing strategy specific disable function  NOTE: Should always be false, except if `IBaseStrategy.disable` is failing and there is no other way

### emergencyWithdraw

```solidity
function emergencyWithdraw(address strat, address withdrawRecipient, uint256[] data) external nonpayable
```

Liquidating all actively deployed funds within a strategy after it was disabled.

*Requirements: - the caller must be the controller - the strategy must be disabled - the strategy must be awaiting emergency withdraw*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | strategy being disabled
| withdrawRecipient | address | recipient of the withdrawn funds
| data | uint256[] | data to perform the withdrawal

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

### getStratUnderlying

```solidity
function getStratUnderlying(address strat) external nonpayable returns (uint128)
```

Returns total strategy underlying value.



#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined

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

### getUnderlying

```solidity
function getUnderlying(address strat) external nonpayable returns (uint128)
```

Returns the amount of funds the vault caller has in total deployed to a particular strategy.

*Although not set as a view function due to the delegatecall instructions performed by it, its value can be acquired without actually executing the function by both off-chain and on-chain code via simulating the transaction&#39;s execution.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | strategy address

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | amount

### getVaultTotalUnderlyingAtIndex

```solidity
function getVaultTotalUnderlyingAtIndex(address strat, uint256 index) external view returns (uint128)
```

Get total vault underlying at index.

*NOTE: Call ONLY if vault shares are correct for the index.       Meaning vault has just redeemed for this index or this is current index.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | strategy address
| index | uint256 | index in total underlying

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

### runDisableStrategy

```solidity
function runDisableStrategy(address strat) external nonpayable
```

Runs strategy specific disable function if it was skipped when disabling the strategy.



#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | undefined

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



