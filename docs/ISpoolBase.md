# ISpoolBase









## Methods

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

### isMidReallocation

```solidity
function isMidReallocation() external view returns (bool)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined



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



