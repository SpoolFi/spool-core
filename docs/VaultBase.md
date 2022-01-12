# VaultBase





Implementation of the {IVaultBase} interface.

*Vault base holds vault state variables and provides some of the common vault functions.*

## Methods

### lazyWithdrawnShares

```solidity
function lazyWithdrawnShares() external view returns (uint128)
```

Total unprocessed withdrawn shares, waiting to be processed on next vault interaction




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined

### lowerVaultFee

```solidity
function lowerVaultFee(uint16 _vaultFee) external nonpayable
```

Set lower vault fee.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vaultFee | uint16 | new vault fee Requirements: - the caller can only be the vault owner - new vault fee must be lower than before

### name

```solidity
function name() external view returns (string)
```

The name of the vault




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | string | undefined

### proportions

```solidity
function proportions() external view returns (uint256)
```

The proportions of each strategy when depositing

*Proportions are 14bits each, and the add up to FULL_PERCENT (10.000)*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### redistibutionIndex

```solidity
function redistibutionIndex() external view returns (uint24)
```

Data if vault and at what index vault is redistributing




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint24 | undefined

### rewardTokensCount

```solidity
function rewardTokensCount() external view returns (uint8)
```

Number of vault incentivized tokens




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined

### strategiesHash

```solidity
function strategiesHash() external view returns (bytes32)
```

Hash of the strategies list




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### totalInstantDeposit

```solidity
function totalInstantDeposit() external view returns (uint128)
```

Total instant deposit, used to calculate vault reward incentives




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined

### totalShares

```solidity
function totalShares() external view returns (uint128)
```

The total shares of a vault




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint128 | undefined

### transferVaultOwner

```solidity
function transferVaultOwner(address _vaultOwner) external nonpayable
```

Transfer vault owner to another address.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _vaultOwner | address | new vault owner address Requirements: - the caller can only be the vault owner or Spool DAO

### updateName

```solidity
function updateName(string _name) external nonpayable
```

Update the name of the vault.



#### Parameters

| Name | Type | Description |
|---|---|---|
| _name | string | new vault name Requirements: - the caller can only be the Spool DAO

### users

```solidity
function users(address) external view returns (uint128 instantDeposit, uint128 activeDeposit, uint128 owed, uint128 withdrawnDeposits, uint128 shares)
```

User vault state values



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| instantDeposit | uint128 | undefined
| activeDeposit | uint128 | undefined
| owed | uint128 | undefined
| withdrawnDeposits | uint128 | undefined
| shares | uint128 | undefined

### vaultFee

```solidity
function vaultFee() external view returns (uint16)
```

Vault owner fee




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint16 | undefined

### vaultIndex

```solidity
function vaultIndex() external view returns (uint24)
```

Current vault index index, that maps to global index

*Every action stored in vault is mapped to the vault index*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint24 | undefined

### vaultOwner

```solidity
function vaultOwner() external view returns (address)
```

The owner of the vault, also the vault fee recipient




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined



## Events

### AllocationChanged

```solidity
event AllocationChanged(uint256[] previous, uint256[] next)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previous  | uint256[] | undefined |
| next  | uint256[] | undefined |

### DebtClaim

```solidity
event DebtClaim(address indexed member, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| member `indexed` | address | undefined |
| amount  | uint256 | undefined |

### Deposit

```solidity
event Deposit(address indexed member, uint256 indexed globalIndex, uint256 indexed vaultIndex, uint256 amount)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| member `indexed` | address | undefined |
| globalIndex `indexed` | uint256 | undefined |
| vaultIndex `indexed` | uint256 | undefined |
| amount  | uint256 | undefined |

### FeesExtracted

```solidity
event FeesExtracted(address indexed member, address beneficiary, uint256 fees)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| member `indexed` | address | undefined |
| beneficiary  | address | undefined |
| fees  | uint256 | undefined |

### LazyWithdrawal

```solidity
event LazyWithdrawal(address indexed member, uint256 indexed vaultIndex, uint256 shares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| member `indexed` | address | undefined |
| vaultIndex `indexed` | uint256 | undefined |
| shares  | uint256 | undefined |

### LazyWithdrawalProcess

```solidity
event LazyWithdrawalProcess(uint256 indexed globalIndex, uint256 indexed vaultIndex, uint256 shares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| globalIndex `indexed` | uint256 | undefined |
| vaultIndex `indexed` | uint256 | undefined |
| shares  | uint256 | undefined |

### Withdrawal

```solidity
event Withdrawal(address indexed member, uint256 indexed globalIndex, uint256 indexed vaultIndex, uint256 shares)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| member `indexed` | address | undefined |
| globalIndex `indexed` | uint256 | undefined |
| vaultIndex `indexed` | uint256 | undefined |
| shares  | uint256 | undefined |



