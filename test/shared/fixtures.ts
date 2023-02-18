import { ethers } from "hardhat";
import { getContractAddress } from "@ethersproject/address";

import {
    Controller,
    Controller__factory,
    FastWithdraw,
    FastWithdraw__factory,
    FeeHandler,
    FeeHandler__factory,
    IERC20,
    MasterChefUsdcStrategy,
    MasterChefUsdcStrategy__factory,
    MockMasterChef,
    MockMasterChef__factory,
    MockMasterChefFee,
    MockMasterChefFee__factory,
    MockMasterChefFeeStrategy,
    MockMasterChefFeeStrategy__factory,
    MockMasterChefNoReward,
    MockMasterChefNoReward__factory,
    MockMasterChefStrategy,
    MockMasterChefStrategy__factory,
    MockToken__factory,
    ProxyAdmin,
    ProxyAdmin__factory,
    RiskProviderRegistry,
    RiskProviderRegistry__factory,
    Spool,
    Spool__factory,
    SpoolOwner,
    SpoolOwner__factory,
    StrategyRegistry,
    StrategyRegistry__factory,
    TransparentUpgradeableProxy__factory,
    UniswapV2Factory,
    UniswapV2Factory__factory,
    UniswapV2Pair,
    UniswapV2Router02,
    UniswapV2Router02__factory,
    Vault,
    Vault__factory,
} from "../../build/types";

import { Fixture } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { createAndSupply, impersonate, isForking, parseUnits, getFunds, getConstants } from "./utilities";

import { arbitrum, mainnet } from "./constants";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { expect } from "chai";

export const mainnetConst = mainnet();
export const arbitrumConst = arbitrum();

// ***** Interfaces *****
export interface AccountsFixture {
    administrator: SignerWithAddress;
    user0: SignerWithAddress;
    user1: SignerWithAddress;
    user2: SignerWithAddress;
    user3: SignerWithAddress;
    rewardNotifier: SignerWithAddress;
    riskProvider: SignerWithAddress;
    splVault: SignerWithAddress;
    doHardWorker: SignerWithAddress;
    allocationProvider: SignerWithAddress;
}

export interface TokensFixture {
    DAI: IERC20;
    USDC: IERC20;
    USDT: IERC20;
    WETH: IERC20;
    CHEF: IERC20;
}

export interface TokensDeploymentFixture {
    accounts: AccountsFixture;
    tokens: TokensFixture;
}

export interface PoolsFixture {
    router: UniswapV2Router02;
    factory: UniswapV2Factory;
    CHEF_WETH: UniswapV2Pair;
}

export interface SpoolFixture {
    controller: Controller;
    riskProviderRegistry: RiskProviderRegistry;
    spool: Spool;
    fastWithdraw: FastWithdraw;
    feeHandler: FeeHandler;
    spoolOwner: SpoolOwner;
    vault: Vault;
    strategyRegistry: StrategyRegistry;
    proxyAdmin: ProxyAdmin;
}

export interface StrategyFixtureBase {
    strategyAddresses: string[];
}

type MasterChefStrategyOrMock = MockMasterChefStrategy[] | MasterChefUsdcStrategy[];

export interface MockStrategyFixture extends StrategyFixtureBase {
    chefs: MockMasterChef[];
    chefNoRewards: MockMasterChefNoReward[];
    chefFees: MockMasterChefFee[];
    chefStrategies: MasterChefStrategyOrMock;
    chefStrategiesNoRewards: MasterChefStrategyOrMock;
    chefStrategiesFees: MockMasterChefFeeStrategy[];
}

export interface DeploymentFixtureBase {
    accounts: AccountsFixture;
    tokens: TokensFixture;
    pools: PoolsFixture;
    spool: SpoolFixture;
}

export interface DeploymentFixtureCommon extends DeploymentFixtureBase {
    strategies: StrategyFixtureBase;
}

export interface MockDeploymentFixture extends DeploymentFixtureCommon {
    strategies: MockStrategyFixture;
}

// ***** Interfaces *****

// ***** Fixtures *****
export async function accountsFixture(
    hre: HardhatRuntimeEnvironment | undefined = undefined
): Promise<AccountsFixture> {
    const signers = await (hre?.ethers || ethers).getSigners();
    return {
        administrator: signers[0],
        rewardNotifier: signers[1],
        riskProvider: signers[2],
        splVault: signers[3],
        doHardWorker: signers[4],
        allocationProvider: signers[5],
        user0: signers[6],
        user1: signers[7],
        user2: signers[8],
        user3: signers[9],
    };
}

export async function tokensFixture(administrator: SignerWithAddress): Promise<TokensFixture> {
    let DAI: IERC20;
    let USDC: IERC20;
    let USDT: IERC20;
    let WETH: IERC20;
    let CHEF: IERC20;

    if(isForking()) {
        let constants = await getConstants();
        DAI = await ethers.getContractAt(
                  constants.tokens.DAI.contract.ABI,
                  constants.tokens.DAI.contract.address,
                  administrator
              ) as IERC20;

        USDC = await ethers.getContractAt(
                  constants.tokens.USDC.contract.implementation.ABI,
                  constants.tokens.USDC.contract.delegator.address,
                  administrator
              ) as IERC20;

        USDT = await ethers.getContractAt(
              constants.tokens.USDT.contract.ABI,
              constants.tokens.USDT.contract.address,
              administrator
          ) as IERC20;

        WETH = await ethers.getContractAt(
              constants.tokens.WETH.contract.ABI,
              constants.tokens.WETH.contract.address,
              administrator
          ) as IERC20;
        await getFunds(administrator);
    } else {
        DAI = await new MockToken__factory().connect(administrator).deploy("DAI", "DAI", 18);
        USDC = await new MockToken__factory().connect(administrator).deploy("USDC", "USDC", 8);
        USDT = await new MockToken__factory().connect(administrator).deploy("USDT", "USDT", 8);
        WETH = await new MockToken__factory().connect(administrator).deploy("WETH", "Wrapped Ether", 18);
    }
    CHEF = await new MockToken__factory().connect(administrator).deploy("CHEF", "Chef Reward", 18);

    return { DAI, USDC, USDT, WETH, CHEF };
}

async function poolsFixture(accounts: AccountsFixture, tokens: TokensFixture): Promise<PoolsFixture> {
    let factory: UniswapV2Factory;
    let router: UniswapV2Router02;

    if(isForking()) {
        let constants = await getConstants();
        factory = await ethers.getContractAt(
                  constants.uniswap.Factory.ABI,
                  constants.uniswap.Factory.address
              ) as UniswapV2Factory;

        router = await ethers.getContractAt(
                  constants.uniswap.Router.ABI,
                  constants.uniswap.Router.address
              ) as UniswapV2Router02;
    } else {
        factory = await new UniswapV2Factory__factory()
                    .connect(accounts.administrator)
                    .deploy(accounts.administrator.address);

        router = await new UniswapV2Router02__factory()
                  .connect(accounts.administrator)
                  .deploy(factory.address, tokens.WETH.address);

        // These pairs already exit on mainnet. They are not required by the tests directly
        await createAndSupply(factory, accounts.riskProvider, tokens.USDC, tokens.WETH, [8, 18], ["10000", "2500"]);
        await createAndSupply(factory, accounts.riskProvider, tokens.DAI, tokens.USDC, [18, 8], ["10000", "10000"]);
    }

    const CHEF_WETH = await createAndSupply(
        factory,
        accounts.riskProvider,
        tokens.CHEF,
        tokens.WETH,
        [18, 18],
        ["10000", "2500"]
    );

    return { factory, router, CHEF_WETH };
}

export async function spoolFixture(accounts: AccountsFixture): Promise<SpoolFixture> {
    // Deploy Spool owner
    let tx: any;
    const spoolOwner = await new SpoolOwner__factory().connect(accounts.administrator).deploy();
    const proxyAdmin = await new ProxyAdmin__factory().connect(accounts.administrator).deploy();

    let index = 0;
    const strategyRegistryAdd = await getFutureContractAddress(accounts.administrator, index++);
    const riskProviderRegistryAdd = await getFutureContractAddress(accounts.administrator, index++);
    const riskProviderRegistryProxyAdd = await getFutureContractAddress(accounts.administrator, index++);
    const controllerAdd = await getFutureContractAddress(accounts.administrator, index++);
    const controllerProxyAdd = await getFutureContractAddress(accounts.administrator, index++);
    const feeHandlerAdd = await getFutureContractAddress(accounts.administrator, index++);
    const feeHandlerProxyAdd = await getFutureContractAddress(accounts.administrator, index++);
    const fastWithdrawAdd = await getFutureContractAddress(accounts.administrator, index++);
    const fastWithdrawProxyAdd = await getFutureContractAddress(accounts.administrator, index++);
    const spoolAdd = await getFutureContractAddress(accounts.administrator, index++);
    const spoolProxyAdd = await getFutureContractAddress(accounts.administrator, index++);
    const vaultImplAdd = await getFutureContractAddress(accounts.administrator, index++);

    const strategyRegistry = await (await new StrategyRegistry__factory())
        .connect(accounts.administrator)
        .deploy(proxyAdmin.address, controllerProxyAdd);

    // Deploy Risk Registry
    let riskProviderRegistry = await new RiskProviderRegistry__factory()
        .connect(accounts.administrator)
        .deploy(feeHandlerProxyAdd, spoolOwner.address);
    const riskProviderRegistryProxy = await new TransparentUpgradeableProxy__factory()
        .connect(accounts.administrator)
        .deploy(riskProviderRegistry.address, proxyAdmin.address, "0x");

    expect(riskProviderRegistry.address).equals(riskProviderRegistryAdd, "Address doesn't match");
    expect(riskProviderRegistryProxy.address).equals(riskProviderRegistryProxyAdd, "Address doesn't match");
    riskProviderRegistry = RiskProviderRegistry__factory.connect(
        riskProviderRegistryProxy.address,
        accounts.administrator
    );

    // Deploy Controller
    let controller = await new Controller__factory()
        .connect(accounts.administrator)
        .deploy(
            spoolOwner.address,
            riskProviderRegistryProxy.address,
            spoolProxyAdd,
            strategyRegistry.address,
            vaultImplAdd,
            proxyAdmin.address
        );

    const controllerProxy = await new TransparentUpgradeableProxy__factory()
        .connect(accounts.administrator)
        .deploy(controller.address, proxyAdmin.address, "0x");

    expect(controller.address).equals(controllerAdd, "Address doesn't match");
    expect(controllerProxy.address).equals(controllerProxyAdd, "Address doesn't match");
    controller = Controller__factory.connect(controllerProxy.address, accounts.administrator);

    // Deploy Fee Handler
    let feeHandler = await new FeeHandler__factory()
        .connect(accounts.administrator)
        .deploy(spoolOwner.address, controllerProxy.address, riskProviderRegistryProxy.address);

    const feeHandlerProxy = await new TransparentUpgradeableProxy__factory()
        .connect(accounts.administrator)
        .deploy(feeHandler.address, proxyAdmin.address, "0x");

    expect(feeHandler.address).equals(feeHandlerAdd, "Address doesn't match");
    expect(feeHandlerProxy.address).equals(feeHandlerProxyAdd, "Address doesn't match");
    feeHandler = FeeHandler__factory.connect(feeHandlerProxy.address, accounts.administrator);

    // Deploy Fast Withdraw
    let fastWithdraw = await new FastWithdraw__factory()
        .connect(accounts.administrator)
        .deploy(controllerProxy.address, feeHandlerProxy.address, spoolProxyAdd);

    const fastWithdrawProxy = await new TransparentUpgradeableProxy__factory()
        .connect(accounts.administrator)
        .deploy(fastWithdraw.address, proxyAdmin.address, "0x");

    expect(fastWithdraw.address).equals(fastWithdrawAdd, "Address doesn't match");
    expect(fastWithdrawProxy.address).equals(fastWithdrawProxyAdd, "Address doesn't match");
    fastWithdraw = FastWithdraw__factory.connect(fastWithdrawProxy.address, accounts.administrator);

    // Deploy Spool
    let spool = await new Spool__factory()
        .connect(accounts.administrator)
        .deploy(spoolOwner.address, controllerProxy.address, strategyRegistry.address, fastWithdrawProxy.address);

    const spoolProxy = await new TransparentUpgradeableProxy__factory()
        .connect(accounts.administrator)
        .deploy(spool.address, proxyAdmin.address, "0x");

    expect(spool.address).equals(spoolAdd, "Address doesn't match");
    expect(spoolProxy.address).equals(spoolProxyAdd, "Address doesn't match");
    spool = Spool__factory.connect(spoolProxy.address, accounts.administrator);

    const vault = await new Vault__factory()
        .connect(accounts.administrator)
        .deploy(
            spoolProxy.address,
            controllerProxy.address,
            fastWithdrawProxy.address,
            feeHandlerProxy.address,
            spoolOwner.address
        );

    tx = await feeHandler.initialize(8_00, 2_00, accounts.administrator.address, accounts.administrator.address);
    await tx.wait();

    tx = await controller.initialize();
    await tx.wait();

    tx = await spool.initialize();
    await tx.wait();

    await spool.setDoHardWorker(accounts.doHardWorker.address, true);
    await spool.setAllocationProvider(accounts.allocationProvider.address, true);
    await spool.setLogReallocationTable(true);

    // after setup transfer ownership of contracts to spool owner
    await spoolOwner.transferOwnership(accounts.administrator.address);

    return {
        controller,
        riskProviderRegistry,
        spool,
        fastWithdraw,
        feeHandler,
        spoolOwner,
        strategyRegistry,
        proxyAdmin,
        vault,
    };
}

async function getFutureContractAddress(signer: SignerWithAddress, skip: number = 0) {
    const transactionCount = (await signer.getTransactionCount()) + skip;

    return getContractAddress({
        from: signer.address,
        nonce: transactionCount,
    });
}

async function StrategiesFixture(
    administrator: SignerWithAddress,
    spool: SpoolFixture,
    tokens: TokensFixture,
    pools: PoolsFixture
): Promise<MockStrategyFixture> {
    // Deploy 2 Chefs (regular)
    const chefs = [
        await new MockMasterChef__factory().connect(administrator).deploy(tokens.CHEF.address, parseUnits("10")),
        await new MockMasterChef__factory().connect(administrator).deploy(tokens.CHEF.address, parseUnits("10")),
    ];
    await chefs[0].add(parseUnits("1"), tokens.USDC.address, true);
    await chefs[1].add(parseUnits("1"), tokens.USDC.address, true);

    // Deploy 2 Chefs (no rewards)
    const chefNoRewards = [
        await new MockMasterChefNoReward__factory()
            .connect(administrator)
            .deploy(tokens.CHEF.address, parseUnits("10")),
        await new MockMasterChefNoReward__factory()
            .connect(administrator)
            .deploy(tokens.CHEF.address, parseUnits("10")),
    ];
    await chefNoRewards[0].add(parseUnits("1"), tokens.USDC.address, true);
    await chefNoRewards[1].add(parseUnits("1"), tokens.USDC.address, true);

    // Deploy 2 chefs (withdrawal fees)
    const chefFees = [
        await new MockMasterChefFee__factory()
            .connect(administrator)
            .deploy(tokens.CHEF.address, parseUnits("10"), "6"),
        await new MockMasterChefFee__factory()
            .connect(administrator)
            .deploy(tokens.CHEF.address, parseUnits("10"), "3"),
    ];
    await chefFees[0].add(parseUnits("1"), tokens.USDC.address, true);
    await chefFees[1].add(parseUnits("1"), tokens.USDC.address, true);

    const masterChefConstructorParams: [string, number] = [tokens.CHEF.address, 0];

    const mockMasterChefConstructorParams: [string, number, string, string, string] = [
        ...masterChefConstructorParams,
        tokens.USDC.address,
        pools.router.address,
        tokens.WETH.address,
    ];

    let chefStrategies: MasterChefStrategyOrMock = [];
    let chefStrategiesNoRewards: MasterChefStrategyOrMock = [];

    // if test chain is mainnet fork use real master chef strategy implementatio
    if (isForking()) {
        // Deploy Chef Strategies (regular)
        chefStrategies = [
            await new MasterChefUsdcStrategy__factory()
                .connect(administrator)
                .deploy(chefs[0].address, ...masterChefConstructorParams),
            await new MasterChefUsdcStrategy__factory()
                .connect(administrator)
                .deploy(chefs[1].address, ...masterChefConstructorParams),
        ];

        // Deploy Chef Strategies (no rewards)
        chefStrategiesNoRewards = [
            await new MasterChefUsdcStrategy__factory()
                .connect(administrator)
                .deploy(chefNoRewards[0].address, ...masterChefConstructorParams),
            await new MasterChefUsdcStrategy__factory()
                .connect(administrator)
                .deploy(chefNoRewards[1].address, ...masterChefConstructorParams),
        ];
    } else {
        // deploy master chef mock strategies
        // Deploy Chef Strategies (regular)
        chefStrategies = [
            await new MockMasterChefStrategy__factory()
                .connect(administrator)
                .deploy(chefs[0].address, ...mockMasterChefConstructorParams),
            await new MockMasterChefStrategy__factory()
                .connect(administrator)
                .deploy(chefs[1].address, ...mockMasterChefConstructorParams),
        ];

        // Deploy Chef Strategies (no rewards)
        chefStrategiesNoRewards = [
            await new MockMasterChefStrategy__factory()
                .connect(administrator)
                .deploy(chefNoRewards[0].address, ...mockMasterChefConstructorParams),
            await new MockMasterChefStrategy__factory()
                .connect(administrator)
                .deploy(chefNoRewards[1].address, ...mockMasterChefConstructorParams),
        ];
    }

    // Deploy Chef Strategies (withdrawal fees)
    const chefStrategiesFees = [
        await new MockMasterChefFeeStrategy__factory()
            .connect(administrator)
            .deploy(chefFees[0].address, ...mockMasterChefConstructorParams),
        await new MockMasterChefFeeStrategy__factory()
            .connect(administrator)
            .deploy(chefFees[1].address, ...mockMasterChefConstructorParams),
    ];

    // Add Strategies to registry
    await spool.controller.addStrategy(chefStrategies[0].address, []);
    await spool.controller.addStrategy(chefStrategies[1].address, []);
    await spool.controller.addStrategy(chefStrategiesNoRewards[0].address, []);
    await spool.controller.addStrategy(chefStrategiesNoRewards[1].address, []);
    await spool.controller.addStrategy(chefStrategiesFees[0].address, []);
    await spool.controller.addStrategy(chefStrategiesFees[1].address, []);

    let strategyAddresses: string[] = [
        chefStrategies[0].address,
        chefStrategies[1].address,
        chefStrategiesNoRewards[0].address,
        chefStrategiesNoRewards[1].address,
        chefStrategiesFees[0].address,
        chefStrategiesFees[1].address,
    ];

    return {
        chefs,
        chefNoRewards,
        chefFees,
        chefStrategies,
        chefStrategiesNoRewards,
        chefStrategiesFees,
        strategyAddresses,
    };
}

export async function deploymentFixtureCommon(): Promise<DeploymentFixtureBase> {
    console.log("create accounts..");
    const accounts = await accountsFixture();
    console.log("deploy tokens..");
    const tokens = await tokensFixture(accounts.administrator);
    console.log("deploy pools..");
    const pools = await poolsFixture(accounts, tokens);
    console.log("deploy spool..");
    const spool = await spoolFixture(accounts);

    return { accounts, tokens, pools, spool };
}

// ***** Fixtures *****

// ***** main fixture *****
export const deploymentFixture: Fixture<MockDeploymentFixture> = async function (): Promise<MockDeploymentFixture> {
    const { accounts, spool, tokens, pools } = await deploymentFixtureCommon();

    console.log("deploy strategies..");
    const strategies = await StrategiesFixture(accounts.administrator, spool, tokens, pools);

    return { accounts, tokens, pools, spool, strategies };
};

export const underlyingTokensFixture: Fixture<TokensDeploymentFixture> =
    async function (): Promise<TokensDeploymentFixture> {
        const accounts = await accountsFixture();
        const tokens = await tokensFixture(accounts.administrator);

        return { accounts, tokens };
    };
// ***** main fixture *****
