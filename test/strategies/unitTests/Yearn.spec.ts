import { expect, use } from "chai";
import { BigNumber, constants } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import { IBaseStrategy, IERC20, TestStrategySetup__factory, YearnStrategy__factory } from "../../../build/types";
import { AccountsFixture, mainnetConst, TokensFixture, underlyingTokensFixture } from "../../shared/fixtures";
import { Tokens } from "../../shared/constants";

import {
    BasisPoints,
    encodeDepositSlippage,
    getMillionUnits,
    mineBlocks,
    reset,
    SECS_DAY,
} from "../../shared/utilities";

import { getStrategySetupObject, getStrategyState, setStrategyState } from "./shared/stratSetupUtilities";

const { Zero, AddressZero } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

type YearnStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
    yVault: string;
};

const strategyAssets: YearnStratSetup[] = [
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

const depositSlippage = encodeDepositSlippage(0);

describe("Strategies Unit Test: Yearn", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    it("Should fail deploying Yearn with vault address 0", async () => {
        const YearnStrategy = new YearnStrategy__factory().connect(accounts.administrator);
        await expect(
            YearnStrategy.deploy(AddressZero, "0x0000000000000000000000000000000000000001", AddressZero)
        ).to.be.revertedWith("YearnStrategy::constructor: Vault address cannot be 0");
    });

    describe(`Gatekeeping`, () => {
        it("Claim rewards, should throw as Yearn Vault has no rewards", async () => {
            const { tokens } = await loadFixture(underlyingTokensFixture);
            const yearnContract = await new YearnStrategy__factory()
                .connect(accounts.administrator)
                .deploy(mainnetConst.yearn.DAIVault.address, tokens.DAI.address, AddressZero);

            // ACT
            await expect(yearnContract.claimRewards([])).to.be.revertedWith(
                "NoRewardStrategy::_processRewards: Strategy does not have rewards"
            );
        });
    });

    strategyAssets.forEach(({ name, yVault }) => {
        describe(`Asset: ${name}`, () => {
            let token: IERC20;
            before(async () => {
                const { tokens } = await loadFixture(underlyingTokensFixture);
                token = tokens[name];
            });

            describe(`Deployment: ${name}`, () => {
                it("Should deploy", async () => {
                    await new YearnStrategy__factory().connect(accounts.administrator).deploy(yVault, token.address, AddressZero);
                });
            });

            describe(`Functions: ${name}`, () => {
                let yearnContract: IBaseStrategy;
                let implAddress: string;
                let millionUnits: BigNumber;

                before(async () => {
                    const yearnStrategyImpl = await new YearnStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(yVault, token.address, AddressZero);

                    implAddress = yearnStrategyImpl.address;

                    millionUnits = getMillionUnits(mainnetConst.tokens[name].units);
                });

                beforeEach(async () => {
                    // deploy proxy for a strategy
                    const compoundStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        implAddress
                    );

                    yearnContract = YearnStrategy__factory.connect(
                        compoundStrategyProxy.address,
                        accounts.administrator
                    );
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(yearnContract, stratSetup);
                    token.transfer(yearnContract.address, depositAmount);

                    // ACT
                    await yearnContract.process([depositSlippage], false, []);

                    // ASSERT
                    const balance = await yearnContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(yearnContract);

                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_1);
                    const totalShares = balance.mul(10**6).sub(10**5);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_01);
                });

                it("Process deposit twice, should deposit the second time and get the same number of shares", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(yearnContract, stratSetup);
                    token.transfer(yearnContract.address, depositAmount);

                    await yearnContract.process([depositSlippage], false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(yearnContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(yearnContract, stratSetup2);
                    token.transfer(yearnContract.address, depositAmount);

                    // ACT
                    await yearnContract.process([depositSlippage], false, []);

                    // ASSERT
                    const balance = await yearnContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount.mul(2), BasisPoints.Basis_1);

                    const totalShares = balance.mul(10**6).sub(10**5);
                    const strategyDetails = await getStrategyState(yearnContract);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_01);

                    const shares1 = stratSetup2.totalShares;
                    const shares2 = strategyDetails.totalShares.sub(shares1);

                    expect(shares1).to.beCloseTo(shares2, BasisPoints.Basis_01);
                });

                it("Process withraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(yearnContract, stratSetupDeposit);
                    token.transfer(yearnContract.address, depositAmount);
                    await yearnContract.process([depositSlippage], false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(yearnContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(yearnContract, stratSetupWithdraw);

                    // ACT
                    await yearnContract.process([0], false, []);

                    // ASSERT
                    const balance = await yearnContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(yearnContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);
                });

                it("Fast withdraw, remove shares", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(yearnContract, stratSetupDeposit);
                    token.transfer(yearnContract.address, depositAmount);
                    await yearnContract.process([depositSlippage], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(yearnContract);

                    // ACT
                    await yearnContract.fastWithdraw(stratSetupWithdraw.totalShares, [0], []);

                    // ASSERT

                    const balance = await yearnContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(yearnContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    const daiBalance = await token.balanceOf(yearnContract.address);
                    expect(daiBalance).to.be.greaterWithTolerance(depositAmount, BasisPoints.Basis_1);
                });

                it("Emergency withdraw, should withdraw all funds and send it to the recipient", async () => {
                    // ARRANGE
                    const emergencyRecipient = accounts.user0.address;
                    const tokenBalanceBefore = await token.balanceOf(emergencyRecipient);

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(yearnContract, stratSetupDeposit);
                    token.transfer(yearnContract.address, depositAmount);
                    await yearnContract.process([depositSlippage], false, []);

                    // add pending deposit
                    const pendingDeposit = millionUnits.div(5);
                    const stratSetupDepositpending = getStrategySetupObject();
                    stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                    stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                    await setStrategyState(yearnContract, stratSetupDepositpending);

                    const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                    token.transfer(yearnContract.address, totalPendingDeposit);

                    // mine blocks
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await yearnContract.emergencyWithdraw(emergencyRecipient, []);

                    // ASSERT
                    const stratBalance = await yearnContract.getStrategyBalance();
                    expect(stratBalance).to.equal(Zero);

                    // check if balance of the recipient is close to the deposit + pending deposit
                    const totalDeposit = depositAmount.add(totalPendingDeposit);

                    const tokenBalanceAfter = await token.balanceOf(emergencyRecipient);
                    const tokensWithdrawn = tokenBalanceAfter.sub(tokenBalanceBefore);
                    expect(tokensWithdrawn).to.beCloseTo(totalDeposit, BasisPoints.Basis_100);
                });
            });
        });
    });
});
