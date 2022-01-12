# AaveStrategy









## Methods

### aToken

```solidity
function aToken() external view returns (contract IAToken)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IAToken | undefined

### claimRewards

```solidity
function claimRewards(SwapData[] swapData) external nonpayable
```

Claims and possibly compounds strategy rewards.



#### Parameters

| Name | Type | Description |
|---|---|---|
| swapData | SwapData[] | swap data for processing

### disable

```solidity
function disable() external nonpayable
```

Disables a strategy.

*Cleans strategy specific values if needed.*


### emergencyWithdraw

```solidity
function emergencyWithdraw(address recipient, uint256[] data) external nonpayable
```

Withdraws all actively deployed funds in the strategy, liquifying them in the process.



#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient | address | recipient of the withdrawn funds
| data | uint256[] | data necessary execute the emergency withdraw

### fastWithdraw

```solidity
function fastWithdraw(uint128 shares, uint256[] slippages, SwapData[] swapData) external nonpayable returns (uint128)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| shares | uint128 | undefined
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

### getStrategyBalance

```solidity
function getStrategyBalance() external view returns (uint128)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined

### getStrategyUnderlyingWithRewards

```solidity
function getStrategyUnderlyingWithRewards() external view returns (uint128)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined

### incentive

```solidity
function incentive() external view returns (contract IAaveIncentivesController)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IAaveIncentivesController | undefined

### initialize

```solidity
function initialize() external nonpayable
```

Initialize a strategy.

*Execute strategy specific one-time actions if needed.*


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

### process

```solidity
function process(uint256[] slippages, bool redeposit, SwapData[] swapData) external nonpayable
```

Process the latest pending action of the strategy

*it yields amount of funds processed as well as the reward buffer of the strategy. The function will auto-compound rewards if requested and supported. Requirements: - the slippages provided must be valid in length - if the redeposit flag is set to true, the strategy must support   compounding of rewards*

#### Parameters

| Name | Type | Description |
|---|---|---|
| slippages | uint256[] | slippages to process
| redeposit | bool | if redepositing is to occur
| swapData | SwapData[] | swap data for processing

### processDeposit

```solidity
function processDeposit(uint256[] slippages) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| slippages | uint256[] | undefined

### processReallocation

```solidity
function processReallocation(uint256[] slippages, ProcessReallocationData processReallocationData) external nonpayable returns (uint128)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| slippages | uint256[] | undefined
| processReallocationData | ProcessReallocationData | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined

### provider

```solidity
function provider() external view returns (contract ILendingPoolAddressesProvider)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract ILendingPoolAddressesProvider | undefined

### reallocationIndex

```solidity
function reallocationIndex() external view returns (uint24)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint24 | undefined

### stkAave

```solidity
function stkAave() external view returns (contract IERC20)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined

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

### underlying

```solidity
function underlying() external view returns (contract IERC20)
```

The underlying asset of the strategy




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined

### withdrawalDoHardWorksLeft

```solidity
function withdrawalDoHardWorksLeft() external view returns (uint8)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined




