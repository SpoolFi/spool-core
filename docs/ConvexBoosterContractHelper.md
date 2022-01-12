# ConvexBoosterContractHelper









## Methods

### booster

```solidity
function booster() external view returns (contract IBooster)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IBooster | undefined

### claimRewards

```solidity
function claimRewards(address[] rewardTokens, bool executeClaim) external nonpayable returns (uint256[] rewardTokenAmounts, bool didClaimNewRewards)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| rewardTokens | address[] | undefined
| executeClaim | bool | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| rewardTokenAmounts | uint256[] | undefined
| didClaimNewRewards | bool | undefined

### crvRewards

```solidity
function crvRewards() external view returns (contract IBaseRewardPool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IBaseRewardPool | undefined

### deposit

```solidity
function deposit(uint256 lp) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| lp | uint256 | undefined

### lpToken

```solidity
function lpToken() external view returns (contract IERC20)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined

### pid

```solidity
function pid() external view returns (uint256)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### spool

```solidity
function spool() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### withdraw

```solidity
function withdraw(uint256 lp) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| lp | uint256 | undefined

### withdrawAll

```solidity
function withdrawAll() external nonpayable
```









