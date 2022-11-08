import { readFile, writeFile } from "fs/promises";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
    Controller,
    Controller__factory,
    FastWithdraw,
    FastWithdraw__factory,
    FeeHandler,
    FeeHandler__factory,
    IERC20,
    ProxyAdmin,
    ProxyAdmin__factory,
    RiskProviderRegistry,
    RiskProviderRegistry__factory,
    SlippagesHelper__factory,
    Spool,
    Spool__factory,
    SpoolOwner__factory,
    StrategyRegistry,
    StrategyRegistry__factory,
    Vault,
    Vault__factory,
} from "../build/types";

import { BarnBridgeMultiContracts, HarvestContracts, mainnet, nToken, Tokens } from "../test/shared/constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { getContractAddress } from "ethers/lib/utils";
import { StrategiesContracts, UnderlyingContracts } from "./data/interface";
import assert from "assert";
import { BigNumber } from "ethers";
import { VaultDetailsStruct } from "../build/types/Controller";
import { HelperContracts, NamedVault, SpoolFixture } from "./infrastructure";
import { existsSync } from "fs";
import { ethers } from "hardhat";

const constants = mainnet();
const AddressZero = ethers.constants.AddressZero;

export const mainnetConst = constants;

type UnderlyingAssets = "DAI" | "USDC" | "USDT";
const strategyAssets: ("DAI" | "USDC" | "USDT")[] = ["DAI", "USDC", "USDT"];

const TREASURY_ADDRESS = "0xF6Bc2E3b1F939C435D9769D078a6e5048AaBD463";

type BarnBridgeStratSetup = {
    name: keyof TokensFixture & keyof Tokens & UnderlyingAssets;
    contracts: BarnBridgeMultiContracts;
};

type CompoundStratSetup = {
    name: keyof TokensFixture & keyof Tokens & UnderlyingAssets;
    cToken: string;
};

type HarvestStratSetup = {
    name: keyof TokensFixture & keyof Tokens & UnderlyingAssets;
    contracts: HarvestContracts;
};

type IdleStratSetup = {
    name: keyof TokensFixture & keyof Tokens & UnderlyingAssets;
    idleTokenYield: string;
};

type MorphoStratSetup = {
    name: keyof TokensFixture & keyof Tokens & UnderlyingAssets;
    cToken: string;
};

type MorphoAaveStratSetup = {
    name: keyof TokensFixture & keyof Tokens & UnderlyingAssets;
    aToken: string;
};

type NotionalStratSetup = {
    name: keyof TokensFixture & keyof Tokens & UnderlyingAssets;
    nToken: nToken;
};

type YearnStratSetup = {
    name: keyof TokensFixture & keyof Tokens & UnderlyingAssets;
    yVault: string;
};

export const BarnBridge: BarnBridgeStratSetup[] = [
    {
        name: "DAI",
        contracts: mainnetConst.barnBridge.aDAI,
    },
    {
        name: "USDC",
        contracts: mainnetConst.barnBridge.aUSDC,
    },
    {
        name: "USDT",
        contracts: mainnetConst.barnBridge.aUSDT,
    },
];

export const Compound: CompoundStratSetup[] = [
    {
        name: "DAI",
        cToken: mainnetConst.compound.cDAI.delegator.address,
    },
    {
        name: "USDC",
        cToken: mainnetConst.compound.cUSDC.address,
    },
    {
        name: "USDT",
        cToken: mainnetConst.compound.cUSDT.delegator.address,
    },
];

export const Harvest: HarvestStratSetup[] = [
    {
        name: "DAI",
        contracts: mainnetConst.harvest.DAI,
    },
    {
        name: "USDC",
        contracts: mainnetConst.harvest.USDC,
    },
    {
        name: "USDT",
        contracts: mainnetConst.harvest.USDT,
    },
];

export const Idle: IdleStratSetup[] = [
    {
        name: "DAI",
        idleTokenYield: mainnetConst.idle.idleDAI.address,
    },
    {
        name: "USDC",
        idleTokenYield: mainnetConst.idle.idleUSDC.address,
    },
    {
        name: "USDT",
        idleTokenYield: mainnetConst.idle.idleUSDT.address,
    },
];

export const Morpho: MorphoStratSetup[] = [
    {
        name: "DAI",
        cToken: mainnetConst.compound.cDAI.delegator.address,
    },
    {
        name: "USDC",
        cToken: mainnetConst.compound.cUSDC.address,
    },
    {
        name: "USDT",
        cToken: mainnetConst.compound.cUSDT.delegator.address,
    },
];

export const MorphoAave: MorphoAaveStratSetup[] = [
    {
        name: "DAI",
        aToken: mainnetConst.aave.aDAI.address,
    },
    {
        name: "USDC",
        aToken: mainnetConst.aave.aUSDC.address,
    },
    {
        name: "USDT",
        aToken: mainnetConst.aave.aUSDT.address,
    },
];

export const Notional: NotionalStratSetup[] = [
    {
        name: "DAI",
        nToken: mainnetConst.notional.nDAI,
    },
    {
        name: "USDC",
        nToken: mainnetConst.notional.nUSDC,
    },
];

export const Yearn: YearnStratSetup[] = [
    {
        name: "DAI",
        yVault: mainnetConst.yearn.DAIVault.address,
    },
    {
        name: "USDC",
        yVault: mainnetConst.yearn.USDCVault.address,
    },
    {
        name: "USDT",
        yVault: mainnetConst.yearn.USDTVault.address,
    },
];

// #endregion Types

// ***** Interfaces *****

export interface AccountsFixture {
    administrator: SignerWithAddress;
}

export interface TokensFixture {
    DAI: IERC20;
    USDC: IERC20;
    USDT: IERC20;
    WETH: IERC20;
}

export interface SpoolUpgradeableFixture extends SpoolFixture {
    implementation: SpoolFixture;
}

// ***** Interfaces *****

// ***** Fixtures *****

export async function deploy(
    hre: HardhatRuntimeEnvironment,
    accounts: AccountsFixture,
    contractName: string,
    options: any
) {
    return await hre.deployments.deploy(contractName, {
        from: accounts.administrator.address,
        autoMine: true,
        log: true,
        ...options,
    });
}

export async function accountsFixture(hre: HardhatRuntimeEnvironment): Promise<AccountsFixture> {
    console.log("get signers..");
    const signers = await hre.ethers.getSigners();
    console.log("done..");
    const administrator = signers[0];
    console.log("administrator.address: " + administrator.address);

    return { administrator };
}

export async function tokensFixture(
    administrator: SignerWithAddress,
    hre: HardhatRuntimeEnvironment
): Promise<TokensFixture> {
    const DAI = (await hre.ethers.getContractAt(
        constants.tokens.DAI.contract.ABI,
        constants.tokens.DAI.contract.address,
        administrator
    )) as IERC20;

    const USDC = (await hre.ethers.getContractAt(
        constants.tokens.USDC.contract.implementation.ABI,
        constants.tokens.USDC.contract.delegator.address,
        administrator
    )) as IERC20;

    const USDT = (await hre.ethers.getContractAt(
        constants.tokens.USDT.contract.ABI,
        constants.tokens.USDT.contract.address,
        administrator
    )) as IERC20;

    const WETH = (await hre.ethers.getContractAt(
        constants.tokens.WETH.contract.ABI,
        constants.tokens.WETH.contract.address,
        administrator
    )) as IERC20;

    return { DAI, USDC, USDT, WETH };
}

export async function loadContracts(hre: HardhatRuntimeEnvironment) {
    const network = hre.network.name;
    const filePath = `scripts/data/${network}.contracts.json`;
    return existsSync(filePath) ? JSON.parse((await readFile(filePath)).toString()) : {};
}

export async function loadSpoolInfra(accounts: AccountsFixture, hre: HardhatRuntimeEnvironment): Promise<SpoolFixture> {
    const contracts = (await loadContracts(hre)).infra;

    return {
        controller: Controller__factory.connect(contracts.controller, accounts.administrator),
        riskProviderRegistry: RiskProviderRegistry__factory.connect(
            contracts.riskProviderRegistry,
            accounts.administrator
        ),
        spool: Spool__factory.connect(contracts.spool, accounts.administrator),
        fastWithdraw: FastWithdraw__factory.connect(contracts.fastWithdraw, accounts.administrator),
        feeHandler: FeeHandler__factory.connect(contracts.feeHandler, accounts.administrator),
        spoolOwner: SpoolOwner__factory.connect(contracts.spoolOwner, accounts.administrator),
        vault: Vault__factory.connect(contracts.vault, accounts.administrator),
        strategyRegistry: StrategyRegistry__factory.connect(contracts.strategyRegistry, accounts.administrator),
        proxyAdmin: ProxyAdmin__factory.connect(contracts.proxyAdmin, accounts.administrator),
    };
}

export async function LoadSpoolOwner(hre: HardhatRuntimeEnvironment): Promise<string> {
    const contracts = await loadContracts(hre);
    return contracts.spoolOwner;
}

export async function loadStrategies(hre: HardhatRuntimeEnvironment): Promise<StrategiesContracts> {
    const contracts = await loadContracts(hre);
    return contracts.strategies;
}

export async function loadVaults(hre: HardhatRuntimeEnvironment): Promise<{ [name: string]: NamedVault }> {
    const contracts = await loadContracts(hre);
    return contracts.vaults;
}

export async function writeContracts(hre: HardhatRuntimeEnvironment, contracts: any): Promise<HelperContracts> {
    const storedContracts = await loadContracts(hre);
    const newValue = { ...storedContracts, ...contracts };

    const network = hre.network.name;
    await writeFile(`scripts/data/${network}.contracts.json`, JSON.stringify(newValue, null, 2), "utf8");
    return newValue;
}

async function deployProxy(
    hre: HardhatRuntimeEnvironment,
    accounts: AccountsFixture,
    implementationName: string,
    implementationAddress: string,
    proxyAdminAddress: string
) {
    const contractName = `TransparentUpgradeableProxy_${implementationName}`;
    const contract = "TransparentUpgradeableProxy";
    const args = [implementationAddress, proxyAdminAddress, "0x"];
    const options = { contract, from: accounts.administrator.address, args };
    console.log("Deploying proxy", contractName);
    return await deploy(hre, accounts, contractName, options);
}

export async function deploySpoolInfra(
    spoolOwnerAddress: string,
    accounts: AccountsFixture,
    hre: HardhatRuntimeEnvironment
): Promise<SpoolUpgradeableFixture> {
    const proxyAdmin = await deploy(hre, accounts, "ProxyAdmin", {});
    const spoolOwner = SpoolOwner__factory.connect(spoolOwnerAddress, accounts.administrator);

    let tx: any;
    let startIndex = 0;
    const strategyRegistryAdd = await getFutureContractAddress(accounts.administrator, startIndex++, hre);
    const riskProviderRegistryAdd = await getFutureContractAddress(accounts.administrator, startIndex++, hre);
    const riskProviderRegistryProxyAdd = await getFutureContractAddress(accounts.administrator, startIndex++, hre);
    const controllerAdd = await getFutureContractAddress(accounts.administrator, startIndex++, hre);
    const controllerProxyAdd = await getFutureContractAddress(accounts.administrator, startIndex++, hre);
    const feeHandlerAdd = await getFutureContractAddress(accounts.administrator, startIndex++, hre);
    const feeHandlerProxyAdd = await getFutureContractAddress(accounts.administrator, startIndex++, hre);
    const fastWithdrawAdd = await getFutureContractAddress(accounts.administrator, startIndex++, hre);
    const fastWithdrawProxyAdd = await getFutureContractAddress(accounts.administrator, startIndex++, hre);
    const spoolAdd = await getFutureContractAddress(accounts.administrator, startIndex++, hre);
    const spoolProxyAdd = await getFutureContractAddress(accounts.administrator, startIndex++, hre);
    const vaultImplAdd = await getFutureContractAddress(accounts.administrator, startIndex++, hre);

    /**
     * Strategy registry
     */
    console.log("Deploy Strategy Registry... ");
    const strategyRegistryArgs = [proxyAdmin.address, controllerProxyAdd];
    const strategyRegistry = await deploy(hre, accounts, "StrategyRegistry", { args: strategyRegistryArgs });
    assert.equal(strategyRegistry.address, strategyRegistryAdd);

    /**
     * Risk provider registry
     */
    console.log("Deploy Risk Registry... ");
    const riskProviderRegistry = await deploy(hre, accounts, "RiskProviderRegistry", {
        args: [feeHandlerProxyAdd, spoolOwner.address],
    });
    const riskProviderRegistryProxy = await deployProxy(
        hre,
        accounts,
        "RiskProviderRegistry",
        riskProviderRegistry.address,
        proxyAdmin.address
    );
    assert.equal(riskProviderRegistry.address, riskProviderRegistryAdd);
    assert.equal(riskProviderRegistryProxy.address, riskProviderRegistryProxyAdd);

    /**
     * Controller
     */
    console.log("Deploy Controller... ");
    const controllerArgs = [
        spoolOwner.address,
        riskProviderRegistryProxy.address,
        spoolProxyAdd,
        strategyRegistry.address,
        vaultImplAdd,
        proxyAdmin.address,
    ];
    const controller = await deploy(hre, accounts, "Controller", {
        args: controllerArgs,
        gasPrice: BigNumber.from("90000000000"),
    });
    const controllerProxy = await deployProxy(hre, accounts, "Controller", controller.address, proxyAdmin.address);
    assert.equal(controller.address, controllerAdd);
    assert.equal(controllerProxy.address, controllerProxyAdd);

    /**
     * Fee handler
     */
    console.log("Deploy Fee Handler... ");
    const feeHandlerArgs = [spoolOwner.address, controllerProxy.address, riskProviderRegistryProxy.address];
    const feeHandler = await deploy(hre, accounts, "FeeHandler", {
        args: feeHandlerArgs,
        gasPrice: BigNumber.from("90000000000"),
    });
    const feeHandlerProxy = await deployProxy(hre, accounts, "FeeHandler", feeHandler.address, proxyAdmin.address);
    assert.equal(feeHandler.address, feeHandlerAdd);
    assert.equal(feeHandlerProxy.address, feeHandlerProxyAdd);

    /**
     * Fast withdraw
     */
    console.log("Deploy Fast Withdraw...");
    const fastWithdrawArgs = [controllerProxy.address, feeHandlerProxy.address, spoolProxyAdd];
    const fastWithdraw = await deploy(hre, accounts, "FastWithdraw", { args: fastWithdrawArgs });
    const fastWithdrawProxy = await deployProxy(
        hre,
        accounts,
        "FastWithdraw",
        fastWithdraw.address,
        proxyAdmin.address
    );
    assert.equal(fastWithdraw.address, fastWithdrawAdd);
    assert.equal(fastWithdrawProxy.address, fastWithdrawProxyAdd);

    /**
     * Spool
     */
    console.log("Deploy Spool... ");
    const spoolArgs = [
        spoolOwner.address,
        controllerProxy.address,
        strategyRegistry.address,
        fastWithdrawProxy.address,
    ];
    const spool = await deploy(hre, accounts, "Spool", { args: spoolArgs });
    const spoolProxy = await deployProxy(hre, accounts, "Spool", spool.address, proxyAdmin.address);
    assert.equal(spool.address, spoolAdd);
    assert.equal(spoolProxy.address, spoolProxyAdd);

    /**
     * Vault implementation
     */
    console.log("Deploy Vault implementation... ");
    const vaultImplArgs = [
        spoolProxy.address,
        controllerProxy.address,
        fastWithdrawProxy.address,
        feeHandlerProxy.address,
        spoolOwner.address,
    ];
    const vaultImpl = await deploy(hre, accounts, "Vault", { args: vaultImplArgs });
    assert.equal(vaultImpl.address, vaultImplAdd);

    /**
     * Initialization
     */
    console.log("Initialize controller");
    const controllerContract = Controller__factory.connect(controllerProxy.address, accounts.administrator);
    tx = await controllerContract.initialize();
    await tx.wait();

    console.log("Initialize fee handler ");
    const feeHandlerContract = FeeHandler__factory.connect(feeHandlerProxy.address, accounts.administrator);
    tx = await feeHandlerContract.initialize(8_00, 2_00, TREASURY_ADDRESS, TREASURY_ADDRESS);
    await tx.wait();

    console.log("Initialize spool");
    const spoolContract = Spool__factory.connect(spoolProxy.address, accounts.administrator);
    tx = await spoolContract.initialize();
    await tx.wait();

    return {
        strategyRegistry: StrategyRegistry__factory.connect(strategyRegistry.address, accounts.administrator),
        controller: Controller__factory.connect(controllerProxy.address, accounts.administrator),
        fastWithdraw: FastWithdraw__factory.connect(fastWithdrawProxy.address, accounts.administrator),
        feeHandler: FeeHandler__factory.connect(feeHandlerProxy.address, accounts.administrator),
        riskProviderRegistry: RiskProviderRegistry__factory.connect(
            riskProviderRegistryProxy.address,
            accounts.administrator
        ),
        spool: Spool__factory.connect(spoolProxy.address, accounts.administrator),
        vault: Vault__factory.connect(vaultImpl.address, accounts.administrator),
        spoolOwner: SpoolOwner__factory.connect(spoolOwnerAddress, accounts.administrator),
        proxyAdmin: ProxyAdmin__factory.connect(proxyAdmin.address, accounts.administrator),
        implementation: {
            strategyRegistry: StrategyRegistry__factory.connect(strategyRegistry.address, accounts.administrator),
            controller: Controller__factory.connect(controller.address, accounts.administrator),
            fastWithdraw: FastWithdraw__factory.connect(fastWithdraw.address, accounts.administrator),
            feeHandler: FeeHandler__factory.connect(feeHandler.address, accounts.administrator),
            riskProviderRegistry: RiskProviderRegistry__factory.connect(
                riskProviderRegistry.address,
                accounts.administrator
            ),
            spool: Spool__factory.connect(spool.address, accounts.administrator),
            vault: Vault__factory.connect(vaultImpl.address, accounts.administrator),
            spoolOwner: SpoolOwner__factory.connect(spoolOwnerAddress, accounts.administrator),
            proxyAdmin: ProxyAdmin__factory.connect(proxyAdmin.address, accounts.administrator),
        },
    };
}

async function getFutureContractAddress(signer: SignerWithAddress, skip: number = 0, hre: HardhatRuntimeEnvironment) {
    return await getFutureContractAddressFromAddress(signer.address, skip, hre);
}

async function getFutureContractAddressFromAddress(address: string, skip: number = 0, hre: HardhatRuntimeEnvironment) {
    const transactionCount = (await hre.ethers.provider.getTransactionCount(address)) + skip;

    return getContractAddress({
        from: address,
        nonce: transactionCount,
    });
}

export async function DeployAave(
    accounts: AccountsFixture,
    tokens: TokensFixture,
    hre: HardhatRuntimeEnvironment
): Promise<UnderlyingContracts> {
    let implementation: UnderlyingContracts = { DAI: [], USDC: [], USDT: [] };

    for (let name of strategyAssets) {
        let token: IERC20 = tokens[name];

        console.log("Deploying Aave Strategy for token: " + name + "...");
        const args = [
            mainnetConst.aave.stkAAVE.delegator.address,
            mainnetConst.aave.LendingPoolAddressesProvider.address,
            mainnetConst.aave.IncentiveController.delegator.address,
            token.address,
            AddressZero
        ];

        const strat = await deploy(hre, accounts, `AaveStrategy${name}`, { contract: "AaveStrategy", args });
        implementation[name].push(strat.address);
    }

    return implementation;
}

export async function DeployCompound(
    accounts: AccountsFixture,
    tokens: TokensFixture,
    spool: SpoolFixture,
    hre: HardhatRuntimeEnvironment
): Promise<UnderlyingContracts> {
    let implementation: UnderlyingContracts = { DAI: [], USDC: [], USDT: [] };

    for (let { name, cToken } of Compound) {
        let token: IERC20 = tokens[name];
        console.log("Deploying Compound Strategy for token: " + name + "...");

        let args = [
            mainnetConst.compound.COMP.address,
            cToken,
            mainnetConst.compound.COMPtroller.delegator.address,
            token.address,
            spool.spool.address
        ];

        const compoundHelper = await deploy(hre, accounts, `CompoundContractHelper${name}`, {
            contract: "CompoundContractHelper",
            args,
        });

        const compoundHelperProxy = await deployProxy(
            hre,
            accounts,
            `CompoundContractHelper${name}`,
            compoundHelper.address,
            spool.proxyAdmin.address
        );

        await writeContracts(hre, {
            compoundHelper: {
                proxy: compoundHelperProxy.address,
                implementation: compoundHelper.address,
            },
        });

        args = [
            mainnetConst.compound.COMP.address,
            cToken,
            mainnetConst.compound.COMPtroller.delegator.address,
            token.address,
            compoundHelperProxy.address,
            AddressZero
        ];

        const strat = await deploy(hre, accounts, `CompoundStrategy${name}`, { contract: "CompoundStrategy", args });
        implementation[name].push(strat.address);
    }

    return implementation;
}

export async function DeployConvex(
    accounts: AccountsFixture,
    tokens: TokensFixture,
    spool: SpoolFixture,
    hre: HardhatRuntimeEnvironment
): Promise<UnderlyingContracts> {
    let implementation: UnderlyingContracts = { DAI: [], USDC: [], USDT: [] };

    for (let name of strategyAssets) {
        let token: IERC20 = tokens[name];
        console.log("Deploying Convex Strategy for token: " + name + "...");

        const helperArgs = [
            spool.spool.address,
            mainnetConst.convex.Booster.address,
            mainnetConst.convex._3pool.boosterPoolId,
        ];
        const convexBoosterHelper = await deploy(hre, accounts, `ConvexBoosterContractHelper${name}`, {
            contract: "ConvexBoosterContractHelper",
            args: helperArgs,
        });
        const convexHelperProxy = await deployProxy(
            hre,
            accounts,
            `ConvexBoosterContractHelper${name}`,
            convexBoosterHelper.address,
            spool.proxyAdmin.address
        );

        await writeContracts(hre, {
            [`convexHelper${name}`]: {
                proxy: convexHelperProxy.address,
                implementation: convexBoosterHelper.address,
            },
        });

        const args = [
            mainnetConst.convex.Booster.address,
            mainnetConst.convex._3pool.boosterPoolId,
            mainnetConst.curve._3pool.pool.address,
            mainnetConst.curve._3pool.lpToken.address,
            token.address,
            convexHelperProxy.address,
            ethers.constants.AddressZero
        ];
        const strat = await deploy(hre, accounts, `ConvexSharedStrategy${name}`, {
            contract: "ConvexSharedStrategy",
            args,
        });
        implementation[name].push(strat.address);
    }

    return implementation;
}

export async function DeployConvex4pool(
    accounts: AccountsFixture,
    tokens: TokensFixture,
    spool: SpoolFixture,
    hre: HardhatRuntimeEnvironment
): Promise<UnderlyingContracts> {
    let implementation: UnderlyingContracts = { DAI: [], USDC: [], USDT: [] };

    for (let name of strategyAssets) {
        let token: IERC20 = tokens[name];
        console.log("Deploying Convex 4pool Strategy for token: " + name + "...");

        const helperArgs = [
            spool.spool.address,
            mainnetConst.convex.Booster.address,
            mainnetConst.convex._sUSD.boosterPoolId,
        ];
        const convexBoosterHelper = await deploy(hre, accounts, `ConvexBooster4poolContractHelper${name}`, {
            contract: "ConvexBoosterContractHelper",
            args: helperArgs,
        });
        const convexHelperProxy = await deployProxy(
            hre,
            accounts,
            `ConvexBooster4poolContractHelper${name}`,
            convexBoosterHelper.address,
            spool.proxyAdmin.address
        );

        await writeContracts(hre, {
            [`convex4poolHelper${name}`]: {
                proxy: convexHelperProxy.address,
                implementation: convexBoosterHelper.address,
            },
        });

        const args = [
            mainnetConst.convex.Booster.address,
            mainnetConst.convex._sUSD.boosterPoolId,
            mainnetConst.curve._sUSD.pool.address,
            mainnetConst.curve._sUSD.lpToken.address,
            token.address,
            convexHelperProxy.address,
            ethers.constants.AddressZero
        ];
        const strat = await deploy(hre, accounts, `ConvexShared4poolStrategy${name}`, {
            contract: "ConvexShared4poolStrategy",
            args,
        });
        implementation[name].push(strat.address);
    }

    return implementation;
}


export async function DeployConvexMetapool(
    accounts: AccountsFixture,
    tokens: TokensFixture,
    spool: SpoolFixture,
    hre: HardhatRuntimeEnvironment
): Promise<UnderlyingContracts> {
    let implementation: UnderlyingContracts = { DAI: [], USDC: [], USDT: [] };

    for (let name of strategyAssets) {
        let token: IERC20 = tokens[name];
        console.log("Deploying Convex Metapool Strategy for token: " + name + "...");

        const helperArgs = [
            spool.spool.address,
            mainnetConst.convex.Booster.address,
            mainnetConst.convex._alUSD.boosterPoolId,
        ];
        const convexBoosterHelper = await deploy(hre, accounts, `ConvexBoosterMetapoolContractHelper${name}`, {
            contract: "ConvexBoosterContractHelper",
            args: helperArgs,
        });
        const convexHelperProxy = await deployProxy(
            hre,
            accounts,
            `ConvexBoosterMetapoolContractHelper${name}`,
            convexBoosterHelper.address,
            spool.proxyAdmin.address
        );

        await writeContracts(hre, {
            [`convexMetapoolHelper${name}`]: {
                proxy: convexHelperProxy.address,
                implementation: convexBoosterHelper.address,
            },
        });

        const args = [
            mainnetConst.convex.Booster.address,
            mainnetConst.convex._alUSD.boosterPoolId,
            mainnetConst.curve._3pool.pool.address,
            mainnetConst.curve._alUSD.depositZap.address,
            mainnetConst.curve._alUSD.lpToken.address,
            token.address,
            convexHelperProxy.address,
            ethers.constants.AddressZero
        ];
        const strat = await deploy(hre, accounts, `ConvexSharedMetapoolStrategy${name}`, {
            contract: "ConvexSharedMetapoolStrategy",
            args,
        });
        implementation[name].push(strat.address);
    }

    return implementation;
}

export async function DeployConvex2pool(
    accounts: AccountsFixture,
    tokens: TokensFixture,
    spool: SpoolFixture,
    hre: HardhatRuntimeEnvironment
): Promise<UnderlyingContracts> {
    let implementation: UnderlyingContracts = { USDC: [], DAI:[], USDT:[] };

    const name = "USDC";
    let token: IERC20 = tokens[name];
    console.log("Deploying Convex 2pool Strategy for token: " + name + "...");

    const helperArgs = [
        spool.spool.address,
        mainnetConst.convex.Booster.address,
        mainnetConst.convex._sUSD.boosterPoolId,
    ];
    const boosterHelperName = `ConvexBooster2poolContractHelper${name}`;
    const convexBoosterHelper = await deploy(hre, accounts, boosterHelperName, {
        contract: "ConvexBoosterContractHelper",
        args: helperArgs,
    });
    const convexHelperProxy = await deployProxy(
        hre,
        accounts,
        boosterHelperName,
        convexBoosterHelper.address,
        spool.proxyAdmin.address
    );

    await writeContracts(hre, {
        [`convex2poolHelper${name}`]: {
            proxy: convexHelperProxy.address,
            implementation: convexBoosterHelper.address,
        },
    });

    const args = [
        mainnetConst.convex.Booster.address,
        mainnetConst.convex._fraxusdc.boosterPoolId,
        mainnetConst.curve._fraxusdc.pool.address,
        mainnetConst.curve._fraxusdc.lpToken.address,
        token.address,
        convexHelperProxy.address,
        ethers.constants.AddressZero
    ];
    const strat = await deploy(hre, accounts, `ConvexShared2poolStrategy${name}`, {
        contract: "ConvexShared2poolStrategy",
        args,
    });
    implementation[name].push(strat.address);

    return implementation;
}

export async function DeployCurve(
    accounts: AccountsFixture,
    tokens: TokensFixture,
    hre: HardhatRuntimeEnvironment
): Promise<UnderlyingContracts> {
    let implementation: UnderlyingContracts = { DAI: [], USDC: [], USDT: [] };

    for (let name of strategyAssets) {
        let token: IERC20 = tokens[name];
        console.log("Deploying Curve Strategy for token: " + name + "...");
        const args = [
            mainnetConst.curve._3pool.pool.address,
            mainnetConst.curve._3pool.LiquidityGauge.address,
            token.address,
            AddressZero
        ];
        const strat = await deploy(hre, accounts, `Curve3poolStrategy${name}`, {
            contract: "Curve3poolStrategy",
            args,
        });

        implementation[name].push(strat.address);
    }

    return implementation;
}

export async function DeployHarvest(
    accounts: AccountsFixture,
    tokens: TokensFixture,
    hre: HardhatRuntimeEnvironment
): Promise<UnderlyingContracts> {
    let implementation: UnderlyingContracts = { DAI: [], USDC: [], USDT: [] };

    for (let { name, contracts } of Harvest) {
        let token: IERC20 = tokens[name];
        console.log("Deploying Harvest Strategy for token: " + name + "...");
        const args = [
            mainnetConst.harvest.FARM.address,
            contracts.Vault.address,
            contracts.Pool.address,
            token.address,
            AddressZero
        ];
        const strat = await deploy(hre, accounts, `HarvestStrategy${name}`, { contract: "HarvestStrategy", args });

        implementation[name].push(strat.address);
    }

    return implementation;
}

export async function DeployIdle(
    accounts: AccountsFixture,
    tokens: TokensFixture,
    hre: HardhatRuntimeEnvironment
): Promise<UnderlyingContracts> {
    let implementation: UnderlyingContracts = { DAI: [], USDC: [], USDT: [] };

    for (let { name, idleTokenYield } of Idle) {
        let token: IERC20 = tokens[name];
        console.log("Deploying Idle Strategy for token: " + name + "...");
        const args = [idleTokenYield, token.address, AddressZero];
        const strat = await deploy(hre, accounts, `IdleStrategy${name}`, { contract: "IdleStrategy", args });

        implementation[name].push(strat.address);
    }

    return implementation;
}

export async function DeployMorpho(
    accounts: AccountsFixture,
    tokens: TokensFixture,
    spool: SpoolFixture,
    hre: HardhatRuntimeEnvironment
): Promise<UnderlyingContracts> {
    let implementation: UnderlyingContracts = { DAI: [], USDC: [], USDT: [] };

    for (let { name, cToken } of Morpho) {
        let token: IERC20 = tokens[name];
        console.log("Deploying Morpho Strategy for token: " + name + "...");

        let args = [
            mainnetConst.morpho.Compound.Proxy.address,
            mainnetConst.compound.COMP.address,
            cToken,
            token.address,
            spool.spool.address
        ];

        const morphoHelper = await deploy(hre, accounts, `MorphoContractHelper${name}`, {
            contract: "MorphoContractHelper",
            args,
        });

        const morphoHelperProxy = await deployProxy(
            hre,
            accounts,
            `MorphoContractHelper${name}`,
            morphoHelper.address,
            spool.proxyAdmin.address
        );

        await writeContracts(hre, {
            morphoHelper: {
                proxy: morphoHelperProxy.address,
                implementation: morphoHelper.address,
            },
        });

        args = [
            mainnetConst.morpho.Compound.Proxy.address,
            mainnetConst.compound.COMP.address,
            cToken,
            token.address,
            morphoHelperProxy.address,
            mainnetConst.morpho.Compound.Lens.address,
            AddressZero
        ];

        const strat = await deploy(hre, accounts, `MorphoStrategy${name}`, { contract: "MorphoStrategy", args });
        implementation[name].push(strat.address);
    }

    return implementation;
}

export async function DeployMorphoAave(
    accounts: AccountsFixture,
    tokens: TokensFixture,
    spool: SpoolFixture,
    hre: HardhatRuntimeEnvironment
): Promise<UnderlyingContracts> {
    let implementation: UnderlyingContracts = { DAI: [], USDC: [], USDT: [] };

    for (let { name, aToken } of MorphoAave) {
        let token: IERC20 = tokens[name];
        console.log("Deploying MorphoAave Strategy for token: " + name + "...");

        let args = [
            mainnetConst.morpho.Aave.Proxy.address,
            mainnetConst.tokens.AAVE.contract.address,
            aToken,
            token.address,
            spool.spool.address
        ];

        const morphoHelper = await deploy(hre, accounts, `MorphoAaveContractHelper${name}`, {
            contract: "MorphoAaveContractHelper",
            args,
        });

        const morphoHelperProxy = await deployProxy(
            hre,
            accounts,
            `MorphoAaveContractHelper${name}`,
            morphoHelper.address,
            spool.proxyAdmin.address
        );

        await writeContracts(hre, {
            morphoHelper: {
                proxy: morphoHelperProxy.address,
                implementation: morphoHelper.address,
            },
        });

        args = [
            mainnetConst.morpho.Aave.Proxy.address,
            mainnetConst.tokens.AAVE.contract.address,
            aToken,
            token.address,
            morphoHelperProxy.address,
            mainnetConst.morpho.Aave.Lens.address,
            AddressZero
        ];

        const strat = await deploy(hre, accounts, `MorphoAaveStrategy${name}`, { contract: "MorphoAaveStrategy", args });
        implementation[name].push(strat.address);
    }

    return implementation;
}

export async function DeployNotional(
    accounts: AccountsFixture,
    tokens: TokensFixture,
    spool: SpoolFixture,
    hre: HardhatRuntimeEnvironment
): Promise<UnderlyingContracts> {
    let implementation: UnderlyingContracts = { DAI: [], USDC: [], USDT: [] };

    for (let { name, nToken } of Notional) {
        let token: IERC20 = tokens[name];
        console.log("Deploying Notional Strategy for token: " + name + "...");

        let args = [
            mainnetConst.notional.Proxy.address,
            mainnetConst.notional.NOTE.address,
            nToken.contract.address,
            nToken.id,
            token.address,
            spool.spool.address,
        ];

        const compoundHelper = await deploy(hre, accounts, `NotionalContractHelper${name}`, {
            contract: "NotionalContractHelper",
            args,
        });

        const compoundHelperProxy = await deployProxy(
            hre,
            accounts,
            `NotionalContractHelper${name}`,
            compoundHelper.address,
            spool.proxyAdmin.address
        );

        await writeContracts(hre, {
            compoundHelper: {
                proxy: compoundHelperProxy.address,
                implementation: compoundHelper.address,
            },
        });

        args = [
            mainnetConst.notional.Proxy.address,
            mainnetConst.notional.NOTE.address,
            nToken.contract.address,
            nToken.id,
            token.address,
            compoundHelperProxy.address,
        ];

        const strat = await deploy(hre, accounts, `NotionalStrategy${name}`, { contract: "NotionalStrategy", args });
        implementation[name].push(strat.address);
    }

    return implementation;
}

export async function DeployYearn(
    accounts: AccountsFixture,
    tokens: TokensFixture,
    hre: HardhatRuntimeEnvironment
): Promise<UnderlyingContracts> {
    let implementation: UnderlyingContracts = { DAI: [], USDC: [], USDT: [] };

    console.log("Strategy Deployment: Yearn");
    for (let { name, yVault } of Yearn) {
        console.log(`: ${name}`);
        let token: IERC20 = tokens[name];
        console.log("Deploying Yearn Strategy for token: " + name + "...");

        const args = [yVault, token.address, AddressZero];
        const strat = await deploy(hre, accounts, `YearnStrategy${name}`, { contract: "YearnStrategy", args });
        implementation[name].push(strat.address);
    }

    return implementation;
}

export async function deployVaults(
    controller: Controller,
    accounts: AccountsFixture,
    tokens: TokensFixture,
    strategies: StrategiesContracts,
    riskToleranceHigh: number,
    riskToleranceLow: number,
    fee: number,
    riskProvider: string,
    confirmations: number,
    hre: HardhatRuntimeEnvironment
): Promise<{ [name: string]: NamedVault }> {
    const assets = ["DAI", "USDC", "USDT"];
    const riskKeys = ["LOW_RISK", "HIGH_RISK"];
    const vaultData: any = JSON.parse((await readFile("scripts/data/allocations.json")).toString());

    const parseAlloc = (value: number) => Math.round(value * 10_000);
    const strategyKeys = ["Aave", "Notional", "Compound", "Convex", "Convex4pool", "ConvexMetapool", "Curve", "Harvest", "Morpho", "Yearn", "Idle"];

    const vaults: any = {};
    for (const assetKey of assets) {
        // @ts-ignore
        const stratAddresses = strategyKeys.map((key) => strategies[key][assetKey]).filter(String).flat();

        for (const riskKey of riskKeys) {
            const riskDisplay = riskKey == "LOW_RISK" ? "Lower" : "Higher";
            const name = `Genesis Spool ${assetKey} ${riskDisplay} Risk`;
            console.log("=========================");
            console.log(`Deploying vault: ${name}`);

            const proportions = strategyKeys
                .map((key) => vaultData[assetKey][riskKey][key].alloc)
                .map(parseAlloc)
                .filter(Number);

            const delta = 10000 - proportions.reduce((a, b) => a + b);
            if (Math.abs(delta) > 1) {
                // "Controller::createVault: Improper allocations"
                throw Error("Allocations don't sum up to 10.000");
            }
            proportions[0] += delta;

            const vaultDetails: VaultDetailsStruct = {
                creator: accounts.administrator.address,
                name,
                riskProvider: riskProvider,
                riskTolerance: riskKey == "LOW_RISK" ? riskToleranceLow : riskToleranceHigh,
                strategies: stratAddresses,
                // @ts-ignore
                underlying: tokens[assetKey].address,
                vaultFee: fee,
                proportions,
            };

            const vaultAddress = await getFutureContractAddressFromAddress(controller.address, 0, hre);
            const tx = await controller.createVault(vaultDetails);
            await tx.wait(confirmations);

            console.log(`Vault deployed: ${vaultAddress}`);

            vaults[name] = {
                address: vaultAddress,
                strategies: stratAddresses,
                underlying: assetKey,
            };
        }
    }

    return vaults;
}
