import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
    accountsFixture,
    DeployCompound,
    DeployConvex,
    DeployConvex4pool,
    DeployConvexMetapool,
    DeployMorpho,
    DeployNotional,
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
    let Notional = await DeployNotional(accounts, tokens, spoolFixture, hre);
    let Compound = await DeployCompound(accounts, tokens, spoolFixture, hre);
    let Convex = await DeployConvex(accounts, tokens, spoolFixture, hre);
    let Convex4pool = await DeployConvex4pool(accounts, tokens, spoolFixture, hre);
    let ConvexMetapool = await DeployConvexMetapool(accounts, tokens, spoolFixture, hre);
    let Morpho = await DeployMorpho(accounts, tokens, spoolFixture, hre);

    let implementation = {
        Notional,
        Compound,
        Convex,
        Convex4pool,
        ConvexMetapool,
        Morpho
    };

    let strategies = (await loadContracts(hre)).strategies;
    strategies = { ...strategies, ...implementation };
    await writeContracts(hre, { strategies });

    console.log("contracts:");
    console.log(JSON.stringify(implementation));
};

export default func;
func.tags = ["mainnet", "Spool.strategies2"];
