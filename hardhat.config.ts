import { config as dotenvConfig } from "dotenv";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "hardhat-contract-sizer";
import "solidity-coverage";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "@primitivefi/hardhat-dodoc";
import "hardhat-deploy";
import "hardhat-deploy-ethers";
import { removeConsoleLog } from "hardhat-preprocessor";

import { task, types } from "hardhat/config";

import * as glob from "glob";
import * as path from "path";

dotenvConfig();

const FORK_BLOCK_NUMBER = 13825000;
const FORK_BLOCK_NUMBER_E2E = 14554585;

task("generate-docs", "Generate docs from contract comments").setAction(async (_, hre) => {
    const excludedContracts = hre.config.dodoc.exclude
        .map((p) => glob.sync(path.resolve(p), { nodir: true }))
        .flat()
        .map((p) => path.basename(p, ".sol"));

    hre.config.dodoc.exclude = excludedContracts;
    hre.config.dodoc.runOnCompile = true;

    await hre.run("compile");
});

task("test-fork", "Runs mocha tests on a fork of mainnet")
    .addOptionalParam("placement", "The placement of the Mainnet archive node (local or remote)", "", types.string)
    .addFlag("strategies", "Only run strategy tests")
    .addFlag("log", "Enable node logging")
    .setAction(async (taskArgs, hre) => {
        const _url = (taskArgs.placement === "local" ? process.env.LOCALHOST : process.env.MAINNET_URL) as string;

        hre.config.networks.hardhat.forking = {
            url: _url,
            blockNumber: FORK_BLOCK_NUMBER,
            enabled: true,
        };

        if (taskArgs.log) {
            hre.config.networks.hardhat.loggingEnabled = true;
        }

        let tsFiles;
        if (taskArgs.strategies) {
            tsFiles = glob.sync(path.join(hre.config.paths.tests, "strategies", "**/*.spec.ts"));
        } else {
            tsFiles = glob.sync(path.join(hre.config.paths.tests, "{,!(e2e)/**}/*.spec.ts"));
        }

        await hre.run("test", { testFiles: [...tsFiles] });
    });

task("coverage-fork", "Runs mocha tests on a fork of mainnet with coverage")
    .addOptionalParam("placement", "The placement of the Mainnet archive node (local or remote)", "", types.string)
    .addFlag("strategies", "Only run strategy tests")
    .setAction(async (taskArgs, hre) => {
        await hre.run("clean");
        const _url = (taskArgs.placement === "local" ? process.env.LOCALHOST : process.env.MAINNET_URL) as string;

        hre.config.networks.hardhat.forking = {
            url: _url,
            blockNumber: FORK_BLOCK_NUMBER,
            enabled: true,
        };

        if (taskArgs.strategies) {
            await hre.run("coverage", { testfiles: "test/**/*.spec.ts" });
        } else {
            await hre.run("coverage");
        }
    });

task("test-local", "Runs mocha tests locally")
    .addFlag("log", "Enable node logging")
    .setAction(async (taskArgs, hre) => {
        if (taskArgs.log) {
            hre.config.networks.hardhat.loggingEnabled = true;
        }

        const tsFiles = glob.sync(path.join(hre.config.paths.tests, "*.spec.ts"));
        await hre.run("test", { testFiles: [...tsFiles] });
    });

task("test-e2e", "Runs mocha e2e tests on a fork of mainnet")
    .addOptionalParam("placement", "The placement of the Mainnet archive node (local or remote)", "", types.string)
    .addFlag("log", "Enable node logging")
    .addFlag("noconsole", "Remove console logs")
    .setAction(async (taskArgs, hre) => {
        const _url = (taskArgs.placement === "local" ? process.env.LOCALHOST : process.env.MAINNET_URL) as string;

        hre.config.networks.hardhat.forking = {
            url: _url,
            blockNumber: FORK_BLOCK_NUMBER_E2E,
            enabled: true,
        };

        if (taskArgs.log) {
            hre.config.networks.hardhat.loggingEnabled = true;
        }

        if (taskArgs.noconsole) {
            hre.config.preprocess = {
                eachLine: removeConsoleLog(() => true),
            };
        }

        const tsFiles = glob.sync(path.join(hre.config.paths.tests, "e2e", "**/*.spec.ts"));
        await hre.run("test", { testFiles: [...tsFiles], deployFixture: true });
    });

task("coverage-local", "Runs mocha tests locally with coverage").setAction(async (taskArgs, hre) => {
    if (taskArgs.log) {
        hre.config.networks.hardhat.loggingEnabled = true;
    }

    await hre.run("coverage", { testfiles: "test/*.spec.ts" });
});


export default {
    paths: {
        sources: "./contracts",
        cache: "./cache",
        artifacts: "./build",
        tests: "./test",
        scripts: "./scripts",
    },
    mocha: {
        timeout: 999_000,
    },
    networks: {
        hardhat: {
            chainId: 1,
            allowUnlimitedContractSize: true,
            hardfork: "london",
            saveDeployments: false,
            accounts: {
                mnemonic: process.env.MNEMONIC,
                count: 120,
            },
        },
        deployment: {
            chainId: 1,
            url: "http://127.0.0.1:8545/",
            accounts: {
                mnemonic: process.env.MNEMONIC,
            },
            timeout: 100000,
            saveDeployments: false,
        },
        rinkeby: {
            chainId: 4,
            url: process.env.MAINNET_URL,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            timeout: 60000,
        },
        mainnet: {
            chainId: 1,
            url: process.env.MAINNET_URL,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            timeout: 60000,
        },
    },
    dodoc: {
        runOnCompile: false,
        exclude: ["contracts/external/**/*", "contracts/mocks/**/*", "contracts/utils/**/*"],
    },
    gasReporter: {
        enabled: false,
    },
    typechain: {
        outDir: "build/types",
        target: "ethers-v5",
        alwaysGenerateOverloads: false,
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
    etherscan: {
        apiKey: process.env.ETHERSCAN_KEY,
    },
    preprocess: {
        eachLine: removeConsoleLog(() => false),
    },
};
