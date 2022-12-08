import { Context } from "../../scripts/infrastructure";
import { BigNumber, ContractTransaction } from "ethers";
import { pack } from "@ethersproject/solidity";
import { getRewardSwapPathBalancer, getRewardSwapPathV2Weth, PathBalancerAsset, PathBalancerSwap } from "./utilities";
import { ethers } from "hardhat";
import { getReallocationSlippages, getSlippages } from "./dhwUtils";
import {arbitrum, mainnet} from "./constants";

export type ActionType = "deposit" | "withdrawal";

type FeeValue = 10000 | 3000 | 500;

export const UNISWAP_V3_FEE = {
    _10000: 10000 as FeeValue,
    _3000: 3000 as FeeValue,
    _500: 500 as FeeValue,
};

type PathV3 = {
    address: string;
    fee: FeeValue;
};

export const mainnetConst = mainnet();
export const arbitrumConst = arbitrum();

function getRewardSwapPathV3Custom(fee: FeeValue, path: PathV3[]) {
    const types = ["uint8", "uint24"];
    const values: any[] = [6, fee];

    path.forEach((p) => {
        types.push("address");
        values.push(p.address);
        types.push("uint24");
        values.push(p.fee);
    });

    return pack(types, values);
}

function getRewardSwapPathV3Weth(fee1: FeeValue, fee2: FeeValue) {
    const types = ["uint8", "uint24", "uint24"];
    const values: any[] = [5, fee1, fee2];

    return pack(types, values);
}

const swapPathWeth = getRewardSwapPathV2Weth();

const swapPathStkAave = getRewardSwapPathV3Custom(UNISWAP_V3_FEE._3000, [
    // AAVE
    { address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", fee: UNISWAP_V3_FEE._3000 },
    // WETH
    { address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", fee: UNISWAP_V3_FEE._500 },
]);

const swapPath3000Weth500 = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._3000, UNISWAP_V3_FEE._500);


// const swapPathCvxWeth = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._3000, UNISWAP_V3_FEE._500);
const swapPathWeth10000 = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._10000, UNISWAP_V3_FEE._500);

const swapDataConvex = [
    { slippage: 1, path: swapPath3000Weth500 },
    { slippage: 1, path: swapPathWeth10000 },
];

const swapDataConvexExtra = [
    { slippage: 1, path: swapPath3000Weth500 },
    { slippage: 1, path: swapPathWeth10000 },
    { slippage: 1, path: swapPathWeth10000 },
];

const swapPath_COMP = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._3000, UNISWAP_V3_FEE._500);
const swapPath_IDLE = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._3000, UNISWAP_V3_FEE._500);

const swapSlippages = [
    { slippage: 0, path: swapPath_COMP },
    { slippage: 0, path: swapPathStkAave },
    { slippage: 0, path: swapPath_IDLE },
];

const baseSwap : PathBalancerSwap = 
    {
        poolId: '0x5122e01d819e58bb2e22528c0d68d310f0aa6fd7000200000000000000000163', // 80 NOTE - 20 WETH
        indexIn: 0,
        indexOut: 1
    }


const swapDAI : PathBalancerSwap[] = [
    baseSwap,
    {
        poolId: '0x0b09dea16768f0799065c475be02919503cb2a3500020000000000000000001a', // 40 DAI - 60 WETH
        indexIn: 1,
        indexOut: 2
    }
]

const swapUSDC : PathBalancerSwap[] = [ 
    baseSwap,
    {
        poolId: '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019', // 50 USDC - 50 WETH
        indexIn: 1,
        indexOut: 2
    }
]

const assetsDAI : PathBalancerAsset[] = [
    { asset: mainnetConst.notional.NOTE.address, },
    { asset: mainnetConst.tokens.WETH.contract.address, },
    { asset: mainnetConst.tokens.DAI.contract.address }
]

const assetsUSDC : PathBalancerAsset[] = [
    { asset: mainnetConst.notional.NOTE.address, },
    { asset: mainnetConst.tokens.WETH.contract.address, },
    { asset: mainnetConst.tokens.USDC.contract.delegator.address }
]

const swapPathBalancerNOTEDAI = getRewardSwapPathBalancer(swapDAI, assetsDAI);
const swapPathBalancerNOTEUSDC = getRewardSwapPathBalancer(swapUSDC, assetsUSDC);

function getRewardSlippages(strategies: any) {
    return Object.keys(strategies)
        .filter((s) => s != "All")
        .flatMap((stratName) => {
            return getRewardSlippage(stratName);
        });
}

function getRewardSlippage(stratName: string) {
    switch (stratName) {
        case "Aave": {
            return [
                { doClaim: true, swapData: [{ slippage: 1, path: swapPathStkAave }] },
                { doClaim: true, swapData: [{ slippage: 1, path: swapPathStkAave }] },
                { doClaim: true, swapData: [{ slippage: 1, path: swapPathStkAave }] }
            ]
        }
        case "AaveV3": {
            return [
                { doClaim: true, swapData: [{ slippage: 1, path: swapPathStkAave }] },
                { doClaim: true, swapData: [{ slippage: 1, path: swapPathStkAave }] },
                { doClaim: true, swapData: [{ slippage: 1, path: swapPathStkAave }] }
            ]
        }
        case "Abracadabra": {
            return [
                { doClaim: true, swapData: [{ slippage: 1, path: swapPathWeth }] },
                { doClaim: true, swapData: [{ slippage: 1, path: swapPathWeth }] }
            ]
        }
        case "Compound": {
            return [ 
                { doClaim: true, swapData: [{ slippage: 1, path: swapPath3000Weth500 }] },
                { doClaim: true, swapData: [{ slippage: 1, path: swapPath3000Weth500 }] },
                { doClaim: true, swapData: [{ slippage: 1, path: swapPath3000Weth500 }] }
            ]
        }
        case "Convex": {
            return [ 
                { doClaim: true, swapData: swapDataConvex }, 
                { doClaim: true, swapData: swapDataConvex }, 
                { doClaim: true, swapData: swapDataConvex } 
            ]
        }
        case "Convex4pool": {
            return [ 
                { doClaim: true, swapData: swapDataConvexExtra }, 
                { doClaim: true, swapData: swapDataConvexExtra }, 
                { doClaim: true, swapData: swapDataConvexExtra },
            ]
        }
        case "ConvexMetapool": {
            return [ 
                { doClaim: true, swapData: swapDataConvexExtra }, 
                { doClaim: true, swapData: swapDataConvexExtra }, 
                { doClaim: true, swapData: swapDataConvexExtra },
            ]
        }
        case "Curve": {
            return [ 
                { doClaim: true, swapData: [{ slippage: 1, path: swapPath3000Weth500 }] },
                { doClaim: true, swapData: [{ slippage: 1, path: swapPath3000Weth500 }] },
                { doClaim: true, swapData: [{ slippage: 1, path: swapPath3000Weth500 }] }
            ];
        }
        case "Curve2pool": {
            return [ 
                { doClaim: true, swapData: [{ slippage: 1, path: swapPath3000Weth500 }] },
                { doClaim: true, swapData: [{ slippage: 1, path: swapPath3000Weth500 }] }
            ];
        }
        case "Idle": {
            return [ 
                { doClaim: true, swapData: swapSlippages }, 
                { doClaim: true, swapData: swapSlippages }, 
                { doClaim: true, swapData: swapSlippages }
            ]
        }
        case "Morpho": {
            return [ 
                { doClaim: true, swapData: [{ slippage: 1, path: swapPath3000Weth500 }] },
                { doClaim: true, swapData: [{ slippage: 1, path: swapPath3000Weth500 }] },
                { doClaim: true, swapData: [{ slippage: 1, path: swapPath3000Weth500 }] }
            ]
        }
        case "Notional": {
            return [ 
                { doClaim: true, swapData: [{ slippage: 1, path: swapPathBalancerNOTEDAI }] },
                { doClaim: true, swapData: [{ slippage: 1, path: swapPathBalancerNOTEUSDC }] },
            ]
        }
        case "TimelessFi": {
            return [ 
                { doClaim: false, swapData: [] },
            ]
        }
        case "YearnMetapool": {
            return [ 
                { doClaim: false, swapData: [] },
                { doClaim: false, swapData: [] },
            ]
        }
        default: {
            return [ 
                { doClaim: false, swapData: [] }, 
                { doClaim: false, swapData: [] }, 
                { doClaim: false, swapData: [] } 
            ];
        }
    }
}

export async function doHardWork(context: Context, getRewards: boolean): Promise<ContractTransaction> {
    console.log(`>> Do hard work, get rewards: ${getRewards}`);

    if (getRewards) {
        await ethers.provider.send("evm_increaseTime", [BigNumber.from(100_000).toNumber()]);
        await ethers.provider.send("hardhat_mine", [BigNumber.from(7000).toHexString(), "0x0"]);
    }
    
    const _strategies = context.strategies[context.network];
    const strategies = _strategies!.All;
    const rewardSlippages = getRewardSlippages(_strategies);

    const chainStrats = await context.infra.controller.getAllStrategies();

    console.log('All strats:');
    console.log(strategies);

    console.log('chain strats:');
    console.log(chainStrats);

    const { indexes, slippages } = await getSlippages(context);
    return context.infra.spool
        .connect(context.accounts.doHardWorker)
        .batchDoHardWork(indexes, slippages, rewardSlippages, strategies);
}

export async function doHardWorkReallocation(context: Context, getRewards: boolean, reallocationTable: BigNumber[][]) {
    console.log(`>> Do hard work REALLOCATION, get rewards: ${getRewards}`);

    if (getRewards) {
        await ethers.provider.send("evm_increaseTime", [BigNumber.from(1_691_800).toNumber()]);
    }

    const { withdrawData, depositData, allStrategies } = await getReallocationSlippages(context, reallocationTable);

    await context.infra.spool
        .connect(context.accounts.doHardWorker)
        .batchDoHardWorkReallocation(withdrawData, depositData, allStrategies, true);

    console.log(">> DoHardWork REALLOCATION finished.");
}
