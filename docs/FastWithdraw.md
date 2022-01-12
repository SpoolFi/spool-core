# FastWithdraw





Implementation of the {IFastWithdraw} interface.

*The Fast Withdraw contract implements the logic to withdraw user shares without the need to wait for the do hard work function in Spool to be executed. The vault maps strategy shares to users, so the user can claim them any at time. Performance fee is still paid to the vault where the shares where initially taken from.*

## Methods

### controller

```solidity
function controller() external view returns (contract IController)
```

controller contract




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IController | undefined

### feeHandler

```solidity
function feeHandler() external view returns (address)
```

fee handler contracts, to manage the risk provider fees




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### getUserVaultWithdraw

```solidity
function getUserVaultWithdraw(address user, contract IVault vault, address[] strategies) external view returns (uint256 proportionateDeposit, uint256[] strategyShares)
```

get proportionate deposit and strategy shares for a user in vault 



#### Parameters

| Name | Type | Description |
|---|---|---|
| user | address | user address
| vault | contract IVault | vault address
| strategies | address[] | chosen strategies from selected vault

#### Returns

| Name | Type | Description |
|---|---|---|
| proportionateDeposit | uint256 | undefined
| strategyShares | uint256[] | undefined

### spool

```solidity
function spool() external view returns (contract ISpool)
```

The Spool implementation




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract ISpool | undefined

### transferShares

```solidity
function transferShares(address[] vaultStrategies, uint128[] sharesWithdrawn, uint256 proportionateDeposit, address user, FastWithdrawParams fastWithdrawParams) external nonpayable
```

Set user-strategy shares, previously owned by the vault.

*Requirements: - Can only be called by a vault.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| vaultStrategies | address[] | strategies from calling vault
| sharesWithdrawn | uint128[] | shares removed from the vault 
| proportionateDeposit | uint256 | used to know how much fees to pay
| user | address | caller of withdrawFast function in the vault
| fastWithdrawParams | FastWithdrawParams | parameters on how to execute fast withdraw

### withdraw

```solidity
function withdraw(contract IVault vault, address[] strategies, uint256[][] slippages, SwapData[][] swapData) external nonpayable
```

Fast withdraw user shares for a vault.

*Called after `transferShares` has been called by the vault and the user has      transfered the shares from vault to FastWithdraw contracts. Now user can execute      withdraw manually for strategies that belonged to the vault at any time immidiately.      When withdrawn, performance fees are paid to the vault at the same rate as standar witdraw.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| vault | contract IVault | Vault where fees are paid at withdraw
| strategies | address[] | Array of strategy addresses to fast withdraw from
| slippages | uint256[][] | Array of slippage parameters to apply when withdrawing
| swapData | SwapData[][] | Array containig data to swap unclaimed strategy reward tokens for underlying asset




