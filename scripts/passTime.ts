import { BigNumber, BigNumberish } from "ethers";
import { ethers as hhEthers } from "hardhat";

const SECS_DAY: number = 86400;

export async function increase(seconds: BigNumberish, ethers: typeof hhEthers) {
    await ethers.provider.send("evm_increaseTime", [BigNumber.from(seconds).toNumber()]);
    await ethers.provider.send("evm_mine", []);
}

export async function main(days: number, ethers: typeof hhEthers) {
    console.log(`Pass time days: ${days}, seconds: ${days * SECS_DAY}`);
    await increase(days * SECS_DAY, ethers);
}
