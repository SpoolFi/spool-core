import { expect, use } from "chai";
import { BigNumber, constants } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import { IBaseStrategy, IdleTranchesNoReward__factory, IERC20, TestStrategySetup__factory } from "../../../build/types";
import { AccountsFixture, mainnetConst, TokensFixture, underlyingTokensFixture } from "../../shared/fixtures";
import { Tokens } from "../../shared/constants";

import {
    BasisPoints,
    encodeDepositSlippage,
    getMillionUnits,
    mineBlocks,
    resetToBlockNumber,
    SECS_DAY,
} from "../../shared/utilities";

import { getStrategySetupObject, getStrategyState, setStrategyState } from "./shared/stratSetupUtilities";

const { Zero, AddressZero } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);
const mainnetBlock = 15082700;

type idleTranchesStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
    idleTranche: string;
};

const strategyAssets: idleTranchesStratSetup[] = [
    {
        name: "DAI",
        idleTranche: mainnetConst.idleTranches.eulerDAI.address,
    },
    {
        name: "USDC",
        idleTranche: mainnetConst.idleTranches.eulerUSDC.address,
    },
    {
        name: "USDT",
        idleTranche: mainnetConst.idleTranches.eulerUSDT.address,
    },
];

describe("Strategies Unit Test: IdleTranches Euler", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await resetToBlockNumber(mainnetBlock);
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    it("Should fail deploying strategy with vault address 0", async () => {
        const IdleTranchesStrategy = new IdleTranchesNoReward__factory().connect(accounts.administrator);
        await expect(
            IdleTranchesStrategy.deploy(AddressZero, "0x0000000000000000000000000000000000000001", AddressZero)
        ).to.be.revertedWith("IdleTranchesNoReward::constructor: Idle CDO address cannot be 0");
    });

    describe(`Gatekeeping`, () => {
        it("Claim rewards, should throw as protocol has no rewards", async () => {
            const { tokens } = await loadFixture(underlyingTokensFixture);
            const idleTranchesContract = await new IdleTranchesNoReward__factory()
                .connect(accounts.administrator)
                .deploy(mainnetConst.idleTranches.eulerUSDC.address, tokens.USDC.address, AddressZero);

            // ACT
            await expect(idleTranchesContract.claimRewards([])).to.be.revertedWith(
                "NoRewardStrategy::_processRewards: Strategy does not have rewards"
            );
        });
    });

    strategyAssets.forEach(({ name, idleTranche }) => {
        describe(`Asset: ${name}`, () => {
            let token: IERC20;
            before(async () => {
                const { tokens } = await loadFixture(underlyingTokensFixture);
                token = tokens[name];
            });

            describe(`Deployment: ${name}`, () => {
                it("Should deploy", async () => {
                    await new IdleTranchesNoReward__factory().connect(accounts.administrator).deploy(idleTranche, token.address, AddressZero);
                });
            });

            describe(`Functions: ${name}`, () => {
                let idleTranchesContract: IBaseStrategy;
                let implAddress: string;
                let millionUnits: BigNumber;

                before(async () => {
                    const idleTranchesStrategyImpl = await new IdleTranchesNoReward__factory()
                        .connect(accounts.administrator)
                        .deploy(idleTranche, token.address, AddressZero);

                    implAddress = idleTranchesStrategyImpl.address;

                    millionUnits = getMillionUnits(mainnetConst.tokens[name].units);
                });

                beforeEach(async () => {
                    // deploy proxy for a strategy
                    const compoundStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        implAddress
                    );

                    idleTranchesContract = IdleTranchesNoReward__factory.connect(
                        compoundStrategyProxy.address,
                        accounts.administrator
                    );
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(idleTranchesContract, stratSetup);
                    token.transfer(idleTranchesContract.address, depositAmount);

                    // ACT
                    await idleTranchesContract.process([], false, []);

                    // ASSERT
                    const balance = await idleTranchesContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(idleTranchesContract);

                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_1);
                    const totalShares = balance.mul(10**6).sub(10**5);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_01);
                });

                it("Process deposit twice, should deposit the second time and get the same number of shares", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(idleTranchesContract, stratSetup);
                    token.transfer(idleTranchesContract.address, depositAmount);

                    await idleTranchesContract.process([], false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(idleTranchesContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(idleTranchesContract, stratSetup2);
                    token.transfer(idleTranchesContract.address, depositAmount);

                    // ACT
                    await idleTranchesContract.process([], false, []);

                    // ASSERT
                    const balance = await idleTranchesContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount.mul(2), BasisPoints.Basis_1);

                    const totalShares = balance.mul(10**6).sub(10**5);
                    const strategyDetails = await getStrategyState(idleTranchesContract);
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
                    await setStrategyState(idleTranchesContract, stratSetupDeposit);
                    token.transfer(idleTranchesContract.address, depositAmount);
                    await idleTranchesContract.process([], false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(idleTranchesContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(idleTranchesContract, stratSetupWithdraw);

                    // ACT
                    await idleTranchesContract.process([0], false, []);

                    // ASSERT
                    const balance = await idleTranchesContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(idleTranchesContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);
                });

                it("Fast withdraw, remove shares", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(idleTranchesContract, stratSetupDeposit);
                    token.transfer(idleTranchesContract.address, depositAmount);
                    await idleTranchesContract.process([], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(idleTranchesContract);

                    // ACT
                    await idleTranchesContract.fastWithdraw(stratSetupWithdraw.totalShares, [0], []);

                    // ASSERT

                    const balance = await idleTranchesContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(idleTranchesContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    const daiBalance = await token.balanceOf(idleTranchesContract.address);
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
                    await setStrategyState(idleTranchesContract, stratSetupDeposit);
                    token.transfer(idleTranchesContract.address, depositAmount);
                    await idleTranchesContract.process([], false, []);

                    // add pending deposit
                    const pendingDeposit = millionUnits.div(5);
                    const stratSetupDepositpending = getStrategySetupObject();
                    stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                    stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                    await setStrategyState(idleTranchesContract, stratSetupDepositpending);

                    const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                    token.transfer(idleTranchesContract.address, totalPendingDeposit);

                    // mine blocks
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await idleTranchesContract.emergencyWithdraw(emergencyRecipient, []);

                    // ASSERT
                    const stratBalance = await idleTranchesContract.getStrategyBalance();
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
