import { BigNumber, BigNumberish } from "ethers";
import { ethers } from "hardhat";

import { SlippagesHelper__factory, SpoolDoHardWorkReallocationHelper__factory } from "../../../build/types";
import { SlippageStruct } from "../../../build/types/SlippagesHelper";
import { Result } from "ethers/lib/utils";
import { Context } from "../../../scripts/infrastructure";
import { customConstants, getNetworkName, getStrategyIndexes } from "./../utilities";
import { ReallocationWithdrawDataHelperStruct } from "../../../build/types/SpoolDoHardWorkReallocationHelper";

// the view functions will calculate the optimal values. howoever we apply
// a small perentage difference before passing the slippage as an argument, in the case
// that the on-chain state has changed before DHW has successfully executed.
// they are considered as basis points out of 10000.
// eg. for 50, slippage value passed is 0.5% less than calcuated value (0.5 == (50 / 10000) * 100)
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
    "2pool": [30, 30, 3],
    "3pool": [30, 30, 3],
    "4pool": [150, 150, 3],
    Euler: [50, 50],
    Idle: [50, 50],
    Notional: [50, 50],
    Yearn: [30, 30, 3],
};

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
        price: BigNumber.from(raw[4].toString()),
    };
    printSlippage(slippage);
    return slippage;
}

function printSlippage(slippage: SlippageStruct) {
    console.log("Slippage (Protocol) argument: " + slippage.slippage.toString());
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
        console.log(context.strategies[context.network].All);
        const i = context.strategies[context.network].All.findIndex((s) => s == strat);

        return reallocationWithdrawnShares[i];
    }
    return ethers.constants.Zero;
}

// ************************ SLIPPAGES ********************************************

// gets slippages for Convex and Curve 3pool (3pool as base pool for all)
async function get3PoolSlippage(
    context: Context,
    reallocationWithdrawnShares?: BigNumber[]
): Promise<Array<BigNumber[]>> {
    const strategies = [
        context.strategies.mainnet.ConvexMetapool.DAI,
        context.strategies.mainnet.ConvexMetapool.USDC,
        context.strategies.mainnet.ConvexMetapool.USDT,
        context.strategies.mainnet.Convex.DAI,
        context.strategies.mainnet.Convex.USDC,
        context.strategies.mainnet.Convex.USDT,
        context.strategies.mainnet.Curve.DAI,
        context.strategies.mainnet.Curve.USDC,
        context.strategies.mainnet.Curve.USDT,
    ].flat();

    const reallocateSharesToWithdraw = strategies.map((s3pl) => {
        return findRealocationShares(s3pl, context, reallocationWithdrawnShares);
    });

    let result = await strategyHelperCall("get3PoolSlippage", [strategies, reallocateSharesToWithdraw], context);

    const slippageArgs = new Array<BigNumber[]>();
    for (let i = 0; i < result.length; i++) {
        let raw = result[i];

        let slippage = convertToSlippageStruct(raw);
        let slippageBalance = BigNumber.from(slippage.balance);
        let slippagePrice = BigNumber.from(slippage.price);
        const balanceSlippage = getPercentage(slippageBalance, percents["3pool"][2]);
        const priceSlippage = getPercentage(slippagePrice, percents["3pool"][2]);

        let slippageArg = [
            slippageBalance.sub(balanceSlippage),
            slippageBalance.add(balanceSlippage),
            slippagePrice.sub(priceSlippage),
            slippagePrice.add(priceSlippage),
            handleSlippageResult(slippage, percents["3pool"]),
        ];

        slippageArgs.push(slippageArg);
    }
    return slippageArgs;
}

// gets slippages for Convex 2pool
async function getConvex2PoolSlippage(
    context: Context,
    reallocationWithdrawnShares?: BigNumber[]
): Promise<Array<BigNumber[]>> {
    const strategies = [
        context.strategies.mainnet.Convex2pool.USDC,
    ].flat();

    const reallocateSharesToWithdraw = strategies.map((s3pl) => {
        return findRealocationShares(s3pl, context, reallocationWithdrawnShares);
    });

    let result = await strategyHelperCall("getConvex2PoolSlippage", [strategies, reallocateSharesToWithdraw], context);

    const slippageArgs = new Array<BigNumber[]>();
    for (let i = 0; i < result.length; i++) {
        let raw = result[i];

        let slippage = convertToSlippageStruct(raw);
        let slippageBalance = BigNumber.from(slippage.balance);
        let slippagePrice = BigNumber.from(slippage.price);
        const balanceSlippage = getPercentage(slippageBalance, percents["2pool"][2]);
        const priceSlippage = getPercentage(slippagePrice, percents["2pool"][2]);

        let slippageArg = [
            slippageBalance.sub(balanceSlippage),
            slippageBalance.add(balanceSlippage),
            slippagePrice.sub(priceSlippage),
            slippagePrice.add(priceSlippage),
            handleSlippageResult(slippage, percents["2pool"]),
        ];

        slippageArgs.push(slippageArg);
    }
    return slippageArgs;
}

// gets slippages for Convex 4pool
async function getConvex4PoolSlippage(
    context: Context,
    reallocationWithdrawnShares?: BigNumber[]
): Promise<Array<BigNumber[]>> {
    const strategies = [
        context.strategies.mainnet.Convex4pool.DAI,
        context.strategies.mainnet.Convex4pool.USDC,
        context.strategies.mainnet.Convex4pool.USDT,
    ].flat();

    const reallocateSharesToWithdraw = strategies.map((s3pl) => {
        return findRealocationShares(s3pl, context, reallocationWithdrawnShares);
    });

    let result = await strategyHelperCall("getConvex4PoolSlippage", [strategies, reallocateSharesToWithdraw], context);

    const slippageArgs = new Array<BigNumber[]>();
    for (let i = 0; i < result.length; i++) {
        let raw = result[i];

        let slippage = convertToSlippageStruct(raw);
        let slippageBalance = BigNumber.from(slippage.balance);
        let slippagePrice = BigNumber.from(slippage.price);
        const balanceSlippage = getPercentage(slippageBalance, percents["4pool"][2]);
        const priceSlippage = getPercentage(slippagePrice, percents["4pool"][2]);

        let slippageArg = [
            slippageBalance.sub(balanceSlippage),
            slippageBalance.add(balanceSlippage),
            slippagePrice.sub(priceSlippage),
            slippagePrice.add(priceSlippage),
            handleSlippageResult(slippage, percents["4pool"]),
        ];

        slippageArgs.push(slippageArg);
    }
    return slippageArgs;
}

async function getEulerSlippage(
    strategy: string,
    context: Context,
    reallocationWithdrawnShares?: BigNumber[]
): Promise<BigNumber[]> {
    const reallocateSharesToWithdraw = findRealocationShares(strategy, context, reallocationWithdrawnShares);

    const result = await strategyHelperCall("getEulerSlippage", [strategy, reallocateSharesToWithdraw], context);
    const slippage = convertToSlippageStruct(result);
    return [handleSlippageResult(slippage, percents["Euler"])];
}

// gets slippages for Convex Metapool
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

async function getNotionalSlippage(
    strategy: string,
    context: Context,
    reallocationWithdrawnShares?: BigNumber[]
): Promise<BigNumber[]> {
    const reallocateSharesToWithdraw = findRealocationShares(strategy, context, reallocationWithdrawnShares);

    const result = await strategyHelperCall("getNotionalSlippage", [strategy, reallocateSharesToWithdraw], context);
    const slippage = convertToSlippageStruct(result);
    return [handleSlippageResult(slippage, percents["Notional"])];
}

async function getYearnSlippage(
    strategy: string,
    context: Context,
    reallocationWithdrawnShares?: BigNumber[]
): Promise<BigNumber[]> {
    const reallocateSharesToWithdraw = findRealocationShares(strategy, context, reallocationWithdrawnShares);

    const result = await strategyHelperCall("getYearnSlippage", [strategy, reallocateSharesToWithdraw], context);
    const slippage = convertToSlippageStruct(result);
    let slippageBalance = BigNumber.from(slippage.balance);
    let slippagePrice = BigNumber.from(slippage.price);
    const balanceSlippage = getPercentage(slippageBalance, percents["Yearn"][2]);
    const priceSlippage = getPercentage(slippagePrice, percents["Yearn"][2]);

    let slippageArg = [
        slippageBalance.sub(balanceSlippage),
        slippageBalance.add(balanceSlippage),
        slippagePrice.sub(priceSlippage),
        slippagePrice.add(priceSlippage),
    ]
    if (slippage.isDeposit) {
        slippageArg.push(handleSlippageResult(slippage, percents["Yearn"]));
    } else {
        // in the withdraw case, a maxLoss basis points value is directly passed, so no reduction in percent
        slippageArg.push(handleSlippageResult(slippage, [0, 0]));
    }

    return slippageArg;
}

export async function getSlippagesMainnet(context: Context) {
    const strategies = context.strategies[context.network];
    if (!strategies) {
        return {
            indexes: [],
            slippages: [],
            allStrategies: [],
            rewardSlippages: [],
        };
    }

    const allStrategies = await context.infra.controller.getAllStrategies();

    console.log("*********CALCULATING SLIPPAGES*********");
    const slippages = await getDhwSlippagesMainnet(context);
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
    const strategies = context.strategies[context.network];
    const stratIndexes = getStrategyIndexes(strategies.All, strategies.All);

    const rewardSlippages = Array.from(Array(strategies.All.length), () => {
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
        strategies.All,
    ]);

    const rawResult = await context.infra.spool
        .connect(context.infra.spool.provider)
        .callStatic.relay(context.helperContracts.reallocationHelper, encodedData, {
            from: ADDRESS_ONE,
        });

    const result = reallocationHelper.interface.decodeFunctionResult("batchDoHardWorkReallocationHelper", rawResult);

    return result[0] as BigNumber[];
}

export async function getReallocationSlippagesMainnet(context: Context, reallocationTable: BigNumber[][]) {
    const strategies = context.strategies[context.network];
    const stratIndexes = getStrategyIndexes(strategies.All, strategies.All);

    const priceSlippages = Array.from(Array(strategies.All.length), () => {
        return { min: 0, max: customConstants.MaxUint128 };
    });

    const rewardSlippages = Array.from(Array(strategies.All.length), () => {
        return { doClaim: false, swapData: [] };
    });

    const reallocationWithdrawnShares = await doHardWorkReallocationHelper(context, reallocationTable);

    const withdrawSlippages = await getDhwSlippagesMainnet(context, reallocationWithdrawnShares);

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

    console.log("strategies.All");
    console.table(strategies.All);

    console.log("Strats");
    const stratNames = Object.keys(strategies)
        .filter((s) => s != "All")
        .flatMap((s) => Object.keys((strategies as any)[s]).map((st) => s + st));

    console.table(stratNames.map((stratName, i) => [stratName, strategies.All[i]]));

    return {
        withdrawData,
        depositData,
        allStrategies,
        rewardSlippages,
    };
}


export async function getDhwSlippagesMainnet(context: Context, reallocationWithdrawnShares?: BigNumber[]) {
    const curvePoolSlippages = await get3PoolSlippage(context, reallocationWithdrawnShares);
    const convex2poolSlippages = await getConvex2PoolSlippage(context, reallocationWithdrawnShares);
    const convex4poolSlippages = await getConvex4PoolSlippage(context, reallocationWithdrawnShares);
    let slippages = new Array<BigNumber[]>();

    let strategies = context.strategies.mainnet;

    if (!strategies) return slippages;

    for (let stratName in strategies) {
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
                slippages.push(curvePoolSlippages[3], curvePoolSlippages[4], curvePoolSlippages[5]);
                continue;
            }
            case "Convex2pool": {
                slippages.push(convex2poolSlippages[0]);
                continue;
            }
            case "Convex4pool": {
                slippages.push(convex4poolSlippages[0], convex4poolSlippages[1], convex4poolSlippages[2]);
                continue;
            }
            case "ConvexMetapool": {
                slippages.push(curvePoolSlippages[0], curvePoolSlippages[1], curvePoolSlippages[2]);
                continue;
            }
            case "Curve": {
                slippages.push(curvePoolSlippages[6], curvePoolSlippages[7], curvePoolSlippages[8]);
                continue;
            }
            case "Euler": {
                slippages.push(
                    await getEulerSlippage(strategies.Euler.DAI[0], context, reallocationWithdrawnShares),
                    await getEulerSlippage(strategies.Euler.USDC[0], context, reallocationWithdrawnShares),
                    await getEulerSlippage(strategies.Euler.USDT[0], context, reallocationWithdrawnShares),
                );
                continue;
            }
            case "Harvest": {
                slippages.push([], [], []);
                continue;
            }
            case "Morpho": {
                slippages.push([], [], []);
                continue;
            }
            case "MorphoAave": {
                slippages.push([], [], []);
                continue;
            }
            case "Notional": {
                slippages.push(
                    await getNotionalSlippage(strategies.Notional.DAI[0], context, reallocationWithdrawnShares),
                    await getNotionalSlippage(strategies.Notional.USDC[0], context, reallocationWithdrawnShares),
                );
                continue;
            }
            case "Idle": {
                slippages.push(
                    await getIdleSlippage(strategies.Idle.DAI[0], context, reallocationWithdrawnShares),
                    await getIdleSlippage(strategies.Idle.USDC[0], context, reallocationWithdrawnShares),
                    await getIdleSlippage(strategies.Idle.USDT[0], context, reallocationWithdrawnShares)
                );
                continue;
            }
            case "IdleTranchesEuler": {
                slippages.push([], [], []);
                continue;
            }
            case "Yearn": {
                slippages.push(
                    await getYearnSlippage(strategies.Yearn.DAI[0], context, reallocationWithdrawnShares),
                    await getYearnSlippage(strategies.Yearn.USDC[0], context, reallocationWithdrawnShares),
                    await getYearnSlippage(strategies.Yearn.USDT[0], context, reallocationWithdrawnShares)
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

    for (let stratName in context.strategies[context.network]) {
        switch (stratName) {
            case "Aave": {
                slippages.push([], [], []);
                continue;
            }
            case "AaveV3": {
                slippages.push([], [], []);
                continue;
            }
            case "Abracadabra": {
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                continue;
            }
            case "Balancer": {
                slippages.push([depositSlippage]);
                slippages.push([depositSlippage]);
                slippages.push([depositSlippage]);
                continue;
            }
            case "Compound": {
                slippages.push([], [], []);
                continue;
            }
            case "Convex": {
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                continue;
            }
            case "Convex2pool": {
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                continue;
            }
            case "Convex4pool": {
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                continue;
            }
            case "ConvexMetapool": {
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                continue;
            }
            case "Curve": {
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                continue;
            }
            case "Curve2pool": {
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                continue;
            }
            case "Euler": {
                slippages.push([depositSlippage]);
                slippages.push([depositSlippage]);
                slippages.push([depositSlippage]);
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
            case "Morpho": {
                slippages.push([], [], []);
                continue;
            }
            case "Notional": {
                slippages.push([depositSlippage]);
                slippages.push([depositSlippage]);
                continue;
            }
            case "TimelessFi": {
                slippages.push([]);
                continue;
            }
            case "Yearn": {
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage]);
                continue;
            }
            case "YearnMetapool": {
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage, depositSlippage]);
                slippages.push([0, ethers.constants.MaxUint256, 0, ethers.constants.MaxUint256, depositSlippage, depositSlippage]);
                continue;
            }
        }
    }

    return slippages;
}
