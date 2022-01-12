import { expect, use } from "chai";
import { BigNumber, BigNumberish, constants } from "ethers";
import { solidity } from "ethereum-waffle";
import { deployMockContract, MockContract } from "@ethereum-waffle/mock-contract";
import { ethers } from "hardhat";

import { MockRewardDrip__factory } from "../build/types/factories/MockRewardDrip__factory";
import { MockRewardDrip } from "../build/types/MockRewardDrip";
import { MockToken__factory } from "../build/types/factories/MockToken__factory";
import { MockToken } from "../build/types/MockToken";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ISpoolOwner__factory } from "../build/types/factories/ISpoolOwner__factory";
import { BasisPoints, getMillionUnits, increase, increaseTo, SECS_DAY } from "./shared/utilities";

const ADDRESS_ONE = "0x0000000000000000000000000000000000000001";
const UNDERLYING_ADDRESS = "0x0000000000000000000000000000000000000002";

use(solidity);

describe("RewardDrip", () => {
    let mockSpoolOwner: MockContract;
    let rewardDrip: MockRewardDrip;
    let rewardToken: MockToken;
    let deployer: SignerWithAddress;
    let spoolDao: SignerWithAddress;
    let vaultOwner: SignerWithAddress;
    let user1: SignerWithAddress;
    let user2: SignerWithAddress;

    before(async () => {
        [
            deployer,
            spoolDao,
            vaultOwner,
            user1,
            user2,
        ] = await ethers.getSigners();

        mockSpoolOwner = await deployMockContract(spoolDao, ISpoolOwner__factory.abi);
        await mockSpoolOwner.mock.isSpoolOwner.returns(false);
        await mockSpoolOwner.mock.isSpoolOwner.withArgs(spoolDao.address).returns(true);
    })

    beforeEach("Deploy reward drip and reward token", async () => {
        rewardDrip = await (new MockRewardDrip__factory).connect(deployer).deploy(
            ADDRESS_ONE,
            ADDRESS_ONE,
            ADDRESS_ONE,
            ADDRESS_ONE,
            mockSpoolOwner.address,
            vaultOwner.address,
            UNDERLYING_ADDRESS
        )

        rewardToken = (await (new MockToken__factory()).connect(deployer).deploy("RWD", "RWD", 18));
        
        // approve transferFrom for reward drip in advance so we don't have to do it in tests
        await rewardToken.connect(vaultOwner).approve(rewardDrip.address, constants.MaxUint256);
    });

    describe("Rewards Drip Configuration", () => {        
        it("Should add one token", async () => {
            // ARRANGE
            const rewardAmount = getMillionUnits(18);
            const rewardDuration = SECS_DAY * 10; // 10 days
            await rewardToken.mint(vaultOwner.address, rewardAmount);

            // ACT
            await rewardDrip.connect(vaultOwner).addToken(
                rewardToken.address,
                rewardDuration,
                rewardAmount
            );
            
            // ASSERT
            expect(await rewardDrip.rewardTokensCount()).to.eq(1);
            expect(await rewardDrip.rewardTokens(0)).to.eq(rewardToken.address);
            expect(await rewardToken.balanceOf(rewardDrip.address)).to.eq(rewardAmount);
            
            const rewardConfiguration = await rewardDrip.rewardConfiguration(rewardToken.address);
            expect(rewardConfiguration.rewardsDuration).to.eq(rewardDuration);
            const rewardRatePredicted = rewardAmount.mul(BigNumber.from(10).pow(18)).div(rewardDuration);
            expect(rewardConfiguration.rewardRate).to.eq(rewardRatePredicted);
        });

        it("Should add two tokens", async () => {
            // ARRANGE
            const rewardAmount = getMillionUnits(18);
            const rewardDuration = SECS_DAY * 10; // 10 days
            await rewardToken.mint(vaultOwner.address, rewardAmount);

            const rewardToken2 = (await (new MockToken__factory()).connect(deployer).deploy("RWD2", "RWD2", 18));
            await rewardToken2.connect(vaultOwner).approve(rewardDrip.address, constants.MaxUint256);
            await rewardToken2.mint(vaultOwner.address, rewardAmount);


            // ACT
            await rewardDrip.connect(vaultOwner).addToken(
                rewardToken.address,
                rewardDuration,
                rewardAmount
            );

            await rewardDrip.connect(vaultOwner).addToken(
                rewardToken2.address,
                rewardDuration,
                rewardAmount
            );
            
            // ASSERT
            expect(await rewardDrip.rewardTokensCount()).to.eq(2);

            expect(await rewardDrip.rewardTokens(0)).to.eq(rewardToken.address);
            expect(await rewardToken.balanceOf(rewardDrip.address)).to.eq(rewardAmount);

            expect(await rewardDrip.rewardTokens(1)).to.eq(rewardToken2.address);
            expect(await rewardToken2.balanceOf(rewardDrip.address)).to.eq(rewardAmount);
        });
    });

    describe("Rewards Drip Emitting Rewards", () => {
        const rewardAmount = getMillionUnits(18);
        const rewardDuration = SECS_DAY * 10; // 10 days

        beforeEach(async () => {
            await rewardToken.mint(vaultOwner.address, rewardAmount);

            await rewardDrip.connect(vaultOwner).addToken(
                rewardToken.address,
                rewardDuration,
                rewardAmount
            );
        });

        it("Deposit one user, should claim rewards proportionally", async () => {
            // ARRANGE
            const depositAmount = getMillionUnits(18);
            await rewardDrip.connect(user1).deposit(depositAmount);
            const user1balanceBefore = await rewardToken.balanceOf(user1.address)
            await increase(rewardDuration * 2);

            // ACT
            await rewardDrip.getActiveRewards(user1.address);
            
            // ASSERT
            const user1balanceAfter = await rewardToken.balanceOf(user1.address)
            const user1balanceGain = user1balanceAfter.sub(user1balanceBefore);
            expect(user1balanceGain).to.beCloseTo(rewardAmount, BasisPoints.Basis_10);
        });

        it("Deposit two users, should claim rewards proportionally", async () => {
            // ARRANGE
            const deposit1Amount = getMillionUnits(18);
            const deposit2Amount = getMillionUnits(18).div(2);
            const depositTotal = deposit1Amount.add(deposit2Amount);
            await rewardDrip.connect(user1).deposit(deposit1Amount);
            await rewardDrip.connect(user2).deposit(deposit2Amount);
            const user1balanceBefore = await rewardToken.balanceOf(user1.address)
            const user2balanceBefore = await rewardToken.balanceOf(user2.address)
            await increase(rewardDuration * 2);

            // ACT
            await rewardDrip.getActiveRewards(user1.address);
            await rewardDrip.getActiveRewards(user2.address);
            
            // ASSERT
            const user1balanceAfter = await rewardToken.balanceOf(user1.address)
            const user1balanceGain = user1balanceAfter.sub(user1balanceBefore);
            expect(user1balanceGain).to.beCloseTo(rewardAmount.mul(deposit1Amount).div(depositTotal), BasisPoints.Basis_10);

            const user2balanceAfter = await rewardToken.balanceOf(user2.address)
            const user2balanceGain = user2balanceAfter.sub(user2balanceBefore);
            expect(user2balanceGain).to.beCloseTo(rewardAmount.mul(deposit2Amount).div(depositTotal), BasisPoints.Basis_10);
        });

        it("Deposit two users, two rewards, should claim rewards proportionally", async () => {
            const rewardToken2 = (await (new MockToken__factory()).connect(deployer).deploy("RWD2", "RWD2", 18));
            await rewardToken2.connect(vaultOwner).approve(rewardDrip.address, constants.MaxUint256);
            const reward2Amount = getMillionUnits(3);
            
            await addToken(
                rewardDrip,
                rewardToken2,
                vaultOwner,
                reward2Amount,
                Math.round(rewardDuration / 2)
            )

            // ARRANGE
            const deposit1Amount = getMillionUnits(18);
            const deposit2Amount = getMillionUnits(18).div(2);
            const depositTotal = deposit1Amount.add(deposit2Amount);
            await rewardDrip.connect(user1).deposit(deposit1Amount);
            await rewardDrip.connect(user2).deposit(deposit2Amount);
            const user1balance1Before = await rewardToken.balanceOf(user1.address)
            const user2balance1Before = await rewardToken.balanceOf(user2.address)
            const user1balance2Before = await rewardToken2.balanceOf(user1.address)
            const user2balance2Before = await rewardToken2.balanceOf(user2.address)
            await increase(rewardDuration * 2);

            // ACT
            await rewardDrip.getActiveRewards(user1.address);
            await rewardDrip.getActiveRewards(user2.address);
            
            // ASSERT
            const user1balance1After = await rewardToken.balanceOf(user1.address)
            const user1balance2After = await rewardToken2.balanceOf(user1.address)
            const user1balance1Gain = user1balance1After.sub(user1balance1Before);
            const user1balance2Gain = user1balance2After.sub(user1balance2Before);
            expect(user1balance1Gain).to.beCloseTo(rewardAmount.mul(deposit1Amount).div(depositTotal), BasisPoints.Basis_10);
            expect(user1balance2Gain).to.beCloseTo(reward2Amount.mul(deposit1Amount).div(depositTotal), BasisPoints.Basis_10);

            const user2balance1After = await rewardToken.balanceOf(user2.address)
            const user2balance2After = await rewardToken2.balanceOf(user2.address)
            const user2balance1Gain = user2balance1After.sub(user2balance1Before);
            const user2balance2Gain = user2balance2After.sub(user2balance2Before);
            expect(user2balance1Gain).to.beCloseTo(rewardAmount.mul(deposit2Amount).div(depositTotal), BasisPoints.Basis_10);
            expect(user2balance2Gain).to.beCloseTo(reward2Amount.mul(deposit2Amount).div(depositTotal), BasisPoints.Basis_10);
        });
    });

    describe("Rewards Drip Emitting Rewards, deposit before rewards", () => {
        const rewardAmount = getMillionUnits(18);
        const rewardDuration = SECS_DAY * 10; // 10 days

        it("Deposit before reward start, should claim rewards proportionally", async () => {
            // ARRANGE
            const deposit1Amount = getMillionUnits(18);
            await rewardDrip.connect(user1).deposit(deposit1Amount);
            const user1balanceBefore = await rewardToken.balanceOf(user1.address)
            
            await increase(rewardDuration);

            await addToken(
                rewardDrip,
                rewardToken,
                vaultOwner,
                rewardAmount,
                rewardDuration
            )

            const deposit2Amount = deposit1Amount;
            const user2balanceBefore = await rewardToken.balanceOf(user2.address)
            await rewardDrip.connect(user2).deposit(deposit2Amount);

            const depositTotal = deposit1Amount.add(deposit2Amount);

            await increase(rewardDuration);

            // ACT
            await rewardDrip.getActiveRewards(user1.address);
            await rewardDrip.getActiveRewards(user2.address);
            
            // ASSERT
            const user1balanceAfter = await rewardToken.balanceOf(user1.address)
            const user1balanceGain = user1balanceAfter.sub(user1balanceBefore);
            expect(user1balanceGain).to.beCloseTo(rewardAmount.mul(deposit1Amount).div(depositTotal), BasisPoints.Basis_10);

            const user2balanceAfter = await rewardToken.balanceOf(user2.address)
            const user2balanceGain = user2balanceAfter.sub(user2balanceBefore);
            expect(user2balanceGain).to.beCloseTo(rewardAmount.mul(deposit2Amount).div(depositTotal), BasisPoints.Basis_10);
        });
    });

    describe("End of life tests", () => {
        const rewardAmount = getMillionUnits(18);
        const reward2Amount = getMillionUnits(3);
        const rewardDuration = SECS_DAY * 10; // 10 days
        let rewardToken2: MockToken;

        beforeEach(async () => {
            await rewardToken.mint(vaultOwner.address, rewardAmount);

            await rewardDrip.connect(vaultOwner).addToken(
                rewardToken.address,
                rewardDuration,
                rewardAmount
            );

            rewardToken2 = (await (new MockToken__factory()).connect(deployer).deploy("RWD2", "RWD2", 6));
            await addToken(
                rewardDrip,
                rewardToken2,
                vaultOwner,
                reward2Amount,
                rewardDuration
            )
        });

        it("Should be able to remove token after finish, while user can still claim the token reward", async () => {
            // ARRANGE
            const deposit1Amount = getMillionUnits(18);
            await rewardDrip.connect(user1).deposit(deposit1Amount);

            const user1balance1Before = await rewardToken.balanceOf(user1.address)
            const user1balance2Before = await rewardToken2.balanceOf(user1.address)

            const rewardCountBefore = await rewardDrip.rewardTokensCount();
            await increase(rewardDuration);
           
            // ACT
            await rewardDrip.connect(vaultOwner).removeReward(rewardToken.address);
            await rewardDrip.getActiveRewards(user1.address);
            await rewardDrip.getRewards([rewardToken.address], user1.address);

            // ASSERT
            const rewardCountAfter = await rewardDrip.rewardTokensCount();
            expect(rewardCountAfter).to.be.equal(rewardCountBefore - 1);

            const user1balance1After = await rewardToken.balanceOf(user1.address)
            const user1balance2After = await rewardToken2.balanceOf(user1.address)
            const user1balance1Gain = user1balance1After.sub(user1balance1Before);
            const user1balance2Gain = user1balance2After.sub(user1balance2Before);
            expect(user1balance1Gain).to.beCloseTo(rewardAmount, BasisPoints.Basis_10);
            expect(user1balance2Gain).to.beCloseTo(reward2Amount, BasisPoints.Basis_10);
        });
    });
});

const addToken = async (rewardDrip: MockRewardDrip, rewardToken: MockToken, vaultOwner: SignerWithAddress, rewardAmount: BigNumber, rewardDuration: BigNumberish) => {
    await rewardToken.connect(vaultOwner).approve(rewardDrip.address, constants.MaxUint256);
    await rewardToken.mint(vaultOwner.address, rewardAmount);

    await rewardDrip.connect(vaultOwner).addToken(
        rewardToken.address,
        rewardDuration,
        rewardAmount
    );
}