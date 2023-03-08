import { expect, use } from "chai";
import { BigNumber, constants } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import { IBaseStrategy, IERC20, TestStrategySetup__factory, BalancerStrategy__factory } from "../../../../build/types";
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

type BalancerStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
    nCoin: number;
};

const strategyAssets: BalancerStratSetup[] = [
    {
        name: "DAI",
        nCoin: arbitrumConst.balancer.staBAL.DAI
    },
    {
        name: "USDC",
        nCoin: arbitrumConst.balancer.staBAL.USDC
    },
    {
        name: "USDT",
        nCoin: arbitrumConst.balancer.staBAL.USDT
    },
];

const depositSlippage = encodeDepositSlippage(0);

describe("Strategies Unit Test: Arbitrum - Balancer", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    it("Should fail deploying Balancer with vault address 0", async () => {
        const BalancerStrategy = new BalancerStrategy__factory().connect(accounts.administrator);
        await expect(
            BalancerStrategy.deploy(AddressZero, "0x0000000000000000000000000000000000000001", AddressZero, AddressZero)
        ).to.be.revertedWith("BalancerStrategy::constructor: Pool address cannot be 0");
    });

    describe(`Gatekeeping`, () => {
        it("Claim rewards, should throw as Balancer Vault has no rewards", async () => {
            const { tokens } = await loadFixture(underlyingTokensFixture);
            const balancerContract = await new BalancerStrategy__factory()
                .connect(accounts.administrator)
                .deploy(arbitrumConst.balancer.staBAL.Pool.address, 
                        tokens.DAI.address, 
                        arbitrumConst.balancer.staBAL.DAI,
                        AddressZero
                );

            // ACT
            await expect(balancerContract.claimRewards([])).to.be.revertedWith(
                "NoRewardStrategy::_processRewards: Strategy does not have rewards"
            );
        });
    });

    strategyAssets.forEach(({ name, nCoin }) => {
        describe(`Asset: ${name}`, () => {
            let token: IERC20;
            before(async () => {
                const { tokens } = await loadFixture(underlyingTokensFixture);
                token = tokens[name];
            });

            describe(`Deployment: ${name}`, () => {
                it("Should deploy", async () => {
                    await new BalancerStrategy__factory().connect(accounts.administrator)
                    .deploy(arbitrumConst.balancer.staBAL.Pool.address, 
                            token.address, 
                            nCoin,
                            AddressZero
                     );
                });
            });

            describe(`Functions: ${name}`, () => {
                let balancerContract: IBaseStrategy;
                let implAddress: string;
                let millionUnits: BigNumber;

                before(async () => {
                    const balancerStrategyImpl = await new BalancerStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(arbitrumConst.balancer.staBAL.Pool.address, 
                            token.address, 
                            nCoin,
                            AddressZero
                        );

                    implAddress = balancerStrategyImpl.address;

                    millionUnits = getMillionUnits(arbitrumConst.tokens[name].units);
                });

                beforeEach(async () => {
                    // deploy proxy for a strategy
                    const compoundStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        implAddress
                    );

                    balancerContract = BalancerStrategy__factory.connect(
                        compoundStrategyProxy.address,
                        accounts.administrator
                    );
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(balancerContract, stratSetup);
                    token.transfer(balancerContract.address, depositAmount);

                    // ACT
                    await balancerContract.process([depositSlippage], false, []);

                    // ASSERT
                    const balance = await balancerContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(balancerContract);

                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);
                    const totalShares = balance.mul(10**6).sub(10**5);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_01);
                });

                it("Process deposit twice, should deposit the second time and get the same number of shares", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(balancerContract, stratSetup);
                    token.transfer(balancerContract.address, depositAmount);

                    await balancerContract.process([depositSlippage], false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(balancerContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(balancerContract, stratSetup2);
                    token.transfer(balancerContract.address, depositAmount);

                    // ACT
                    await balancerContract.process([depositSlippage], false, []);

                    // ASSERT
                    const balance = await balancerContract.getStrategyBalance();
                    expect(balance).to.be.greaterWithTolerance(depositAmount.mul(2), BasisPoints.Basis_100);

                    const totalShares = balance.mul(10**6).mul(2).sub(10**5);
                    const strategyDetails = await getStrategyState(balancerContract);
                    expect(strategyDetails.totalShares).to.be.lte(totalShares);
                });

                it("Process withdraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(balancerContract, stratSetupDeposit);
                    token.transfer(balancerContract.address, depositAmount);
                    await balancerContract.process([depositSlippage], false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(balancerContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(balancerContract, stratSetupWithdraw);

                    // ACT
                    await balancerContract.process([0], false, []);

                    // ASSERT
                    const balance = await balancerContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(balancerContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);
                });

                it("Fast withdraw, remove shares", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(balancerContract, stratSetupDeposit);
                    token.transfer(balancerContract.address, depositAmount);
                    await balancerContract.process([depositSlippage], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(balancerContract);

                    // ACT
                    await balancerContract.fastWithdraw(stratSetupWithdraw.totalShares, [0], []);

                    // ASSERT

                    const balance = await balancerContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(balancerContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    const tokenBalance = await token.balanceOf(balancerContract.address);
                    expect(tokenBalance).to.be.greaterWithTolerance(depositAmount, BasisPoints.Basis_5);
                });

                it("Emergency withdraw, should withdraw all funds and send it to the recipient", async () => {
                    // ARRANGE
                    const emergencyRecipient = accounts.user0.address;
                    const tokenBalanceBefore = await token.balanceOf(emergencyRecipient);

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(balancerContract, stratSetupDeposit);
                    token.transfer(balancerContract.address, depositAmount);
                    await balancerContract.process([depositSlippage], false, []);

                    // add pending deposit
                    const pendingDeposit = millionUnits.div(5);
                    const stratSetupDepositpending = getStrategySetupObject();
                    stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                    stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                    await setStrategyState(balancerContract, stratSetupDepositpending);

                    const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                    token.transfer(balancerContract.address, totalPendingDeposit);

                    // mine blocks
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await balancerContract.emergencyWithdraw(emergencyRecipient, []);

                    // ASSERT
                    const stratBalance = await balancerContract.getStrategyBalance();
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
