import { expect, use } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { solidity, MockProvider, createFixtureLoader } from "ethereum-waffle";
import { deploymentFixture } from "./shared/fixtures";
import { VaultDetailsStruct, createVault, getProportionsFromBitwise, TEN_UNITS_E8, reset, customConstants } from "./shared/utilities";
import { Vault } from "../build/types/Vault";
import { IVault__factory } from "../build/types/factories/IVault__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Vault__factory } from "../build/types/factories/Vault__factory";

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

describe("Vault", () => {
    let vault: Vault;
    let vaultCreation: VaultDetailsStruct;

    before("reset chain", async () => {
        await reset();
    });

    describe("contract setup tests", () => {
        let owner: SignerWithAddress;

        before(async () => {
            [
                owner
            ] = await ethers.getSigners();
        })

        it("Should fail deploying the Vault with address 0", async () => {
            await expect(
                new Vault__factory()
                    .connect(owner)
                    .deploy(
                        ethers.constants.AddressZero,
                        "0x0000000000000000000000000000000000000001",
                        "0x0000000000000000000000000000000000000001",
                        "0x0000000000000000000000000000000000000001",
                        "0x0000000000000000000000000000000000000001"
                    )
            ).to.be.revertedWith("VaultBase::constructor: Spool address cannot be 0");
        });
    });

    describe("vault creation test", () => {
        it("should be created properly by the Controller", async () => {
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

            vault = await createVault(spool.controller, vaultCreation, accounts.rewardNotifier);

            expect(
                (await IVault__factory.connect(vault.address, accounts.administrator).underlying()).toLowerCase()
            ).to.equal(tokens.USDC.address.toLowerCase());

            const bitwiseProportions = await vault.proportions();
            const proportions = getProportionsFromBitwise(bitwiseProportions, vaultCreation.strategies.length);

            expect(proportions[0]).to.equal(vaultCreation.proportions[0]);
            expect(proportions[1]).to.equal(vaultCreation.proportions[1]);
            expect(proportions[2]).to.equal(vaultCreation.proportions[2]);

            const vaultFee = await vault.vaultFee();
            const vaultOwner = await vault.vaultOwner();

            expect(vaultOwner).to.equal(accounts.rewardNotifier.address); // Vault Creator

            expect(vaultFee).to.equal(vaultCreation.vaultFee); // Vault Creator  20%
        });
    });

    describe("vault deposit / withdraw tests", () => {
        it("should properly mint shares for a deposit", async () => {
            const { accounts, tokens, spool } = await loadFixture(deploymentFixture);

            await tokens.USDC.transfer(accounts.user0.address, TEN_UNITS_E8);
            await tokens.USDC.connect(accounts.user0).approve(vault.address, TEN_UNITS_E8);

            await vault.connect(accounts.user0).deposit(vaultCreation.strategies, TEN_UNITS_E8, true);

            const depositIndex = await vault.vaultIndex();
            const userIndexAction = await vault.userIndexAction(accounts.user0.address, depositIndex);
            const vaultIndexAction = await vault.vaultIndexAction(depositIndex);

            const user = await vault.users(accounts.user0.address);

            expect(await vault.totalShares()).to.equal(0);
            expect(user.shares).to.equal(0);
            expect(user.activeDeposit).to.equal(0);
            expect(userIndexAction.depositAmount).to.equal(TEN_UNITS_E8);
            expect(vaultIndexAction.depositAmount).to.equal(TEN_UNITS_E8);
            expect(await tokens.USDC.balanceOf(accounts.user0.address)).to.equal(0);
            expect(await tokens.USDC.balanceOf(spool.spool.address)).to.equal(TEN_UNITS_E8);
        });

        it("should allow for second deposit", async () => {
            const { accounts, tokens, spool } = await loadFixture(deploymentFixture);

            const user2DepositAmount = TEN_UNITS_E8.div(BigNumber.from("2"));
            await tokens.USDC.transfer(accounts.user1.address, user2DepositAmount);
            await tokens.USDC.connect(accounts.user1).approve(spool.controller.address, user2DepositAmount);

            await vault.connect(accounts.user1).deposit(vaultCreation.strategies, user2DepositAmount, false);

            const depositIndex = await vault.vaultIndex();

            const user2IndexAction = await vault.userIndexAction(accounts.user1.address, depositIndex);
            const vaultIndexAction = await vault.vaultIndexAction(depositIndex);

            expect(user2IndexAction.depositAmount).to.equal(user2DepositAmount);
            expect(vaultIndexAction.depositAmount).to.equal(TEN_UNITS_E8.add(user2DepositAmount));
        });

        it("should properly mint shares for two deposits from the same user", async () => {
            const { accounts, tokens, spool } = await loadFixture(deploymentFixture);

            const user2DepositAmount = TEN_UNITS_E8.div(BigNumber.from("2"));

            await tokens.USDC.transfer(accounts.user1.address, user2DepositAmount);
            await tokens.USDC.connect(accounts.user1).approve(spool.controller.address, user2DepositAmount);

            await vault.connect(accounts.user1).deposit(vaultCreation.strategies, user2DepositAmount, false);

            const depositIndex = await vault.vaultIndex();

            const user2IndexAction = await vault.userIndexAction(accounts.user1.address, depositIndex);
            const vaultIndexAction = await vault.vaultIndexAction(depositIndex);

            expect(user2IndexAction.depositAmount).to.equal(user2DepositAmount.add(user2DepositAmount));
            expect(vaultIndexAction.depositAmount).to.equal(
                TEN_UNITS_E8.add(user2DepositAmount).add(user2DepositAmount)
            );
        });

        it("should execute doHardWork after deposit", async () => {
            const { accounts, spool, strategies } = await loadFixture(deploymentFixture);

            const stratIndexes = [...Array(strategies.strategyAddresses.length).keys()];
            const slippages = Array.from(Array(strategies.strategyAddresses.length), () => [0, 0]);

            const rewardSlippages = Array.from(Array(strategies.strategyAddresses.length), () => {
                return { doClaim: false, swapData: [] };
            });

            await spool.spool
                .connect(accounts.doHardWorker)
                .batchDoHardWork(stratIndexes, slippages, rewardSlippages, strategies.strategyAddresses);

            // spool assert

            const strat0 = await spool.spool.strategies(vaultCreation.strategies[0]);
            const stratPendingDeposit0 = strat0.pendingUser.deposit;
            const stratTotalShares0 = strat0.totalShares;
            const amount0 = TEN_UNITS_E8.mul(BigNumber.from(2)).mul(BigNumber.from(4500)).div(BigNumber.from(10000));
            expect(stratPendingDeposit0).to.equal(customConstants.MaxUint128);
            expect(stratTotalShares0).to.equal(amount0);

            const strat1 = await spool.spool.strategies(vaultCreation.strategies[1]);
            const stratPendingDeposit1 = strat1.pendingUser.deposit;
            const stratTotalShares1 = strat1.totalShares;
            const amount1 = TEN_UNITS_E8.mul(BigNumber.from(2)).mul(BigNumber.from(2500)).div(BigNumber.from(10000));
            expect(stratPendingDeposit1).to.equal(customConstants.MaxUint128);
            expect(stratTotalShares1).to.equal(amount1);

            const strat2 = await spool.spool.strategies(vaultCreation.strategies[2]);
            const stratPendingDeposit2 = strat2.pendingUser.deposit;
            const stratTotalShares2 = strat2.totalShares;
            const amount2 = TEN_UNITS_E8.mul(BigNumber.from(2)).mul(BigNumber.from(3000)).div(BigNumber.from(10000));
            expect(stratPendingDeposit2).to.equal(customConstants.MaxUint128);
            expect(stratTotalShares2).to.equal(amount2);
        });

        it("should claim vault and user shares after deposit and dhw", async () => {
            const { accounts } = await loadFixture(deploymentFixture);

            await vault.connect(accounts.user0).redeemVaultStrategies(vaultCreation.strategies);
            await vault.connect(accounts.user0).redeemUser();
            await vault.connect(accounts.user1).redeemUser();

            const vaultTotalShares = await vault.totalShares();
            const user0 = await vault.users(accounts.user0.address);
            const user1 = await vault.users(accounts.user1.address);

            expect(vaultTotalShares.gt("0")).to.be.true;
            expect(user0.shares.gt("0")).to.be.true;
            expect(user1.shares.gt("0")).to.be.true;
            expect(vaultTotalShares).to.equal(user0.shares.add(user1.shares));

            const totalAmount = TEN_UNITS_E8.add(TEN_UNITS_E8);
            expect(totalAmount).to.equal(vaultTotalShares);

            expect(user0.activeDeposit).to.equal(TEN_UNITS_E8);
            expect(user1.activeDeposit).to.equal(TEN_UNITS_E8);
        });

        it("should execute withdrawal action", async () => {
            const { accounts } = await loadFixture(deploymentFixture);
            const user0 = await vault.users(accounts.user0.address);
            const user1 = await vault.users(accounts.user1.address);

            await vault.connect(accounts.user0).withdrawLazy(user0.shares, false);
            await vault.connect(accounts.user1).withdraw(vaultCreation.strategies, user1.shares, false);
            const user0SharesAfter = (await vault.users(accounts.user0.address)).shares;
            const user1SharesAfter = (await vault.users(accounts.user1.address)).shares;
            expect(user0SharesAfter).to.equal("0");
            expect(user1SharesAfter).to.equal("0");
        });

        it("should execute doHardWork", async () => {
            const { accounts, spool, strategies } = await loadFixture(deploymentFixture);

            const stratIndexes = [...Array(strategies.strategyAddresses.length).keys()];
            const slippages = Array.from(Array(strategies.strategyAddresses.length), () => [0, 0]);

            const rewardSlippages = Array.from(Array(strategies.strategyAddresses.length), () => {
                return { doClaim: false, swapData: [] };
            });

            await spool.spool
                .connect(accounts.doHardWorker)
                .batchDoHardWork(stratIndexes, slippages, rewardSlippages, strategies.strategyAddresses);
        });

        it("should redeem vault and user shares after withdrawal and dhw", async () => {
            const { accounts } = await loadFixture(deploymentFixture);

            await vault.connect(accounts.user0).redeemVaultStrategies(vaultCreation.strategies);
            await vault.connect(accounts.user0).redeemUser();
            await vault.connect(accounts.user1).redeemUser();

            const vaultTotalShares = await vault.totalShares();

            const user0 = await vault.users(accounts.user0.address);
            const user1 = await vault.users(accounts.user1.address);

            expect(vaultTotalShares).to.equal("0");
            expect(user0.owed).to.be.gt("0");
            expect(user1.owed).to.be.gt("0");

            // assert.ok(user0DepositBefore.gt(user0DepositAfter));
            // assert.ok(user1DepositBefore.gt(user1DepositAfter));

            expect(user0.withdrawnDeposits).to.equal(TEN_UNITS_E8);
            expect(user1.withdrawnDeposits).to.equal(TEN_UNITS_E8);
        });

        it("should claim vault and user shares", async () => {
            const { accounts, tokens } = await loadFixture(deploymentFixture);

            const user0BalanceBefore = await tokens.USDC.balanceOf(accounts.user0.address);
            const user1BalanceBefore = await tokens.USDC.balanceOf(accounts.user1.address);

            await vault.connect(accounts.user0).claim(false, [], false);
            await vault.connect(accounts.user1).claim(false, [], false);

            const user0BalanceAfter = await tokens.USDC.balanceOf(accounts.user0.address);
            const user1BalanceAfter = await tokens.USDC.balanceOf(accounts.user1.address);

            const vaultTotalShares = await vault.totalShares();
            const user0 = await vault.users(accounts.user0.address);
            const user1 = await vault.users(accounts.user1.address);

            expect(vaultTotalShares).to.equal("0");
            expect(user0.owed).to.equal("0");
            expect(user1.owed).to.equal("0");

            expect(user0BalanceAfter.gt(user0BalanceBefore)).to.be.true;
            expect(user1BalanceAfter.gt(user1BalanceBefore)).to.be.true;
        });
    });

    // TODO: Test for fees
    // TODO: Test for reverts
});
