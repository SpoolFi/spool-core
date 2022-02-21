import { expect, use } from "chai";
import { BigNumber } from "ethers";
import { solidity, MockProvider, createFixtureLoader } from "ethereum-waffle";
import { deploymentFixture } from "./shared/fixtures";
import { VaultDetailsStruct, createVault, TEN_UNITS_E8, reset } from "./shared/utilities";
import { Vault } from "../build/types/Vault";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

use(solidity);

const myProvider = new MockProvider();
let loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

describe("Remove Strategy", () => {
    describe("Remove strategy and withdraw", () => {
        let vault: Vault;
        let vaultCreation: VaultDetailsStruct;
        let emergencyRecipient: SignerWithAddress;
        let totalDepositedInVault = BigNumber.from(0);

        before(async () => {
            await reset();
            loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);
            const { accounts, tokens, spool, strategies } = await loadFixture(deploymentFixture);
            emergencyRecipient = accounts.user3;
            await spool.controller.setEmergencyRecipient(emergencyRecipient.address);

            await spool.riskProviderRegistry.addProvider(accounts.riskProvider.address, 0);

            vaultCreation = {
                underlying: tokens.USDC.address,
                strategies: [
                    strategies.chefStrategiesNoRewards[0].address,
                    strategies.chefStrategiesNoRewards[1].address,
                ],
                proportions: [6000, 4000],
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
            totalDepositedInVault = totalDepositedInVault.add(TEN_UNITS_E8);

            // user 1 deposit
            await tokens.USDC.transfer(accounts.user1.address, TEN_UNITS_E8);
            await tokens.USDC.connect(accounts.user1).approve(vault.address, TEN_UNITS_E8);
            await vault.connect(accounts.user1).deposit(vaultCreation.strategies, TEN_UNITS_E8, true);
            totalDepositedInVault = totalDepositedInVault.add(TEN_UNITS_E8);

            const stratIndexes = [...Array(strategies.strategyAddresses.length).keys()];
            const slippages = Array.from(Array(strategies.strategyAddresses.length), () => []);

            const rewardSlippages = Array.from(Array(strategies.strategyAddresses.length), () => {
                return { doClaim: false, swapData: [{ slippage: 0, path: [] }] };
            });

            await spool.spool
                .connect(accounts.doHardWorker)
                .batchDoHardWork(stratIndexes, slippages, rewardSlippages, strategies.strategyAddresses);
        });

        it("remove strategy, should revert when user had no rights", async () => {
            const { accounts, spool, strategies } = await loadFixture(deploymentFixture);

            await expect(
                spool.controller
                    .connect(accounts.user0)
                    .removeStrategyAndWithdraw(
                        strategies.chefStrategiesNoRewards[1].address,
                        false,
                        [],
                        strategies.strategyAddresses
                    )
            ).to.be.revertedWith(
                "Controller::_onlyEmergencyWithdrawer: Can only be invoked by the emergency withdrawer"
            );
        });

        it("should remove and withdraw strategy from the system", async () => {
            const { tokens, spool, strategies } = await loadFixture(deploymentFixture);

            const oldStrategiesCount = await spool.controller.getStrategiesCount();

            const withdrawerBalanceBefore = await tokens.USDC.balanceOf(emergencyRecipient.address);

            await spool.controller.removeStrategyAndWithdraw(
                strategies.chefStrategiesNoRewards[1].address,
                false,
                [],
                strategies.strategyAddresses
            );

            const newStrategiesCount = await spool.controller.getStrategiesCount();
            expect(newStrategiesCount).to.equal(oldStrategiesCount - 1);

            const withdrawerBalanceAfter = await tokens.USDC.balanceOf(emergencyRecipient.address);
            expect(withdrawerBalanceAfter).to.be.gt(withdrawerBalanceBefore);
        });

        it("Should remove strategy from the vault", async () => {
            const oldStrategiesHash = await vault.strategiesHash();

            await vault.notifyStrategyRemoved(vaultCreation.strategies, 1);

            vaultCreation.strategies = vaultCreation.strategies.slice(0, -1);

            const newStrategiesHash = await vault.strategiesHash();
            expect(newStrategiesHash).not.to.equal(oldStrategiesHash);

            const strategiesProportions = await vault.proportions();
            expect(strategiesProportions).to.equal(100_00);
        });

        it("Should deposit to vault", async () => {
            const { accounts, tokens } = await loadFixture(deploymentFixture);

            // user 0 deposit
            await tokens.USDC.transfer(accounts.user0.address, TEN_UNITS_E8);
            await tokens.USDC.connect(accounts.user0).approve(vault.address, TEN_UNITS_E8);
            await vault.connect(accounts.user0).deposit(vaultCreation.strategies, TEN_UNITS_E8, true);
            totalDepositedInVault = totalDepositedInVault.add(TEN_UNITS_E8);
        });

        it("should remove and withdraw strategy from the system again", async () => {
            const { tokens, spool, strategies } = await loadFixture(deploymentFixture);

            const oldStrategiesCount = await spool.controller.getStrategiesCount();

            await spool.controller.removeStrategyAndWithdraw(
                strategies.chefStrategiesNoRewards[0].address,
                false,
                [],
                []
            );

            const newStrategiesCount = await spool.controller.getStrategiesCount();
            expect(newStrategiesCount).to.equal(oldStrategiesCount - 1);

            const withdrawerBalanceAfter = await tokens.USDC.balanceOf(emergencyRecipient.address);
            expect(withdrawerBalanceAfter).to.equal(totalDepositedInVault);
        });

        it("Should remove last strategy from the vault", async () => {
            const oldStrategiesHash = await vault.strategiesHash();

            await vault.notifyStrategyRemoved(vaultCreation.strategies, 0);

            const newStrategiesHash = await vault.strategiesHash();
            expect(newStrategiesHash).not.to.equal(oldStrategiesHash);

            const strategiesProportions = await vault.proportions();
            expect(strategiesProportions).to.equal(0);
        });
    });
});
