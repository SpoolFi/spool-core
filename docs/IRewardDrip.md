# IRewardDrip









## Methods

### getActiveRewards

```solidity
function getActiveRewards(address account) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined



## Events

### RewardAdded

```solidity
event RewardAdded(contract IERC20 token, uint256 reward)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| token  | contract IERC20 | undefined |
| reward  | uint256 | undefined |

### RewardPaid

```solidity
event RewardPaid(contract IERC20 token, address indexed user, uint256 reward)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| token  | contract IERC20 | undefined |
| user `indexed` | address | undefined |
| reward  | uint256 | undefined |

### RewardsDurationUpdated

```solidity
event RewardsDurationUpdated(contract IERC20 token, uint256 newDuration)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| token  | contract IERC20 | undefined |
| newDuration  | uint256 | undefined |

### TokenAdded

```solidity
event TokenAdded(contract IERC20 token)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| token  | contract IERC20 | undefined |



