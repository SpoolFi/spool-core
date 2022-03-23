import { expect, use } from "chai";
import { constants, ethers } from "ethers";
import { solidity, MockProvider, createFixtureLoader } from "ethereum-waffle";
import { deploymentFixture } from "./shared/fixtures";
import { Vault } from "../build/types/Vault";
import {FastWithdrawParamsStruct} from "../build/types/FastWithdraw";
import {
    VaultDetailsStruct,
    createVault,
    setReallocationProportions,
    getStrategyIndexes,
    getBitwiseStrategies,
    getBitwiseProportions,
    TEN_UNITS_E8,
    customConstants,
    TestContext,
    reset,
    getRewardSwapPathV2Weth,
} from "./shared/utilities";
import {FastWithdraw__factory} from "../build/types/factories/FastWithdraw__factory";

const { Zero } = constants;
const { MaxUint128 } = customConstants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

describe("Vault Fast Withdraw", () => {
    let vault: Vault;
    let vaultCreation: VaultDetailsStruct;

    const context: TestContext = {
        reallocationProportions: [],
    };

    before(async () => {
        await reset();
        console.log("getting deployment..");
        const { accounts, tokens, spool, strategies } = await loadFixture(deploymentFixture);

        await spool.riskProviderRegistry.addProvider(accounts.riskProvider.address, 0);

        vaultCreation = {
            underlying: tokens.USDC.address,
            strategies: [
                strategies.chefStrategies[0].address,
                strategies.chefStrategiesFees[0].address,
                strategies.chefStrategiesFees[1].address,
            ],
            proportions: [4500, 2500, 3000],
            creator: accounts.rewardNotifier.address,
            vaultFee: 2000,
            riskProvider: accounts.riskProvider.address,
            riskTolerance: 0,
            name: "Test",
        };

        console.log("create vault..");
        vault = await createVault(spool.controller, vaultCreation, accounts.rewardNotifier);

        // user 0 deposit
        await tokens.USDC.transfer(accounts.user0.address, TEN_UNITS_E8);
        await tokens.USDC.connect(accounts.user0).approve(vault.address, TEN_UNITS_E8);
        await vault.connect(accounts.user0).deposit(vaultCreation.strategies, TEN_UNITS_E8, true);

        // user 1 deposit
        await tokens.USDC.transfer(accounts.user1.address, TEN_UNITS_E8);
        await tokens.USDC.connect(accounts.user1).approve(vault.address, TEN_UNITS_E8);
        await vault.connect(accounts.user1).deposit(vaultCreation.strategies, TEN_UNITS_E8, true);

        // user 2 deposit
        await tokens.USDC.transfer(accounts.user2.address, TEN_UNITS_E8);
        await tokens.USDC.connect(accounts.user2).approve(vault.address, TEN_UNITS_E8);
        await vault.connect(accounts.user2).deposit(vaultCreation.strategies, TEN_UNITS_E8, true);

        const stratIndexes = [...Array(strategies.strategyAddresses.length).keys()];
        const slippages = Array.from(Array(strategies.strategyAddresses.length), () => []);
        const wethPath = getRewardSwapPathV2Weth();
        const rewardSlippages = Array.from(Array(strategies.strategyAddresses.length), () => {
            return { doClaim: true, swapData: [{ slippage: 1, path: wethPath }] };
        });

        await spool.spool
            .connect(accounts.doHardWorker)
            .batchDoHardWork(stratIndexes, slippages, rewardSlippages, strategies.strategyAddresses);
    });

    it("Should fail deploying the FastWithdraw contract with 0 addresses", async () => {
        const { accounts} = await loadFixture(deploymentFixture);
        await expect(
            new FastWithdraw__factory()
             .connect(accounts.administrator)
             .deploy(
                 ethers.constants.AddressZero,
                 "0x0000000000000000000000000000000000000001",
                 "0x0000000000000000000000000000000000000001",
             )
        ).to.be.revertedWith("FastWithdraw::constructor: Controller, Fee Handler or FastWithdraw address cannot be 0");
    });

    describe("Fast Withdraw", () => {
        it("should fast withdraw user 0", async () => {
            // ARRANGE
            const { accounts, tokens } = await loadFixture(deploymentFixture);

            const slippages = Array.from(Array(vaultCreation.strategies.length), () => []);
            const wethPath = getRewardSwapPathV2Weth();
            const swapData = Array.from(Array(vaultCreation.strategies.length), () => [
                { slippage: 1, path: wethPath },
            ]);

            const user0BalanceBefore = await tokens.USDC.balanceOf(accounts.user0.address);

            // ACT
            const fastWithdrawParams = {
                doExecuteWithdraw: true,
                slippages: slippages,
                swapData: swapData,
            };
            await vault.connect(accounts.user0).withdrawFast(vaultCreation.strategies, 0, true, fastWithdrawParams);

            // ASSERT
            const user0BalanceAfter = await tokens.USDC.balanceOf(accounts.user0.address);

            const vaultTotalShares = await vault.totalShares();
            const user0 = await vault.users(accounts.user0.address);

            expect(vaultTotalShares).to.be.gt(Zero);
            expect(user0.shares).to.equal(Zero);
            expect(user0BalanceAfter).to.be.gt(user0BalanceBefore);

            expect(vaultTotalShares).to.equal(TEN_UNITS_E8.mul(2));

            expect(user0.activeDeposit).to.equal(Zero);
        });

        it("should redeem user 1 shares still left in vault", async () => {
            // ARRANGE
            const { accounts } = await loadFixture(deploymentFixture);

            // ACT
            await vault.connect(accounts.user1).redeemUser();

            // ASSERT
            const vaultTotalShares = await vault.totalShares();
            const user1 = await vault.users(accounts.user1.address);

            expect(user1.shares).to.be.gt(Zero);
            expect(vaultTotalShares).to.equal(user1.shares.mul(2));

            expect(vaultTotalShares).to.equal(TEN_UNITS_E8.mul(2));

            expect(user1.activeDeposit).to.equal(TEN_UNITS_E8);
        });

        it("should fast withdraw user 1 without executing withdraw", async () => {
            // ARRANGE
            const { accounts, tokens } = await loadFixture(deploymentFixture);

            const slippages = Array.from(Array(vaultCreation.strategies.length), () => []);

            const user1BalanceBefore = await tokens.USDC.balanceOf(accounts.user1.address);

            const swapData = Array.from(Array(vaultCreation.strategies.length), () => []);

            const fastWithdrawParams = {
                doExecuteWithdraw: false,
                slippages: slippages,
                swapData: swapData,
            };

            // ACT
            await vault.connect(accounts.user1).withdrawFast(vaultCreation.strategies, 0, true, fastWithdrawParams);

            // ASSERT
            const user1BalanceAfter = await tokens.USDC.balanceOf(accounts.user1.address);
            expect(user1BalanceBefore).to.equal(user1BalanceAfter);

            const vaultTotalShares = await vault.totalShares();
            const user1 = await vault.users(accounts.user1.address);

            expect(user1.shares).to.equal(Zero);
            expect(vaultTotalShares).to.equal(TEN_UNITS_E8);
        });

        it("user 1 should have fast withdraw strategy shares", async () => {
            const {
                accounts,
                spool: { fastWithdraw },
            } = await loadFixture(deploymentFixture);

            const userVaultWithdraw = await fastWithdraw.getUserVaultWithdraw(
                accounts.user1.address,
                vault.address,
                vaultCreation.strategies
            );

            userVaultWithdraw.strategyShares.forEach((shares) => {
                expect(shares).to.be.gt(Zero);
            });

            expect(userVaultWithdraw.proportionateDeposit).to.equal(TEN_UNITS_E8);
        });

        it("should fail to call gatekeeped functions", async () => {
            // ARRANGE
            const {
                accounts,
                spool: { fastWithdraw },
            } = await loadFixture(deploymentFixture);

            // ACT

            await expect(fastWithdraw
                .connect(accounts.user1)
                .transferShares([], [], 0, ethers.constants.AddressZero, {
                    doExecuteWithdraw: false,
                    slippages: [],
                    swapData: []
                }))
            .to.be.revertedWith("FastWithdraw::_onlyVault: Can only be invoked by vault");
        });

        it("should fail to withdraw with incorrect arguments", async () => {
            // ARRANGE
            const {
                accounts,
                tokens,
                spool: { fastWithdraw },
            } = await loadFixture(deploymentFixture);
            const slippages = Array.from(Array(vaultCreation.strategies.length), () => []);

            const wethPath = getRewardSwapPathV2Weth();
            const rewardSlippages = Array.from(Array(vaultCreation.strategies.length), () => {
                return [{ slippage: 1, path: wethPath }];
            });

            // ACT
            await expect(fastWithdraw
                .connect(accounts.user1)
                .withdraw(vault.address, [], slippages, rewardSlippages))
            .to.be.revertedWith("FastWithdraw::withdraw: No strategies");

            await expect(fastWithdraw
                .connect(accounts.user1)
                .withdraw(vault.address, vaultCreation.strategies, [], rewardSlippages))
            .to.be.revertedWith("FastWithdraw::_executeWithdraw: Strategies length should match slippages length");
            
            await expect(fastWithdraw
                .connect(accounts.user1)
                .withdraw(vault.address, vaultCreation.strategies, slippages, []))
            .to.be.revertedWith("FastWithdraw::_executeWithdraw: Strategies length should match swap data length");

        });

        it("should execute fast withdraw for user 1", async () => {
            // ARRANGE
            const {
                accounts,
                tokens,
                spool: { fastWithdraw },
            } = await loadFixture(deploymentFixture);
            const slippages = Array.from(Array(vaultCreation.strategies.length), () => []);

            const wethPath = getRewardSwapPathV2Weth();
            const rewardSlippages = Array.from(Array(vaultCreation.strategies.length), () => {
                return [{ slippage: 1, path: wethPath }];
            });

            const user1BalanceBefore = await tokens.USDC.balanceOf(accounts.user1.address);

            // ACT
            await fastWithdraw
                .connect(accounts.user1)
                .withdraw(vault.address, vaultCreation.strategies, slippages, rewardSlippages);

            // ASSERT
            const user1BalanceAfter = await tokens.USDC.balanceOf(accounts.user1.address);
            expect(user1BalanceAfter).gt(user1BalanceBefore);

            const userVaultWithdraw = await fastWithdraw.getUserVaultWithdraw(
                accounts.user1.address,
                vault.address,
                vaultCreation.strategies
            );

            userVaultWithdraw.strategyShares.forEach((shares) => {
                expect(shares).to.equal(Zero);
            });

            expect(userVaultWithdraw.proportionateDeposit).to.equal(Zero);
        });
        
        it("user 1 should not be able to fast withdraw if no fast withdraw shares", async () => {
            // ARRANGE
            const {
                accounts,
                spool: { fastWithdraw },
            } = await loadFixture(deploymentFixture);
            const slippages = Array.from(Array(vaultCreation.strategies.length), () => [1]);

            // ACT/ASSERT
            const wethPath = getRewardSwapPathV2Weth();
            const swapData = Array.from(Array(vaultCreation.strategies.length), () => [
                { slippage: 1, path: wethPath },
            ]);
            await expect(
                fastWithdraw
                    .connect(accounts.user1)
                    .withdraw(vault.address, vaultCreation.strategies, slippages, swapData)
            ).to.be.revertedWith("FastWithdraw::_executeWithdraw: Nothing withdrawn");
        });

        it("should initialize reallocation for vault", async () => {
            const { accounts, tokens, spool, strategies } = await loadFixture(deploymentFixture);

            const newProportions = [2500, 2500, 5000];
            const vaultStratIndex = getStrategyIndexes(vaultCreation.strategies, strategies.strategyAddresses);

            const vaults = [
                {
                    vault: vault.address,
                    strategiesCount: vaultStratIndex.length, // strategies count
                    strategiesBitwise: getBitwiseStrategies(vaultStratIndex).toString(),
                    newProportions: getBitwiseProportions(newProportions).toString(),
                },
            ];

            const empty2dArray = [[]];

            const tx = await spool.spool
                .connect(accounts.allocationProvider)
                .reallocateVaults(vaults, strategies.strategyAddresses, empty2dArray);

            await setReallocationProportions(tx, spool.spool, context);
        });

        it("user 2 should not be able to normal fast withdraw when reallocation is in progress", async () => {
            // ARRANGE
            const {
                accounts,
                tokens,
                spool: { fastWithdraw },
            } = await loadFixture(deploymentFixture);
            const slippages = Array.from(Array(vaultCreation.strategies.length), () => [1]);

            // ACT/ASSERT
            const wethPath = getRewardSwapPathV2Weth();
            const swapData = Array.from(Array(vaultCreation.strategies.length), () => [
                { slippage: 1, path: wethPath },
            ]);

            const fastWithdrawParams = {
                doExecuteWithdraw: false,
                slippages: slippages,
                swapData: swapData,
            };

            await expect(
                vault.connect(accounts.user2).withdrawFast(vaultCreation.strategies, 0, true, fastWithdrawParams)
            ).to.be.revertedWith("NRED");
        });
    });
});
