import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
    accountsFixture,
    DeployEuler,
    loadContracts,
    tokensFixture,
    writeContracts,
} from "../scripts/deployUtils";

/**
 * Deploy Euler script
 * @param hre
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log("Loading accounts..");
    const accounts = await accountsFixture(hre);

    console.log("Deploying tokens..");
    const tokens = await tokensFixture(accounts.administrator, hre);

    console.log("Deploying Euler..");
    let Euler = await DeployEuler(accounts, tokens, hre);


    let implementation = {
        Euler
    };

    let strategies = (await loadContracts(hre)).strategies;
    strategies = { ...strategies, ...implementation };
    await writeContracts(hre, { strategies });

    console.log("contracts:");
    console.log(JSON.stringify(implementation));
};

export default func;
func.tags = ["mainnet", "Spool.strategies6"];
