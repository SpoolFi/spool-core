import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
    accountsFixture,
    DeployAaveV3,
    DeployBalancer,
    DeployTimelessFi,
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
    let AaveV3 = await DeployAaveV3(accounts, tokens, hre);
    let Balancer = await DeployBalancer(accounts, tokens, hre);
    let TimelessFi = await DeployTimelessFi(accounts, tokens, hre);

    let strategies = {
        AaveV3,
        Balancer,
        TimelessFi
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
func.tags = ["arbitrum", "Spool.strategies1"];
