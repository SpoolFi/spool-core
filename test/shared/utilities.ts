import hre, { ethers } from "hardhat";
import { BigNumber, BigNumberish, ContractTransaction } from "ethers";
import {
    IHarvestController__factory,
    UniswapV2Factory,
    UniswapV2Pair,
    UniswapV2Pair__factory,
    Vault,
    Vault__factory,
} from "../../build/types";
import { Controller, VaultDetailsStruct } from "../../build/types/Controller";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Log } from "@ethersproject/abstract-provider";
import { BaseContract } from "@ethersproject/contracts";
import { pack } from "@ethersproject/solidity";
import { mainnet } from "./constants";
import { SlippageStruct } from "../../build/types/SlippagesHelper";
import { RewardDataStruct } from "../../build/types/RewardsHelper";

export { BasisPoints } from "./chaiExtension/chaiExtAssertions";
export { VaultDetailsStruct };

// constants
export const SECS_DAY: number = 86400;
export const parseUnits = ethers.utils.parseUnits;
export const TEN_UNITS = parseUnits("10");
export const TEN_UNITS_E8 = TEN_UNITS.div(parseUnits("1", 10));
export const TEN_POW_6 = BigNumber.from(10).pow(6);
export const BINANCE_WALLET = "0xe78388b4ce79068e89bf8aa7f218ef6b9ab0e9d0";
export const ADDRESS_ONE = "0x0000000000000000000000000000000000000001";

const MaxUint16 = BigNumber.from("0xffff");
const MaxUint128 = BigNumber.from("0xffffffffffffffffffffffffffffffff");
const Uint2pow255 = BigNumber.from("0x8000000000000000000000000000000000000000000000000000000000000000");

export const customConstants = {
    MaxUint16,
    MaxUint128,
};

export function getMillionUnits(decimals: BigNumberish) {
    return BigNumber.from(1_000_000).mul(BigNumber.from(10).pow(decimals));
}

export function getPercentageTwoDecimal(value: BigNumberish, percentage: BigNumberish): BigNumber {
    return BigNumber.from(value).mul(percentage).div(100_00);
}

// blockchain manipulation (time and blocks)

export async function increase(seconds: BigNumberish) {
    await ethers.provider.send("evm_increaseTime", [BigNumber.from(seconds).toNumber()]);
}

export async function increaseTo(seconds: BigNumberish) {
    await ethers.provider.send("evm_setNextBlockTimestamp", [BigNumber.from(seconds).toNumber()]);
}

export async function mineBlocks(blockNumber: number, seconds = 0) {
    if (seconds > 0) {
        await increase(BigNumber.from(seconds));
    }

    while (blockNumber > 0) {
        blockNumber--;
        await ethers.provider.send("evm_mine", []);
    }
}

// chain fork utils

export async function impersonate(account: string): Promise<SignerWithAddress> {
    await ethers.provider.send("hardhat_impersonateAccount", [account]);
    return await ethers.getSigner(account);
}

export async function whitelistStrategy(address: string) {
    const mainnetConst = mainnet();
    await IHarvestController__factory.connect(
        mainnetConst.harvest.Controller.address,
        await impersonate(mainnetConst.harvest.Governance.address)
    ).addToWhitelist(address);
}

export function isForking(): boolean {
    return hre.config.networks.hardhat.forking ? true : false;
}

export async function reset() {
    if (isForking()) {
        let params = {
            forking: {
                jsonRpcUrl: hre.config.networks.hardhat.forking!.url,
                blockNumber: hre.config.networks.hardhat.forking!.blockNumber,
            },
        };
        await ethers.provider.send("hardhat_reset", [params]);
    }
}

// uniswap add pair

export async function createAndSupply(
    factory: UniswapV2Factory,
    account: SignerWithAddress,
    tokenA: any,
    tokenB: any,
    units: number[],
    amounts: string[]
): Promise<UniswapV2Pair> {
    await factory.createPair(tokenA.address, tokenB.address);

    const UniswapV2PairFactory = await new UniswapV2Pair__factory().connect(account);
    const pairAddress = await factory.getPair(tokenA.address, tokenB.address);
    const lp = (await UniswapV2PairFactory.attach(pairAddress)) as UniswapV2Pair;

    await tokenA.transfer(lp.address, parseUnits(amounts[0], units[0]));
    await tokenB.transfer(lp.address, parseUnits(amounts[1], units[1]));

    // Mint Initial Liquidity to provided account
    await lp.mint(account.address);

    return lp;
}

// vault utils

export async function createVault(
    controller: Controller,
    vaultDetails: VaultDetailsStruct,
    from: SignerWithAddress
): Promise<Vault> {
    const vaultAddress = await controller.callStatic.createVault(vaultDetails);

    const vaultCreate = await controller.connect(from).createVault(vaultDetails);
    await vaultCreate.wait();

    return Vault__factory.connect(vaultAddress, from);
}

export function getStrategyIndexes(vaultStrats: string[], allStrats: string[]): number[] {
    let vaultIndexes: number[];
    vaultIndexes = [];

    vaultStrats.forEach((vs) => {
        vaultIndexes.push(allStrats.findIndex((s) => s == vs));
    });

    return vaultIndexes;
}

// bit manipulation for strategies and proportions

export function getBitwiseStrategies(strategiesArray: number[]) {
    strategiesArray.reverse();
    let bitwiseStrategyIndexes = BigNumber.from("0");

    strategiesArray.forEach((p) => {
        bitwiseStrategyIndexes = bitwiseStrategyIndexes.shl(8);
        bitwiseStrategyIndexes = bitwiseStrategyIndexes.add(BigNumber.from(p));
    });

    strategiesArray.reverse();

    return bitwiseStrategyIndexes;
}

export function getBitwiseProportions(proportionsArray: number[]) {
    proportionsArray.reverse();
    let bitwiseProportions = BigNumber.from("0");

    proportionsArray.forEach((p) => {
        bitwiseProportions = bitwiseProportions.shl(14);
        bitwiseProportions = bitwiseProportions.add(p);
    });
    proportionsArray.reverse();

    return bitwiseProportions;
}

export function getProportionsFromBitwise(bitwiseProportions: BigNumber, length: number) {
    const proportionsArray = [];
    const bit14Mask = BigNumber.from("2").pow(14).sub(1);

    for (let i = 0; i < length; i++) {
        proportionsArray.push(bitwiseProportions.and(bit14Mask));
        bitwiseProportions = bitwiseProportions.shr(14);
    }

    return proportionsArray;
}

// Parse reallocation from the event

type ReallocationTableUpdatedWithTableEvent = {
    index: BigNumber;
    reallocationTableHash: string;
    reallocationTable: BigNumber[][];
};

export function getReallocationTableFromEvent(logs: Log[], contract: BaseContract) {
    return getLogByName(
        logs,
        "ReallocationTableUpdatedWithTable",
        contract
    ) as any as ReallocationTableUpdatedWithTableEvent;
}

function getLogByName(logs: Log[], topicName: string, contract: BaseContract) {
    const eventFragment = contract.interface.getEvent(topicName);
    const topic = contract.interface.getEventTopic(eventFragment);

    const log = logs
        .filter((log) => log.topics.includes(topic))
        .find((log) => log.address && log.address.toLowerCase() === contract.address.toLowerCase());

    if (!log) {
        throw new Error(`No ${topicName} event emitted from ${contract.address}`);
    }

    return contract.interface.decodeEventLog(topicName, log?.data, log.topics);
}

export type TestContext = {
    reallocationTable: BigNumber[][];
};

export async function setReallocationTable(tx: ContractTransaction, spool: BaseContract, context: TestContext) {
    const receipt = await tx.wait();

    const reallocationEvent = getReallocationTableFromEvent(receipt.logs, spool);

    context.reallocationTable = reallocationEvent.reallocationTable;
}

// Reward swap data utils

export type FeeValue = 10000 | 3000 | 500;

export const UNISWAP_V3_FEE = {
    _10000: 10000 as FeeValue,
    _3000: 3000 as FeeValue,
    _500: 500 as FeeValue,
};

export function getRewardSwapPathV2Direct() {
    return pack(["uint8"], [1]);
}

export function getRewardSwapPathV2Weth() {
    return pack(["uint8"], [2]);
}

export function getRewardSwapPathV2Custom(path: string[]) {
    const types = ["uint8"];
    const values: any[] = [3];

    path.forEach((p) => {
        types.push("address");
        values.push(p);
    });

    return pack(types, values);
}

export function getRewardSwapPathV3Direct(fee: FeeValue) {
    const types = ["uint8", "uint24"];
    const values: any[] = [4, fee];

    return pack(types, values);
}

export function getRewardSwapPathV3Weth(fee1: FeeValue, fee2: FeeValue) {
    const types = ["uint8", "uint24", "uint24"];
    const values: any[] = [5, fee1, fee2];

    return pack(types, values);
}

type PathV3 = {
    address: string;
    fee: FeeValue;
};

export function getRewardSwapPathV3Custom(fee: FeeValue, path: PathV3[]) {
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

// for deposit slippage we set the most significant bit to 1 (withdraw most significant bit is 0)
export function encodeDepositSlippage(slippage: BigNumberish) {
    return BigNumber.from(slippage).add(Uint2pow255);
}

// ********** SLIPPAGE UTILS **********
// reduce a big number by a percentage, expressed in basis points.
export function reduceByPercentage(x: BigNumber, bp: number) {
    const maxBP = BigNumber.from("10000");
    const bpBN = BigNumber.from(bp.toString());
    const val = x.sub(x.div(maxBP).mul(bpBN));
    return val;
}

export function convertBPToPercentage(bp: number): number {
    return (bp / 10000) * 100;
}

export function convertToRewardDataStruct(raw: string[], _path: string): RewardDataStruct {
    let rewardData: RewardDataStruct = {
        from: raw[0].toString(),
        to: raw[1].toString(),
        amount: BigNumber.from(raw[2].toString()),
        swapData: {
            slippage: 0,
            path: _path,
        },
        atRouter: Boolean(raw[4]),
    };
    return rewardData;
}

export function convertToSlippageStruct(raw: any): SlippageStruct {
    let slippage: SlippageStruct = {
        slippage: BigNumber.from(raw[0].toString()),
        isDeposit: Boolean(raw[1]),
        canProcess: Boolean(raw[2]),
        basisPoints: Number(raw[3]),
        balance: BigNumber.from(raw[4].toString()),
    };
    printSlippage(slippage);
    return slippage;
}

export function printSlippage(slippage: SlippageStruct) {
    console.log("Slippage argument: " + ethers.utils.formatUnits(slippage.slippage.toString()));
    console.log("Is it a deposit? : " + slippage.isDeposit);
    console.log(
        "Percentage difference between output and input to slippage function: " +
            convertBPToPercentage(Number(slippage.basisPoints)) +
            "%"
    );
    console.log("Will it have deposits/withdrawals processed by DoHardWork? " + slippage.canProcess);
    console.log("");
}

export function handleSlippageResult(slippage: SlippageStruct, _percents: number[]): BigNumber {
    if (!slippage.canProcess) {
        return BigNumber.from(0);
    }
    let arg = BigNumber.from(slippage.slippage);
    if (slippage.isDeposit) {
        return encodeDepositSlippage(reduceByPercentage(arg, _percents[0]));
    }
    return reduceByPercentage(arg, _percents[1]);
}
