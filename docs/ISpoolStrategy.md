# ISpoolStrategy









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

### runDisableStrategy

```solidity
function runDisableStrategy(address strategy) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy | address | undefined




