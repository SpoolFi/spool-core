import { ILendingPool__factory } from "../../build/types/factories/ILendingPool__factory";
import { ILendingPoolAddressesProvider__factory } from "../../build/types/factories/ILendingPoolAddressesProvider__factory";
import { IAaveIncentivesController__factory} from "../../build/types/factories/IAaveIncentivesController__factory";

import { IComptroller__factory } from "../../build/types/factories/IComptroller__factory";

import { IBooster__factory } from "../../build/types/factories/IBooster__factory";

import { IHarvestPool__factory } from "../../build/types/factories/IHarvestPool__factory";
import { IVault__factory } from "../../build/types/factories/IVault__factory";

import { IMasterChef__factory } from "../../build/types/factories/IMasterChef__factory";

import { IUniswapV2Factory__factory } from "../../build/types/factories/IUniswapV2Factory__factory";
import { IUniswapV2Router02__factory } from "../../build/types/factories/IUniswapV2Router02__factory";

import { IDAI__factory } from "../../build/types/factories/IDAI__factory";
import { IUSDT__factory } from "../../build/types/factories/IUSDT__factory";
import { IWETH__factory } from "../../build/types/factories/IWETH__factory";

import { IYearnTokenVault__factory } from "../../build/types/factories/IYearnTokenVault__factory";

import {BINANCE_WALLET} from "./utilities";
import { IUSDC__factory } from "../../build/types";

export type Contract = {
    address: string;
    ABI: any;
}

export type Address = {
    address: string;
}

export interface Proxy {
    delegator: Contract;
    implementation: Contract;
}

export type Token = {
    contract: any;
    units: number;
    holder: any;
}

export interface Aave {
    stkAAVE: Proxy;
    LendingPool: Proxy;
    IncentiveController: Proxy;
    LendingPoolAddressesProvider: Contract;
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

export interface Convex {
    Booster: Contract;
    _3pool: ConvexPool;
}

export type CurvePool = {
    pool: Address;
    lpToken: Address;
    LiquidityGauge: Address;
    totalTokens: number;
}

export interface Curve {
    CRV: Contract;
    Minter: Address;
    _3pool: CurvePool;
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

export interface Keeper {
    Token: Contract;
    Distributer: Contract;
    Pool: Contract;
}

export interface Masterchef {
    Sushi: Contract;
    Masterchef: Contract;
}

export interface StakeDAO {
    Token: Contract;
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

export interface Tokens {
    DAI: Token;
    USDC: Token;
    USDT: Token;
    WETH: Token;
}

export interface Network {
    aave: Aave;
    barnBridge: BarnBridge;
    compound: Compound;
    convex: Convex;
    curve: Curve;
    harvest: Harvest;
    idle: Idle;
    masterchef: Masterchef;
    uniswap: Uniswap;
    yearn: Yearn;
    tokens: Tokens;
}

export interface Mainnet extends Network {}
export interface Kovan extends Network {}
export interface Rinkeby extends Network {}

export const mainnet = function mainnet(): Mainnet {


    let aave = {
        stkAAVE: {
            delegator: { address: "0x4da27a545c0c5b758a6ba100e3a049001de870f5", ABI: null },
            implementation: {address: "0xe42f02713aec989132c1755117f768dbea523d2f", ABI: null },
        },
        IncentiveController: {
            delegator: { address: "0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5", ABI: null },
            implementation: {address: "0x83d055d382f25e6793099713505c68a5c7535a35", ABI: IAaveIncentivesController__factory.abi},
        },
        LendingPool: {
            delegator: { address: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9", ABI: null },
            implementation: {address: "0xc6845a5c768bf8d7681249f8927877efda425baf", ABI: ILendingPool__factory.abi},
        },
        LendingPoolAddressesProvider: {
            address: "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5",
            ABI: ILendingPoolAddressesProvider__factory.abi
        },
    };

    let barnBridge = {
        BOND: {
            address: "0x0391d2021f89dc339f60fff84546ea23e337750f"
        },
        aDAI: {
            SmartYield: {
                address: "0x6c9dae2c40b1e5883847bf5129764e76cb69fc57",
            },
            MultiPool: {
                address: "0x69951b60b6253697f29c8311bfcea6da09bbac0d",
            }
        },
        aUSDC: {
            SmartYield: {
                address: "0x3cf46da7d65e9aa2168a31b73dd4beea5ca1a1f1",
            },
            MultiPool: {
                address: "0xf4bde50cdf4ee4cf3fb8702fceb6fd499a92792d",
            }
        },
        aUSDT: {
            SmartYield: {
                address: "0x660daf6643191cf0ed045b861d820f283ca078fc",
            },
            MultiPool: {
                address: "0x51d924bf2ff813a68bd5f86cdcc98918f2ae5868",
            }
        },
    };

    let compound = {
        COMP: {address: "0xc00e94cb662c3520282e6f5717214004a7f26888", ABI: null},
        COMPtroller: {
            delegator: {address: "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B", ABI: null},
            implementation: {address: "0xbafe01ff935c7305907c33bf824352ee5979b526", ABI: IComptroller__factory.abi},
        },
        cDAI: {
            delegator: {address: "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643", ABI: null},
            implementation: {address: "0xa035b9e130f2b1aedc733eefb1c67ba4c503491f", ABI: null},
        },
        cUSDC: {address: "0x39aa39c021dfbae8fac545936693ac917d5e7563", ABI: null},
        cUSDT: {
            delegator: {address: "0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9", ABI: null},
            implementation: {address: "0xa035b9e130f2b1aedc733eefb1c67ba4c503491f", ABI: null},
        }
    } as Compound;

    let convex = {
        Booster: {address: "0xF403C135812408BFbE8713b5A23a04b3D48AAE31", ABI: IBooster__factory.abi},
        _3pool: {
            boosterPoolId: 9,
        },
    };

    let curve = {
        CRV: {address: "0xD533a949740bb3306d119CC777fa900bA034cd52", ABI: null},
        Minter: {address: "0xd061d61a4d941c39e5453435b6345dc261c2fce0"},
        _3pool: {
            pool: {address: "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7"},
            lpToken: {address: "0x6c3f90f043a72fa612cbac8115ee7e52bde6e490"},
            LiquidityGauge: {address: "0xbFcF63294aD7105dEa65aA58F8AE5BE2D9d0952A"},
            totalTokens: 3
        },
    };

    let harvest = {
        FARM: {address: "0xa0246c9032bC3A600820415aE600c6388619A14D", ABI: null},
        DAI: {
            Vault: {address: "0xab7fa2b2985bccfc13c6d86b1d5a17486ab1e04c", ABI: IVault__factory.abi},
            Pool: {address: "0x15d3A64B2d5ab9E152F16593Cdebc4bB165B5B4A", ABI: IHarvestPool__factory.abi}
        },
        USDC: {
            Vault: {address: "0xf0358e8c3CD5Fa238a29301d0bEa3D63A17bEdBE", ABI: IVault__factory.abi},
            Pool: {address: "0x4F7c28cCb0F1Dbd1388209C67eEc234273C878Bd", ABI: IHarvestPool__factory.abi}
        },
        USDT: {
            Vault: {address: "0x053c80eA73Dc6941F518a68E2FC52Ac45BDE7c9C", ABI: IVault__factory.abi},
            Pool: {address: "0x6ac4a7AB91E6fD098E13B7d347c6d4d1494994a2", ABI: IHarvestPool__factory.abi}
        },
        Controller: {address: "0x3cc47874dc50d98425ec79e647d83495637c55e3"},
        Governance: {address: "0xf00dd244228f51547f0563e60bca65a30fbf5f7f"}
    };

    let idle = {
        Token: {address: "0x3fE7940616e5Bc47b0775a0dccf6237893353bB4", ABI: null},
        idleDAI: {address: "0x3fe7940616e5bc47b0775a0dccf6237893353bb4"},
        idleUSDC: {address: "0x5274891bEC421B39D23760c04A6755eCB444797C"},
        idleUSDT: {address: "0xF34842d05A1c888Ca02769A633DF37177415C2f8"},
    };

    let masterchef = {
        Sushi: {address: "0x6B3595068778DD592e39A122f4f5a5cF09C90fE2", ABI: null},
        Masterchef: {address: "0xbD17B1ce622d73bD438b9E658acA5996dc394b0d", ABI: IMasterChef__factory.abi},
    };

    let uniswap = {
        Factory: {address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f", ABI: IUniswapV2Factory__factory.abi},
        Router: {address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", ABI: IUniswapV2Router02__factory.abi},
    };

    let yearn = {
        DAIVault: {address: "0xdA816459F1AB5631232FE5e97a05BBBb94970c95", ABI: IYearnTokenVault__factory.abi},
        USDCVault: {address: "0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE", ABI: IYearnTokenVault__factory.abi},
        USDTVault: {address: "0x7Da96a3891Add058AdA2E826306D812C638D87a7", ABI: IYearnTokenVault__factory.abi},
    };

    let tokens = {
        DAI: {
            contract: {address: "0x6b175474e89094c44da98b954eedeac495271d0f", ABI: IDAI__factory.abi} as Contract,
            units: 18,
            holder: BINANCE_WALLET,
        },

        USDT: {
            contract: {address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", ABI: IUSDT__factory.abi} as Contract,
            units: 6,
            holder: BINANCE_WALLET,
        },

        WETH: {
            contract: {address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", ABI: IWETH__factory.abi} as Contract,
            units: 18,
            holder: BINANCE_WALLET,
        },
        USDC: {
            contract: {
                delegator: {address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", ABI: null},
                implementation: {address: "0xa2327a938febf5fec13bacfb16ae10ecbc4cbdcf", ABI: IUSDC__factory.abi},
            } as Proxy,
            units: 6,
            holder: BINANCE_WALLET,
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
        masterchef,
        uniswap,
        yearn,
        tokens,
    };
};
