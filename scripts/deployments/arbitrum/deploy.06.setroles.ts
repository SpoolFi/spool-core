import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { accountsFixture, loadSpoolInfra } from "../scripts/deployUtils";

/**
 * Set roles for core operations
 * @param hre
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const accounts = await accountsFixture(hre);
    const spoolFixture = await loadSpoolInfra(accounts, hre);

    const doHardWorker = accounts.administrator.address;
    const spoolMultisig = accounts.administrator.address;
    const emergencyWithdraw = accounts.administrator.address;
    const allocationProvider = accounts.administrator.address;
    const riskScore = accounts.administrator.address;

    console.log("spool", spoolFixture.spool.address);

    let tx = await spoolFixture.spool.setDoHardWorker(doHardWorker, true);
    await tx.wait();
    tx = await spoolFixture.spool.setAllocationProvider(allocationProvider, true);
    await tx.wait();
    tx = await spoolFixture.controller.setEmergencyWithdrawer(emergencyWithdraw, true);
    await tx.wait();
    tx = await spoolFixture.controller.setEmergencyRecipient(spoolMultisig);
    await tx.wait();
    tx = await spoolFixture.riskProviderRegistry.addProvider(riskScore, 0);
    await tx.wait();
};

export default func;
func.tags = ["arbitrum", "Spool.setroles"];
