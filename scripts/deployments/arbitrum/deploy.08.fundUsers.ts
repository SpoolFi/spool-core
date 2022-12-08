import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { doTransferAssetsToWallets } from "../test/shared/toolkit";
import {getFunds} from "../test/shared/utilities";
import {accountsFixture} from "../scripts/deployUtils";

/**
 * Fund user wallets on staging/testing environments
 * @param hre
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log("Transferring funds to users.");
    const users = await hre.ethers.getSigners();
    const accounts = await accountsFixture(hre);
    await getFunds(accounts.administrator);
    await doTransferAssetsToWallets(users.slice(20, 80), "1000000");
};

export default func;
func.tags = ["arbitrum", "Spool.fundUsers"];
