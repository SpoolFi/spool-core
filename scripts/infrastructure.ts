import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
    Controller,
    FastWithdraw,
    FeeHandler,
    IERC20,
    ProxyAdmin,
    RiskProviderRegistry,
    Spool,
    SpoolOwner,
    StrategyRegistry,
    Vault,
} from "../build/types";
import { HarvestContracts, mainnet, Tokens } from "../test/shared/constants";
import { StrategiesContracts } from "./data/interface";

const constants = mainnet();

export const mainnetConst = constants;

type UnderlyingAssets = "DAI" | "USDC" | "USDT";

type CompoundStratSetup = {
    name: keyof TokensFixture & keyof Tokens & UnderlyingAssets;
    cToken: string;
};

type HarvestStratSetup = {
    name: keyof TokensFixture & keyof Tokens & UnderlyingAssets;
    contracts: HarvestContracts;
};

type IdleStratSetup = {
    name: keyof TokensFixture & keyof Tokens & UnderlyingAssets;
    idleTokenYield: string;
};

type YearnStratSetup = {
    name: keyof TokensFixture & keyof Tokens & UnderlyingAssets;
    yVault: string;
};

export const Compound: CompoundStratSetup[] = [
    {
        name: "DAI",
        cToken: mainnetConst.compound.cDAI.delegator.address,
    },
    {
        name: "USDC",
        cToken: mainnetConst.compound.cUSDC.address,
    },
    {
        name: "USDT",
        cToken: mainnetConst.compound.cUSDT.delegator.address,
    },
];

export const Harvest: HarvestStratSetup[] = [
    {
        name: "DAI",
        contracts: mainnetConst.harvest.DAI,
    },
    {
        name: "USDC",
        contracts: mainnetConst.harvest.USDC,
    },
    {
        name: "USDT",
        contracts: mainnetConst.harvest.USDT,
    },
];

export const Idle: IdleStratSetup[] = [
    {
        name: "DAI",
        idleTokenYield: mainnetConst.idle.idleDAI.address,
    },
    {
        name: "USDC",
        idleTokenYield: mainnetConst.idle.idleUSDC.address,
    },
    {
        name: "USDT",
        idleTokenYield: mainnetConst.idle.idleUSDT.address,
    },
];

export const Yearn: YearnStratSetup[] = [
    {
        name: "DAI",
        yVault: mainnetConst.yearn.DAIVault.address,
    },
    {
        name: "USDC",
        yVault: mainnetConst.yearn.USDCVault.address,
    },
    {
        name: "USDT",
        yVault: mainnetConst.yearn.USDTVault.address,
    },
];
//
// ***** Interfaces *****

export interface AccountsFixture {
    administrator: SignerWithAddress;
    user0: SignerWithAddress;
    user1: SignerWithAddress;
    user2: SignerWithAddress;
    rewardNotifier: SignerWithAddress;
    riskProvider: SignerWithAddress;
    splVault: SignerWithAddress;
    doHardWorker: SignerWithAddress;
    allocationProvider: SignerWithAddress;
}

export interface TokensFixture {
    DAI: IERC20;
    USDC: IERC20;
    USDT: IERC20;
    WETH: IERC20;
}

export interface NamedVault {
    address: string;
    strategies: string[];
    underlying: "DAI" | "USDC" | "USDT";
}

export interface SpoolFixture {
    controller: Controller;
    riskProviderRegistry: RiskProviderRegistry;
    spool: Spool;
    fastWithdraw: FastWithdraw;
    feeHandler: FeeHandler;
    spoolOwner: SpoolOwner;
    vault: Vault;
    strategyRegistry: StrategyRegistry;
    proxyAdmin: ProxyAdmin;
}

export interface HelperContracts {
    slippagesHelper: string;
    reallocationHelper: string;
}

export interface Context {
    infra: SpoolFixture;
    accounts: AccountsFixture;
    tokens: TokensFixture;
    vaults: { [key: string]: NamedVault };
    strategies: StrategiesContracts;
    helperContracts: HelperContracts;
    users: SignerWithAddress[];
    scope: string;
}
