import { Context } from "../../scripts/infrastructure";
import { BigNumber, constants, ContractTransaction } from "ethers";
import { pack } from "@ethersproject/solidity";
import { encodeDepositSlippage, getRewardSwapPathV3Direct } from "./utilities";
import { ethers } from "hardhat";
import { getReallocationSlippages, getSlippages } from "./dhwUtils";

export type ActionType = "deposit" | "withdrawal";
const { MaxUint256 } = constants;

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
        default: {
            return [ 
                { doClaim: false, swapData: [] }, 
                { doClaim: false, swapData: [] }, 
                { doClaim: false, swapData: [] } 
            ];
        }
    }
}

function getDhwSlippages(strategies: any, type: ActionType) {
    return Object.keys(strategies)
        .filter((s) => s != "All")
        .flatMap((stratName) => {
            const slippages = getDhwSlippage(stratName, type);
            return [slippages, slippages, slippages];
        });
}

function getDhwSlippage(stratName: string, type: ActionType) {
    const depositSlippage = encodeDepositSlippage(0);
    switch (stratName) {
        case "Aave": {
            return [];
        }
        case "BarnBridge": {
            return type == "deposit" ? [depositSlippage] : [0];
        }
        case "Compound": {
            return [];
        }
        case "Convex": {
            return type == "deposit" ? [0, MaxUint256, depositSlippage] : [0, MaxUint256, 0];
        }
        case "Convex4pool": {
            return type == "deposit" ? [0, MaxUint256, depositSlippage] : [0, MaxUint256, 0];
        }
        case "ConvexMetapool": {
            return type == "deposit" ? [0, MaxUint256, depositSlippage] : [0, MaxUint256, 0];
        }
        case "Curve": {
            return type == "deposit" ? [0, MaxUint256, depositSlippage] : [0, MaxUint256, 0];
        }
        case "Harvest": {
            return [];
        }
        case "Idle": {
            return type == "deposit" ? [depositSlippage] : [0];
        }
        case "Morpho": {
            return [];
        }
        case "Yearn": {
            return type == "deposit" ? [depositSlippage] : [0];
        }
        default: {
            throw new Error(`Strategy: "${stratName}" not supported`);
        }
    }
}

export async function doHardWork(context: Context, getRewards: boolean): Promise<ContractTransaction> {
    console.log(`>> Do hard work, get rewards: ${getRewards}`);

    if (getRewards) {
        await ethers.provider.send("evm_increaseTime", [BigNumber.from(100_000).toNumber()]);
        await ethers.provider.send("hardhat_mine", [BigNumber.from(7000).toHexString(), "0x0"]);
    }

    const strategies = context.strategies!.All;
    const rewardSlippages = getRewardSlippages(context.strategies);

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
