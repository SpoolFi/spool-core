import { expect, use } from "chai";
import { BigNumber, constants } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import {
    IBaseStrategy,
    IERC20,
    TestStrategySetup__factory,
    YearnMetapoolStrategy__factory,
} from "../../../../build/types";
import { AccountsFixture, arbitrumConst, TokensFixture, underlyingTokensFixture } from "../../../shared/fixtures";
import { Tokens } from "../../../shared/constants";

import {
    BasisPoints,
    encodeDepositSlippage,
    getMillionUnits,
    mineBlocks,
    reset,
    SECS_DAY
} from "../../../shared/utilities";

import { getStrategySetupObject, getStrategyState, setStrategyState } from "./../shared/stratSetupUtilities";

const { Zero, AddressZero, MaxUint256 } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

type YearnStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
};

const strategyAssets: YearnStratSetup[] = [
    { name: "USDC" }, 
    { name: "USDT" }
];

const depositSlippage = encodeDepositSlippage(0);

const depositSlippages  = [0, MaxUint256, depositSlippage, depositSlippage ];
const withdrawSlippages = [0, MaxUint256,               0,               0 ];

describe("Strategies Unit Test: Arbitrum - Yearn MIM2CRV", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    it("Should fail deploying Yearn Metapool Strategy with underlying address 0", async () => {
        const YearnMetapoolStrategy = new YearnMetapoolStrategy__factory().connect(accounts.administrator);
        await expect(
            YearnMetapoolStrategy.deploy(
                arbitrumConst.yearn.CurveMIMVault.address,
                arbitrumConst.curve._2pool.pool.address,
                arbitrumConst.curve._mim.depositZap.address,
                arbitrumConst.curve._mim.lpToken.address,
                AddressZero,
                AddressZero,
            )
        ).to.be.revertedWith("BaseStrategy::constructor: Underlying address cannot be 0");
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
                    const yearnStrat = await new YearnMetapoolStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            arbitrumConst.yearn.CurveMIMVault.address,
                            arbitrumConst.curve._2pool.pool.address,
                            arbitrumConst.curve._mim.depositZap.address,
                            arbitrumConst.curve._mim.lpToken.address,
                            token.address,
                            AddressZero,
                        );

                    await yearnStrat.initialize();
                });
            });

            describe(`Functions: ${name}`, () => {
                let yearnContract: IBaseStrategy;
                let millionUnits: BigNumber;

                before(async () => {
                    millionUnits = getMillionUnits(arbitrumConst.tokens[name].units);
                });

                beforeEach(async () => {
                    const yearnStrategyImpl = await new YearnMetapoolStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            arbitrumConst.yearn.CurveMIMVault.address,
                            arbitrumConst.curve._2pool.pool.address,
                            arbitrumConst.curve._mim.depositZap.address,
                            arbitrumConst.curve._mim.lpToken.address,
                            token.address, 
                            AddressZero
                        );

                    // deploy proxy for a strategy
                    const yearnStrategyProxy = await new TestStrategySetup__factory(accounts.administrator)
                    .deploy(
                        yearnStrategyImpl.address
                    );

                    yearnContract = YearnMetapoolStrategy__factory.connect(
                        yearnStrategyProxy.address,
                        accounts.administrator
                    );

                    await yearnContract.initialize();
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(yearnContract, stratSetup);
                    token.transfer(yearnContract.address, depositAmount);

                    // ACT
                    await yearnContract.process(depositSlippages, false, []);

                    // ASSERT
                    const balance = await yearnContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(yearnContract);

                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_10);
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

                    await yearnContract.process(depositSlippages, false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(yearnContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(yearnContract, stratSetup2);
                    token.transfer(yearnContract.address, depositAmount);

                    // ACT
                    await yearnContract.process(depositSlippages, false, []);

                    // ASSERT
                    const balance = await yearnContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount.mul(2), BasisPoints.Basis_10);

                    const totalShares = balance.mul(10**6).sub(10**5);
                    const strategyDetails = await getStrategyState(yearnContract);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_5);

                    const shares1 = stratSetup2.totalShares;
                    const shares2 = strategyDetails.totalShares.sub(shares1);

                    expect(shares1).to.beCloseTo(shares2, BasisPoints.Basis_5);
                });

                it("Process withdraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(yearnContract, stratSetupDeposit);
                    token.transfer(yearnContract.address, depositAmount);
                    await yearnContract.process(depositSlippages, false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(yearnContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(yearnContract, stratSetupWithdraw);

                    // ACT
                    await yearnContract.process(withdrawSlippages, false, []);

                    // ASSERT
                    const balance = await yearnContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(yearnContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    const tokenBalance = await token.balanceOf(yearnContract.address);
                    expect(tokenBalance).to.be.greaterWithTolerance(depositAmount, BasisPoints.Basis_1000);
                });

                it("Fast withdraw, remove shares", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(yearnContract, stratSetupDeposit);
                    token.transfer(yearnContract.address, depositAmount);
                    await yearnContract.process(depositSlippages, false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(yearnContract);

                    // ACT
                    await yearnContract.fastWithdraw(stratSetupWithdraw.totalShares, withdrawSlippages, []);

                    // ASSERT

                    const balance = await yearnContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(yearnContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    // check if balance is greater than initial, as we claim the rewards as well
                    const tokenBalance = await token.balanceOf(yearnContract.address);
                    expect(tokenBalance).to.be.greaterWithTolerance(depositAmount, BasisPoints.Basis_1000);
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
                    await yearnContract.process(depositSlippages, false, []);

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
