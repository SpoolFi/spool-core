import {ethers} from "hardhat";
import {getContractAddress} from "@ethersproject/address";

// types
import {MockToken__factory} from "../../build/types/factories/MockToken__factory";
import {IERC20} from "../../build/types/IERC20";
import {UniswapV2Factory} from "../../build/types/UniswapV2Factory";
import {UniswapV2Pair} from "../../build/types/UniswapV2Pair";
import {UniswapV2Router02} from "../../build/types/UniswapV2Router02";
import {Controller} from "../../build/types/Controller";
import {FeeHandler} from "../../build/types/FeeHandler";
import {FastWithdraw} from "../../build/types/FastWithdraw";
import {RiskProviderRegistry} from "../../build/types/RiskProviderRegistry";
import {SpoolOwner} from "../../build/types/SpoolOwner";
import {Spool} from "../../build/types/Spool";
import {MockMasterChef} from "../../build/types/MockMasterChef";
import {MockMasterChefNoReward} from "../../build/types/MockMasterChefNoReward";
import {MockMasterChefFee} from "../../build/types/MockMasterChefFee";
import {MockMasterChefStrategy} from "../../build/types/MockMasterChefStrategy";
import {MockMasterChefFeeStrategy} from "../../build/types/MockMasterChefFeeStrategy";
import {MasterChefUsdcStrategy} from "../../build/types/MasterChefUsdcStrategy";

// factories
import {UniswapV2Factory__factory} from "../../build/types/factories/UniswapV2Factory__factory";
import {UniswapV2Router02__factory} from "../../build/types/factories/UniswapV2Router02__factory";
import {Controller__factory} from "../../build/types/factories/Controller__factory";
import {FeeHandler__factory} from "../../build/types/factories/FeeHandler__factory";
import {Vault__factory} from "../../build/types/factories/Vault__factory";
import {FastWithdraw__factory} from "../../build/types/factories/FastWithdraw__factory";
import {RiskProviderRegistry__factory} from "../../build/types/factories/RiskProviderRegistry__factory";
import {Spool__factory} from "../../build/types/factories/Spool__factory";
import {SpoolOwner__factory} from "../../build/types/factories/SpoolOwner__factory";
import {MockMasterChef__factory} from "../../build/types/factories/MockMasterChef__factory";
import {MockMasterChefNoReward__factory} from "../../build/types/factories/MockMasterChefNoReward__factory";
import {MockMasterChefFee__factory} from "../../build/types/factories/MockMasterChefFee__factory";
import {MockMasterChefStrategy__factory} from "../../build/types/factories/MockMasterChefStrategy__factory";
import {MockMasterChefFeeStrategy__factory} from "../../build/types/factories/MockMasterChefFeeStrategy__factory";
import {MasterChefUsdcStrategy__factory} from "../../build/types/factories/MasterChefUsdcStrategy__factory";

import {Fixture} from "ethereum-waffle";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {impersonate, createAndSupply, parseUnits, isForking} from "./utilities";

import {mainnet} from "./constants";
const constants = mainnet();

export const mainnetConst = constants;

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
    //USDC_WETH: UniswapV2Pair;
    //DAI_USDC: UniswapV2Pair;
}

export interface SpoolFixture {
    controller: Controller;
    riskProviderRegistry: RiskProviderRegistry;
    spool: Spool;
    fastWithdraw: FastWithdraw;
    feeHandler: FeeHandler;
    spoolOwner: SpoolOwner;
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
export async function accountsFixture(): Promise<AccountsFixture> {
    const signers = await ethers.getSigners();
    const administrator = signers[0];
    const user0 = signers[1];
    const user1 = signers[2];
    const user2 = signers[3];
    const user3 = signers[4];
    const rewardNotifier = signers[5];
    const riskProvider = signers[6];
    const splVault = signers[7];
    const doHardWorker = signers[8];
    const allocationProvider = signers[9];

    return {
        administrator,
        user0,
        user1,
        user2,
        user3,
        rewardNotifier,
        riskProvider,
        splVault,
        doHardWorker,
        allocationProvider,
    };
}

export async function tokensFixture(administrator: SignerWithAddress): Promise<TokensFixture> {
    const DAI = isForking()
        ? ((await ethers.getContractAt(
              constants.tokens.DAI.contract.ABI,
              constants.tokens.DAI.contract.address,
              administrator
          )) as IERC20)
        : ((await new MockToken__factory().connect(administrator).deploy("DAI", "DAI", 18)))

    const USDC = isForking()
        ? ((await ethers.getContractAt(
              constants.tokens.USDC.contract.implementation.ABI,
              constants.tokens.USDC.contract.delegator.address,
              administrator
          )) as IERC20)
        : ((await new MockToken__factory().connect(administrator).deploy("USDC", "USDC", 8)))

    const USDT = isForking()
        ? ((await ethers.getContractAt(
              constants.tokens.USDT.contract.ABI,
              constants.tokens.USDT.contract.address,
              administrator
          )) as IERC20)
        : ((await new MockToken__factory().connect(administrator).deploy("USDT", "USDT", 8)))

    const WETH = isForking()
        ? ((await ethers.getContractAt(
              constants.tokens.WETH.contract.ABI,
              constants.tokens.WETH.contract.address,
              administrator
          )) as IERC20)
        : ((await new MockToken__factory().connect(administrator).deploy("WETH", "Wrapped Ether", 18)))

    const CHEF = (await new MockToken__factory().connect(administrator).deploy("CHEF", "Chef Reward", 18))

    if (isForking()) {
        await DAI.connect(await impersonate(constants.tokens.DAI.holder)).transfer(
            administrator.address,
            parseUnits("20000000", constants.tokens.DAI.units)
        );
        await USDC.connect(await impersonate(constants.tokens.USDC.holder)).transfer(
            administrator.address,
            parseUnits("20000000", constants.tokens.USDC.units)
        );
        await USDT.connect(await impersonate(constants.tokens.USDT.holder)).transfer(
            administrator.address,
            parseUnits("20000000", constants.tokens.USDT.units)
        );
        await WETH.connect(await impersonate(constants.tokens.WETH.holder)).transfer(
            administrator.address,
            parseUnits("20000", constants.tokens.WETH.units)
        );
    }

    return {DAI, USDC, USDT, WETH, CHEF};
}

async function poolsFixture(
    accounts: AccountsFixture,
    tokens: TokensFixture
): Promise<PoolsFixture> {
    const factory = isForking()
        ? ((await ethers.getContractAt(
              constants.uniswap.Factory.ABI,
              constants.uniswap.Factory.address
          )) as UniswapV2Factory)
        : ((await (
              new UniswapV2Factory__factory().connect(accounts.administrator)
          ).deploy(accounts.administrator.address)));

    const router = isForking()
        ? ((await ethers.getContractAt(
              constants.uniswap.Router.ABI,
              constants.uniswap.Router.address
          )) as UniswapV2Router02)
        : ((await (
              new UniswapV2Router02__factory().connect(accounts.administrator)
          ).deploy(factory.address, tokens.WETH.address)));

    const CHEF_WETH = await createAndSupply(factory, accounts.riskProvider, tokens.CHEF, tokens.WETH, [18, 18], ["10000", "2500"]);
    
    // These pairs already exit on mainnet. They are not required by the tests directly
    if (!isForking()) {
        await createAndSupply(factory, accounts.riskProvider, tokens.USDC, tokens.WETH, [8, 18], ["10000", "2500"]);
        await createAndSupply(factory, accounts.riskProvider, tokens.DAI, tokens.USDC, [18, 8], ["10000", "10000"]);
    }

    return {factory, router, CHEF_WETH};
}

async function SpoolFixture(accounts: AccountsFixture): Promise<SpoolFixture> {
    // Deploy Spool owner
    const spoolOwner = (await new SpoolOwner__factory().connect(accounts.administrator).deploy());

    const riskProviderRegistryAdd = await getFutureContractAddress(accounts.administrator, 0)
    const controllerAdd = await getFutureContractAddress(accounts.administrator, 1)
    const feeHandlerAdd = await getFutureContractAddress(accounts.administrator, 2)
    const fastWithdrawAdd = await getFutureContractAddress(accounts.administrator, 3)
    const spoolAdd = await getFutureContractAddress(accounts.administrator, 4)
    const vaultImplAdd = await getFutureContractAddress(accounts.administrator, 5)

    // Deploy Risk Registry
    const riskProviderRegistry = (await new RiskProviderRegistry__factory().connect(accounts.administrator).deploy(
        feeHandlerAdd,
        spoolOwner.address
    ));

    // Deploy Controller
    const controller = (await new Controller__factory().connect(accounts.administrator).deploy(
        spoolOwner.address,
        riskProviderRegistry.address,
        spoolAdd,
        vaultImplAdd
    ));
    
    // Deploy Fee Handler
    const feeHandler = (await new FeeHandler__factory().connect(accounts.administrator).deploy(
        spoolOwner.address,
        controller.address,
        riskProviderRegistry.address,
        8_00,
        2_00,
        accounts.administrator.address,
        accounts.administrator.address
    ));

    // Deploy Fast Withdraw
    const fastWithdraw = (await new FastWithdraw__factory().connect(accounts.administrator).deploy(
        controller.address,
        feeHandler.address,
        spoolAdd
    ));

    // Deploy Spool
    const spool = (await new Spool__factory().connect(accounts.administrator).deploy(
        spoolOwner.address,
        controller.address,
        fastWithdraw.address
    ));

    const vaultImpl = (await new Vault__factory().connect(accounts.administrator).deploy(
        spool.address,
        controller.address,
        fastWithdraw.address,
        feeHandler.address,
        spoolOwner.address
    ));    

    await spool.setDoHardWorker(accounts.doHardWorker.address, true);
    await spool.setAllocationProvider(accounts.allocationProvider.address, true);
    await spool.setLogReallocationProportions(true);


    // after setup transfer ownership of contracts to spool owner
    spoolOwner.transferOwnership(accounts.administrator.address);

    return {controller, riskProviderRegistry, spool, fastWithdraw, feeHandler, spoolOwner};
}

async function getFutureContractAddress(signer: SignerWithAddress, skip: number = 0) {  
    const transactionCount = await signer.getTransactionCount() + skip;
  
    return getContractAddress({
      from: signer.address,
      nonce: transactionCount
    })
}

async function StrategiesFixture(
    administrator: SignerWithAddress,
    spool: SpoolFixture,
    tokens: TokensFixture,
    pools: PoolsFixture
): Promise<MockStrategyFixture> {

    // Deploy 2 Chefs (regular)
    const chefs = [
        (await new MockMasterChef__factory().connect(administrator).deploy(tokens.CHEF.address, parseUnits("10"))),
        (await new MockMasterChef__factory().connect(administrator).deploy(tokens.CHEF.address, parseUnits("10"))),
    ];
    await chefs[0].add(parseUnits("1"), tokens.USDC.address, true);
    await chefs[1].add(parseUnits("1"), tokens.USDC.address, true);

    // Deploy 2 Chefs (no rewards)
    const chefNoRewards = [
        (await new MockMasterChefNoReward__factory().connect(administrator).deploy(tokens.CHEF.address, parseUnits("10"))),
        (await new MockMasterChefNoReward__factory().connect(administrator).deploy(tokens.CHEF.address, parseUnits("10"))),
    ];
    await chefNoRewards[0].add(parseUnits("1"), tokens.USDC.address, true);
    await chefNoRewards[1].add(parseUnits("1"), tokens.USDC.address, true);

    // Deploy 2 chefs (withdrawal fees)
    const chefFees = [
        (await new MockMasterChefFee__factory().connect(administrator).deploy(tokens.CHEF.address, parseUnits("10"), "6")),
        (await new MockMasterChefFee__factory().connect(administrator).deploy(tokens.CHEF.address, parseUnits("10"), "3")),
    ];
    await chefFees[0].add(parseUnits("1"), tokens.USDC.address, true);
    await chefFees[1].add(parseUnits("1"), tokens.USDC.address, true);

    const masterChefConstructorParams: [string, number] = [
        tokens.CHEF.address,
        0,
    ];
    
    const mockMasterChefConstructorParams: 
        [string, number, string, string, string] = 
        [
            ...masterChefConstructorParams,
            tokens.USDC.address,
            pools.router.address,
            tokens.WETH.address
        ];

    let chefStrategies: MasterChefStrategyOrMock = []
    let chefStrategiesNoRewards: MasterChefStrategyOrMock = []

    // if test chain is mainnet fork use real master chef strategy implementatio
    if (isForking()) {
        // Deploy Chef Strategies (regular)
        chefStrategies = [
            (await new MasterChefUsdcStrategy__factory().connect(administrator).deploy(
                chefs[0].address,
                ...masterChefConstructorParams
            )),
            (await new MasterChefUsdcStrategy__factory().connect(administrator).deploy(
                chefs[1].address,
                ...masterChefConstructorParams
            )),
        ];

        // Deploy Chef Strategies (no rewards)
        chefStrategiesNoRewards = [
            (await new MasterChefUsdcStrategy__factory().connect(administrator).deploy(
                chefNoRewards[0].address,
                ...masterChefConstructorParams
            )),
            (await new MasterChefUsdcStrategy__factory().connect(administrator).deploy(
                chefNoRewards[1].address,
                ...masterChefConstructorParams
            )),
        ];
    } else { // deploy master chef mock strategies
        // Deploy Chef Strategies (regular)
        chefStrategies = [
            (await new MockMasterChefStrategy__factory().connect(administrator).deploy(
                chefs[0].address,
                ...mockMasterChefConstructorParams
            )),
            (await new MockMasterChefStrategy__factory().connect(administrator).deploy(
                chefs[1].address,
                ...mockMasterChefConstructorParams
            )),
        ];

        // Deploy Chef Strategies (no rewards)
        chefStrategiesNoRewards = [
            (await new MockMasterChefStrategy__factory().connect(administrator).deploy(
                chefNoRewards[0].address,
                ...mockMasterChefConstructorParams
            )),
            (await new MockMasterChefStrategy__factory().connect(administrator).deploy(
                chefNoRewards[1].address,
                ...mockMasterChefConstructorParams
            )),
        ];
    }


    // Deploy Chef Strategies (withdrawal fees)
    const chefStrategiesFees = [
        (await new MockMasterChefFeeStrategy__factory().connect(administrator).deploy(
            chefFees[0].address,
            ...mockMasterChefConstructorParams
        )),

        (await new MockMasterChefFeeStrategy__factory().connect(administrator).deploy(
            chefFees[1].address,
            ...mockMasterChefConstructorParams
        )),
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
    const spool = await SpoolFixture(accounts);
    
    return {accounts, tokens, pools, spool};
}

// ***** Fixtures *****

// ***** main fixture *****
export const deploymentFixture: Fixture<MockDeploymentFixture> = async function (): Promise<MockDeploymentFixture> {
    const {
        accounts,
        spool,
        tokens,
        pools,
    } = await deploymentFixtureCommon();

    console.log("deploy strategies..");
    const strategies = await StrategiesFixture(accounts.administrator, spool, tokens, pools);

    return {accounts, tokens, pools, spool, strategies};
};

export const underlyingTokensFixture: Fixture<TokensDeploymentFixture> = async function (): Promise<TokensDeploymentFixture> {
    const accounts = await accountsFixture();
    const tokens = await tokensFixture(accounts.administrator);

    return {accounts, tokens};
};
// ***** main fixture *****
