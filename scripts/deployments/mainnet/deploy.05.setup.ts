import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { accountsFixture, loadSpoolInfra, loadStrategies } from "../scripts/deployUtils";

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

    const strategyNames = ["Aave",  "Notional", "Compound", "Convex4pool", "ConvexMetapool", "Convex", "Curve", "Harvest", "Idle", "Morpho", "Yearn"];

    for (const strategy of strategyNames) {
        for (const assetKey of ["DAI", "USDC", "USDT"]) {
            const strategyAddresses = strategies[strategy][assetKey];
            for(const strategyAddress of strategyAddresses){
                console.log(`Adding strategy: ${strategy} ${assetKey}`);
                let allStrategies = await spoolFixture.controller.getAllStrategies();
                let tx = await spoolFixture.controller.addStrategy(strategyAddress, allStrategies);
                await tx.wait();
            }
        }
    }
};

export default func;
func.tags = ["mainnet", "Spool.setup"];
