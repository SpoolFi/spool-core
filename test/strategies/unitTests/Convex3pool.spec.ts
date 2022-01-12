import { expect, use } from "chai";
import { constants, BigNumber } from "ethers";
import { solidity, MockProvider, createFixtureLoader, MockContract, deployMockContract } from "ethereum-waffle";
import { IBaseStrategy } from "../../../build/types/IBaseStrategy";
import { IERC20 } from "../../../build/types/IERC20";
import { TestStrategySetup__factory } from "../../../build/types/factories/TestStrategySetup__factory";
import { ConvexSharedStrategy__factory } from "../../../build/types/factories/ConvexSharedStrategy__factory";
import { ConvexBoosterContractHelper__factory } from "../../../build/types/factories/ConvexBoosterContractHelper__factory";
import { underlyingTokensFixture, mainnetConst, TokensFixture, AccountsFixture } from "../../shared/fixtures";
import { Tokens } from "../../shared/constants";

import {
    reset,
    mineBlocks,
    SECS_DAY,
    BasisPoints,
    getMillionUnits,
    getRewardSwapPathV3Direct,
    getRewardSwapPathV3Weth,
    UNISWAP_V3_FEE,
    encodeDepositSlippage,
} from "../../shared/utilities";

import { getStrategySetupObject, getStrategyState, setStrategyState } from "./shared/stratSetupUtilities";

const { Zero, AddressZero } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

// reward order: COMP, stkAAVE, IDLE

const swapPathWeth = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._3000, UNISWAP_V3_FEE._500);
const swapPathWeth10000 = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._10000, UNISWAP_V3_FEE._500);
const swapPathDirect3000 = getRewardSwapPathV3Direct(UNISWAP_V3_FEE._3000);

type ConvexStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
    swapData: {
        slippage: number;
        path: string;
    }[];
};

const swapData = [
    { slippage: 1, path: swapPathWeth },
    { slippage: 1, path: swapPathWeth10000 },
];

const swapDataUSDT = [
    { slippage: 1, path: swapPathDirect3000 },
    { slippage: 1, path: swapPathWeth10000 },
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
        swapData: swapDataUSDT,
    },
];

const depositSlippage = encodeDepositSlippage(0);

describe("Strategies Unit Test: Convex 3pool", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    it("Should fail deploying Convex 3 Pool Strategy with underlying address 0", async () => {
        const ConvexSharedStrategy = await new ConvexSharedStrategy__factory().connect(accounts.administrator);
        await expect(
            ConvexSharedStrategy.deploy(
                mainnetConst.convex.Booster.address,
                mainnetConst.convex._3pool.boosterPoolId,
                mainnetConst.curve._3pool.pool.address,
                mainnetConst.curve._3pool.lpToken.address,
                AddressZero,
                AddressZero
            )
        ).to.be.revertedWith("BaseStrategy::constructor: Underlying address cannot be 0");
    });

    strategyAssets.forEach(({ name, swapData }) => {
        describe(`Asset: ${name}`, () => {
            let token: IERC20;

            before(async () => {
                const {tokens} = await loadFixture(underlyingTokensFixture);
                token = tokens[name];
            });

            describe(`Deployment: ${name}`, () => {
                it("Should deploy", async () => {
                    const convexStrat = await new ConvexSharedStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.convex.Booster.address,
                            mainnetConst.convex._3pool.boosterPoolId,
                            mainnetConst.curve._3pool.pool.address,
                            mainnetConst.curve._3pool.lpToken.address,
                            token.address,
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

                    const convexBoosterHelper = await new ConvexBoosterContractHelper__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            convexStrategyProxy.address,
                            mainnetConst.convex.Booster.address,
                            mainnetConst.convex._3pool.boosterPoolId
                        );

                    const convexStrategyImpl = await new ConvexSharedStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.convex.Booster.address,
                            mainnetConst.convex._3pool.boosterPoolId,
                            mainnetConst.curve._3pool.pool.address,
                            mainnetConst.curve._3pool.lpToken.address,
                            token.address,
                            convexBoosterHelper.address
                        );

                    convexStrategyProxy.setImplementation(convexStrategyImpl.address);

                    convexContract = ConvexSharedStrategy__factory.connect(
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
                    await convexContract.process([depositSlippage], false, []);

                    // ASSERT
                    const balance = await convexContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(convexContract);

                    expect(strategyDetails.totalShares).to.beCloseTo(depositAmount, BasisPoints.Basis_100);
                    expect(strategyDetails.totalShares).to.beCloseTo(balance, BasisPoints.Basis_100);
                });

                it("Process deposit twice, should redeposit rewards", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(convexContract, stratSetup);
                    token.transfer(convexContract.address, depositAmount);

                    await convexContract.process([depositSlippage], false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(convexContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(convexContract, stratSetup2);
                    token.transfer(convexContract.address, depositAmount);

                    // ACT
                    await convexContract.process([depositSlippage], true, swapData);

                    // ASSERT
                    const balance = await convexContract.getStrategyBalance();
                    expect(balance).to.be.greaterWithTolerance(depositAmount.mul(2), BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(convexContract);
                    expect(strategyDetails.totalShares).to.be.greaterWithTolerance(
                        depositAmount.mul(2),
                        BasisPoints.Basis_100
                    );
                });

                it("Process withraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(convexContract, stratSetupDeposit);
                    token.transfer(convexContract.address, depositAmount);
                    await convexContract.process([depositSlippage], false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(convexContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(convexContract, stratSetupWithdraw);

                    // ACT
                    await convexContract.process([0], false, swapData);

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
                    await convexContract.process([depositSlippage], false, []);

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
                    await convexContract.process([depositSlippage], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(convexContract);

                    // ACT
                    await convexContract.fastWithdraw(stratSetupWithdraw.totalShares, [0], swapData);

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
                    await convexContract.process([depositSlippage], false, []);

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
