# VaultIndexActions





VaultIndexActions extends VaultBase and holds the logic to process index related data and actions.

*Index functions are executed when state changes are performed, to synchronize to vault with central Spool contract.  Index actions include: - Redeem vault: claiming vault shares and withdrawn amount when DHW is complete - Redeem user: claiming user deposit shares and/or withdrawn amount after vault claim has been processed - Vault index: Incrementing vault index and mapping it to the global index*

## Methods

### addToken

```solidity
function addToken(contract IERC20 token, uint32 rewardsDuration, uint256 reward) external nonpayable
```

Allows a new token to be added to the reward system

*Emits an {TokenAdded} event indicating the newly added reward token and configuration Requirements: - the caller must be the reward distributor - the reward duration must be non-zero - the token must not have already been added*

#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20 | undefined
| rewardsDuration | uint32 | undefined
| reward | uint256 | undefined

### claimFinishedRewards

```solidity
function claimFinishedRewards(contract IERC20 token, uint256 amount) external nonpayable
```

Claim reward tokens

*This is meant to be an emergency function to claim reward tokens. Users that have not claimed yet will not be able to claim as the rewards will be removed. Requirements: - the caller must be Spool DAO - cannot claim vault underlying token - cannot only execute if the reward finished*

#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20 | Token address to remove
| amount | uint256 | Amount of tokens to claim

### earned

```solidity
function earned(contract IERC20 token, address account) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20 | undefined
| account | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### forceRemoveReward

```solidity
function forceRemoveReward(contract IERC20 token) external nonpayable
```

Force remove reward from vault rewards configuration.

*This is meant to be an emergency function if a reward token breaks. Requirements: - the caller must be Spool DAO*

#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20 | Token address to remove

### getActiveRewards

```solidity
function getActiveRewards(address account) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| account | address | undefined

### getGlobalIndexFromVaultIndex

```solidity
function getGlobalIndexFromVaultIndex(uint256 _vaultIndex) external view returns (uint24 globalIndex)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| _vaultIndex | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| globalIndex | uint24 | undefined

### getRewardForDuration

```solidity
function getRewardForDuration(contract IERC20 token) external view returns (uint256)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### getRewards

```solidity
function getRewards(contract IERC20[] tokens, address account) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| tokens | contract IERC20[] | undefined
| account | address | undefined

### initialize

```solidity
function initialize(VaultInitializable vaultInitializable) external nonpayable
```

Sets initial state of the vault.

*Called only once by vault factory after deploying a vault proxy.      All values have been sanitized by the controller contract, meaning      that no additional checks need to be applied here.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| vaultInitializable | VaultInitializable | undefined

### lastIndexInteracted

```solidity
function lastIndexInteracted() external view returns (uint128 index1, uint128 index2)
```

Holds up to 2 vault indexes vault last interacted at and havend been claimed yet

*Hecond index can only be the next index of the first one*


#### Returns

| Name | Type | Description |
|---|---|---|
| index1 | uint128 | undefined
| index2 | uint128 | undefined

### lastTimeRewardApplicable

```solidity
function lastTimeRewardApplicable(contract IERC20 token) external view returns (uint32)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint32 | undefined

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

### notifyRewardAmount

```solidity
function notifyRewardAmount(contract IERC20 token, uint256 reward) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20 | undefined
| reward | uint256 | undefined

### proportions

```solidity
function proportions() external view returns (uint256)
```

The proportions of each strategy when depositing




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### redeems

```solidity
function redeems(uint256) external view returns (uint128 depositShares, uint128 withdrawnAmount)
```

Vault index to deposit and withdraw vault redeem 



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| depositShares | uint128 | undefined
| withdrawnAmount | uint128 | undefined

### redistibutionIndex

```solidity
function redistibutionIndex() external view returns (uint24)
```

Data if vault and at what index vault is redistributing




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint24 | undefined

### removeReward

```solidity
function removeReward(contract IERC20 token) external nonpayable
```

Remove reward from vault rewards configuration.

*Used to sanitize vault and save on gas, after the reward has ended. Users will be able to claim rewards  Requirements: - the caller must be the spool owner or Spool DAO - cannot claim vault underlying token - cannot only execute if the reward finished*

#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20 | Token address to remove

### rewardConfiguration

```solidity
function rewardConfiguration(contract IERC20) external view returns (uint32 rewardsDuration, uint32 periodFinish, uint192 rewardRate, uint32 lastUpdateTime, uint224 rewardPerTokenStored)
```

Vault reward token incentive configuration



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| rewardsDuration | uint32 | undefined
| periodFinish | uint32 | undefined
| rewardRate | uint192 | undefined
| lastUpdateTime | uint32 | undefined
| rewardPerTokenStored | uint224 | undefined

### rewardPerToken

```solidity
function rewardPerToken(contract IERC20 token) external view returns (uint224)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint224 | undefined

### rewardTokens

```solidity
function rewardTokens(uint256) external view returns (contract IERC20)
```

All reward tokens supported by the contract



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined

### rewardTokensCount

```solidity
function rewardTokensCount() external view returns (uint8)
```

Number of vault incentivized tokens




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined

### setRewardsDuration

```solidity
function setRewardsDuration(contract IERC20 token, uint32 _rewardsDuration) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20 | undefined
| _rewardsDuration | uint32 | undefined

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

### updatePeriodFinish

```solidity
function updatePeriodFinish(contract IERC20 token, uint32 timestamp) external nonpayable
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| token | contract IERC20 | undefined
| timestamp | uint32 | undefined

### userIndexAction

```solidity
function userIndexAction(address, uint256) external view returns (uint128 depositAmount, uint128 withdrawShares)
```

Maps user actions to the vault index



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined
| _1 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| depositAmount | uint128 | undefined
| withdrawShares | uint128 | undefined

### userLastInteractions

```solidity
function userLastInteractions(address) external view returns (uint128 index1, uint128 index2)
```

Holds up to 2 vault indexes users last interacted with, and havend been claimed yet



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| index1 | uint128 | undefined
| index2 | uint128 | undefined

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




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint24 | undefined

### vaultIndexAction

```solidity
function vaultIndexAction(uint256) external view returns (uint128 depositAmount, uint128 withdrawShares)
```

Maps vault index to deposits and withdrawals for this index



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| depositAmount | uint128 | undefined
| withdrawShares | uint128 | undefined

### vaultIndexToGlobalIndex

```solidity
function vaultIndexToGlobalIndex(uint256) external view returns (uint256)
```

Vault index to global index mapping



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

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



