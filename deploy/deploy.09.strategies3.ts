import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
    accountsFixture,
    DeployConvex2pool,
    loadContracts,
    loadSpoolInfra,
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

    console.log("Loading spool..");
    const spoolFixture = await loadSpoolInfra(accounts, hre);

    console.log("Deploying tokens..");
    const tokens = await tokensFixture(accounts.administrator, hre);

    console.log("Deploying all strategies..");
    let Convex2pool = await DeployConvex2pool(accounts, tokens, spoolFixture, hre);


    let implementation = {
        Convex2pool
    };

    let strategies = (await loadContracts(hre)).strategies;
    strategies = { ...strategies, ...implementation };
    await writeContracts(hre, { strategies });

    console.log("contracts:");
    console.log(JSON.stringify(implementation));
};

export default func;
func.tags = ["Spool.strategies3"];