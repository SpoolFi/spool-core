import {
    IAaveIncentivesController__factory,
    IBooster__factory,
    ICERC20Delegate__factory,
    ICERC20Delegator__factory,
    IComp__factory,
    IComptroller__factory,
    ICRV__factory,
    IDAI__factory,
    IFARM__factory,
    IFiatTokenProxy__factory,
    IHarvestPool__factory,
    IIdleDAI__factory,
    IInitializableAdminUpgradeabilityProxy__factory,
    ILendingPool__factory,
    ILendingPoolAddressesProvider__factory,
    IMasterChef__factory,
    IStakedTokenV2Rev3__factory,
    ISUSHI__factory,
    IUniswapV2Factory__factory,
    IUniswapV2Router02__factory,
    IUnitroller__factory,
    IUSDC__factory,
    IUSDT__factory,
    IVault__factory,
    IWETH__factory,
    IYearnTokenVault__factory,
    IMorpho__factory,
    INotional__factory,
    IERC20__factory,
    IAToken__factory,
    IBoosterV2__factory,
} from "../../build/types";

export type Contract = {
    address: string;
    ABI: any;
};

export type Address = {
    address: string;
};

export interface Proxy {
    delegator: Contract;
    implementation: Contract;
}

export type Token = {
    contract: any;
    units: number;
};

export interface UnderlyingToken extends Token {
    balanceSlot: number;
}

export interface Aave {
    aDAI: Contract;
    aUSDC: Contract;
    aUSDT: Contract;
    stkAAVE: Proxy;
    LendingPool: Proxy;
    IncentiveController: Proxy;
    LendingPoolAddressesProvider: Contract;
}

export interface AaveV3 {
    RewardsController: Address;
    PoolAddressesProvider: Address;
}

export interface Abracadabra {
    Farm: Address;
}

export interface StablePool3USD {
    Pool: Address;
    DAI: number;
    USDT: number;
    USDC: number;
}

export interface Balancer {
    staBAL: StablePool3USD;
}

export interface BarnBridgeContracts {
    SmartYield: Address;
    YieldFarmContinuous: Address;
}

export interface BarnBridgeMultiContracts {
    SmartYield: Address;
    MultiPool: Address;
}

export interface BarnBridge {
    BOND: Address;
    aDAI: BarnBridgeMultiContracts;
    aUSDC: BarnBridgeMultiContracts;
    aUSDT: BarnBridgeMultiContracts;
}

export interface ChainLink {
    DAIOracle: Contract;
    USDCOracle: Contract;
}

export interface Compound {
    COMP: Contract;
    COMPtroller: Proxy;
    cDAI: Proxy;
    cUSDC: Contract;
    cUSDT: Proxy;
}

export interface ConvexPool {
    boosterPoolId: number;
}

export interface MorphoContracts {
    Proxy: Contract;
    Lens: Address;
}

export interface Convex {
    Booster: Contract;
    _3pool: ConvexPool;
    _sUSD: ConvexPool;
    _alUSD: ConvexPool;
    _fraxusdc: ConvexPool;
}

export interface ConvexArb {
    Booster: Contract;
    _2pool: ConvexPool;
}

export type CurvePool = {
    pool: Address;
    lpToken: Address;
    depositZap: Address;
    LiquidityGauge: Address;
    totalTokens: number;
};

export interface Curve {
    CRV: Contract;
    Minter: Address;
    _3pool: CurvePool;
    _sUSD: CurvePool;
    _alUSD: CurvePool;
    _fraxusdc: CurvePool;
}

export interface CurveArb {
    CRV: Address;
    GaugeFactory: Address;
    _2pool: CurvePool;
    _mim: CurvePool;
}

export interface HarvestContracts {
    Vault: Contract;
    Pool: Contract;
}

export interface Harvest {
    FARM: Contract;
    DAI: HarvestContracts;
    USDC: HarvestContracts;
    USDT: HarvestContracts;
    Controller: Address;
    Governance: Address;
}

export interface Idle {
    Token: Contract;
    idleDAI: Address;
    idleUSDC: Address;
    idleUSDT: Address;
}

export interface IdleTranches {
    eulerDAI: Address;
    eulerUSDC: Address;
    eulerUSDT: Address;
}

export interface IdleTranche {
    protocol: Address;
    underlying: Address
}

export interface Keeper {
    Token: Contract;
    Distributer: Contract;
    Pool: Contract;
}

export interface Masterchef {
    Sushi: Contract;
    Masterchef: Contract;
}

export interface Morpho {
    Compound: MorphoContracts;
    Aave: MorphoContracts;
}

export interface nToken {
    contract: Contract;
    id: number;
}

export interface Notional {
    Proxy: Contract;
    NOTE: Contract;
    nDAI: nToken;
    nUSDC: nToken;
}

export interface StakeDAO {
    Token: Contract;
}

export interface TimelessFi {
    xPYT: Address;
    vault: Address;
    gate: Address;
}

export interface Uniswap {
    Factory: Contract;
    Router: Contract;
}

export interface Yearn {
    DAIVault: Contract;
    USDCVault: Contract;
    USDTVault: Contract;
}

export interface YearnArb {
    CurveMIMVault: Address;
}

export interface TokensBase {
    DAI: UnderlyingToken;
    USDC: UnderlyingToken;
    USDT: UnderlyingToken;
    WETH: Token;
}

export interface Tokens extends TokensBase {
    AAVE: Token;
    stkAAVE: Token;
    COMP: Token;
    CRV: Token;
    CVX: Token;
    IDLE: Token;
    symbols: any;
}

export interface Strategy {
    address: string;
    extraArgs: string[];
}

export interface StrategyType {
    DAI: Strategy;
    USDT: Strategy;
    USDC: Strategy;
}

export interface Strategies {
    Aave: StrategyType;
    Compound: StrategyType;
    Convex: StrategyType;
    Convex4pool: StrategyType;
    ConvexMetapool: StrategyType;
    Curve: StrategyType;
    Harvest: StrategyType;
    Idle: StrategyType;
    Yearn: StrategyType;
}

export interface Mainnet {
    aave: Aave;
    barnBridge: BarnBridge;
    compound: Compound;
    convex: Convex;
    curve: Curve;
    harvest: Harvest;
    idle: Idle;
    idleTranches: IdleTranches;
    masterchef: Masterchef;
    morpho: Morpho;
    notional: Notional;
    uniswap: Uniswap;
    yearn: Yearn;
    tokens: Tokens;
}

export interface Arbitrum {
    aave: AaveV3;
    abracadabra: Abracadabra;
    balancer: Balancer;
    convex: ConvexArb;
    curve: CurveArb;
    timelessfi: TimelessFi;
    uniswap: Uniswap;
    yearn: YearnArb;
    tokens: TokensBase;
}

export const mainnet = function mainnet(): Mainnet {
    let aave = {
        aDAI: {
            address: "0x028171bca77440897b824ca71d1c56cac55b68a3",
            ABI: IAToken__factory.abi,
        },
        aUSDC: {
            address: "0xbcca60bb61934080951369a648fb03df4f96263c",
            ABI: IAToken__factory.abi,
        },
        aUSDT: {
            address: "0x3ed3b47dd13ec9a98b44e6204a523e766b225811",
            ABI: IAToken__factory.abi,
        },
        stkAAVE: {
            delegator: {
                address: "0x4da27a545c0c5b758a6ba100e3a049001de870f5",
                ABI: IInitializableAdminUpgradeabilityProxy__factory.abi,
            },
            implementation: {
                address: "0xe42f02713aec989132c1755117f768dbea523d2f",
                ABI: IStakedTokenV2Rev3__factory.abi,
            },
        },
        IncentiveController: {
            delegator: {
                address: "0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5",
                ABI: IInitializableAdminUpgradeabilityProxy__factory.abi,
            },
            implementation: {
                address: "0x83d055d382f25e6793099713505c68a5c7535a35",
                ABI: IAaveIncentivesController__factory.abi,
            },
        },
        LendingPool: {
            delegator: {
                address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
                ABI: IInitializableAdminUpgradeabilityProxy__factory.abi,
            },
            implementation: { address: "0xc6845a5c768bf8d7681249f8927877efda425baf", ABI: ILendingPool__factory.abi },
        },
        LendingPoolAddressesProvider: {
            address: "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5",
            ABI: ILendingPoolAddressesProvider__factory.abi,
        },
    };

    let barnBridge = {
        BOND: {
            address: "0x0391d2021f89dc339f60fff84546ea23e337750f",
        },
        aDAI: {
            SmartYield: {
                address: "0x6c9dae2c40b1e5883847bf5129764e76cb69fc57",
            },
            MultiPool: {
                address: "0x69951b60b6253697f29c8311bfcea6da09bbac0d",
            },
        },
        aUSDC: {
            SmartYield: {
                address: "0x3cf46da7d65e9aa2168a31b73dd4beea5ca1a1f1",
            },
            MultiPool: {
                address: "0xf4bde50cdf4ee4cf3fb8702fceb6fd499a92792d",
            },
        },
        aUSDT: {
            SmartYield: {
                address: "0x660daf6643191cf0ed045b861d820f283ca078fc",
            },
            MultiPool: {
                address: "0x51d924bf2ff813a68bd5f86cdcc98918f2ae5868",
            },
        },
    };

    let compound = {
        COMP: { address: "0xc00e94cb662c3520282e6f5717214004a7f26888", ABI: IComp__factory.abi },
        COMPtroller: {
            delegator: { address: "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B", ABI: IUnitroller__factory.abi },
            implementation: { address: "0xbafe01ff935c7305907c33bf824352ee5979b526", ABI: IComptroller__factory.abi },
        },
        cDAI: {
            delegator: { address: "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643", ABI: ICERC20Delegate__factory.abi },
            implementation: {
                address: "0xa035b9e130f2b1aedc733eefb1c67ba4c503491f",
                ABI: ICERC20Delegator__factory.abi,
            },
        },
        cUSDC: { address: "0x39aa39c021dfbae8fac545936693ac917d5e7563", ABI: ICERC20Delegator__factory.abi },
        cUSDT: {
            delegator: { address: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9", ABI: ICERC20Delegate__factory.abi },
            implementation: {
                address: "0xa035b9e130f2b1aedc733eefb1c67ba4c503491f",
                ABI: ICERC20Delegator__factory.abi,
            },
        },
    } as Compound;

    let convex = {
        Booster: { address: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31", ABI: IBooster__factory.abi },
        _sUSD: {
            boosterPoolId: 4,
        },
        _3pool: {
            boosterPoolId: 9,
        },
        _alUSD: {
            boosterPoolId: 36,
        },
        _fraxusdc: {
            boosterPoolId: 100,
        }
    };

    let curve = {
        CRV: { address: "0xD533a949740bb3306d119CC777fa900bA034cd52", ABI: ICRV__factory.abi },
        Minter: { address: "0xd061d61a4d941c39e5453435b6345dc261c2fce0" },
        _3pool: {
            pool: { address: "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7" },
            lpToken: { address: "0x6c3f90f043a72fa612cbac8115ee7e52bde6e490" },
            depositZap: { address: "" },
            LiquidityGauge: { address: "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A" },
            totalTokens: 3,
        },
        _sUSD: {
            pool: { address: "0xFCBa3E75865d2d561BE8D220616520c171F12851" },
            lpToken: { address: "0xC25a3A3b969415c80451098fa907EC722572917F" },
            depositZap: { address: "" },
            LiquidityGauge: { address: "0xA90996896660DEcC6E997655E065b23788857849" },
            totalTokens: 4,
        },
        _alUSD: {
            pool: { address: "0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c" },
            lpToken: { address: "0x43b4FdFD4Ff969587185cDB6f0BD875c5Fc83f8c" },
            depositZap: { address: "0xA79828DF1850E8a3A3064576f380D90aECDD3359" },
            LiquidityGauge: { address: "0x9582C4ADACB3BCE56Fea3e590F05c3ca2fb9C477" },
            totalTokens: 4,
        },
        _fraxusdc: {
            pool: { address: "0xdcef968d416a41cdac0ed8702fac8128a64241a2" },
            lpToken: { address: "0x3175Df0976dFA876431C2E9eE6Bc45b65d3473CC" },
            depositZap: { address: "" },
            LiquidityGauge: { address: "" },
            totalTokens: 2,
        },
    };

    let harvest = {
        FARM: { address: "0xa0246c9032bC3A600820415aE600c6388619A14D", ABI: IFARM__factory.abi },
        DAI: {
            Vault: { address: "0xab7fa2b2985bccfc13c6d86b1d5a17486ab1e04c", ABI: IVault__factory.abi },
            Pool: { address: "0x15d3A64B2d5ab9E152F16593Cdebc4bB165B5B4A", ABI: IHarvestPool__factory.abi },
        },
        USDC: {
            Vault: { address: "0xf0358e8c3CD5Fa238a29301d0bEa3D63A17bEdBE", ABI: IVault__factory.abi },
            Pool: { address: "0x4F7c28cCb0F1Dbd1388209C67eEc234273C878Bd", ABI: IHarvestPool__factory.abi },
        },
        USDT: {
            Vault: { address: "0x053c80eA73Dc6941F518a68E2FC52Ac45BDE7c9C", ABI: IVault__factory.abi },
            Pool: { address: "0x6ac4a7AB91E6fD098E13B7d347c6d4d1494994a2", ABI: IHarvestPool__factory.abi },
        },
        Controller: { address: "0x3cc47874dc50d98425ec79e647d83495637c55e3" },
        Governance: { address: "0xf00dd244228f51547f0563e60bca65a30fbf5f7f" },
    };

    let idle = {
        Token: { address: "0x3fE7940616e5Bc47b0775a0dccf6237893353bB4", ABI: IIdleDAI__factory.abi },
        idleDAI: { address: "0x3fe7940616e5bc47b0775a0dccf6237893353bb4" },
        idleUSDC: { address: "0x5274891bEC421B39D23760c04A6755eCB444797C" },
        idleUSDT: { address: "0xF34842d05A1c888Ca02769A633DF37177415C2f8" },
    };

    const idleTranches = {
        eulerDAI: { address: "0x46c1f702a6aad1fd810216a5ff15aab1c62ca826" },
        eulerUSDC: { address: "0xf5a3d259bfe7288284bd41823ec5c8327a314054" },
        eulerUSDT: { address: "0xd5469df8ca36e7eaedb35d428f28e13380ec8ede" },
    };

    let masterchef = {
        Sushi: { address: "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2", ABI: ISUSHI__factory.abi },
        Masterchef: { address: "0xbD17B1ce622d73bD438b9E658acA5996dc394b0d", ABI: IMasterChef__factory.abi },
    };

    let morpho = {
        Compound: { 
            Proxy: { address: "0x8888882f8f843896699869179fB6E4f7e3B58888", ABI: IMorpho__factory.abi },
            Lens: { address: "0x930f1b46e1D081Ec1524efD95752bE3eCe51EF67"},
        },
        Aave: { 
            Proxy: { address: "0x777777c9898D384F785Ee44Acfe945efDFf5f3E0", ABI: IMorpho__factory.abi },
            Lens: { address: "0x507fa343d0a90786d86c7cd885f5c49263a91ff4"},
        },
    };

    let notional = {
        Proxy: { address: "0x1344A36A1B56144C3Bc62E7757377D288fDE0369", ABI: INotional__factory.abi },
        NOTE: { address: "0xCFEAead4947f0705A14ec42aC3D44129E1Ef3eD5", ABI: IERC20__factory.abi },
        nDAI: {
            contract: { address: "0x6EbcE2453398af200c688C7c4eBD479171231818", ABI: IERC20__factory.abi }, 
            id: 2
        },
        nUSDC: { 
            contract: { address: "0x18b0Fc5A233acF1586Da7C199Ca9E3f486305A29", ABI: IERC20__factory.abi },
            id: 3
        },
    };

    let uniswap = {
        Factory: { address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f", ABI: IUniswapV2Factory__factory.abi },
        Router: { address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", ABI: IUniswapV2Router02__factory.abi },
    };

    let yearn = {
        DAIVault: { address: "0xdA816459F1AB5631232FE5e97a05BBBb94970c95", ABI: IYearnTokenVault__factory.abi },
        USDCVault: { address: "0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE", ABI: IYearnTokenVault__factory.abi },
        USDTVault: { address: "0x3B27F92C0e212C671EA351827EDF93DB27cc0c65", ABI: IYearnTokenVault__factory.abi },
    };

    let tokens = {
        DAI: {
            contract: { address: "0x6b175474e89094c44da98b954eedeac495271d0f", ABI: IDAI__factory.abi } as Contract,
            units: 18,
            balanceSlot: 2
        },

        USDT: {
            contract: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", ABI: IUSDT__factory.abi } as Contract,
            units: 6,
            balanceSlot: 2
        },

        WETH: {
            contract: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", ABI: IWETH__factory.abi } as Contract,
            units: 18,
        },
        USDC: {
            contract: {
                delegator: { address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", ABI: IFiatTokenProxy__factory.abi },
                implementation: { address: "0xa2327a938febf5fec13bacfb16ae10ecbc4cbdcf", ABI: IUSDC__factory.abi },
            } as Proxy,
            units: 6,
            balanceSlot: 9
        },
        AAVE: {
            contract: { address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", ABI: null } as Contract,
            units: 18,
        },
        stkAAVE: {
            contract: { address: "0x4da27a545c0c5B758a6BA100e3a049001de870f5", ABI: null } as Contract,
            units: 18,
        },
        COMP: {
            contract: { address: "0xc00e94Cb662C3520282E6f5717214004A7f26888", ABI: null } as Contract,
            units: 18,
        },
        CRV: {
            contract: { address: "0xD533a949740bb3306d119CC777fa900bA034cd52", ABI: null } as Contract,
            units: 18,
        },
        CVX: {
            contract: { address: "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B", ABI: null } as Contract,
            units: 18,
        },
        IDLE: {
            contract: { address: "0x875773784Af8135eA0ef43b5a374AaD105c5D39e", ABI: null } as Contract,
            units: 18,
        },
        symbols: {
            // enables lookup with address: tokens[tokens.symbols[address]]
            "0x6B175474E89094C44Da98b954EedeAC495271d0F": "DAI",
            "0xdAC17F958D2ee523a2206206994597C13D831ec7": "USDT",
            "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": "WETH",
            "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "USDC",
            "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": "AAVE",
            "0x4da27a545c0c5B758a6BA100e3a049001de870f5": "stkAAVE",
            "0xc00e94Cb662C3520282E6f5717214004A7f26888": "COMP",
            "0xD533a949740bb3306d119CC777fa900bA034cd52": "CRV",
            "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B": "CVX",
            "0x875773784Af8135eA0ef43b5a374AaD105c5D39e": "IDLE",
        },
    };

    return {
        aave,
        barnBridge,
        compound,
        convex,
        curve,
        harvest,
        idle,
        idleTranches,
        masterchef,
        morpho,
        notional,
        uniswap,
        yearn,
        tokens
    };
};
export const arbitrum = function arbitrum(): Arbitrum {
    let aave = {
        RewardsController: { address: "0x929EC64c34a17401F460460D4B9390518E5B473e" },
        PoolAddressesProvider: { address: "0xa97684ead0e402dc232d5a977953df7ecbab3cdb" }
    };
    let abracadabra = {
        Farm: { address: "0x839de324a1ab773f76a53900d70ac1b913d2b387" }
    };
    let balancer = {
        staBAL: { 
            Pool: { address: "0x1533A3278f3F9141d5F820A184EA4B017fce2382" },
            DAI: 0,
            USDT: 1,
            USDC: 2
        }
    };
    let convex = {
        Booster: { address: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31", ABI: IBoosterV2__factory.abi },
        _2pool: {
            boosterPoolId: 1,
        }
    };

    let curve = {
        CRV: { address: "0x11cdb42b0eb46d95f990bedd4695a6e3fa034978" },
        GaugeFactory: { address: "0xabC000d88f23Bb45525E447528DBF656A9D55bf5" },
        _2pool: {
            pool: { address: "0x7f90122BF0700F9E7e1F688fe926940E8839F353" },
            lpToken: { address: "0x7f90122BF0700F9E7e1F688fe926940E8839F353" },
            depositZap: { address: "" },
            LiquidityGauge: { address: "0xCE5F24B7A95e9cBa7df4B54E911B4A3Dc8CDAf6f" },
            totalTokens: 2,
        },
        _mim: {
            pool: { address: "0x30df229cefa463e991e29d42db0bae2e122b2ac7" },
            lpToken: { address: "0x30df229cefa463e991e29d42db0bae2e122b2ac7" },
            depositZap: { address: "0x7544Fe3d184b6B55D6B36c3FCA1157eE0Ba30287" },
            LiquidityGauge: { address: "" },
            totalTokens: 3,
        },
    };
    let timelessfi = {
        xPYT: { address: "0x841120e51ad43efe489244728532854a352073ad" },
        vault: { address: "0x1c0aca7cec87ce862638bc0dd8d8fa874d8ad95f" },
        gate: { address: "0xbb443d6740322293fcee4414d03978c7e4bf5d55" }
    };
    let yearn = {
        CurveMIMVault: { address: "0x1dBa7641dc69188D6086a73B972aC4bda29Ec35d" }
    };

    let uniswap = {
        Factory: { address: "0x1F98431c8aD98523631AE4a59f267346ea31F984", ABI: IUniswapV2Factory__factory.abi },
        Router: { address: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", ABI: IUniswapV2Router02__factory.abi },
    };

    let tokens = {
        DAI: {
            contract: { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", ABI: IDAI__factory.abi } as Contract,
            units: 18,
            balanceSlot: 2
        },

        USDT: {
            contract: { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", ABI: IUSDT__factory.abi } as Contract,
            units: 6,
            balanceSlot: 51
        },

        WETH: {
            contract: { address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", ABI: IWETH__factory.abi } as Contract,
            units: 18,
        },
        USDC: {
            contract: {
                delegator: { address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", ABI: IFiatTokenProxy__factory.abi },
                implementation: { address: "0x1efb3f88bc88f03fd1804a5c53b7141bbef5ded8", ABI: IUSDC__factory.abi },
            } as Proxy,
            units: 6,
            balanceSlot: 51
        },
        symbols: {
            // enables lookup with address: tokens[tokens.symbols[address]]
            "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1": "DAI",
            "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9": "USDT",
            "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": "WETH",
            "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8": "USDC",
        },
    };

    return {
        aave,
        abracadabra,
        balancer,
        convex,
        curve,
        timelessfi,
        uniswap,
        yearn,
        tokens
    };
};
