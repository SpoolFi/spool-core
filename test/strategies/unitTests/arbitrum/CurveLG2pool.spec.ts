import { expect, use } from "chai";
import { BigNumber, constants } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import {
    Curve2poolStrategy__factory,
    CurveGaugeContractHelper__factory,
    IBaseStrategy,
    IERC20,
    TestStrategySetup__factory,
    TransparentUpgradeableProxy__factory,
} from "../../../../build/types";
import { AccountsFixture, arbitrumConst, TokensFixture, underlyingTokensFixture } from "../../../shared/fixtures";
import { Tokens } from "../../../shared/constants";

import {
    BasisPoints,
    encodeDepositSlippage,
    getMillionUnits,
    getRewardSwapPathV3Weth,
    mineBlocks,
    reset,
    SECS_DAY,
    UNISWAP_V3_FEE,
} from "../../../shared/utilities";

import { getStrategySetupObject, getStrategyState, setStrategyState } from "./../shared/stratSetupUtilities";

const { Zero, AddressZero, MaxUint256 } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

const swapPathWeth = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._3000, UNISWAP_V3_FEE._500);

type ConvexStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
    swapPath: string;
};

const strategyAssets: ConvexStratSetup[] = [
    {
        name: "USDC",
        swapPath: swapPathWeth,
    },
    {
        name: "USDT",
        swapPath: swapPathWeth,
    },
];

const depositSlippage = encodeDepositSlippage(0);

const depositSlippages = [0, MaxUint256, depositSlippage];
const withdrawSlippages = [0, MaxUint256, 0];

describe("Strategies Unit Test: Arbitrum - Curve Liquidity Gauge 2pool", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    it("Should fail deploying Curve 2pool with pool address 0", async () => {
        const CurveStrategy = new Curve2poolStrategy__factory().connect(accounts.administrator);
        await expect(
            CurveStrategy.deploy(
                AddressZero, 
                "0x0000000000000000000000000000000000000001",
                "0x0000000000000000000000000000000000000001", 
                "0x0000000000000000000000000000000000000001", 
                "0x0000000000000000000000000000000000000001", 
                AddressZero,
)
        ).to.be.revertedWith("CurveStrategyBaseV3::constructor: Curve Pool address cannot be 0");
    });

    strategyAssets.forEach(({ name, swapPath }) => {
        describe(`Asset: ${name}`, () => {
            let token: IERC20;

            before(async () => {
                const { tokens } = await loadFixture(underlyingTokensFixture);
                token = tokens[name];
            });

            describe(`Deployment: ${name}`, () => {
                it("Should deploy", async () => {
                    const curveStrat = await new Curve2poolStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            arbitrumConst.curve._2pool.pool.address,
                            arbitrumConst.curve._2pool.lpToken.address,
                            arbitrumConst.curve.CRV.address,
                            token.address, 
                            AddressZero,
                            AddressZero,

                        );

                    await curveStrat.initialize();
                });
            });

            describe(`Functions: ${name}`, () => {
                let curveContract: IBaseStrategy;
                let millionUnits: BigNumber;

                before(async () => {
                    millionUnits = getMillionUnits(arbitrumConst.tokens[name].units);
                });

                beforeEach(async () => {
                    // deploy proxy for a strategy
                    const curveStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        AddressZero
                    );

                    let curveHelper = await new CurveGaugeContractHelper__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            curveStrategyProxy.address,
                            arbitrumConst.curve._2pool.LiquidityGauge.address,
                            arbitrumConst.curve.CRV.address,
                        );

                    const helperProxy = await new TransparentUpgradeableProxy__factory()
                        .connect(accounts.administrator)
                        .deploy(curveHelper.address, "0x0000000000000000000000000000000000000001", "0x");
                    curveHelper = CurveGaugeContractHelper__factory.connect(
                        helperProxy.address,
                        accounts.administrator
                    );

                    const curveStrategyImpl = await new Curve2poolStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            arbitrumConst.curve._2pool.pool.address,
                            arbitrumConst.curve._2pool.lpToken.address,
                            arbitrumConst.curve.CRV.address,
                            token.address, 
                            curveHelper.address,
                            AddressZero
                        );

                    curveStrategyProxy.setImplementation(curveStrategyImpl.address);

                    curveContract = Curve2poolStrategy__factory.connect(
                        curveStrategyProxy.address,
                        accounts.administrator
                    );

                    await curveContract.initialize();
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(curveContract, stratSetup);
                    await token.transfer(curveContract.address, depositAmount);

                    // ACT
                    await curveContract.process(depositSlippages, false, []);

                    // ASSERT
                    const balance = await curveContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(curveContract);

                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_10);
                    const totalShares = balance.mul(10**6).sub(10**5);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_01);
                });

                it("Process deposit twice, should redeposit rewards", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(curveContract, stratSetup);
                    await token.transfer(curveContract.address, depositAmount);

                    await curveContract.process(depositSlippages, false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(curveContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(curveContract, stratSetup2);
                    await token.transfer(curveContract.address, depositAmount);

                    // ACT
                    await curveContract.process(depositSlippages, true, [{ slippage: 1, path: swapPath }]);

                    // ASSERT
                    const balance = await curveContract.getStrategyBalance();
                    expect(balance).to.be.greaterWithTolerance(depositAmount.mul(2), BasisPoints.Basis_100);

                    const totalShares = balance.mul(10**6).mul(2).sub(10**5);
                    const strategyDetails = await getStrategyState(curveContract);
                    expect(strategyDetails.totalShares).to.be.lte(totalShares);
                });

                it("Process withraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(curveContract, stratSetupDeposit);
                    await token.transfer(curveContract.address, depositAmount);
                    await curveContract.process(depositSlippages, false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(curveContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(curveContract, stratSetupWithdraw);

                    // ACT
                    await curveContract.process(withdrawSlippages, false, [{ slippage: 1, path: swapPath }]);

                    // ASSERT
                    const balance = await curveContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(curveContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    const tokenBalance = await token.balanceOf(curveContract.address);
                    expect(tokenBalance).to.be.greaterWithTolerance(depositAmount, BasisPoints.Basis_10);
                });

                it("Claim rewards, should claim and swap rewards for the underlying currency", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(curveContract, stratSetupDeposit);
                    await token.transfer(curveContract.address, depositAmount);
                    await curveContract.process(depositSlippages, false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await curveContract.claimRewards([{ slippage: 1, path: swapPath }]);

                    // ASSERT
                    const strategyDetails = await getStrategyState(curveContract);
                    expect(strategyDetails.pendingDepositReward).to.be.gte(Zero);
                });

                it("Fast withdraw, remove shares", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(curveContract, stratSetupDeposit);
                    await token.transfer(curveContract.address, depositAmount);
                    await curveContract.process(depositSlippages, false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(curveContract);

                    // ACT
                    await curveContract.fastWithdraw(stratSetupWithdraw.totalShares, withdrawSlippages, [
                        { slippage: 1, path: swapPath },
                    ]);

                    // ASSERT
                    const balance = await curveContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(curveContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    // check if balance is greater than initial, as we claim the rewards as well
                    const tokenBalance = await token.balanceOf(curveContract.address);
                    expect(tokenBalance).to.be.greaterWithTolerance(depositAmount, BasisPoints.Basis_10);
                });

                it("Emergency withdraw, should withdraw all funds and send it to the recipient", async () => {
                    // ARRANGE
                    const emergencyRecipient = accounts.user0.address;
                    const tokenBalanceBefore = await token.balanceOf(emergencyRecipient);

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(curveContract, stratSetupDeposit);
                    await token.transfer(curveContract.address, depositAmount);
                    await curveContract.process(depositSlippages, false, []);

                    // add pending deposit
                    const pendingDeposit = millionUnits.div(5);
                    const stratSetupDepositpending = getStrategySetupObject();
                    stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                    stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                    await setStrategyState(curveContract, stratSetupDepositpending);

                    const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                    await token.transfer(curveContract.address, totalPendingDeposit);

                    // mine blocks
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await curveContract.emergencyWithdraw(emergencyRecipient, []);

                    // ASSERT
                    const stratBalance = await curveContract.getStrategyBalance();
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
