import { BigNumber, BigNumberish } from "ethers";
import { ethers } from "hardhat";

import { SlippagesHelper__factory, SpoolDoHardWorkReallocationHelper__factory } from "../../build/types";
import { SlippageStruct } from "../../build/types/SlippagesHelper";
import { Result } from "ethers/lib/utils";
import { Context } from "../../scripts/infrastructure";
import { customConstants, getStrategyIndexes } from "./utilities";
import { ReallocationWithdrawDataHelperStruct } from "../../build/types/SpoolDoHardWorkReallocationHelper";

// the view functions will calculate the optimal values. howoever we apply
// a small perentage difference before passing the slippage as an argument, in the case
// that the on-chain state has changed before DHW has successfully executed.
// they are considered as basis points out of 10000.
// eg. for 50, slippage value passed is 0.5% less than calcuated value (0.55 == (50 / 10000) * 100)
// first index for each is deposit, second is withdraw.

const FULL_PERCENT = "10000";
const ADDRESS_ONE = "0x0000000000000000000000000000000000000001";
const Uint2pow255 = BigNumber.from("0x8000000000000000000000000000000000000000000000000000000000000000");

function encodeDepositSlippage(slippage: BigNumberish) {
    return BigNumber.from(slippage).add(Uint2pow255);
}

function decodeSlippageIfDeposit(slippage: BigNumberish) {
    let slippy = BigNumber.from(slippage);
    if (slippy.gte(Uint2pow255)) {
        slippy = slippy.sub(Uint2pow255);
    }
    return slippy;
}

const percents = {
    // deposit, withdrawal, balance - all in basis points
    "3pool": [30, 30, 3],
    Idle: [50, 50],
    Yearn: [30, 30],
};
// let spoolContracts: any;
// let contracts: any;
const stratIndexes: number[] = [];

// reduce a big number by a percentage, expressed in basis points.
function reduceByPercentage(x: BigNumber, bp: number) {
    const maxBP = BigNumber.from(FULL_PERCENT);
    const bpBN = BigNumber.from(bp.toString());
    const val = x.sub(x.mul(bpBN).div(maxBP));
    return val;
}

function getPercentage(x: BigNumber, bp: number) {
    console.log("getPercentage", x, bp);
    return x.mul(bp).div(FULL_PERCENT);
}

function convertToSlippageStruct(raw: any): SlippageStruct {
    let slippage: SlippageStruct = {
        slippage: BigNumber.from(raw[0].toString()),
        isDeposit: Boolean(raw[1]),
        canProcess: Boolean(raw[2]),
        balance: BigNumber.from(raw[3].toString()),
    };
    printSlippage(slippage);
    return slippage;
}

function printSlippage(slippage: SlippageStruct) {
    console.log("Slippage argument: " + slippage.slippage.toString());
    console.log("Is it a deposit? : " + slippage.isDeposit);

    console.log("Will it have deposits/withdrawals processed by DoHardWork? " + slippage.canProcess);
    console.log("");
}

function handleSlippageResult(slippage: SlippageStruct, _percents: number[]): BigNumber {
    if (!slippage.canProcess) {
        return BigNumber.from(0);
    }
    let slippageValue = BigNumber.from(slippage.slippage);
    if (slippage.isDeposit) {
        return encodeDepositSlippage(reduceByPercentage(slippageValue, _percents[0]));
    }
    return reduceByPercentage(slippageValue, _percents[1]);
}

async function strategyHelperCall(functionName: string, args: any, context: Context): Promise<Result> {
    console.log("strategyHelperCall", functionName, args);

    const strategyHelperInterface = new ethers.utils.Interface(SlippagesHelper__factory.abi);
    const functionFragment = strategyHelperInterface.getFunction(functionName);
    const encodedData = strategyHelperInterface.encodeFunctionData(functionFragment, args);
    console.log("RELAY");

    const rawResult = await context.infra.spool
        .connect(context.infra.spool.provider)
        .callStatic.relay(context.helperContracts.slippagesHelper, encodedData, {
            from: ADDRESS_ONE,
        });
    console.log("rawResult", rawResult);
    const result = strategyHelperInterface.decodeFunctionResult(functionFragment, rawResult);
    return result[0];
}

function findRealocationShares(strat: string, context: Context, reallocationWithdrawnShares?: BigNumber[]) {
    if (reallocationWithdrawnShares && reallocationWithdrawnShares.length > 0) {
        const i = context.strategies.All.findIndex((s) => s == strat);

        return reallocationWithdrawnShares[i];
    }
    return ethers.constants.Zero;
}

// ************************ SLIPPAGES ********************************************

// gets slippages for Convex and Curve
async function get3PoolSlippage(
    context: Context,
    reallocationWithdrawnShares?: BigNumber[]
): Promise<Array<BigNumber[]>> {
    const strategies = [
        context.strategies.Convex.DAI,
        context.strategies.Convex.USDC,
        context.strategies.Convex.USDT,
        context.strategies.Curve.DAI,
        context.strategies.Curve.USDC,
        context.strategies.Curve.USDT,
    ];

    const reallocateSharesToWithdraw = strategies.map((s3pl) => {
        return findRealocationShares(s3pl, context, reallocationWithdrawnShares);
    });

    let result = await strategyHelperCall("get3PoolSlippage", [strategies, reallocateSharesToWithdraw], context);

    const slippageArgs = new Array<BigNumber[]>();
    for (let i = 0; i < result.length; i++) {
        let raw = result[i];

        let slippage = convertToSlippageStruct(raw);
        let slippageBalance = BigNumber.from(slippage.balance);
        const balanceSlippage = getPercentage(slippageBalance, percents["3pool"][2]);

        let slippageArg = [
            slippageBalance.sub(balanceSlippage),
            slippageBalance.add(balanceSlippage),
            handleSlippageResult(slippage, percents["3pool"]),
        ];

        slippageArgs.push(slippageArg);
    }
    return slippageArgs;
}

async function getIdleSlippage(
    strategy: string,
    context: Context,
    reallocationWithdrawnShares?: BigNumber[]
): Promise<BigNumber[]> {
    const reallocateSharesToWithdraw = findRealocationShares(strategy, context, reallocationWithdrawnShares);

    const result = await strategyHelperCall("getIdleSlippage", [strategy, reallocateSharesToWithdraw], context);
    const slippage = convertToSlippageStruct(result);
    return [handleSlippageResult(slippage, percents["Idle"])];
}

async function getYearnSlippage(
    strategy: string,
    context: Context,
    reallocationWithdrawnShares?: BigNumber[]
): Promise<BigNumber[]> {
    const reallocateSharesToWithdraw = findRealocationShares(strategy, context, reallocationWithdrawnShares);

    const result = await strategyHelperCall("getYearnSlippage", [strategy, reallocateSharesToWithdraw], context);
    const slippage = convertToSlippageStruct(result);
    if (slippage.isDeposit) {
        return [handleSlippageResult(slippage, percents["Yearn"])];
    }
    // in the withdraw case, a maxLoss basis points value is directly passed, so no reduction in percent
    return [handleSlippageResult(slippage, [0, 0])];
}

export async function getSlippages(context: Context) {
    if (!context.strategies) {
        return {
            indexes: [],
            slippages: [],
            allStrategies: [],
            rewardSlippages: [],
        };
    }

    const strategies = context.strategies;
    const allStrategies = await context.infra.controller.getAllStrategies();

    console.log("*********CALCULATING SLIPPAGES*********");
    const slippages = await getDhwSlippages(context);
    console.log("*********SLIPPAGE CALCULATED*********");

    let indexes = allStrategies.map((strat) => {
        return strategies.All.findIndex((s) => s == strat);
    });

    const slippys: BigNumber[][] = [];

    indexes.forEach((i) => {
        slippys.push(slippages[i]);
    });

    const rewardSlippages = Array.from(Array(indexes.length), () => {
        return { doClaim: false, swapData: [] };
    });

    console.log("done.");

    return {
        indexes,
        slippages: slippys,
        allStrategies,
        rewardSlippages,
    };
}

async function doHardWorkReallocationHelper(context: Context, reallocationTable: BigNumber[][]) {
    const stratIndexes = getStrategyIndexes(context.strategies.All, context.strategies.All);

    const rewardSlippages = Array.from(Array(context.strategies.All.length), () => {
        return { doClaim: false, swapData: [] };
    });

    const withdrawData: ReallocationWithdrawDataHelperStruct = {
        reallocationTable: reallocationTable,
        rewardSlippages: rewardSlippages,
        stratIndexes: stratIndexes,
    };

    const reallocationHelper = SpoolDoHardWorkReallocationHelper__factory.connect(
        context.helperContracts.reallocationHelper,
        context.accounts.doHardWorker
    );

    const encodedData = reallocationHelper.interface.encodeFunctionData("batchDoHardWorkReallocationHelper", [
        withdrawData,
        context.strategies.All,
    ]);

    const rawResult = await context.infra.spool
        .connect(context.infra.spool.provider)
        .callStatic.relay(context.helperContracts.reallocationHelper, encodedData, {
            from: ADDRESS_ONE,
        });

    const result = reallocationHelper.interface.decodeFunctionResult("batchDoHardWorkReallocationHelper", rawResult);

    return result[0] as BigNumber[];
}

export async function getReallocationSlippages(context: Context, reallocationTable: BigNumber[][]) {
    const stratIndexes = getStrategyIndexes(context.strategies.All, context.strategies.All);

    const priceSlippages = Array.from(Array(context.strategies.All.length), () => {
        return { min: 0, max: customConstants.MaxUint128 };
    });

    const rewardSlippages = Array.from(Array(context.strategies.All.length), () => {
        return { doClaim: false, swapData: [] };
    });

    const reallocationWithdrawnShares = await doHardWorkReallocationHelper(context, reallocationTable);

    const withdrawSlippages = await getDhwSlippages(context, reallocationWithdrawnShares);

    console.log("reallocationWithdrawnShares");
    console.table(reallocationWithdrawnShares.map((ss) => decodeSlippageIfDeposit(ss).toString()));

    const withdrawData = {
        reallocationTable: reallocationTable,
        priceSlippages: priceSlippages,
        rewardSlippages: rewardSlippages,
        stratIndexes: stratIndexes,
        slippages: withdrawSlippages,
    };

    // NOTE: mark all strat slippages as deposits in the deposit phase
    // later on we add tight slippages
    const depositSlippages = getDhwDepositSlippage(context);

    const depositData = {
        stratIndexes: stratIndexes,
        slippages: depositSlippages,
    };

    // NOTE: consider this for correct order of execution
    const allStrategies = await context.infra.controller.getAllStrategies();

    console.log("withdrawSlippages");
    console.table(withdrawSlippages.map((rr) => rr.map((ss) => decodeSlippageIfDeposit(ss).toString())));

    console.log("depositSlippages");
    console.table(depositSlippages.map((rr) => rr.map((ss) => decodeSlippageIfDeposit(ss).toString())));

    console.log("allStrategies");
    console.table(allStrategies);

    console.log("context.strategies.All");
    console.table(context.strategies.All);

    console.log("Strats");
    const stratNames = Object.keys(context.strategies)
        .filter((s) => s != "All")
        .flatMap((s) => Object.keys((context.strategies as any)[s]).map((st) => s + st));

    console.table(stratNames.map((stratName, i) => [stratName, context.strategies.All[i]]));

    return {
        withdrawData,
        depositData,
        allStrategies,
        rewardSlippages,
    };
}

async function getDhwSlippages(context: Context, reallocationWithdrawnShares?: BigNumber[]) {
    const curvePoolSlippages = await get3PoolSlippage(context, reallocationWithdrawnShares);
    let slippages = new Array<BigNumber[]>();

    if (!context.strategies) return slippages;

    for (let stratName in context.strategies) {
        switch (stratName) {
            case "Aave": {
                slippages.push([], [], []);
                continue;
            }
            case "Compound": {
                slippages.push([], [], []);
                continue;
            }
            case "Convex": {
                slippages.push(curvePoolSlippages[0], curvePoolSlippages[1], curvePoolSlippages[2]);
                continue;
            }
            case "Curve": {
                slippages.push(curvePoolSlippages[3], curvePoolSlippages[4], curvePoolSlippages[5]);
                continue;
            }
            case "Harvest": {
                slippages.push([], [], []);
                continue;
            }
            case "Idle": {
                slippages.push(
                    await getIdleSlippage(context.strategies.Idle.DAI, context, reallocationWithdrawnShares),
                    await getIdleSlippage(context.strategies.Idle.USDC, context, reallocationWithdrawnShares),
                    await getIdleSlippage(context.strategies.Idle.USDT, context, reallocationWithdrawnShares)
                );
                continue;
            }
            case "Yearn": {
                slippages.push(
                    await getYearnSlippage(context.strategies.Yearn.DAI, context, reallocationWithdrawnShares),
                    await getYearnSlippage(context.strategies.Yearn.USDC, context, reallocationWithdrawnShares),
                    await getYearnSlippage(context.strategies.Yearn.USDT, context, reallocationWithdrawnShares)
                );
                continue;
            }
        }
    }
    
    return slippages;
}

function getDhwDepositSlippage(context: Context) {
    const depositSlippage = encodeDepositSlippage(0);
    const slippages = new Array<BigNumberish[]>();

    for (let stratName in context.strategies) {
        switch (stratName) {
            case "Aave": {
                slippages.push([], [], []);
                continue;
            }
            case "Compound": {
                slippages.push([], [], []);
                continue;
            }
            case "Convex": {
                slippages.push([0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, depositSlippage]);
                continue;
            }
            case "Curve": {
                slippages.push([0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, depositSlippage]);
                continue;
            }
            case "Harvest": {
                slippages.push([], [], []);
                continue;
            }
            case "Idle": {
                slippages.push([depositSlippage]);
                slippages.push([depositSlippage]);
                slippages.push([depositSlippage]);
                continue;
            }
            case "Yearn": {
                slippages.push([depositSlippage]);
                slippages.push([depositSlippage]);
                slippages.push([depositSlippage]);
                continue;
            }
        }
    }

    return slippages;
}
