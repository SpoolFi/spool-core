# SpoolOwner





Implementation of the {ISpoolOwner} interface.

*This implementation acts as a simple central Spool owner oracle. All Spool contracts should refer to this contract to check the owner of the Spool.*

## Methods

### isSpoolOwner

```solidity
function isSpoolOwner(address user) external view returns (bool isOwner)
```

checks if input is the spool owner contract. 



#### Parameters

| Name | Type | Description |
|---|---|---|
| user | address | the address to check 

#### Returns

| Name | Type | Description |
|---|---|---|
| isOwner | bool | returns true if user is the Spool owner, else returns false.

### owner

```solidity
function owner() external view returns (address)
```



*Returns the address of the current owner.*


#### Returns

| Name | Type | Description |
|---|---|---|
| _0 | address | undefined

### renounceOwnership

```solidity
function renounceOwnership() external view
```

removed renounceOwnership function 

* overrides OpenZeppelin renounceOwnership() function and reverts in all cases, as Spool ownership should never be renounced.*


### transferOwnership

```solidity
function transferOwnership(address newOwner) external nonpayable
```



*Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.*

#### Parameters

| Name | Type | Description |
|---|---|---|
| newOwner | address | undefined



## Events

### OwnershipTransferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```





#### Parameters

| Name | Type | Description |
|---|---|---|
| previousOwner `indexed` | address | undefined |
| newOwner `indexed` | address | undefined |



