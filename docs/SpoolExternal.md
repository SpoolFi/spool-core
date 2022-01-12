# SpoolExternal





Exposes spool functions to set and redeem actions.

*Most of the functions are restricted to vaults. The action is recorded in the buffer system and is processed at the next do hard work. A user cannot interact with any of the Spool functions directly. Complete interaction with Spool consists of 4 steps 1. deposit 2. redeem shares 3. withdraw 4. redeem underlying asset Redeems (step 2. and 4.) are done at the same time. Redeem is processed automatically on first vault interaction after the DHW is completed. As the system works asynchronously, between every step a do hard work needs to be executed. The shares and actual withdrawn amount are only calculated at the time of action (DHW). *

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

### batchDoHardWork

```solidity
function batchDoHardWork(uint256[] stratIndexes, uint256[][] slippages, RewardSlippages[] rewardSlippages, address[] allStrategies) external nonpayable
```

Executes do hard work of specified strategies. 

*Requirements: - caller must be a valid do hard worker - provided strategies must be valid - reallocation is not pending for current index - at least one sttrategy must be processed*

#### Parameters

| Name | Type | Description |
|---|---|---|
| stratIndexes | uint256[] | undefined
| slippages | uint256[][] | undefined
| rewardSlippages | RewardSlippages[] | undefined
| allStrategies | address[] | undefined

### batchDoHardWorkReallocation

```solidity
function batchDoHardWorkReallocation(ReallocationWithdrawData withdrawData, ReallocationData depositData, address[] allStrategies, bool isOneTransaction) external nonpayable
```

Executes do hard work of specified strategies if reallocation is in progress. 

*Requirements: - caller must be a valid do hard worker - provided strategies must be valid - reallocation is pending for current index - at least one strategy must be processed*

#### Parameters

| Name | Type | Description |
|---|---|---|
| withdrawData | ReallocationWithdrawData | undefined
| depositData | ReallocationData | undefined
| allStrategies | address[] | undefined
| isOneTransaction | bool | undefined

### deposit

```solidity
function deposit(address strat, uint128 amount, uint256 index) external nonpayable
```

Allows a vault to queue a deposit to a single-collateral strategy.

*Requirements: - the caller must be a vault - strategy shouldn&#39;t be removed*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | undefined
| amount | uint128 | undefined
| index | uint256 | undefined

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

### fastWithdrawStrat

```solidity
function fastWithdrawStrat(address strat, address underlying, uint256 shares, uint256[] slippages, SwapData[] swapData) external nonpayable returns (uint128)
```

Fast withdtaw from a strategy.

*Performs immediate withdrawal executing strategy protocol functions directly. Can be very gas expensive, especially if executing it for multiple strategies. Requirements: - the caller must be a fast withdraw contract - strategy shouldn&#39;t be removed*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | undefined
| underlying | address | undefined
| shares | uint256 | undefined
| slippages | uint256[] | undefined
| swapData | SwapData[] | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined

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

### reallocateVaults

```solidity
function reallocateVaults(VaultData[] vaults, address[] strategies, uint256[][] reallocationProportions) external nonpayable
```

Set vaults to reallocate on next do hard work



#### Parameters

| Name | Type | Description |
|---|---|---|
| vaults | VaultData[] | undefined
| strategies | address[] | undefined
| reallocationProportions | uint256[][] | undefined

### reallocationIndex

```solidity
function reallocationIndex() external view returns (uint24)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint24 | undefined

### redeem

```solidity
function redeem(address strat, uint256 index) external nonpayable returns (uint128, uint128)
```

Allows a vault to redeem deposit and withdrawals for the processed index. Requirements: - the caller must be a valid vault



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

Redeem vault shares after vault reallocation has been performed



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

### removeShares

```solidity
function removeShares(address[] vaultStrategies, uint256 vaultProportion) external nonpayable returns (uint128[])
```

Remove vault shares.

*Requirements: - can only be called by the vault*

#### Parameters

| Name | Type | Description |
|---|---|---|
| vaultStrategies | address[] | undefined
| vaultProportion | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128[] | undefined

### removeSharesDuringVaultReallocation

```solidity
function removeSharesDuringVaultReallocation(ISpoolExternal.VaultWithdraw vaultWithdraw, ISpoolExternal.FastWithdrawalReallocation reallocation, uint256[][] reallocationProportions) external nonpayable returns (uint128[])
```

Remove vault shares while vault reallocation is pending.

*Requirements: - can only be called by the vault*

#### Parameters

| Name | Type | Description |
|---|---|---|
| vaultWithdraw | ISpoolExternal.VaultWithdraw | undefined
| reallocation | ISpoolExternal.FastWithdrawalReallocation | undefined
| reallocationProportions | uint256[][] | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128[] | undefined

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

### withdraw

```solidity
function withdraw(address strat, uint256 vaultProportion, uint256 index) external nonpayable
```

Allows a vault to queue a withdrawal from a strategy.

*Requirements: - the caller must be a vault - strategy shouldn&#39;t be removed*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strat | address | undefined
| vaultProportion | uint256 | undefined
| index | uint256 | undefined

### withdrawalDoHardWorksLeft

```solidity
function withdrawalDoHardWorksLeft() external view returns (uint8)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined



## Events

### DoHardWorkCompleted

```solidity
event DoHardWorkCompleted(uint256 indexed index)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| index `indexed` | uint256 | undefined |

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

### Worked

```solidity
event Worked(address indexed strategy)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy `indexed` | address | undefined |



