import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import {
    accountsFixture,
    deployVaults,
    loadSpoolInfra,
    loadStrategies,
    tokensFixture,
    writeContracts,
} from "../scripts/deployUtils";

/**
 * Deploy 6 Spool Genesis vaults
 * @param hre
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const accounts = await accountsFixture(hre);

    const spoolFixture = await loadSpoolInfra(accounts, hre);
    const tokens: any = await tokensFixture(accounts.administrator, hre);

    const riskScore = accounts.administrator.address;

    const strategies: any = await loadStrategies(hre);

    const vaults = await deployVaults(
        spoolFixture.controller,
        accounts,
        tokens,
        strategies,
        9,
        -8,
        0,
        riskScore,
        1,
        hre
    );

    await writeContracts(hre, { vaults });
};

export default func;
func.tags = ["Spool.deployVaults"];
