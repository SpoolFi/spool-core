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

// ***** Interfaces *****

export interface UnderlyingContracts {
    DAI: string[];
    USDT: string[];
    USDC: string[];
}

export interface ArbitrumContracts {
    AaveV3: UnderlyingContracts;
    Abracadabra: UnderlyingContracts;
    Balancer: UnderlyingContracts;
    Curve2pool: UnderlyingContracts;
    TimelessFi: UnderlyingContracts;
    YearnMetapool: UnderlyingContracts;
    All: string[];
}

export interface MainnetContracts {
    Aave: UnderlyingContracts;
    Compound: UnderlyingContracts;
    Convex: UnderlyingContracts;
    Convex2pool: UnderlyingContracts;
    Convex4pool: UnderlyingContracts;
    ConvexMetapool: UnderlyingContracts;
    Curve: UnderlyingContracts;
    Harvest: UnderlyingContracts;
    Idle: UnderlyingContracts;
    Morpho: UnderlyingContracts;
    Notional: UnderlyingContracts;
    Yearn: UnderlyingContracts;
    All: string[];
}

export interface StrategiesContracts {
    arbitrum: ArbitrumContracts;
    mainnet: MainnetContracts;
}

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
    slippagesHelperArbitrum: string;
    reallocationHelper: string;
}

export interface Context {
    network: keyof StrategiesContracts;
    infra: SpoolFixture;
    accounts: AccountsFixture;
    tokens: TokensFixture;
    vaults: { [key: string]: NamedVault };
    strategies: StrategiesContracts;
    helperContracts: HelperContracts;
    users: SignerWithAddress[];
    scope: string;
}
