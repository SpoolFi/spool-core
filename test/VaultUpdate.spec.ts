import { expect, use } from "chai";
import { Wallet } from "ethers";
import { solidity } from "ethereum-waffle";
import { createVault, customConstants, getProportionsFromBitwise, reset, VaultDetailsStruct } from "./shared/utilities";
import {
    AccountsFixture,
    deploymentFixture,
    MockStrategyFixture,
    SpoolFixture,
    TokensFixture,
} from "./shared/fixtures";
import { ethers, waffle } from "hardhat";
import { IVault__factory, Vault } from "../build/types";

use(solidity);

const { MaxUint16 } = customConstants;
const createFixtureLoader = waffle.createFixtureLoader;

describe("VaultUpdate", () => {
    let vault: Vault;
    let vaultCreation: VaultDetailsStruct;
    let wallet: Wallet, other: Wallet;
    let loadFixture: ReturnType<typeof createFixtureLoader>;
    before("create fixture loader", async () => {
        await reset();
        [wallet, other] = await (ethers as any).getSigners();
        loadFixture = createFixtureLoader([wallet, other]);
    });

    let accounts: AccountsFixture;
    let strategies: MockStrategyFixture;
    let tokens: TokensFixture;
    let spool: SpoolFixture;

    let stratIndexes: any;
    let slippages: any;
    let rewardSlippages: any;

    beforeEach("load fixtures and create vault", async () => {
        ({ accounts, tokens, spool, strategies } = await loadFixture(deploymentFixture));

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

        stratIndexes = [...Array(strategies.strategyAddresses.length).keys()];
        slippages = Array.from(Array(strategies.strategyAddresses.length), () => [0, 0]);
        rewardSlippages = Array.from(Array(strategies.strategyAddresses.length), () => {
            return { doClaim: false, swapData: [] };
        });

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

    describe("Commence vault update tests", () => {
        it("Should fail trying to transfer the vault owner", async () => {
            await expect(vault.connect(accounts.user0).transferVaultOwner(accounts.user0.address)).to.be.revertedWith(
                "OOD"
            );
        });
        it("should fail trying to lower the vault fee with too high fee", async () => {
            await expect(vault.connect(accounts.rewardNotifier).lowerVaultFee(MaxUint16)).to.be.revertedWith("FEE");
        });
        it("should fail trying to lower the vault fee from non-vault owner account", async () => {
            await expect(vault.connect(accounts.user0).lowerVaultFee(0)).to.be.revertedWith("FEE");
        });
        it("should fail trying to update the vault name", async () => {
            await expect(vault.connect(accounts.user0).updateName("newName")).to.be.revertedWith(
                "SpoolOwnable::onlyOwner: Caller is not the Spool owner"
            );
        });
        it("Should transfer the vault owner", async () => {
            await vault.connect(accounts.rewardNotifier).transferVaultOwner(accounts.user0.address);
            expect(await vault.vaultOwner()).to.be.equal(accounts.user0.address);
        });

        it("should lower the vault fee", async () => {
            await vault.connect(accounts.rewardNotifier).lowerVaultFee(0);
            expect(await vault.vaultFee()).to.be.equal(0);
        });

        it("should update the vault name", async () => {
            await vault.connect(accounts.administrator).updateName("newName");
            expect(await vault.name()).to.be.equal("newName");
        });
    });

    describe("Commence vault index tests", () => {
        beforeEach("Should set up the state to have consecutive indexes", async () => {
            console.log("Should deposit at index x...");
            await tokens.USDC.transfer(accounts.user0.address, ethers.utils.parseUnits("100", 6));
            await tokens.USDC.connect(accounts.user0).approve(vault.address, ethers.utils.parseUnits("100", 6));
            let vaultLitBefore = await vault.lastIndexInteracted();
            let userLitBefore = await vault.userLastInteractions(accounts.user0.address);
            expect(vaultLitBefore.index1).to.equal(0);
            expect(userLitBefore.index1).to.equal(0);
            expect(vaultLitBefore.index2).to.equal(0);
            expect(userLitBefore.index2).to.equal(0);
            await vault
                .connect(accounts.user0)
                .deposit(vaultCreation.strategies, ethers.utils.parseUnits("100", 6), true);

            let vaultLitAfter = await vault.lastIndexInteracted();
            let userLitAfter = await vault.userLastInteractions(accounts.user0.address);
            let activeGlobalIndex = await spool.spool.getActiveGlobalIndex();
            expect(vaultLitAfter.index1).to.equal(activeGlobalIndex);
            expect(userLitAfter.index1).to.equal(activeGlobalIndex);
            expect(vaultLitAfter.index2).to.equal(0);
            expect(userLitAfter.index2).to.equal(0);

            let globalIndex = await spool.spool.globalIndex();
            console.log("Should partially complete DHW for index x...");
            await spool.spool
                .connect(accounts.doHardWorker)
                .batchDoHardWork([stratIndexes[0]], [slippages[0]], [rewardSlippages[0]], strategies.strategyAddresses);
            expect(await spool.spool.globalIndex()).to.be.equal(globalIndex + 1);

            console.log("Should deposit at index x+1...");
            await tokens.USDC.transfer(accounts.user0.address, ethers.utils.parseUnits("100", 6));
            await tokens.USDC.connect(accounts.user0).approve(vault.address, ethers.utils.parseUnits("100", 6));
            vaultLitBefore = await vault.lastIndexInteracted();
            userLitBefore = await vault.userLastInteractions(accounts.user0.address);
            expect(vaultLitBefore.index1).to.equal(activeGlobalIndex);
            expect(userLitBefore.index1).to.equal(activeGlobalIndex);
            expect(vaultLitBefore.index2).to.equal(0);
            expect(userLitBefore.index2).to.equal(0);
            await vault
                .connect(accounts.user0)
                .deposit(vaultCreation.strategies, ethers.utils.parseUnits("100", 6), true);

            vaultLitAfter = await vault.lastIndexInteracted();
            userLitAfter = await vault.userLastInteractions(accounts.user0.address);
            expect(vaultLitAfter.index1).to.equal(activeGlobalIndex);
            expect(userLitAfter.index1).to.equal(activeGlobalIndex);
            expect(vaultLitAfter.index2).to.equal(activeGlobalIndex + 1);
            expect(userLitAfter.index2).to.equal(activeGlobalIndex + 1);

            console.log("Should complete DHW for index x...");
            await spool.spool
                .connect(accounts.doHardWorker)
                .batchDoHardWork(
                    stratIndexes.slice(1),
                    slippages.slice(1),
                    rewardSlippages.slice(1),
                    strategies.strategyAddresses
                );
            expect(await spool.spool.globalIndex()).to.be.equal(globalIndex + 1);
        });

        it("Should Execute withdraw", async () => {
            const vaultLitBefore = await vault.lastIndexInteracted();
            const userLitBefore = await vault.userLastInteractions(accounts.user0.address);

            await vault.connect(accounts.user0).withdraw(vaultCreation.strategies, 0, true);

            const vaultLitAfter = await vault.lastIndexInteracted();
            const userLitAfter = await vault.userLastInteractions(accounts.user0.address);

            expect(vaultLitAfter.index1).to.equal(vaultLitBefore.index2);
            expect(userLitAfter.index1).to.equal(userLitBefore.index2);
            expect(vaultLitAfter.index2).to.equal(0);
            expect(userLitAfter.index2).to.equal(0);
        });

        it("Should perform DHW again and then withdraw", async () => {
            await spool.spool
                .connect(accounts.doHardWorker)
                .batchDoHardWork(stratIndexes, slippages, rewardSlippages, strategies.strategyAddresses);

            await vault.connect(accounts.user0).withdraw(vaultCreation.strategies, 0, true);

            const vaultLitAfter = await vault.lastIndexInteracted();
            const userLitAfter = await vault.userLastInteractions(accounts.user0.address);
            let activeGlobalIndex = await spool.spool.getActiveGlobalIndex();
            expect(vaultLitAfter.index1).to.equal(activeGlobalIndex);
            expect(userLitAfter.index1).to.equal(activeGlobalIndex);
            expect(vaultLitAfter.index2).to.equal(0);
            expect(userLitAfter.index2).to.equal(0);
        });
    });
});
