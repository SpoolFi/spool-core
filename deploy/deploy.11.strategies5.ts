import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
    accountsFixture,
    DeployIdleTranchesEuler,
    loadContracts,
    tokensFixture,
    writeContracts,
} from "../scripts/deployUtils";

/**
 * Deploy strategies that depend on core spool contracts
 * @param hre
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log("Loading accounts..");
    const accounts = await accountsFixture(hre);

    console.log("Deploying tokens..");
    const tokens = await tokensFixture(accounts.administrator, hre);

    console.log("Deploying idle Tranches (Euler)..");
    let idleTranchesEuler = await DeployIdleTranchesEuler(accounts, tokens, hre);


    let implementation = {
        idleTranchesEuler
    };

    let strategies = (await loadContracts(hre)).strategies;
    strategies = { ...strategies, ...implementation };
    await writeContracts(hre, { strategies });

    console.log("contracts:");
    console.log(JSON.stringify(implementation));
};

export default func;
func.tags = ["Spool.strategies5"];
