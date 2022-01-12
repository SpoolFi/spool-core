# Controller





Implementation of the {IController} interface.

*This implementation joins the various contracts of the Spool system together to allow the creation of new vaults in the system as well as allow the Spool to validate that its incoming requests are indeed from a vault in the system. The contract can be thought of as the central point of contract for assessing the validity of data in the system (i.e. supported strategy, vault etc.).*

## Methods

### MAX_DAO_VAULT_CREATOR_FEE

```solidity
function MAX_DAO_VAULT_CREATOR_FEE() external view returns (uint256)
```

Maximum vault creator fee if the creator is the Spool DAO - 60%




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### MAX_RISK_TOLERANCE

```solidity
function MAX_RISK_TOLERANCE() external view returns (int8)
```

Maximum vault risk tolerance




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int8 | undefined

### MAX_VAULT_CREATOR_FEE

```solidity
function MAX_VAULT_CREATOR_FEE() external view returns (uint256)
```

Maximum vault creator fee - 20%




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### MAX_VAULT_STRATEGIES

```solidity
function MAX_VAULT_STRATEGIES() external view returns (uint256)
```

Maximum number of vault strategies




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### MIN_RISK_TOLERANCE

```solidity
function MIN_RISK_TOLERANCE() external view returns (int8)
```

Minimum vault risk tolerance




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | int8 | undefined

### addStrategy

```solidity
function addStrategy(address strategy, address[] allStrategies) external nonpayable
```

Allows a new strategy to be added to the Spool system.

*Emits a {StrategyAdded} event indicating the newly added strategy and whether it is multi-collateral. Requirements: - the caller must be the contract owner (Spool DAO) - the strategy must not have already been added *

#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy | address | the strategy to add to the system
| allStrategies | address[] | undefined

### createVault

```solidity
function createVault(VaultDetails details) external nonpayable returns (address vault)
```

Allows the creation of a new vault.

*The vault creator is immediately set as the allocation provider as well as reward token setter. These traits are all transferrable and should be transferred to another person beyond creation. Emits a {VaultCreated} event indicating the address of the vault. Parameters cannot be emitted due to reaching the stack limit and should instead be fetched from the vault directly. Requirements: - the underlying currency must be supported by the system - the strategies and proportions must be equal in length - the sum of the strategy proportions must be 100% - the strategies must all be supported by the system - the strategies must be unique - the underlying asset of the strategies must match the desired one - the fee of the vault owner must not exceed 20% in basis points,   or 60% if creator is the Spool DAO - the risk provider must exist in the risk provider registry - the risk tolerance of the vault must be within the [-10, 10] range*

#### Parameters

| Name | Type | Description |
|---|---|---|
| details | VaultDetails | details of the vault to be created (see VaultDetails)

#### Returns

| Name | Type | Description |
|---|---|---|
| vault | address | address of the newly created vault 

### emergencyRecipient

```solidity
function emergencyRecipient() external view returns (address)
```

Recipient address of emergency withdrawn funds




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### emergencyWithdraw

```solidity
function emergencyWithdraw(address strategy, uint256[] data) external nonpayable
```

Withdraws and liquidates any actively deployed funds from already removed strategy.

*Withdrawn funds are sent to the `emergencyRecipient` address. If the address is 0 Funds will be sent to the caller of this function.  Requirements: - the caller must be the emergency withdrawer - the strategy must already be removed*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy | address | the strategy to remove from the system
| data | uint256[] | strategy specific data required to withdraw the funds from the strategy 

### getAllStrategies

```solidity
function getAllStrategies() external view returns (address[])
```

Returns all strategy contract addresses.




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address[] | array of strategy addresses

### getRewards

```solidity
function getRewards(contract IVault[] vaults) external nonpayable
```

Allows a user to claim their reward drip rewards across multiple vaults in a single transaction.

*Requirements: - the caller must have rewards in all the vaults specified - the vaults must be valid vaults in the Spool system*

#### Parameters

| Name | Type | Description |
|---|---|---|
| vaults | contract IVault[] | vaults for which to claim rewards for

### getStrategiesCount

```solidity
function getStrategiesCount() external view returns (uint8)
```

Returns the amount of strategies registered




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | strategies count

### isEmergencyWithdrawer

```solidity
function isEmergencyWithdrawer(address) external view returns (bool)
```

Whether the address is the emergency withdrawer



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### removeStrategy

```solidity
function removeStrategy(address strategy, bool skipDisable, address[] allStrategies) external nonpayable
```

Allows an existing strategy to be removed from the Spool system.

*Emits a {StrategyRemoved} event indicating the removed strategy. Requirements: - the caller must be the emergency withdrawer - the strategy must already exist in the contract - the provided strategies array must be vaild or empty*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy | address | the strategy to remove from the system
| skipDisable | bool | flag to skip execution of strategy specific disable (e.g cleanup tasks) function.
| allStrategies | address[] | current valid strategies or empty array

### removeStrategyAndWithdraw

```solidity
function removeStrategyAndWithdraw(address strategy, bool skipDisable, uint256[] data, address[] allStrategies) external nonpayable
```

Allows an existing strategy to be removed from the Spool system, withdrawing and liquidating any actively deployed funds in the strategy.

*Withdrawn funds are sent to the `emergencyRecipient` address. If the address is 0 Funds will be sent to the caller of this function.  Emits a {StrategyRemoved} event indicating the removed strategy. Requirements: - the caller must be the emergency withdrawer - the strategy must already exist in the contract - the provided strategies array must be vaild or empty*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy | address | the strategy to remove from the system
| skipDisable | bool | flag to skip execution of strategy specific disable (e.g cleanup tasks) function.
| data | uint256[] | strategy specific data required to withdraw the funds from the strategy 
| allStrategies | address[] | current valid strategies or empty array

### riskRegistry

```solidity
function riskRegistry() external view returns (contract IRiskProviderRegistry)
```

The risk provider registry




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IRiskProviderRegistry | undefined

### setEmergencyRecipient

```solidity
function setEmergencyRecipient(address _emergencyRecipient) external nonpayable
```

Set the emergency withdraw recipient

*Requirements: - the caller must be the contract owner (Spool DAO)*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _emergencyRecipient | address | undefined

### setEmergencyWithdrawer

```solidity
function setEmergencyWithdrawer(address user, bool _isEmergencyWithdrawer) external nonpayable
```

Add or remove the emergency withdrawer right

*Requirements: - the caller must be the contract owner (Spool DAO)*

#### Parameters

| Name | Type | Description |
|---|---|---|
| user | address | undefined
| _isEmergencyWithdrawer | bool | undefined

### spool

```solidity
function spool() external view returns (contract ISpool)
```

The central Spool contract




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract ISpool | undefined

### strategies

```solidity
function strategies(uint256) external view returns (address)
```

The list of strategies supported by the system



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### strategiesHash

```solidity
function strategiesHash() external view returns (bytes32)
```

Hash of strategies list




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bytes32 | undefined

### supportedUnderlying

```solidity
function supportedUnderlying(contract IERC20) external view returns (bool)
```

Whether the specified token is supported as an underlying token for a vault



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | contract IERC20 | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### totalVaults

```solidity
function totalVaults() external view returns (uint256)
```

The total vaults created in the system




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint256 | undefined

### transferToSpool

```solidity
function transferToSpool(address transferFrom, uint256 amount) external nonpayable
```

transfer vault underlying tokens to the Spool contact, from a user.

*Users of multiple vaults can choose to set allowance for the underlying token to this contract only, and then  interact with any vault without having to set allowance to each vault induvidually. Requirements: - the caller must be a vault - user (transferFrom address) must have given enough allowance to this contract  - user (transferFrom address) must have enough tokens to transfer*

#### Parameters

| Name | Type | Description |
|---|---|---|
| transferFrom | address | address to transfer the tokens from (user address from vault)
| amount | uint256 | amount of underlying tokens to transfer to the Spool

### validStrategy

```solidity
function validStrategy(address) external view returns (bool)
```

Whether the particular strategy address is valid



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### validVault

```solidity
function validVault(address) external view returns (bool)
```

Whether the particular vault address is valid



#### Parameters

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | undefined

### vaultImplementation

```solidity
function vaultImplementation() external view returns (address)
```

vault implementation address




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### verifyStrategies

```solidity
function verifyStrategies(address[] _strategies) external view
```

hash strategies list, verify hash matches to storage hash.

*Requirements: - hash of input matches hash in storage*

#### Parameters

| Name | Type | Description |
|---|---|---|
| _strategies | address[] | list of strategies to check



## Events

### ControllerInitialized

```solidity
event ControllerInitialized(address spool, address vaultFactory)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| spool  | address | undefined |
| vaultFactory  | address | undefined |

### FeeChanged

```solidity
event FeeChanged(uint96 previous, uint96 next)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previous  | uint96 | undefined |
| next  | uint96 | undefined |

### StrategyAdded

```solidity
event StrategyAdded(address strategy)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy  | address | undefined |

### StrategyRemoved

```solidity
event StrategyRemoved(address strategy)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy  | address | undefined |

### VaultCreated

```solidity
event VaultCreated(address vault, address[] strategies)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| vault  | address | undefined |
| strategies  | address[] | undefined |



