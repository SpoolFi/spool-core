# Spool Core (V1)

Spool Core contracts implementation.

## About

Spool is permissionless middleware that allows users and builders to access DeFi in a fully composable manner. It lays the foundation for a customizable, scalable, and efficient financial services ecosystem that bridges the gap between end users and DeFi primitives.

## Run

### Install dependencies

- `npm install`

### Run tests

#### Run test on local node

    NOTE: Skips strategy tests, these use mainnet addresses

- `npm run test-local`

#### Run tests on mainnet fork

- `cp .env.sample .env`
- add mainnet archive node url under `MAINNET_URL`
- `npm run test-fork`
- if you have a local mainnet fork or actual archive node (eg. Erigon) running on the default port, you can run `npm run test-fork-local` to use that instead.
- to run only strategy tests, run `npm run test-strategy`

### Generate documentation

- `npm run generate-docs`

### Run coverage report

- `npm run coverage`
