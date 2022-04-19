import {
    AlphaRouter,
    AlphaRouterConfig,
    ChainId,
    routeAmountsToString,
    RouteWithValidQuote,
    V2Route,
    V3Route,
} from "@uniswap/smart-order-router";
import { CurrencyAmount, Percent, Token, TradeType } from "@uniswap/sdk-core";
import { BigNumber } from "ethers";

import { mainnet, Strategies, StrategyType, Tokens } from "./constants";
import hre, { ethers as hhEthers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
    ADDRESS_ONE,
    convertToRewardDataStruct,
    FeeValue,
    getRewardSwapPathV2Custom,
    getRewardSwapPathV2Direct,
    getRewardSwapPathV3Custom,
    getRewardSwapPathV3Direct,
} from "./utilities";
import { SlippagesHelper__factory, Spool__factory } from "../../build/types";
import { Result } from "ethers/lib/utils";
import {
    accountsFixture,
    AccountsFixture,
    loadContracts,
    loadSpoolInfra,
    loadStrategies,
} from "../../scripts/deployUtils";
import { SpoolFixture } from "../../scripts/infrastructure";
import { StrategiesContracts } from "../../scripts/data/interface";

const mConstants = mainnet();
export const mainnetConst = mConstants;

// Interfaces for the data that will be returned.
interface amountOut {
    raw: number; // raw amount given for amount in
    gasAdjusted: number; // amount when gas is taken from the receiving token
}

interface SwapData {
    path: string;
    amountOut: amountOut;
}

interface Reward {
    tokenIn: string;
    swapData: SwapData;
}

interface Strategy {
    strategyAddress: string;
    rewards: Reward[];
    underlying: string;
    name: string;
}

// Maps to be used for internal processing.
type BNMap = Map<string, BigNumber>;
type BN2DMap = Map<string, BNMap>;

type SwapDataMap = Map<string, SwapData>;
type SwapData2DMap = Map<string, SwapDataMap>;

const EMPTY_PATH = "0x";
const EMPTY_SWAP_DATA: SwapData = {
    path: EMPTY_PATH,
    amountOut: {
        raw: 0,
        gasAdjusted: 0,
    },
};

const isV3Route = (route: V3Route | V2Route): route is V3Route => (route as V3Route).pools != undefined;

/**
 * Helper function to static call the rewardsHelper contract through the Spool contract.
 * @param _rewardsHelper
 * @param _spool
 * @param functionName
 * @param args
 */
async function rewardsHelperStaticCall(
    _rewardsHelper: string,
    _spool: string,
    functionName: string,
    args: any
): Promise<Result> {
    const spool = Spool__factory.connect(_spool, hhEthers.provider);
    const rewardsHelper = SlippagesHelper__factory.connect(_rewardsHelper, hhEthers.provider);

    const strategyHelperInterface = new hhEthers.utils.Interface(SlippagesHelper__factory.abi);
    const functionFragment = strategyHelperInterface.getFunction(functionName);
    const encodedData = strategyHelperInterface.encodeFunctionData(functionFragment, args);
    const rawResult = await spool.callStatic.relay(rewardsHelper.address, encodedData, { from: ADDRESS_ONE });
    const result = strategyHelperInterface.decodeFunctionResult(functionFragment, rawResult);
    return result[0];
}

/**
 * Convert a route returned from the Uniswap router as a path to be used in DoHardWork.
 * @param routeWithValidQuote
 */
async function routeToSwapPath(routeWithValidQuote: RouteWithValidQuote[]): Promise<string> {
    console.log(routeAmountsToString(routeWithValidQuote));
    const route = routeWithValidQuote[0].route;
    const tokens = isV3Route(route) ? route.tokenPath : route.path;
    let addresses = tokens.map((token: any) => `${token.address}`);
    console.log("addresses:");
    console.log(addresses);
    let path = EMPTY_PATH;
    if (isV3Route(route)) {
        console.log("is V3 path.");
        let fees = route.pools.map((pool) => {
            return pool.fee;
        });
        console.log("fees:");
        console.log(fees);
        if (addresses.length == 2) {
            console.log("direct path.");
            // direct path.
            path = getRewardSwapPathV3Direct(fees[0] as FeeValue);
            console.log("path.");
        } else {
            // custom path.
            console.log("custom path.");
            let firstFee = fees[0] as FeeValue;
            console.log("first fee: " + firstFee);
            addresses = addresses.slice(1, -1);
            console.log("address slice: " + addresses);
            fees = fees.slice(1);
            console.log("fee slice: " + fees);
            let paths = [];
            for (let i = 0; i < addresses.length; i++) {
                paths.push({ address: addresses[i], fee: fees[i] as FeeValue });
            }
            path = getRewardSwapPathV3Custom(firstFee, paths);
        }
    } else {
        console.log("is V2 path.");
        console.log(addresses.slice(1, -1));
        if (addresses.length == 2) {
            // direct path.
            path = getRewardSwapPathV2Direct();
        } else {
            path = getRewardSwapPathV2Custom(addresses.slice(1, -1));
        }
    }
    console.log("path: " + path);
    return path;
}

/**
 * Call the Uniswap router with the desired parameters, and return the path and amounts.
 * @param signer
 * @param reward
 * @param underlying
 * @param amount
 */
export async function getSwapData(
    signer: SignerWithAddress,
    reward: Token,
    underlying: Token,
    amount: BigNumber
): Promise<SwapData> {
    console.log("reward" + JSON.stringify(reward));
    console.log("underlying" + JSON.stringify(underlying));
    console.log("amount" + amount);
    const provider = new hhEthers.providers.JsonRpcProvider(process.env.MAINNET_URL); // connect to mainnet directly, not fork (speed issues with Hardhat)
    // @ts-ignore
    const router = new AlphaRouter({ chainId: 1, provider });

    const swapConfig = {
        recipient: signer.address,
        slippageTolerance: new Percent(5, 1000), // 0.5%
        deadline: Math.floor(Date.now() / 1000 + 1800),
    };

    const routingConfig: AlphaRouterConfig = {
        v2PoolSelection: {
            topN: 3,
            topNDirectSwaps: 2,
            topNTokenInOut: 2,
            topNSecondHop: 1,
            topNWithEachBaseToken: 2,
            topNWithBaseToken: 6,
        },
        v3PoolSelection: {
            topN: 3,
            topNDirectSwaps: 2,
            topNTokenInOut: 2,
            topNSecondHop: 1,
            topNWithEachBaseToken: 2,
            topNWithBaseToken: 6,
        },
        maxSwapsPerPath: 4,
        maxSplits: 1,
        minSplits: 1,
        forceCrossProtocol: false,
        distributionPercent: 5,
    };

    const fromAndAmount = CurrencyAmount.fromRawAmount(reward, amount.toString());
    console.log(fromAndAmount);

    console.log("running router..");
    const swapRoutes = await router.route(fromAndAmount, underlying, TradeType.EXACT_INPUT, swapConfig, routingConfig);
    if (swapRoutes == null) {
        throw new Error("Error: router.route call failed for reward " + reward.name + " to " + underlying.name);
    }

    const { quoteGasAdjusted, quote, route: routeAmounts } = swapRoutes;

    const amountOut: amountOut = {
        raw: Number(quote.toFixed(Math.min(quote.currency.decimals, 2))),
        gasAdjusted: Number(quoteGasAdjusted.toFixed(Math.min(quote.currency.decimals, 2))),
    };
    console.log("amountOut: " + amountOut.raw);
    console.log("amountOutGasAdjusted: " + amountOut.gasAdjusted);
    const path = await routeToSwapPath(routeAmounts);
    const swapData: SwapData = {
        path: path,
        amountOut: amountOut,
    };
    return swapData;
}

/**
 * Gets all the paths and amounts for the rewards in each strategy
 * @param swapData
 * @param tokens
 * @param administrator
 */
async function swapDataForStrategy(
    swapData: BN2DMap,
    tokens: Tokens,
    administrator: SignerWithAddress
): Promise<SwapData2DMap> {
    console.log("SWAP DATA FOR STRATEGY");
    let swapDatas = new Map<string, SwapDataMap>();
    for (let [underlyingAddr, reward] of swapData) {
        console.log("UNDERLYING IN SWAP: " + underlyingAddr);
        const to = tokens[tokens.symbols[underlyingAddr] as keyof Tokens];
        let rewardToSwapData = new Map<string, SwapData>();
        for (let [rewardAddr, _amount] of reward) {
            console.log("REWARD IN SWAP: " + rewardAddr);
            console.log(tokens.symbols[rewardAddr]);
            const from = tokens[tokens.symbols[rewardAddr] as keyof Tokens];
            console.log("from: " + from);
            const amount = _amount as BigNumber;
            console.log("value to swap: " + amount.toString());
            const swapData = amount.eq(0) ? EMPTY_SWAP_DATA : await getSwapData(administrator, from, to, amount);
            console.log("reward: " + reward);
            //const route = await getSwapData(administrator, from, to, );
            console.log("route:");
            console.log(JSON.stringify(swapData));
            rewardToSwapData.set(rewardAddr, swapData);
        }
        swapDatas.set(underlyingAddr, rewardToSwapData);
    }

    return swapDatas;
}

function getStrategyExtras(strategy: string): string[] {
    let extraArgs: string[] = [];
    switch (strategy) {
        case "Compound":
            extraArgs = [mainnetConst.compound.COMP.address];
            break;
        case "Curve":
            extraArgs = [mainnetConst.curve.CRV.address];
            break;
        case "Harvest":
            extraArgs = [mainnetConst.harvest.FARM.address];
            break;
    }
    return extraArgs;
}

/**
 * static calls the claim functions for each strategy, and then gets the swap paths and amounts for the above.
 * @param rewardsHelper
 * @param accounts
 * @param strategies
 * @param infra
 */
async function getSwapPathsForAllRewardTokens(
    rewardsHelper: string,
    accounts: AccountsFixture,
    strategies: StrategiesContracts,
    infra: SpoolFixture
): Promise<SwapData2DMap> {
    const tokens = mainnetConst.tokens;
    const _spool = infra.spool.address;

    let dataForSwap = new Map<string, BNMap>();

    for (let stratTypeKey of Object.keys(strategies)) {
        //console.log('STRATEGY TYPE: ' + stratTypeKey);

        let stratType = strategies[stratTypeKey as keyof Strategies];

        //console.log('GET ALL REWARD AMOUNTS FOR SWAP..');

        for (let stratKey of Object.keys(stratType)) {
            let strat = stratType[stratKey as keyof StrategyType];

            const claimFunctionName = "claimRewards".concat(stratTypeKey);

            const claimArgs = [strat, getStrategyExtras(stratKey)];

            //console.log('GETTING REWARDS AMOUNT..');
            const rewardDatas = await rewardsHelperStaticCall(rewardsHelper, _spool, claimFunctionName, claimArgs);

            //console.log('REWARD DATAS...')
            console.log(rewardDatas);

            //console.log('GET SWAP PATH FOR REWARDS..')
            for (let rewardDataRaw of rewardDatas) {
                let rewardData = convertToRewardDataStruct(rewardDataRaw, "");

                let rewardAmounts = dataForSwap.get(rewardData.to); // get underlying swap amounts
                if (rewardAmounts === undefined) {
                    rewardAmounts = new Map<string, BigNumber>();
                }
                let rewardAmount = rewardAmounts.get(rewardData.from);
                if (rewardAmount === undefined) {
                    rewardAmount = BigNumber.from(0);
                }
                //console.log('SETTING DATA FOR SWAP...')
                rewardAmounts.set(rewardData.from, rewardAmount.add(BigNumber.from(rewardData.amount)));
                dataForSwap.set(rewardData.to, rewardAmounts);
            }
        }
    }

    console.log(dataForSwap);

    console.log("GET SWAP PATHS FOR REWARD AMOUNTS..");
    let swapDatas = await swapDataForStrategy(dataForSwap, tokens, accounts.administrator);
    console.log("dataForSwap:");
    console.log(swapDatas);

    return swapDatas;
}

/**
 * get the swap path from the internal map that was created above.
 * @param dataForSwap
 * @param underlying
 * @param reward
 */
function getSwapPathForReward(dataForSwap: SwapData2DMap, underlying: string, reward: string): SwapData {
    let underlyingRewards = dataForSwap.get(underlying) as SwapDataMap;
    let swapPath = underlyingRewards.get(reward) as SwapData;
    return swapPath;
}

/**
 * parses all the data as a Strategy array.
 * @param rewardsHelper
 * @param dataForSwap
 * @param accounts
 * @param strategiesContracts
 * @param infra
 */
async function getStrategyData(
    rewardsHelper: string,
    dataForSwap: SwapData2DMap,
    accounts: AccountsFixture,
    strategiesContracts: StrategiesContracts,
    infra: SpoolFixture
): Promise<Strategy[]> {
    const tokens = mainnetConst.tokens;
    const _spool = infra.spool.address;

    let strategies = new Array<Strategy>();
    for (let stratTypeKey of Object.keys(strategiesContracts)) {
        console.log("STRATEGY TYPE: " + stratTypeKey);

        let stratType = strategiesContracts[stratTypeKey as keyof Strategies];

        console.log("GET ALL REWARD AMOUNTS FOR SWAP..");

        for (let stratKey of Object.keys(stratType)) {
            let strat = stratType[stratKey as keyof StrategyType];

            console.log("UNDERLYING: " + stratKey);
            console.log("ADDRESS: " + strat);

            const claimFunctionName = "claimRewards".concat(stratTypeKey);
            console.log(claimFunctionName);
            const claimArgs = [strat, getStrategyExtras(strat)];

            console.log("GETTING REWARDS AMOUNT..");
            const rewardDatas = await rewardsHelperStaticCall(rewardsHelper, _spool, claimFunctionName, claimArgs);
            console.log("REWARD DATAS:");
            console.log(rewardDatas);

            let rewards = new Array<Reward>();
            for (let rewardDataRaw of rewardDatas) {
                let rewardData = convertToRewardDataStruct(rewardDataRaw, EMPTY_PATH);
                let swapData = getSwapPathForReward(dataForSwap, rewardData.to, rewardData.from);
                let reward: Reward = {
                    tokenIn: rewardData.from,
                    swapData: swapData,
                };
                rewards.push(reward);
            }

            let strategy: Strategy = {
                strategyAddress: strat,
                rewards: rewards,
                underlying: tokens[stratKey as keyof typeof tokens].address,
                name: stratTypeKey.concat(stratKey),
            };
            console.log("strategy: ");
            console.log(JSON.stringify(strategy));
            strategies.push(strategy);
        }
    }

    return strategies;
}

export async function main() {
    const strategies = await loadStrategies(hre);
    const accounts = await accountsFixture(hre);
    const infra = await loadSpoolInfra(accounts, hre);

    let contracts = await loadContracts(hre);

    // gets swap paths for rewards -> underlying, for amount to be claimed, across all strats.
    let dataForSwap = await getSwapPathsForAllRewardTokens(contracts.rewardsHelper, accounts, strategies, infra);
    // gets the slippage values using the swap paths.
    await getStrategyData(contracts.rewardsHelper, dataForSwap, accounts, strategies, infra);
    //await getSwapDataTest();
}

/**
 * Tester function for the uniswap router.
 */
export async function getSwapDataTest() {
    const signers = await hhEthers.getSigners();
    const administrator = signers[0];
    const tokens = mainnetConst.tokens;

    let amount = BigNumber.from(hhEthers.utils.parseUnits("10"));
    let reward = new Token(ChainId.MAINNET, tokens.stkAAVE.contract.address, tokens.stkAAVE.units, "stkAAVE");
    let underlying = new Token(ChainId.MAINNET, tokens.DAI.contract.address, tokens.DAI.units, "stkAAVE");

    const results = await getSwapData(administrator, reward, underlying, amount);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
