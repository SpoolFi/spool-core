# IVaultBase










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



