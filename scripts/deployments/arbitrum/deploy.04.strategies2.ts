import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
    accountsFixture,
    DeployAbracadabra,
    DeployCurve2pool,
    DeployYearnMetapool,
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
    let Abracadabra = await DeployAbracadabra(accounts, tokens, spoolFixture, hre);
    let Curve2pool = await DeployCurve2pool(accounts, tokens, spoolFixture, hre);
    let YearnMetapool = await DeployYearnMetapool(accounts, tokens, hre);

    let implementation = {
        Abracadabra,
        Curve2pool,
        YearnMetapool
    };

    let strategies = (await loadContracts(hre)).strategies;
    strategies = { ...strategies, ...implementation };
    await writeContracts(hre, { strategies });

    console.log("contracts:");
    console.log(JSON.stringify(implementation));
};

export default func;
func.tags = ["arbitrum", "Spool.strategies2"];
