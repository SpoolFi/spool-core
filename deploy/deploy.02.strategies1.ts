import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
    accountsFixture,
    DeployAave,
    DeployCurve,
    DeployHarvest,
    DeployIdle,
    DeployYearn,
    tokensFixture,
    writeContracts,
} from "../scripts/deployUtils";

/**
 * Deploy strategies that do not depend on Spool core contracts
 * @param hre
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log("Loading accounts..");
    const accounts = await accountsFixture(hre);

    console.log("Deploying tokens..");
    const tokens = await tokensFixture(accounts.administrator, hre);

    console.log("Deploying all strategies..");
    let Aave = await DeployAave(accounts, tokens, hre);
    let Curve = await DeployCurve(accounts, tokens, hre);
    let Harvest = await DeployHarvest(accounts, tokens, hre);
    let Idle = await DeployIdle(accounts, tokens, hre);
    let Yearn = await DeployYearn(accounts, tokens, hre);

    let strategies = {
        Aave,
        Curve,
        Harvest,
        Idle,
        Yearn,
    };

    let underlying = {
        DAI: tokens.DAI.address,
        USDC: tokens.USDC.address,
        USDT: tokens.USDT.address,
    };

    console.log("contracts:");
    console.log(JSON.stringify(strategies));
    console.log(JSON.stringify(underlying));

    await writeContracts(hre, { strategies, underlying });
};

export default func;
func.tags = ["Spool.strategies1"];
