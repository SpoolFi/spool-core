# RiskProviderRegistry





This implementation acts as a simple registry contract permitting a designated party (the owner) to toggle the validity of providers within it. In turn, these providers are able to set a risk score for the strategies they want that needs to be in the range [-10.0, 10.0].

*Implementation of the {IRiskProviderRegistry} interface.*

## Methods

### MAX_RISK_SCORE

```solidity
function MAX_RISK_SCORE() external view returns (uint8)
```

Maximum strategy risk score

*Risk score has 1 decimal accuracy, so value 100 represents 10.0*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | undefined

### _setRisk

```solidity
function _setRisk(address strategy, uint8 riskScore) external nonpayable
```

Allows the risk score of a strategy to be set (internal)

*Emits a {RiskAssessed} event indicating the assessor of the score and the newly set risk score of the strategy Requirements: - the risk score must be less than 100*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy | address | strategy to set risk score for
| riskScore | uint8 | risk score to set on the strategy

### addProvider

```solidity
function addProvider(address provider, uint16 fee) external nonpayable
```

Allows the inclusion of a new provider to the registry.

*Emits a {ProviderAdded} event indicating the newly added provider. Requirements: - the caller must be the owner of the contract - the provider must not already exist in the registry*

#### Parameters

| Name | Type | Description |
|---|---|---|
| provider | address | provider to add
| fee | uint16 | fee to go to provider

### feeHandler

```solidity
function feeHandler() external view returns (contract IFeeHandler)
```

fee handler contracts, to manage the risk provider fees




#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | contract IFeeHandler | undefined

### getRisk

```solidity
function getRisk(address riskProvider, address strategy) external view returns (uint8)
```

Returns the risk score of a particular strategy as defined by the provided risk provider.



#### Parameters

| Name | Type | Description |
|---|---|---|
| riskProvider | address | risk provider to get risk scores for 
| strategy | address | strategy that the risk provider has set risk for

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8 | risk score

### getRisks

```solidity
function getRisks(address riskProvider, address[] strategies) external view returns (uint8[])
```

Returns the risk scores of strateg(s) as defined by the provided risk provider.



#### Parameters

| Name | Type | Description |
|---|---|---|
| riskProvider | address | risk provider to get risk scores for 
| strategies | address[] | list of strategies that the risk provider has set risks for

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | uint8[] | risk scores

### isProvider

```solidity
function isProvider(address provider) external view returns (bool)
```

Returns whether or not a particular address is a risk provider.



#### Parameters

| Name | Type | Description |
|---|---|---|
| provider | address | provider address to check

#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | bool | boolean indicating entry in _provider

### removeProvider

```solidity
function removeProvider(address provider) external nonpayable
```

Allows the removal of an existing provider to the registry.

*Emits a {ProviderRemoved} event indicating the address of the removed provider. provider fee is also set to 0. Requirements: - the caller must be the owner of the contract - the provider must already exist in the registry*

#### Parameters

| Name | Type | Description |
|---|---|---|
| provider | address | provider to remove

### setRisk

```solidity
function setRisk(address strategy, uint8 riskScore) external nonpayable
```

Allows the risk score of a strategy to be set.

*Requirements: - the caller must be a valid risk provider*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strategy | address | strategy to set risk score for
| riskScore | uint8 | risk score to set on the strategy

### setRisks

```solidity
function setRisks(address[] strategies, uint8[] riskScores) external nonpayable
```

Allows the risk score of multiple strategies to be set.

*Requirements: - the caller must be a risk provider - input arrays must have the same length*

#### Parameters

| Name | Type | Description |
|---|---|---|
| strategies | address[] | list of strategies to set risk scores for
| riskScores | uint8[] | list of risk scores to set on each strategy



## Events

### ProviderAdded

```solidity
event ProviderAdded(address provider)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| provider  | address | undefined |

### ProviderRemoved

```solidity
event ProviderRemoved(address provider)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| provider  | address | undefined |

### RiskAssessed

```solidity
event RiskAssessed(address indexed provider, address indexed strategy, uint8 riskScore)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| provider `indexed` | address | undefined |
| strategy `indexed` | address | undefined |
| riskScore  | uint8 | undefined |

### RiskProviderRegistryInitialized

```solidity
event RiskProviderRegistryInitialized(address feeHandler)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| feeHandler  | address | undefined |



