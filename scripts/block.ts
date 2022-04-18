import { ethers } from "hardhat";

export async function main() {
    const block = await ethers.provider.getBlock("latest");
    console.log("block number:", block.number);
    console.log("block timestamp:", block.timestamp);
    console.log("block date:", new Date(block.timestamp * 1000));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
