import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { accountsFixture, deploySpoolInfra, LoadSpoolOwner, writeContracts } from "../scripts/deployUtils";
import _ from "lodash";
import { SpoolFixture } from "../scripts/infrastructure";

/**
 * Deploy Spool core infrastructure contracts
 * @param hre
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    console.log("create accounts..");
    const accounts = await accountsFixture(hre);

    console.log("Deploying spool..");
    const spoolOwner = await LoadSpoolOwner(hre);
    const infra = await deploySpoolInfra(spoolOwner, accounts, hre);

    const extractAddress = (contracts: SpoolFixture) =>
        _.reduce(
            Object.keys(contracts).filter((key) => key !== "implementation"),
            (result: any, key: string, b) => {
                result[key] = (contracts as any)[key].address;
                return result;
            },
            {}
        );

    const implementationAddresses = extractAddress(infra.implementation);
    const proxyAddresses = extractAddress(infra);

    console.log("Proxy contracts:");
    console.log(JSON.stringify(proxyAddresses));

    console.log("Implementation contracts:");
    console.log(JSON.stringify(implementationAddresses));

    await writeContracts(hre, {
        infra: proxyAddresses,
        infraImpl: implementationAddresses,
    });
};

export default func;
func.tags = ["Spool.infra"];
