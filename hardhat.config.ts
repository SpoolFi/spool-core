import {config as dotenvConfig} from "dotenv";
dotenvConfig();
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "hardhat-contract-sizer";
import "solidity-coverage";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import '@primitivefi/hardhat-dodoc';

import {task, types} from "hardhat/config";

import * as glob from "glob";
import * as path from "path";

const FORK_BLOCK_NUMBER = 13825000;

task("generate-docs", "Generate docs from contract comments")
    .setAction(async (_, hre) => {

    const excludedContracts = hre.config.dodoc.exclude
        .map(p => glob.sync(path.resolve(p), {nodir: true}))
        .flat()
        .map(p => path.basename(p, ".sol"))

    hre.config.dodoc.exclude = excludedContracts;
    hre.config.dodoc.runOnCompile = true;

    await hre.run("compile");
});

task("test-fork", "Runs tests on a fork of mainnet").addOptionalParam(
        "placement",
        "The placement of the Mainnet archive node (local or remote)",
        "",
        types.string
    ).addFlag(
        "strategies",
        "Only run strategy tests",
    ).addFlag(
        "log",
        "Enable node logging",
    ).setAction(async (taskArgs, hre) => {

    const _url = 
        ((taskArgs.placement === "local") ? process.env.LOCALHOST 
                                        : process.env.MAINNET_URL) as string;

    hre.config.networks.hardhat.forking = {
        url: _url,
        blockNumber: FORK_BLOCK_NUMBER,
        enabled: true
    };

    if (taskArgs.log) {
        hre.config.networks.hardhat.loggingEnabled = true;
    }

    if (taskArgs.strategies) {
        const tsFiles = glob.sync(path.join(hre.config.paths.tests, "strategies", "**/*.spec.ts"));
        await hre.run("test", {testFiles : [...tsFiles]});
    } else {
        await hre.run("test");
    }
});

task("test-local", "Runs tests locally")
    .addFlag(
        "log",
        "Enable node logging",
    ).setAction(async (taskArgs, hre) => {
    if (taskArgs.log) {
        hre.config.networks.hardhat.loggingEnabled = true;
    }

    const tsFiles = glob.sync(path.join(hre.config.paths.tests, "*.spec.ts"));
    await hre.run("test", {testFiles : [...tsFiles]});
});

export default {
    paths: {
        sources: "./contracts",
        cache: "./cache",
        artifacts: "./build",
        tests: "./test",
    },
    mocha: {
        timeout: 90000,
    },
    networks: {
        hardhat: {
            chainId: 1337,
            allowUnlimitedContractSize: true,
            hardfork: "london",
        },
    },
    dodoc: {
        runOnCompile: false,
        exclude: ["contracts/external/**/*", "contracts/mocks/**/*"]
    },
    gasReporter: {
        enabled: false,
    },
    typechain: {
        outDir: "build/types",
        target: "ethers-v5",
        alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
    },
    solidity: {
        compilers: [
            {
                version: "0.8.11",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                },
            },
        ],
    },
};
