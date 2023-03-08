import { expect, use } from "chai";
import { BigNumber, constants } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import {
    ConvexBoosterContractHelper__factory,
    ConvexSharedMetapoolStrategy__factory,
    IBaseStrategy,
    IERC20,
    TestStrategySetup__factory,
    TransparentUpgradeableProxy__factory,
} from "../../../build/types";
import { AccountsFixture, mainnetConst, TokensFixture, underlyingTokensFixture } from "../../shared/fixtures";
import { Tokens } from "../../shared/constants";

import {
    BasisPoints,
    encodeDepositSlippage,
    getMillionUnits,
    getRewardSwapPathV3Direct,
    getRewardSwapPathV3Weth,
    mineBlocks,
    reset,
    SECS_DAY,
    UNISWAP_V3_FEE,
} from "../../shared/utilities";

import { getStrategySetupObject, getStrategyState, setStrategyState } from "./shared/stratSetupUtilities";

const { Zero, AddressZero, MaxUint256 } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

const swapPathWeth = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._3000, UNISWAP_V3_FEE._500);
const swapPathWeth10000 = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._10000, UNISWAP_V3_FEE._500);

type ConvexStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
    swapData: {
        slippage: number;
        path: string;
    }[];
};

const swapData = [
    { slippage: 1, path: swapPathWeth },      // CRV
    { slippage: 1, path: swapPathWeth10000 }, // CVX
    { slippage: 1, path: swapPathWeth10000 }  // ALCX
];

const strategyAssets: ConvexStratSetup[] = [
    {
        name: "DAI",
        swapData: swapData,
    },
    {
        name: "USDC",
        swapData: swapData,
    },
    {
        name: "USDT",
        swapData: swapData,
    },
];

const depositSlippage = encodeDepositSlippage(0);

const depositSlippages = [0, MaxUint256, 0, MaxUint256, depositSlippage];
const withdrawSlippages = [0, MaxUint256, 0, MaxUint256, 0];

describe("Strategies Unit Test: Convex AlUSD", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    it("Should fail deploying Convex Metapool Strategy with underlying address 0", async () => {
        const ConvexSharedMetapoolStrategy = await new ConvexSharedMetapoolStrategy__factory().connect(accounts.administrator);
        await expect(
            ConvexSharedMetapoolStrategy.deploy(
                mainnetConst.convex.Booster.address,
                mainnetConst.convex._alUSD.boosterPoolId,
                mainnetConst.curve._3pool.pool.address,
                mainnetConst.curve._alUSD.depositZap.address,
                mainnetConst.curve._alUSD.lpToken.address,
                AddressZero,
                AddressZero,
                AddressZero
            )
        ).to.be.revertedWith("BaseStrategy::constructor: Underlying address cannot be 0");
    });

    strategyAssets.forEach(({ name, swapData }) => {
        describe(`Asset: ${name}`, () => {
            let token: IERC20;

            before(async () => {
                const { tokens } = await loadFixture(underlyingTokensFixture);
                token = tokens[name];
            });

            describe(`Deployment: ${name}`, () => {
                it("Should deploy", async () => {
                    const convexStrat = await new ConvexSharedMetapoolStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.convex.Booster.address,
                            mainnetConst.convex._alUSD.boosterPoolId,
                            mainnetConst.curve._3pool.pool.address,
                            mainnetConst.curve._alUSD.depositZap.address,
                            mainnetConst.curve._alUSD.lpToken.address,
                            token.address,
                            AddressZero,
                            AddressZero
                        );

                    await convexStrat.initialize();
                });
            });

            describe(`Functions: ${name}`, () => {
                let convexContract: IBaseStrategy;
                let millionUnits: BigNumber;

                before(async () => {
                    millionUnits = getMillionUnits(mainnetConst.tokens[name].units);
                });

                beforeEach(async () => {
                    // deploy proxy for a strategy
                    const convexStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        AddressZero
                    );

                    let convexBoosterHelper = await new ConvexBoosterContractHelper__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            convexStrategyProxy.address,
                            mainnetConst.convex.Booster.address,
                            mainnetConst.convex._alUSD.boosterPoolId
                        );

                    const helperProxy = await new TransparentUpgradeableProxy__factory()
                        .connect(accounts.administrator)
                        .deploy(convexBoosterHelper.address, "0x0000000000000000000000000000000000000001", "0x");
                    convexBoosterHelper = ConvexBoosterContractHelper__factory.connect(
                        helperProxy.address,
                        accounts.administrator
                    );

                    const convexStrategyImpl = await new ConvexSharedMetapoolStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.convex.Booster.address,
                            mainnetConst.convex._alUSD.boosterPoolId,
                            mainnetConst.curve._3pool.pool.address,
                            mainnetConst.curve._alUSD.depositZap.address,
                            mainnetConst.curve._alUSD.lpToken.address,
                            token.address,
                            convexBoosterHelper.address,
                            AddressZero
                        );

                    convexStrategyProxy.setImplementation(convexStrategyImpl.address);

                    convexContract = ConvexSharedMetapoolStrategy__factory.connect(
                        convexStrategyProxy.address,
                        accounts.administrator
                    );

                    // console.log(tx)
                    await convexContract.initialize();
                    await convexContract.initialize();
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(convexContract, stratSetup);
                    token.transfer(convexContract.address, depositAmount);

                    // ACT
                    await convexContract.process(depositSlippages, false, []);

                    // ASSERT
                    const balance = await convexContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(convexContract);

                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_10);
                    const totalShares = balance.mul(10**6).sub(10**5);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_01);
                });

                it("Process deposit twice, should redeposit rewards", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(convexContract, stratSetup);
                    token.transfer(convexContract.address, depositAmount);

                    await convexContract.process(depositSlippages, false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(convexContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(convexContract, stratSetup2);
                    token.transfer(convexContract.address, depositAmount);

                    // ACT
                    await convexContract.process(depositSlippages, true, swapData);

                    // ASSERT
                    const balance = await convexContract.getStrategyBalance();
                    expect(balance).to.be.greaterWithTolerance(depositAmount.mul(2), BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(convexContract);
                    const totalShares = balance.mul(10**6).mul(2).sub(10**5);
                    expect(strategyDetails.totalShares).to.be.lt(totalShares);
                });

                it("Process withdraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(convexContract, stratSetupDeposit);
                    token.transfer(convexContract.address, depositAmount);
                    await convexContract.process(depositSlippages, false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(convexContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(convexContract, stratSetupWithdraw);

                    // ACT
                    await convexContract.process(withdrawSlippages, false, swapData);

                    // ASSERT
                    const balance = await convexContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(convexContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    const tokenBalance = await token.balanceOf(convexContract.address);
                    expect(tokenBalance).to.be.greaterWithTolerance(depositAmount, BasisPoints.Basis_10);
                });

                it("Claim rewards, should claim and swap rewards for the underlying currency", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(convexContract, stratSetupDeposit);
                    token.transfer(convexContract.address, depositAmount);
                    await convexContract.process(depositSlippages, false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await convexContract.claimRewards(swapData);

                    // ASSERT
                    const strategyDetails = await getStrategyState(convexContract);
                    expect(strategyDetails.pendingDepositReward).to.be.gte(Zero);
                });

                it("Fast withdraw, remove shares", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(convexContract, stratSetupDeposit);
                    token.transfer(convexContract.address, depositAmount);
                    await convexContract.process(depositSlippages, false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(convexContract);

                    // ACT
                    await convexContract.fastWithdraw(stratSetupWithdraw.totalShares, withdrawSlippages, swapData);

                    // ASSERT

                    const balance = await convexContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(convexContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    // check if balance is greater than initial, as we claim the rewards as well
                    const tokenBalance = await token.balanceOf(convexContract.address);
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
                    await setStrategyState(convexContract, stratSetupDeposit);
                    token.transfer(convexContract.address, depositAmount);
                    await convexContract.process(depositSlippages, false, []);

                    // add pending deposit
                    const pendingDeposit = millionUnits.div(5);
                    const stratSetupDepositpending = getStrategySetupObject();
                    stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                    stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                    await setStrategyState(convexContract, stratSetupDepositpending);

                    const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                    token.transfer(convexContract.address, totalPendingDeposit);

                    // mine blocks
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await convexContract.emergencyWithdraw(emergencyRecipient, []);

                    // ASSERT
                    const stratBalance = await convexContract.getStrategyBalance();
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
