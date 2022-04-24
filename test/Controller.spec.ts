import { expect, use } from "chai";
import { BigNumber, Wallet } from "ethers";
import { solidity } from "ethereum-waffle";
import { reset } from "./shared/utilities";
import {
    AccountsFixture,
    deploymentFixture,
    MockStrategyFixture,
    PoolsFixture,
    SpoolFixture,
    TokensFixture,
} from "./shared/fixtures";
import { ethers, waffle } from "hardhat";
import { Controller__factory, MockMasterChefStrategy, MockMasterChefStrategy__factory } from "../build/types";

use(solidity);

const createFixtureLoader = waffle.createFixtureLoader;

describe("Controller", () => {
    let wallet: Wallet, other: Wallet;
    let loadFixture: ReturnType<typeof createFixtureLoader>;
    before("create fixture loader", async () => {
        await reset();
        [wallet, other] = await (ethers as any).getSigners();
        loadFixture = createFixtureLoader([wallet, other]);
    });

    let accounts: AccountsFixture;
    let spool: SpoolFixture;
    let tokens: TokensFixture;
    let strategies: MockStrategyFixture;
    let pools: PoolsFixture;

    beforeEach("load fixtures", async () => {
        ({ accounts, spool, tokens, pools, strategies } = await loadFixture(deploymentFixture));
    });

    describe("contract setup tests", () => {
        it("should deploy the Controller properly", async () => {
            expect(await spool.controller.spool()).to.be.equal(spool.spool.address);

            expect(await spool.controller.strategies(0), strategies.chefStrategies[0].address);
            expect(await spool.controller.strategies(1), strategies.chefStrategies[1].address);
            expect(await spool.controller.validStrategy(strategies.chefStrategies[0].address)).to.be.true;
            expect(await spool.controller.validStrategy(strategies.chefStrategies[1].address)).to.be.true;
            expect(await spool.controller.supportedUnderlying(tokens.USDC.address)).to.be.true;
            expect(await spool.controller.supportedUnderlying(tokens.DAI.address)).to.be.false;

            expect(await spool.controller.totalVaults()).to.be.equal(0);
            expect(await spool.controller.getStrategiesCount()).to.be.equal(strategies.strategyAddresses.length);
        });

        it("Should fail deploying the controller with Risk Provider address 0", async () => {
            const ControllerFactory = await new Controller__factory().connect(accounts.administrator);
            await expect(
                ControllerFactory.deploy(
                    accounts.administrator.address,
                    ethers.constants.AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001"
                )
            ).to.be.revertedWith(
                "Controller::constructor: Risk Provider, Spool, Strategy registry, Proxy admin or Vault Implementation addresses cannot be 0"
            );
        });

        it("Should fail deploying the controller with Spool address 0", async () => {
            const ControllerFactory = await new Controller__factory().connect(accounts.administrator);
            await expect(
                ControllerFactory.deploy(
                    accounts.administrator.address,
                    "0x0000000000000000000000000000000000000001",
                    ethers.constants.AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001"
                )
            ).to.be.revertedWith(
                "Controller::constructor: Risk Provider, Spool, Strategy registry, Proxy admin or Vault Implementation addresses cannot be 0"
            );
        });

        it("Should fail deploying the controller with Vault Factory address 0", async () => {
            const ControllerFactory = await new Controller__factory().connect(accounts.administrator);
            await expect(
                ControllerFactory.deploy(
                    accounts.administrator.address,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    ethers.constants.AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001"
                )
            ).to.be.revertedWith(
                "Controller::constructor: Risk Provider, Spool, Strategy registry, Proxy admin or Vault Implementation addresses cannot be 0"
            );
        });
    });

    describe("Vault creation tests", () => {
        it("should fail to create a vault with duplicate strategies", async () => {
            const vaultDetails = {
                underlying: tokens.USDC.address,
                strategies: [
                    strategies.chefStrategies[0].address,
                    strategies.chefStrategies[0].address,
                    strategies.chefStrategiesFees[0].address,
                ],
                proportions: [4500, 2500, 3000],
                creator: accounts.rewardNotifier.address,
                vaultFee: 2000,
                riskProvider: accounts.riskProvider.address,
                riskTolerance: 0,
                name: "Test",
            };

            await expect(
                spool.controller.connect(accounts.rewardNotifier).createVault(vaultDetails)
            ).to.be.revertedWith("Controller::createVault: Strategies not unique");
        });

        it("should fail to create a vault with no strategies", async () => {
            const vaultDetails = {
                underlying: tokens.USDC.address,
                strategies: [],
                proportions: [4500, 2500, 3000],
                creator: accounts.rewardNotifier.address,
                vaultFee: 2000,
                riskProvider: accounts.riskProvider.address,
                riskTolerance: 0,
                name: "Test",
            };

            await expect(
                spool.controller.connect(accounts.rewardNotifier).createVault(vaultDetails)
            ).to.be.revertedWith("Controller::createVault: Invalid number of strategies");
        });

        it("should fail to create a vault with too many strategies", async () => {
            const vaultDetails = {
                underlying: tokens.USDC.address,
                strategies: Array(19).fill(strategies.chefStrategies[0].address),
                proportions: [4500, 2500, 3000],
                creator: accounts.rewardNotifier.address,
                vaultFee: 2000,
                riskProvider: accounts.riskProvider.address,
                riskTolerance: 0,
                name: "Test",
            };

            await expect(
                spool.controller.connect(accounts.rewardNotifier).createVault(vaultDetails)
            ).to.be.revertedWith("Controller::createVault: Invalid number of strategies");
        });

        it("should fail to create a vault with unsupported strategy", async () => {
            const vaultDetails = {
                underlying: tokens.USDC.address,
                strategies: [accounts.administrator.address],
                proportions: [100_00],
                creator: accounts.rewardNotifier.address,
                vaultFee: 2000,
                riskProvider: accounts.riskProvider.address,
                riskTolerance: 0,
                name: "Test",
            };

            await expect(
                spool.controller.connect(accounts.rewardNotifier).createVault(vaultDetails)
            ).to.be.revertedWith("Controller::createVault: Unsupported strategy");
        });

        it("should fail to create a vault with improper setup", async () => {
            const vaultDetails = {
                underlying: tokens.USDC.address,
                strategies: [
                    strategies.chefStrategies[0].address,
                    strategies.chefStrategies[0].address,
                    strategies.chefStrategiesFees[0].address,
                ],
                proportions: [4500, 2500],
                creator: accounts.rewardNotifier.address,
                vaultFee: 2000,
                riskProvider: accounts.riskProvider.address,
                riskTolerance: 0,
                name: "Test",
            };

            await expect(
                spool.controller.connect(accounts.rewardNotifier).createVault(vaultDetails)
            ).to.be.revertedWith("Controller::createVault: Improper setup");
        });

        it("should fail to create a vault with unsupported currency", async () => {
            const vaultDetails = {
                underlying: tokens.CHEF.address,
                strategies: [
                    strategies.chefStrategies[0].address,
                    strategies.chefStrategies[0].address,
                    strategies.chefStrategiesFees[0].address,
                ],
                proportions: [4500, 2500],
                creator: accounts.rewardNotifier.address,
                vaultFee: 2000,
                riskProvider: accounts.riskProvider.address,
                riskTolerance: 0,
                name: "Test",
            };

            await expect(
                spool.controller.connect(accounts.rewardNotifier).createVault(vaultDetails)
            ).to.be.revertedWith("Controller::createVault: Unsupported currency");
        });

        it("should fail to create a vault with improper allocations", async () => {
            const vaultDetails = {
                underlying: tokens.USDC.address,
                strategies: [
                    strategies.chefStrategies[0].address,
                    strategies.chefStrategies[1].address,
                    strategies.chefStrategiesFees[0].address,
                ],
                proportions: [4500, 2500, 3500],
                creator: accounts.rewardNotifier.address,
                vaultFee: 2000,
                riskProvider: accounts.riskProvider.address,
                riskTolerance: 0,
                name: "Test",
            };

            await expect(
                spool.controller.connect(accounts.rewardNotifier).createVault(vaultDetails)
            ).to.be.revertedWith("Controller::createVault: Improper allocations");
        });

        it("should fail to create a vault with invalid owner fee", async () => {
            const vaultDetails = {
                underlying: tokens.USDC.address,
                strategies: [
                    strategies.chefStrategies[0].address,
                    strategies.chefStrategies[1].address,
                    strategies.chefStrategiesFees[0].address,
                ],
                proportions: [4500, 2500, 3000],
                creator: accounts.rewardNotifier.address,
                vaultFee: 20_01,
                riskProvider: accounts.riskProvider.address,
                riskTolerance: 0,
                name: "Test",
            };

            await expect(
                spool.controller.connect(accounts.rewardNotifier).createVault(vaultDetails)
            ).to.be.revertedWith("Controller::createVault: High owner fee");
        });

        it("should fail to create a vault with invalid risk provider", async () => {
            const vaultDetails = {
                underlying: tokens.USDC.address,
                strategies: [
                    strategies.chefStrategies[0].address,
                    strategies.chefStrategies[1].address,
                    strategies.chefStrategiesFees[0].address,
                ],
                proportions: [4500, 2500, 3000],
                creator: accounts.rewardNotifier.address,
                vaultFee: 2000,
                riskProvider: accounts.administrator.address,
                riskTolerance: 0,
                name: "Test",
            };

            await expect(
                spool.controller.connect(accounts.rewardNotifier).createVault(vaultDetails)
            ).to.be.revertedWith("Controller::createVault: Invalid risk provider");
        });

        it("should fail to create a vault with incorrent risk tolerance", async () => {
            const vaultDetails = {
                underlying: tokens.USDC.address,
                strategies: [
                    strategies.chefStrategies[0].address,
                    strategies.chefStrategies[1].address,
                    strategies.chefStrategiesFees[0].address,
                ],
                proportions: [4500, 2500, 3000],
                creator: accounts.rewardNotifier.address,
                vaultFee: 2000,
                riskProvider: accounts.riskProvider.address,
                riskTolerance: 20,
                name: "Test",
            };

            await spool.riskProviderRegistry.addProvider(accounts.riskProvider.address, 0);
            await expect(
                spool.controller.connect(accounts.rewardNotifier).createVault(vaultDetails)
            ).to.be.revertedWith("Controller::createVault: Incorrect Risk Tolerance");
        });

        it("should add another strategy", async () => {
            const MockMasterChefStrategyFactory = new MockMasterChefStrategy__factory().connect(accounts.administrator);

            const strategy = (await MockMasterChefStrategyFactory.deploy(
                strategies.chefs[0].address,
                tokens.CHEF.address,
                0,
                tokens.DAI.address,
                pools.router.address,
                tokens.WETH.address
            )) as MockMasterChefStrategy;

            await spool.controller.addStrategy(strategy.address, []);

            const stratCount = await spool.controller.getStrategiesCount();
            expect(await spool.controller.strategies(stratCount - 1)).to.be.equal(strategy.address);
        });

        it("should add another strategy using calldata", async () => {
            const MockMasterChefStrategyFactory = new MockMasterChefStrategy__factory().connect(accounts.administrator);

            const strategy = (await MockMasterChefStrategyFactory.deploy(
                strategies.chefs[0].address,
                tokens.CHEF.address,
                0,
                tokens.DAI.address,
                pools.router.address,
                tokens.WETH.address
            )) as MockMasterChefStrategy;

            const allStrategies = await spool.controller.getAllStrategies();

            await spool.controller.addStrategy(strategy.address, allStrategies);

            const stratCount = await spool.controller.getStrategiesCount();
            expect(await spool.controller.strategies(stratCount - 1)).to.be.equal(strategy.address);
        });

        it("should fail to create a vault with incorrent currency for strategy", async () => {
            const vaultCount = await spool.controller.getStrategiesCount();
            const MockMasterChefStrategyFactory = new MockMasterChefStrategy__factory().connect(accounts.administrator);

            const strategy = (await MockMasterChefStrategyFactory.deploy(
                strategies.chefs[0].address,
                tokens.CHEF.address,
                0,
                tokens.DAI.address,
                pools.router.address,
                tokens.WETH.address
            )) as MockMasterChefStrategy;

            await spool.controller.addStrategy(strategy.address, []);

            const vaultDetails = {
                underlying: tokens.USDC.address,
                strategies: [strategy.address],
                proportions: [100_00],
                creator: accounts.rewardNotifier.address,
                vaultFee: 2000,
                riskProvider: accounts.riskProvider.address,
                riskTolerance: 0,
                name: "Test",
            };

            await expect(
                spool.controller.connect(accounts.rewardNotifier).createVault(vaultDetails)
            ).to.be.revertedWith("Controller::createVault: Incorrect currency for strategy");
        });
    });

    describe("Updating variables tests", () => {
        it("Should fail hashing strategies for wrong strategy list", async () => {
            let incompleteStrategies = [strategies.strategyAddresses[0], strategies.strategyAddresses[1]];
            await expect(spool.controller.verifyStrategies(incompleteStrategies)).to.be.revertedWith(
                "Controller::verifyStrategies: Incorrect strategies"
            );
        });
    });
    describe("strategy addition and removal tests", () => {
        it("should prevent addition of an existing strategy", async () => {
            await expect(spool.controller.addStrategy(strategies.chefStrategies[0].address, [])).to.be.revertedWith(
                "Controller::addStrategy: Strategy already registered"
            );
        });

        it("should allow removal of the first strategy from the system", async () => {
            await spool.controller.removeStrategy(strategies.chefStrategies[0].address, false, []);
            const allStrategies = await spool.controller.getAllStrategies();
            expect(allStrategies[0]).to.be.equal(strategies.strategyAddresses[strategies.strategyAddresses.length - 1]);
            expect(await spool.controller.validStrategy(strategies.chefStrategies[0].address)).to.be.false;
            expect(await spool.controller.validStrategy(strategies.chefStrategies[1].address)).to.be.true;

            await expect(spool.controller.addStrategy(strategies.chefStrategies[0].address, [])).to.be.revertedWith(
                "StrategyRegistry::addStrategy: Can not add if already registered"
            );
        });

        it("should allow removal of the 4th strategy from the system", async () => {
            let allStrategies = await spool.controller.getAllStrategies();
            await spool.controller.removeStrategy(strategies.chefStrategiesNoRewards[1].address, false, []);

            allStrategies = await spool.controller.getAllStrategies();
            expect(allStrategies[3]).to.be.equal(strategies.strategyAddresses[strategies.strategyAddresses.length - 1]);
            expect(await spool.controller.validStrategy(strategies.chefStrategiesNoRewards[1].address)).to.be.false;
            expect(await spool.controller.validStrategy(strategies.strategyAddresses[4])).to.be.true;

            await expect(
                spool.controller.addStrategy(strategies.chefStrategiesNoRewards[1].address, [])
            ).to.be.revertedWith("StrategyRegistry::addStrategy: Can not add if already registered'");
        });

        it("should prevent removal of an inexistent strategy", async () => {
            await expect(spool.controller.removeStrategy(accounts.administrator.address, false, [])).to.be.revertedWith(
                "Controller::removeStrategy: Strategy is not registered"
            );
        });
    });
    describe("Gatekeeping tests", async () => {
        it("Should fail doing transfer to spool from non-vault address", async () => {
            await expect(
                spool.controller.transferToSpool(accounts.administrator.address, BigNumber.from(100))
            ).to.be.revertedWith("Controller::_onlyVault: Can only be invoked by vault");
        });
    });
    describe("Emergency withdraw update tests", async () => {
        it("Should fail trying to update emergency recipient address from non-owner account", async () => {
            await expect(
                spool.controller.connect(accounts.user0.address).setEmergencyRecipient(accounts.user0.address)
            ).to.be.revertedWith("SpoolOwnable::onlyOwner: Caller is not the Spool owner");
        });
        it("Should fail trying to update emergency withdrawer address from non-owner account", async () => {
            await expect(
                spool.controller.connect(accounts.user0.address).setEmergencyWithdrawer(accounts.user0.address, true)
            ).to.be.revertedWith("SpoolOwnable::onlyOwner: Caller is not the Spool owner");
        });
        it("Should correctly update emergency recipient address", async () => {
            await spool.controller.setEmergencyRecipient(accounts.user0.address);
            expect(await spool.controller.emergencyRecipient()).to.be.equal(accounts.user0.address);
        });
        it("Should correctly update emergency withdrawer address", async () => {
            await spool.controller.setEmergencyWithdrawer(accounts.user0.address, true);
            expect(await spool.controller.isEmergencyWithdrawer(accounts.user0.address)).to.be.true;
        });
    });

    describe("Pausable controller tests", async () => {
        it("Should fail trying to update pauser address from non-owner account", async () => {
            await expect(
                spool.controller.connect(accounts.user0).setPauser(accounts.user0.address, true)
            ).to.be.revertedWith("SpoolOwnable::onlyOwner: Caller is not the Spool owner");
        });
        it("Should fail trying to update unpauser address from non-owner account", async () => {
            await expect(
                spool.controller.connect(accounts.user0).setUnpauser(accounts.user0.address, true)
            ).to.be.revertedWith("SpoolOwnable::onlyOwner: Caller is not the Spool owner");
        });
        it("Should correctly update pauser address", async () => {
            await spool.controller.setPauser(accounts.user0.address, true);
            expect(await spool.controller.isPauser(accounts.user0.address)).to.be.true;
        });
        it("Should correctly update unpauser address", async () => {
            await spool.controller.setUnpauser(accounts.user0.address, true);
            expect(await spool.controller.isUnpauser(accounts.user0.address)).to.be.true;
        });
        it("Should pause", async () => {
            await spool.controller.setPauser(accounts.user0.address, true);
            await spool.controller.connect(accounts.user0).pause();
            const checkPaused = spool.controller.checkPaused();
            await expect(checkPaused).to.be.revertedWith("Pausable: paused");
        });
        it("Should pause by spool owner", async () => {
            await spool.controller.connect(accounts.administrator).pause();
            const checkPaused = spool.controller.checkPaused();
            await expect(checkPaused).to.be.revertedWith("Pausable: paused");
        });
        it("Should unpause", async () => {
            await spool.controller.setUnpauser(accounts.user0.address, true);
            await spool.controller.setPauser(accounts.user0.address, true);
            await spool.controller.connect(accounts.user0).pause();
            await spool.controller.connect(accounts.user0).unpause();
            const checkPaused = spool.controller.checkPaused();
            await expect(checkPaused).not.to.be.revertedWith("Pausable: paused");
        });
        it("Should unpause by spool owner", async () => {
            await spool.controller.connect(accounts.administrator).pause();
            await spool.controller.connect(accounts.administrator).unpause();
            const checkPaused = spool.controller.checkPaused();
            await expect(checkPaused).not.to.be.revertedWith("Pausable: paused");
        });
        it("Should fail trying to pause from non-approved account", async () => {
            await spool.controller.setPauser(accounts.user0.address, false);
            await expect(spool.controller.connect(accounts.user0).pause()).to.be.revertedWith(
                "Controller::_onlyPauser: Can only be invoked by pauser"
            );
        });
        it("Should fail trying to unpause from non-approved account", async () => {
            await spool.controller.setUnpauser(accounts.user0.address, false);
            await expect(spool.controller.connect(accounts.user0).unpause()).to.be.revertedWith(
                "Controller::_onlyUnpauser: Can only be invoked by unpauser"
            );
        });
    });
});
