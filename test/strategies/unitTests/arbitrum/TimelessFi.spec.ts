import { expect, use } from "chai";
import { BigNumber, constants } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import { IBaseStrategy, IERC20, TestStrategySetup__factory, TimelessFiStrategy__factory } from "../../../../build/types";
import { AccountsFixture, arbitrumConst, TokensFixture, underlyingTokensFixture } from "../../../shared/fixtures";
import { Tokens } from "../../../shared/constants";

import {
    BasisPoints,
    encodeDepositSlippage,
    getMillionUnits,
    mineBlocks,
    reset,
    SECS_DAY,
} from "../../../shared/utilities";

import { getStrategySetupObject, getStrategyState, setStrategyState } from "./../shared/stratSetupUtilities";

const { Zero, AddressZero } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

type TimelessFiStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
};

const strategyAssets: TimelessFiStratSetup[] = [{ name: "USDC" }];

const depositSlippage = encodeDepositSlippage(0);

describe("Strategies Unit Test: Arbitrum - TimelessFi", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    it("Should fail deploying TimelessFi with xPYT address 0", async () => {
        const TimelessFiStrategy = new TimelessFiStrategy__factory().connect(accounts.administrator);
        await expect(
            TimelessFiStrategy.deploy(
                AddressZero, 
                "0x0000000000000000000000000000000000000001", 
                "0x0000000000000000000000000000000000000001", 
                "0x0000000000000000000000000000000000000001", 
                AddressZero)
        ).to.be.revertedWith("TimelessFiStrategy::constructor: xPYT address cannot be 0");
    });

    it("Should fail deploying TimelessFi with vault address 0", async () => {
        const TimelessFiStrategy = new TimelessFiStrategy__factory().connect(accounts.administrator);
        await expect(
            TimelessFiStrategy.deploy(
                "0x0000000000000000000000000000000000000001", 
                AddressZero, 
                "0x0000000000000000000000000000000000000001", 
                "0x0000000000000000000000000000000000000001", 
                AddressZero)
        ).to.be.revertedWith("TimelessFiStrategy::constructor: Vault address cannot be 0");
    });

    it("Should fail deploying TimelessFi with gate address 0", async () => {
        const TimelessFiStrategy = new TimelessFiStrategy__factory().connect(accounts.administrator);
        await expect(
            TimelessFiStrategy.deploy(
                "0x0000000000000000000000000000000000000001", 
                "0x0000000000000000000000000000000000000001", 
                AddressZero, 
                "0x0000000000000000000000000000000000000001", 
                AddressZero)
        ).to.be.revertedWith("TimelessFiStrategy::constructor: Gate address cannot be 0");
    });

    describe(`Gatekeeping`, () => {
        it("Claim rewards, should throw as TimelessFi Vault has no rewards", async () => {
            const { tokens } = await loadFixture(underlyingTokensFixture);
            const timelessfiContract = await new TimelessFiStrategy__factory()
                .connect(accounts.administrator)
                .deploy(
                    arbitrumConst.timelessfi.xPYT.address, 
                    arbitrumConst.timelessfi.vault.address, 
                    arbitrumConst.timelessfi.gate.address, 
                    tokens.DAI.address, 
                    AddressZero
                );

            // ACT
            await expect(timelessfiContract.claimRewards([])).to.be.revertedWith(
                "NoRewardStrategy::_processRewards: Strategy does not have rewards"
            );
        });
    });

    strategyAssets.forEach(({ name }) => {
        describe(`Asset: ${name}`, () => {
            let token: IERC20;
            before(async () => {
                const { tokens } = await loadFixture(underlyingTokensFixture);
                token = tokens[name];
            });

            describe(`Deployment: ${name}`, () => {
                it("Should deploy", async () => {
                    await new TimelessFiStrategy__factory()
                        .connect(accounts.administrator).deploy(
                        arbitrumConst.timelessfi.xPYT.address, 
                        arbitrumConst.timelessfi.vault.address, 
                        arbitrumConst.timelessfi.gate.address, 
                        token.address, 
                        AddressZero
                    );
                });
            });

            describe(`Functions: ${name}`, () => {
                let timelessfiContract: IBaseStrategy;
                let implAddress: string;
                let millionUnits: BigNumber;

                before(async () => {
                    const timelessfiStrategyImpl = await new TimelessFiStrategy__factory()
                        .connect(accounts.administrator).deploy(
                        arbitrumConst.timelessfi.xPYT.address, 
                        arbitrumConst.timelessfi.vault.address, 
                        arbitrumConst.timelessfi.gate.address, 
                        token.address, 
                        AddressZero
                    );

                    implAddress = timelessfiStrategyImpl.address;

                    millionUnits = getMillionUnits(arbitrumConst.tokens[name].units);
                });

                beforeEach(async () => {
                    // deploy proxy for a strategy
                    const compoundStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        implAddress
                    );

                    timelessfiContract = TimelessFiStrategy__factory.connect(
                        compoundStrategyProxy.address,
                        accounts.administrator
                    );
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(timelessfiContract, stratSetup);
                    token.transfer(timelessfiContract.address, depositAmount);

                    // ACT
                    await timelessfiContract.process([depositSlippage], false, []);

                    // ASSERT
                    const balance = await timelessfiContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(timelessfiContract);

                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_1);
                    const totalShares = balance.mul(10**6).sub(10**5);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_01);
                });

                it("Process deposit twice, should deposit the second time and get the same number of shares", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(timelessfiContract, stratSetup);
                    token.transfer(timelessfiContract.address, depositAmount);

                    await timelessfiContract.process([depositSlippage], false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(timelessfiContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(timelessfiContract, stratSetup2);
                    token.transfer(timelessfiContract.address, depositAmount);

                    // ACT
                    await timelessfiContract.process([depositSlippage], false, []);

                    // ASSERT
                    const balance = await timelessfiContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount.mul(2), BasisPoints.Basis_1);

                    const totalShares = balance.mul(10**6).sub(10**5);
                    const strategyDetails = await getStrategyState(timelessfiContract);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_01);

                    const shares1 = stratSetup2.totalShares;
                    const shares2 = strategyDetails.totalShares.sub(shares1);

                    expect(shares1).to.beCloseTo(shares2, BasisPoints.Basis_01);
                });

                it("Process withdraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(timelessfiContract, stratSetupDeposit);
                    token.transfer(timelessfiContract.address, depositAmount);
                    await timelessfiContract.process([depositSlippage], false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(timelessfiContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(timelessfiContract, stratSetupWithdraw);

                    // ACT
                    await timelessfiContract.process([0], false, []);

                    // ASSERT
                    const balance = await timelessfiContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(timelessfiContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);
                });

                it("Fast withdraw, remove shares", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(timelessfiContract, stratSetupDeposit);
                    token.transfer(timelessfiContract.address, depositAmount);
                    await timelessfiContract.process([depositSlippage], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(timelessfiContract);

                    // ACT
                    await timelessfiContract.fastWithdraw(stratSetupWithdraw.totalShares, [0], []);

                    // ASSERT

                    const balance = await timelessfiContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(timelessfiContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    const daiBalance = await token.balanceOf(timelessfiContract.address);
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
                    await setStrategyState(timelessfiContract, stratSetupDeposit);
                    token.transfer(timelessfiContract.address, depositAmount);
                    await timelessfiContract.process([depositSlippage], false, []);

                    // add pending deposit
                    const pendingDeposit = millionUnits.div(5);
                    const stratSetupDepositpending = getStrategySetupObject();
                    stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                    stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                    await setStrategyState(timelessfiContract, stratSetupDepositpending);

                    const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                    token.transfer(timelessfiContract.address, totalPendingDeposit);

                    // mine blocks
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await timelessfiContract.emergencyWithdraw(emergencyRecipient, []);

                    // ASSERT
                    const stratBalance = await timelessfiContract.getStrategyBalance();
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
