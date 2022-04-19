import { expect, use } from "chai";
import { BigNumber, constants, utils } from "ethers";
import { ethers } from "hardhat";
import { createFixtureLoader, deployMockContract, MockContract, MockProvider, solidity } from "ethereum-waffle";
import { underlyingTokensFixture } from "./shared/fixtures";
import { FeeHandler, FeeHandler__factory, IController__factory, ISpoolOwner__factory } from "../build/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import { getPercentageTwoDecimal, reset } from "./shared/utilities";

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

describe("Fee Handler unit tests", () => {
    const ecosystemFee = BigNumber.from(8_00);
    const treasuryFee = BigNumber.from(2_00);
    const riskProviderFee = BigNumber.from(1_00);
    const vaultFee = BigNumber.from(5_00);
    let mockController: MockContract;
    let mockSpoolOwner: MockContract;
    let feeHandler: FeeHandler;
    let owner: SignerWithAddress;
    let vault: SignerWithAddress;
    let riskProviderRegistry: SignerWithAddress;
    let ecosystemFeeCollector: SignerWithAddress;
    let treasuryFeeCollector: SignerWithAddress;
    let riskProvider: SignerWithAddress;
    let vaultOwner: SignerWithAddress;
    let user: SignerWithAddress;

    before(async () => {
        await reset();
    });

    describe("Fee Handler functionality", () => {
        beforeEach(async () => {
            [
                owner,
                vault,
                riskProviderRegistry,
                ecosystemFeeCollector,
                treasuryFeeCollector,
                riskProvider,
                vaultOwner,
                user,
            ] = await ethers.getSigners();

            mockController = await deployMockContract(owner, IController__factory.abi);
            await mockController.mock.validVault.returns(false);
            await mockController.mock.validVault.withArgs(vault.address).returns(true);

            mockSpoolOwner = await deployMockContract(owner, ISpoolOwner__factory.abi);
            await mockSpoolOwner.mock.isSpoolOwner.returns(false);
            await mockSpoolOwner.mock.isSpoolOwner.withArgs(owner.address).returns(true);

            feeHandler = await new FeeHandler__factory()
                .connect(owner)
                .deploy(mockSpoolOwner.address, mockController.address, riskProviderRegistry.address);
            feeHandler = feeHandler.connect(owner);
            await feeHandler.initialize(
                ecosystemFee,
                treasuryFee,
                ecosystemFeeCollector.address,
                treasuryFeeCollector.address
            );

            await feeHandler.connect(riskProviderRegistry).setRiskProviderFee(riskProvider.address, riskProviderFee);
        });

        it("Pay fees, should have correct balances", async () => {
            // ARRANGE
            const { accounts, tokens } = await loadFixture(underlyingTokensFixture);
            const profit = utils.parseEther("1");
            const tokenAddress = tokens.DAI.address;

            // ACT
            const feesPaid = await feeHandler
                .connect(vault)
                .callStatic.payFees(tokenAddress, profit, riskProvider.address, vaultOwner.address, vaultFee);

            await feeHandler
                .connect(vault)
                .payFees(tokenAddress, profit, riskProvider.address, vaultOwner.address, vaultFee);

            // ASSERT

            // total fees
            const totalFeeSize = vaultFee.add(treasuryFee).add(riskProviderFee).add(ecosystemFee);
            const totalFees = getPercentageTwoDecimal(profit, totalFeeSize);
            expect(feesPaid).to.equal(totalFees);

            const platformFees = await feeHandler.platformCollectedFees(tokenAddress);

            // ecosystem
            const expectedEcosystemFees = getPercentageTwoDecimal(profit, ecosystemFee);
            expect(platformFees.ecosystem).to.equal(expectedEcosystemFees);

            // treasury
            const expectedTreasuryFees = getPercentageTwoDecimal(profit, treasuryFee);
            expect(platformFees.treasury).to.equal(expectedTreasuryFees);

            // risk provider
            const riskProviderFees = await feeHandler.collectedFees(riskProvider.address, tokenAddress);
            const expectedRiskProviderFees = getPercentageTwoDecimal(profit, riskProviderFee);
            expect(riskProviderFees).to.equal(expectedRiskProviderFees);

            // vault owner
            const vaultOwnerFees = await feeHandler.collectedFees(vaultOwner.address, tokenAddress);
            const expectedVaultOwnerFees = getPercentageTwoDecimal(profit, riskProviderFee);
            expect(vaultOwnerFees).to.equal(expectedVaultOwnerFees);
        });

        it("Pay and collect fees, should collect correct amounts", async () => {
            // ARRANGE
            const { accounts, tokens } = await loadFixture(underlyingTokensFixture);

            const profit = utils.parseEther("1");
            const tokenAddress = tokens.DAI.address;

            const ecosystemFeeCollectorDaiBalancebefore = await tokens.DAI.balanceOf(ecosystemFeeCollector.address);
            const treasuryFeeCollectorDaiBalancebefore = await tokens.DAI.balanceOf(treasuryFeeCollector.address);
            const riskProviderDaiBalancebefore = await tokens.DAI.balanceOf(riskProvider.address);
            const vaultOwnerDaiBalancebefore = await tokens.DAI.balanceOf(vaultOwner.address);

            const collectTokens = [tokens.DAI.address];

            const feesPaid = await feeHandler
                .connect(vault)
                .callStatic.payFees(tokenAddress, profit, riskProvider.address, vaultOwner.address, vaultFee);

            await feeHandler
                .connect(vault)
                .payFees(tokenAddress, profit, riskProvider.address, vaultOwner.address, vaultFee);

            // send amount of fees collected
            await tokens.DAI.transfer(owner.address, feesPaid);
            await tokens.DAI.connect(owner).transfer(feeHandler.address, feesPaid);

            // ACT

            // ecosystem
            await feeHandler.connect(ecosystemFeeCollector).collectEcosystemFees(collectTokens);
            // treasury
            await feeHandler.connect(treasuryFeeCollector).collectTreasuryFees(collectTokens);
            // risk provider
            await feeHandler.connect(riskProvider).collectFees(collectTokens);
            // vault owner
            await feeHandler.connect(vaultOwner).collectFees(collectTokens);

            // ASSERT

            // ecosystem
            const ecosystemFeeCollectorDaiBalanceAfter = await tokens.DAI.balanceOf(ecosystemFeeCollector.address);
            const actualEcosystemFeesCollected = ecosystemFeeCollectorDaiBalanceAfter.sub(
                ecosystemFeeCollectorDaiBalancebefore
            );

            const expectedEcosystemFees = getPercentageTwoDecimal(profit, ecosystemFee);
            expect(actualEcosystemFeesCollected).to.be.closeTo(expectedEcosystemFees, 10);

            // treasury
            const treasuryFeeCollectorDaiBalanceAfter = await tokens.DAI.balanceOf(treasuryFeeCollector.address);
            const actualTreasuryFeesCollected = treasuryFeeCollectorDaiBalanceAfter.sub(
                treasuryFeeCollectorDaiBalancebefore
            );

            const expectedTreasuryFees = getPercentageTwoDecimal(profit, treasuryFee);
            expect(actualTreasuryFeesCollected).to.be.closeTo(expectedTreasuryFees, 10);

            // risk provider
            const riskProviderDaiBalanceAfter = await tokens.DAI.balanceOf(riskProvider.address);
            const actualRiskProviderFeesCollected = riskProviderDaiBalanceAfter.sub(riskProviderDaiBalancebefore);

            const expectedRiskProviderFees = getPercentageTwoDecimal(profit, riskProviderFee);
            expect(actualRiskProviderFeesCollected).to.be.closeTo(expectedRiskProviderFees, 10);

            // vault owner
            const vaultOwnerDaiBalanceAfter = await tokens.DAI.balanceOf(vaultOwner.address);
            const actualVaultOwnerFeesCollected = vaultOwnerDaiBalanceAfter.sub(vaultOwnerDaiBalancebefore);

            const expectedVaultOwnerFees = getPercentageTwoDecimal(profit, riskProviderFee);
            expect(actualVaultOwnerFeesCollected).to.be.closeTo(expectedVaultOwnerFees, 10);
        });

        it("Collect fees when there are none, should not collect anything", async () => {
            // ARRANGE
            const { accounts, tokens } = await loadFixture(underlyingTokensFixture);

            const ecosystemFeeCollectorDaiBalancebefore = await tokens.DAI.balanceOf(ecosystemFeeCollector.address);
            const treasuryFeeCollectorDaiBalancebefore = await tokens.DAI.balanceOf(treasuryFeeCollector.address);
            const riskProviderDaiBalancebefore = await tokens.DAI.balanceOf(riskProvider.address);
            const vaultOwnerDaiBalancebefore = await tokens.DAI.balanceOf(vaultOwner.address);

            const collectTokens = [tokens.DAI.address];

            // ACT

            // ecosystem
            await feeHandler.connect(ecosystemFeeCollector).collectEcosystemFees(collectTokens);
            // treasury
            await feeHandler.connect(treasuryFeeCollector).collectTreasuryFees(collectTokens);
            // risk provider
            await feeHandler.connect(riskProvider).collectFees(collectTokens);
            // vault owner
            await feeHandler.connect(vaultOwner).collectFees(collectTokens);

            // ASSERT

            // ecosystem
            const ecosystemFeeCollectorDaiBalanceAfter = await tokens.DAI.balanceOf(ecosystemFeeCollector.address);
            const actualEcosystemFeesCollected = ecosystemFeeCollectorDaiBalanceAfter.sub(
                ecosystemFeeCollectorDaiBalancebefore
            );

            const expectedEcosystemFees = constants.Zero;
            expect(actualEcosystemFeesCollected).to.equals(expectedEcosystemFees);

            // treasury
            const treasuryFeeCollectorDaiBalanceAfter = await tokens.DAI.balanceOf(treasuryFeeCollector.address);
            const actualTreasuryFeesCollected = treasuryFeeCollectorDaiBalanceAfter.sub(
                treasuryFeeCollectorDaiBalancebefore
            );

            const expectedTreasuryFees = constants.Zero;
            expect(actualTreasuryFeesCollected).to.equals(expectedTreasuryFees);

            // risk provider
            const riskProviderDaiBalanceAfter = await tokens.DAI.balanceOf(riskProvider.address);
            const actualRiskProviderFeesCollected = riskProviderDaiBalanceAfter.sub(riskProviderDaiBalancebefore);

            const expectedRiskProviderFees = constants.Zero;
            expect(actualRiskProviderFeesCollected).to.equals(expectedRiskProviderFees);

            // vault owner
            const vaultOwnerDaiBalanceAfter = await tokens.DAI.balanceOf(vaultOwner.address);
            const actualVaultOwnerFeesCollected = vaultOwnerDaiBalanceAfter.sub(vaultOwnerDaiBalancebefore);

            const expectedVaultOwnerFees = constants.Zero;
            expect(actualVaultOwnerFeesCollected).to.equals(expectedVaultOwnerFees);
        });

        it("Pay fees when all fees are 0%, should not pay anything", async () => {
            // ARRANGE
            const { accounts, tokens } = await loadFixture(underlyingTokensFixture);

            const profit = utils.parseEther("1");
            const tokenAddress = tokens.DAI.address;

            await feeHandler.connect(riskProviderRegistry).setRiskProviderFee(riskProvider.address, 0);
            await feeHandler.connect(owner).setEcosystemFee(0);
            await feeHandler.connect(owner).setTreasuryFee(0);

            // ACT

            const feesPaid = await feeHandler.connect(vault).callStatic.payFees(
                tokenAddress,
                profit,
                riskProvider.address,
                vaultOwner.address,
                0 // vault fee
            );

            await feeHandler.connect(vault).payFees(
                tokenAddress,
                profit,
                riskProvider.address,
                vaultOwner.address,
                0 // vault fee
            );

            // ASSERT

            // total fees
            expect(feesPaid).to.equal(constants.Zero);

            const platformFees = await feeHandler.platformCollectedFees(tokenAddress);

            // ecosystem
            expect(platformFees.ecosystem).to.equal(constants.Zero);

            // treasury
            expect(platformFees.treasury).to.equal(constants.Zero);

            // risk provider
            const riskProviderFees = await feeHandler.collectedFees(riskProvider.address, tokenAddress);
            expect(riskProviderFees).to.equal(constants.Zero);

            // vault owner
            const vaultOwnerFees = await feeHandler.collectedFees(vaultOwner.address, tokenAddress);
            expect(vaultOwnerFees).to.equal(constants.Zero);
        });
    });

    describe("Gatekeeping tests", () => {
        before(async () => {
            [
                owner,
                vault,
                riskProviderRegistry,
                ecosystemFeeCollector,
                treasuryFeeCollector,
                riskProvider,
                vaultOwner,
            ] = await ethers.getSigners();

            mockController = await deployMockContract(owner, IController__factory.abi);
            await mockController.mock.validVault.returns(false);
            await mockController.mock.validVault.withArgs(vault.address).returns(true);

            mockSpoolOwner = await deployMockContract(owner, ISpoolOwner__factory.abi);
            await mockSpoolOwner.mock.isSpoolOwner.returns(false);
            await mockSpoolOwner.mock.isSpoolOwner.withArgs(owner.address).returns(true);

            feeHandler = await new FeeHandler__factory()
                .connect(owner)
                .deploy(mockSpoolOwner.address, mockController.address, riskProviderRegistry.address);
            feeHandler = feeHandler.connect(owner);
            await feeHandler.initialize(
                ecosystemFee,
                treasuryFee,
                ecosystemFeeCollector.address,
                treasuryFeeCollector.address
            );
            await feeHandler.connect(riskProviderRegistry).setRiskProviderFee(riskProvider.address, riskProviderFee);
        });

        it("Should revert if initialized with Controller as 0 address", async () => {
            await expect(
                new FeeHandler__factory()
                    .connect(owner)
                    .deploy(mockSpoolOwner.address, constants.AddressZero, riskProviderRegistry.address)
            ).to.be.revertedWith("FeeHandler::constructor: Controller address cannot be 0");
        });

        it("Should revert if initialized with Risk Provider Registry as 0 address", async () => {
            await expect(
                new FeeHandler__factory()
                    .connect(owner)
                    .deploy(owner.address, mockController.address, constants.AddressZero)
            ).to.be.revertedWith("FeeHandler::constructor: Risk Provider Registry address cannot be 0");
        });

        it("Should revert if initialized with Ecosystem Fee Collector as 0 address", async () => {
            const feeHandler = await new FeeHandler__factory()
                .connect(owner)
                .deploy(mockSpoolOwner.address, mockController.address, riskProviderRegistry.address);
            await expect(
                feeHandler.initialize(ecosystemFee, treasuryFee, constants.AddressZero, treasuryFeeCollector.address)
            ).to.be.revertedWith("FeeHandler::constructor: Ecosystem Fee Collector cannot be 0");
        });

        it("Should revert if initialized with Treasury Fee Collecter as 0 address", async () => {
            const feeHandler = await new FeeHandler__factory()
                .connect(owner)
                .deploy(mockSpoolOwner.address, mockController.address, riskProviderRegistry.address);
            await expect(
                feeHandler.initialize(ecosystemFee, treasuryFee, ecosystemFeeCollector.address, constants.AddressZero)
            ).to.be.revertedWith("FeeHandler::constructor: Treasury Fee Collector address cannot be 0");
        });

        it("Should revert if non-vault tries to pay fees", async () => {
            const { accounts, tokens } = await loadFixture(underlyingTokensFixture);

            const profit = utils.parseEther("1");
            const tokenAddress = tokens.DAI.address;

            await expect(
                feeHandler
                    .connect(user)
                    .payFees(tokenAddress, profit, riskProvider.address, vaultOwner.address, vaultFee)
            ).to.be.revertedWith("FeeHandler::_onlyVault: Can only be invoked by the Vault");
        });

        it("Should revert if non-risk provider registry tries to pay fees", async () => {
            await expect(feeHandler.connect(user).setRiskProviderFee(riskProvider.address, 10)).to.be.revertedWith(
                "FeeHandler::_onlyRiskProviderRegistry: Can only be invoked by the Risk Provider Registry"
            );
        });

        it("Should revert if non-owner tries to set ecosystem fees", async () => {
            await expect(feeHandler.connect(user).setEcosystemFee(10)).to.be.revertedWith(
                "SpoolOwnable::onlyOwner: Caller is not the Spool owner"
            );
        });

        it("Should revert if non-owner tries to set treasury fees", async () => {
            await expect(feeHandler.connect(user).setTreasuryFee(10)).to.be.revertedWith(
                "SpoolOwnable::onlyOwner: Caller is not the Spool owner"
            );
        });

        it("Should revert if non-owner tries to set ecosystem collector", async () => {
            await expect(
                feeHandler.connect(user).setEcosystemCollector(ecosystemFeeCollector.address)
            ).to.be.revertedWith("SpoolOwnable::onlyOwner: Caller is not the Spool owner");
        });

        it("Should revert if non-owner tries to set treasury collector", async () => {
            await expect(
                feeHandler.connect(user).setTreasuryCollector(ecosystemFeeCollector.address)
            ).to.be.revertedWith("SpoolOwnable::onlyOwner: Caller is not the Spool owner");
        });

        it("Should revert if trying to set ecosystem fee collector to 0", async () => {
            await expect(feeHandler.connect(owner).setEcosystemCollector(constants.AddressZero)).to.be.revertedWith(
                "FeeHandler::_setEcosystemCollector: Ecosystem Fee Collector address cannot be 0"
            );
        });

        it("Should revert if trying to set treasury fee collector to 0", async () => {
            await expect(feeHandler.connect(owner).setTreasuryCollector(constants.AddressZero)).to.be.revertedWith(
                "FeeHandler::_setTreasuryCollector: Treasury Fee Collector address cannot be 0"
            );
        });

        it("Should revert if trying to set ecosystem fees to more than 20%", async () => {
            await expect(feeHandler.connect(owner).setEcosystemFee(20_01)).to.be.revertedWith(
                "FeeHandler::_setEcosystemFee: Ecosystem fee too big"
            );
        });

        it("Should revert if trying to set treasury fees to more than 10%", async () => {
            await expect(feeHandler.connect(owner).setTreasuryFee(10_01)).to.be.revertedWith(
                "FeeHandler::_setTreasuryFee: Treasury fee too big"
            );
        });

        it("Should revert if trying to set risk provider fees to more than 5%", async () => {
            await expect(
                feeHandler.connect(riskProviderRegistry).setRiskProviderFee(riskProvider.address, 5_01)
            ).to.be.revertedWith("FeeHandler::_setRiskProviderFee: Risk Provider fee too big");
        });
    });
});
