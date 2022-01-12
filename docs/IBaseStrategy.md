# IBaseStrategy









## Methods

### claimRewards

```solidity
function claimRewards(SwapData[]) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | SwapData[] | undefined

### disable

```solidity
function disable() external nonpayable
```






### emergencyWithdraw

```solidity
function emergencyWithdraw(address recipient, uint256[] data) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| recipient | address | undefined
| data | uint256[] | undefined

### fastWithdraw

```solidity
function fastWithdraw(uint128, uint256[], SwapData[]) external nonpayable returns (uint128)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined
| _1 | uint256[] | undefined
| _2 | SwapData[] | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined

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

### initialize

```solidity
function initialize() external nonpayable
```






### process

```solidity
function process(uint256[], bool, SwapData[]) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256[] | undefined
| _1 | bool | undefined
| _2 | SwapData[] | undefined

### processDeposit

```solidity
function processDeposit(uint256[]) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256[] | undefined

### processReallocation

```solidity
function processReallocation(uint256[], ProcessReallocationData) external nonpayable returns (uint128)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256[] | undefined
| _1 | ProcessReallocationData | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined

### underlying

```solidity
function underlying() external view returns (contract IERC20)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined




