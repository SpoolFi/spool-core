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

import { task, types } from "hardhat/config";

import * as glob from "glob";
import * as path from "path";

dotenvConfig();

const FORK_BLOCK_NUMBER = 16110000;
const ARBITRUM_FORK_BLOCK_NUMBER = 71740000;

task("generate-docs", "Generate docs from contract comments").setAction(async (_, hre) => {
    const excludedContracts = hre.config.dodoc.exclude
        .map((p) => glob.sync(path.resolve(p), { nodir: true }))
        .flat()
        .map((p) => path.basename(p, ".sol"));

    hre.config.dodoc.exclude = excludedContracts;
    hre.config.dodoc.runOnCompile = true;

    await hre.run("compile");
});

task("test-e2e", "Runs mocha e2e tests")
    .addOptionalParam("placement", "The node type (local, remote, arbitrum)", "", types.string)
    .addFlag("log", "Enable node logging")
    .addFlag("noconsole", "Remove console logs")
    .setAction(async (taskArgs, hre) => {

        let _url;
        let _forkBlock;

        if(taskArgs.placement === 'local') { 
            _url = process.env.LOCALHOST; 
            _forkBlock = FORK_BLOCK_NUMBER; 
        }
        else if(taskArgs.placement === 'arbitrum') { 
            _url = process.env.ARBITRUM_URL; 
            _forkBlock = ARBITRUM_FORK_BLOCK_NUMBER; 
        }
        else { 
            _url = process.env.MAINNET_URL; 
            _forkBlock = FORK_BLOCK_NUMBER; 
        }

        hre.config.networks.hardhat.forking = {
            url: _url as string,
            blockNumber: _forkBlock,
            enabled: true,
        };
        
        if (taskArgs.log) {
            hre.config.networks.hardhat.loggingEnabled = true;
        }


        const tsFiles = glob.sync(path.join(hre.config.paths.tests, "e2e", "**/*.spec.ts"));
        await hre.run("test", { testFiles: [...tsFiles], deployFixture: true });
    });

    task("test-fork", "Runs mocha tests on a fork")
        .addOptionalParam("placement", "The placement of the Mainnet archive node (local, remote, arbitrum)", "", types.string)
        .addFlag("log", "Enable node logging")
        .addFlag("noconsole", "Remove console logs")
        .addFlag("coverage", "Create coverage report")
        .setAction(async (taskArgs, hre) => {

            let _url;
            let _forkBlock;
            if(taskArgs.placement === 'local') { 
                _url = process.env.LOCALHOST; 
                _forkBlock = FORK_BLOCK_NUMBER; 
            }
            else if(taskArgs.placement === 'arbitrum') { 
                _url = process.env.ARBITRUM_URL; 
                _forkBlock = ARBITRUM_FORK_BLOCK_NUMBER; 
            }
            else { 
                _url = process.env.MAINNET_URL; 
                _forkBlock = FORK_BLOCK_NUMBER; 
            }

            hre.config.networks.hardhat.forking = {
                url: _url as string,
                blockNumber: _forkBlock,
                enabled: true,
            };

            if (taskArgs.log) {
                hre.config.networks.hardhat.loggingEnabled = true;
            }
    
            if (taskArgs.coverage) {
                const files = "test/**/*.spec.ts";
                await hre.run("coverage", { testfiles: files });
            } else {
                const testPath = "strategies/unitTests" + ((taskArgs.placement === 'arbitrum') ? "/arbitrum" : "");
                console.log('testPath: ' + testPath);
                let files = [...glob.sync(path.join(hre.config.paths.tests, testPath, "/*.spec.ts"))];
                if(!(taskArgs.placement === 'arbitrum')) files.push(
                    ...glob.sync(path.join(hre.config.paths.tests, "/*.spec.ts"))
                );
                await hre.run("test", { testFiles: files });
            }
    });

    task("test-local", "Runs mocha local tests")
        .addFlag("log", "Enable node logging")
        .addFlag("noconsole", "Remove console logs")
        .addFlag("coverage", "Create coverage report")
        .setAction(async (taskArgs, hre) => {
            if (taskArgs.log) {
                hre.config.networks.hardhat.loggingEnabled = true;
            }
    
            if (taskArgs.coverage) {
                await hre.run("coverage", { testfiles: "test/*.spec.ts" });
            } else {
                const files = glob.sync(path.join(hre.config.paths.tests, "*.spec.ts"));
                await hre.run("test", { testFiles: files });
            }
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
        timeout: 9999_000,
    },
    networks: {
        hardhat: {
            chainId: 1,
            allowUnlimitedContractSize: true,
            hardfork: "london",
            saveDeployments: false,
            gas: 50000000,
            blockGasLimit: 50000000,
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
        arbitrum: {
            chainId: 42161,
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
};
