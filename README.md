# Spool Core

Spool Core contracts implementation.

## About

Spool is permissionless middleware that allows users and builders to access DeFi in a fully composable manner. It lays the foundation for a customizable, scalable, and efficient financial services ecosystem that bridges the gap between end users and DeFi primitives.

## Contracts

Contracts can be found in the `contracts` folder.
Main Spool Core contracts consist of:

- `Controller.sol`
  - Holds the information about the system validity
  - Vaults are deployed from here
- `Vault.sol`
  - Vaults (or spools) can be deployed by any user from a Controller
  - Deposits assets into the stratgies according to the set allocation.
  - Holds user-vault shares
  - All vault abstract contracts can be found inside the `contracts/vault` folder
- `Spool.sol`
  - Spool central contract
  - Holds the vault-strategy shares
  - All spool abstract contracts can be found inside the `contracts/spool` folder
- **strategies** (found in `contracts/strategies`)
  - An implementation contract interacting with the external protocols
  - Strategy contracts are called by the `Spool.sol` as a `delegatecall`
  - Additional strategies can be added by the Spool DAO
- `FeeHandler.sol`
  - Calculates and stores all the performance fees
- `FastWithdraw.sol`
  - Holds shares when a user performs a fast withdrawal and doesn't exit the strategies right away
  - Shares can be larew withdrawn at anytime
- `RiskProviderRegistry.sol`
  - Holds registry of the valid risk providers and their risk scores of the supported strategies
- `SpoolOwner.sol`
  - Simple contract holding the address of the Spool DAO
  - All the contracts controlled by the Spool DAO inherit `contracts/shares/SpoolOwnable.sol` that holds the logic to verify if the caller is the Spool DAO
  - If Spool DAO changes it's address only one call to this contract needs to be performed to transfer the contract ownership privileges.

## Run

### Install dependencies

- `npm install`

### Compile solidity

- `npm run compile`

### Generate documentation

The documentation can be generated from the comments of the contract external functions.

- `npm run generate-docs`

### Run tests

#### Run test on local node

    NOTE: Skips strategy tests, these use mainnet addresses

- `npm run test-local`

#### Run tests on mainnet fork

- `cp .env.sample .env`
- add mainnet archive node url under `MAINNET_URL`
- `npm run test-fork`

### Run coverage report

To run full coverage you have to run tests on forked mainnet

- `npm run coverage-fork`

To run only local net coverage run:

- `npm run coverage-local`

## Licensing

The primary license for Spool is the Business Source License 1.1 (`BUSL-1.1`), see [`LICENSE`](./LICENSE).

### Exceptions

- All files in `contracts/external/` are licensed under the license they were originally published with (as indicated in their SPDX headers)
- All files in `contracts/mocks/` are licensed under `MIT`.
- All files in `contracts/libraries` are licensed under `MIT`.
- All files in `contracts/utils` are licensed under `MIT`.
- All files in `test` remain unlicensed.
