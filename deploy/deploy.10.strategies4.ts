import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
    accountsFixture,
    DeployMorphoAave,
    loadContracts,
    loadSpoolInfra,
    tokensFixture,
    writeContracts,
} from "../scripts/deployUtils";

/**
 * Deploy Morpho-Aave script
 * @param hre
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log("Loading accounts..");
    const accounts = await accountsFixture(hre);

    console.log("Loading spool..");
    const spoolFixture = await loadSpoolInfra(accounts, hre);

    console.log("Deploying tokens..");
    const tokens = await tokensFixture(accounts.administrator, hre);

    console.log("Deploying Morpho-Aave strategy..");
    let MorphoAave = await DeployMorphoAave(accounts, tokens, spoolFixture, hre);

    let implementation = {
        MorphoAave
    };

    let strategies = (await loadContracts(hre)).strategies;
    strategies = { ...strategies, ...implementation };
    await writeContracts(hre, { strategies });

    console.log("contracts:");
    console.log(JSON.stringify(implementation));
};

export default func;
func.tags = ["Spool.strategies4"];
