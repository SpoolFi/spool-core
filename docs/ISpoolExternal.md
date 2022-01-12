# ISpoolExternal









## Methods

### deposit

```solidity
function deposit(address strategy, uint128 amount, uint256 index) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy | address | undefined
| amount | uint128 | undefined
| index | uint256 | undefined

### fastWithdrawStrat

```solidity
function fastWithdrawStrat(address strat, address underlying, uint256 shares, uint256[] slippages, SwapData[] swapData) external nonpayable returns (uint128)
```





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

### redeem

```solidity
function redeem(address strat, uint256 index) external nonpayable returns (uint128, uint128)
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
| _1 | uint128 | undefined

### redeemReallocation

```solidity
function redeemReallocation(address[] vaultStrategies, uint256 depositProportions, uint256 index) external nonpayable
```





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

### withdraw

```solidity
function withdraw(address strategy, uint256 vaultProportion, uint256 index) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy | address | undefined
| vaultProportion | uint256 | undefined
| index | uint256 | undefined




