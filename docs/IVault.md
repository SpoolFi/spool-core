# IVault









## Methods

### getActiveRewards

```solidity
function getActiveRewards(address account) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined

### initialize

```solidity
function initialize(VaultInitializable vaultInitializable) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| vaultInitializable | VaultInitializable | undefined

### payFees

```solidity
function payFees(uint256 profit) external nonpayable returns (uint256 feesPaid)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| profit | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| feesPaid | uint256 | undefined

### reallocate

```solidity
function reallocate(address[] vaultStrategies, uint256 newVaultProportions, uint256 finishedIndex, uint256 activeIndex) external nonpayable returns (uint256[], uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| vaultStrategies | address[] | undefined
| newVaultProportions | uint256 | undefined
| finishedIndex | uint256 | undefined
| activeIndex | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256[] | undefined
| _1 | uint256 | undefined

### riskProvider

```solidity
function riskProvider() external view returns (address)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### riskTolerance

```solidity
function riskTolerance() external view returns (int8)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int8 | undefined

### underlying

```solidity
function underlying() external view returns (contract IERC20)
```






#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined



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



