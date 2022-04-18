import { ethers } from "hardhat";

export async function main() {
    await ethers.provider.send("evm_setNextBlockTimestamp", [Math.floor(Date.now() / 1000 + 20)]);
    await ethers.provider.send("evm_mine", []);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
