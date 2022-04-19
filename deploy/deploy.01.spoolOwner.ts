import { DeployFunction } from "hardhat-deploy/types";

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { accountsFixture, deploy, writeContracts } from "../scripts/deployUtils";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log("Loading accounts..");
    const accounts = await accountsFixture(hre);

    console.log("Deploy Spool Owner... ");
    const spoolOwner = await deploy(hre, accounts, "SpoolOwner", {});

    let contracts = {
        spoolOwner: spoolOwner.address,
    };

    console.log("contracts:");
    console.log(JSON.stringify(contracts));
    await writeContracts(hre, contracts);
};

export default func;
func.tags = ["Spool.owner"];
