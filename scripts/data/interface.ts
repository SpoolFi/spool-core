export interface Users {
    administrator: string;
    user0: string;
    user1: string;
    user2: string;
}
export interface SpoolContracts {
    controller: string;
    riskProviderRegistry: string;
    spool: string;
    fastWithdraw: string;
    feeHandler: string;
    spoolOwner: string;
}

export interface UnderlyingContracts {
    DAI: string[];
    USDT: string[];
    USDC: string[];
}

export interface StrategiesContracts {
    Aave: UnderlyingContracts;
    Compound: UnderlyingContracts;
    Convex: UnderlyingContracts;
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

interface NamedVault {
    address: string;
    strategies: string[];
}

interface UnderlyingVault {
    [key: string]: NamedVault;
}

export interface Vaults {
    DAI: UnderlyingVault[];
    USDT: UnderlyingVault[];
    USDC: UnderlyingVault[];
}

export interface Contracts {
    users: Users;
    spool: SpoolContracts;
    strategies: StrategiesContracts;
    vaults?: Vaults;
    tokens: UnderlyingContracts;
}
