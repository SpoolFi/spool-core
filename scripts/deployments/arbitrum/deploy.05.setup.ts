import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { accountsFixture, loadSpoolInfra, loadStrategies } from "../scripts/deployUtils";
import {getStrategyNames} from "../test/shared/utilities";

/**
 * Add strategies to system and
 * @param hre
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log("create accounts..");
    const accounts = await accountsFixture(hre);

    console.log("Loading spool..");
    const spoolFixture = await loadSpoolInfra(accounts, hre);

    console.log("Loading strategies..");
    const strategies: any = await loadStrategies(hre);

    const strategyNames = await getStrategyNames();

    for (const stratKey of Object.keys(strategyNames)) {
        for (const assetKey of strategyNames[stratKey].assets) {
            const strategyAddresses = strategies[stratKey][assetKey];
            for(const strategyAddress of strategyAddresses){
                console.log(`Adding strategy: ${stratKey} ${assetKey}`);
                let allStrategies = await spoolFixture.controller.getAllStrategies();
                let tx = await spoolFixture.controller.addStrategy(strategyAddress, allStrategies);
                await tx.wait();
            }
        }
    }
};

export default func;
func.tags = ["arbitrum", "Spool.setup"];
