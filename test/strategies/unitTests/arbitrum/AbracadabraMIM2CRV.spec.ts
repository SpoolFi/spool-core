import { expect, use } from "chai";
import { BigNumber, constants } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import {
    AbracadabraFarmContractHelper__factory,
    AbracadabraMetapoolStrategy__factory,
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
    getRewardSwapPathV2Weth,
    mineBlocks,
    reset,
    SECS_DAY
} from "../../../shared/utilities";

import { getStrategySetupObject, getStrategyState, setStrategyState } from "./../shared/stratSetupUtilities";

const { Zero, AddressZero, MaxUint256 } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

const swapPathWeth = getRewardSwapPathV2Weth();

type AbracadabraStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
    swapData: {
        slippage: number;
        path: string;
    }[];
};

const swapData = [
    { slippage: 1, path: swapPathWeth }, // SPELL
];

const strategyAssets: AbracadabraStratSetup[] = [
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

const depositSlippages = [0, MaxUint256, depositSlippage];
const withdrawSlippages = [0, MaxUint256, 0];

describe("Strategies Unit Test: Arbitrum - Abracadabra.money MIM-2CRV", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    it("Should fail deploying Abracadabra Metapool Strategy with underlying address 0", async () => {
        const AbracadabraMetapoolStrategy = await new AbracadabraMetapoolStrategy__factory().connect(accounts.administrator);
        await expect(
            AbracadabraMetapoolStrategy.deploy(
                arbitrumConst.abracadabra.Farm.address,
                arbitrumConst.curve._2pool.pool.address,
                arbitrumConst.curve._mim.depositZap.address,
                arbitrumConst.curve._mim.lpToken.address,
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
                    const abracadabraStrat = await new AbracadabraMetapoolStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            arbitrumConst.abracadabra.Farm.address,
                            arbitrumConst.curve._2pool.pool.address,
                            arbitrumConst.curve._mim.depositZap.address,
                            arbitrumConst.curve._mim.lpToken.address,
                            token.address,
                            AddressZero,
                            AddressZero
                        );

                    await abracadabraStrat.initialize();
                });
            });

            describe(`Functions: ${name}`, () => {
                let abracadabraContract: IBaseStrategy;
                let millionUnits: BigNumber;

                before(async () => {
                    millionUnits = getMillionUnits(arbitrumConst.tokens[name].units);
                });

                beforeEach(async () => {
                    // deploy proxy for a strategy
                    const abracadabraStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        AddressZero
                    );

                    let abracadabraFarmHelper = await new AbracadabraFarmContractHelper__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            abracadabraStrategyProxy.address,
                            arbitrumConst.abracadabra.Farm.address,
                        );

                    const helperProxy = await new TransparentUpgradeableProxy__factory()
                        .connect(accounts.administrator)
                        .deploy(abracadabraFarmHelper.address, "0x0000000000000000000000000000000000000001", "0x");
                    abracadabraFarmHelper = AbracadabraFarmContractHelper__factory.connect(
                        helperProxy.address,
                        accounts.administrator
                    );

                    const abracadabraStrategyImpl = await new AbracadabraMetapoolStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            arbitrumConst.abracadabra.Farm.address,
                            arbitrumConst.curve._2pool.pool.address,
                            arbitrumConst.curve._mim.depositZap.address,
                            arbitrumConst.curve._mim.lpToken.address,
                            token.address,
                            abracadabraFarmHelper.address,
                            AddressZero
                        );

                    abracadabraStrategyProxy.setImplementation(abracadabraStrategyImpl.address);

                    abracadabraContract = AbracadabraMetapoolStrategy__factory.connect(
                        abracadabraStrategyProxy.address,
                        accounts.administrator
                    );

                    // console.log(tx)
                    await abracadabraContract.initialize();
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(abracadabraContract, stratSetup);
                    token.transfer(abracadabraContract.address, depositAmount);

                    // ACT
                    await abracadabraContract.process(depositSlippages, false, []);

                    // ASSERT
                    const balance = await abracadabraContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(abracadabraContract);

                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_10);
                    const totalShares = balance.mul(10**6).sub(10**5);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_01);
                });

                it("Process deposit twice, should redeposit rewards", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(abracadabraContract, stratSetup);
                    token.transfer(abracadabraContract.address, depositAmount);

                    await abracadabraContract.process(depositSlippages, false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(abracadabraContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(abracadabraContract, stratSetup2);
                    token.transfer(abracadabraContract.address, depositAmount);

                    // ACT
                    await abracadabraContract.process(depositSlippages, true, swapData);

                    // ASSERT
                    const balance = await abracadabraContract.getStrategyBalance();
                    expect(balance).to.be.greaterWithTolerance(depositAmount.mul(2), BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(abracadabraContract);
                    const totalShares = balance.mul(10**6).mul(2).sub(10**5);
                    expect(strategyDetails.totalShares).to.be.lt(totalShares);
                });

                it("Process withdraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(abracadabraContract, stratSetupDeposit);
                    token.transfer(abracadabraContract.address, depositAmount);
                    await abracadabraContract.process(depositSlippages, false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(abracadabraContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(abracadabraContract, stratSetupWithdraw);

                    // ACT
                    await abracadabraContract.process(withdrawSlippages, false, swapData);

                    // ASSERT
                    const balance = await abracadabraContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(abracadabraContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    const tokenBalance = await token.balanceOf(abracadabraContract.address);
                    expect(tokenBalance).to.be.greaterWithTolerance(depositAmount, BasisPoints.Basis_50);
                });

                it("Claim rewards, should claim and swap rewards for the underlying currency", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(abracadabraContract, stratSetupDeposit);
                    token.transfer(abracadabraContract.address, depositAmount);
                    await abracadabraContract.process(depositSlippages, false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await abracadabraContract.claimRewards(swapData);

                    // ASSERT
                    const strategyDetails = await getStrategyState(abracadabraContract);
                    expect(strategyDetails.pendingDepositReward).to.be.gte(Zero);
                });

                it("Fast withdraw, remove shares", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(abracadabraContract, stratSetupDeposit);
                    token.transfer(abracadabraContract.address, depositAmount);
                    await abracadabraContract.process(depositSlippages, false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(abracadabraContract);

                    // ACT
                    await abracadabraContract.fastWithdraw(stratSetupWithdraw.totalShares, withdrawSlippages, swapData);

                    // ASSERT

                    const balance = await abracadabraContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(abracadabraContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    // check if balance is greater than initial, as we claim the rewards as well
                    const tokenBalance = await token.balanceOf(abracadabraContract.address);
                    expect(tokenBalance).to.be.greaterWithTolerance(depositAmount, BasisPoints.Basis_50);
                });

                it("Emergency withdraw, should withdraw all funds and send it to the recipient", async () => {
                    // ARRANGE
                    const emergencyRecipient = accounts.user0.address;
                    const tokenBalanceBefore = await token.balanceOf(emergencyRecipient);

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(abracadabraContract, stratSetupDeposit);
                    token.transfer(abracadabraContract.address, depositAmount);
                    await abracadabraContract.process(depositSlippages, false, []);

                    // add pending deposit
                    const pendingDeposit = millionUnits.div(5);
                    const stratSetupDepositpending = getStrategySetupObject();
                    stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                    stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                    await setStrategyState(abracadabraContract, stratSetupDepositpending);

                    const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                    token.transfer(abracadabraContract.address, totalPendingDeposit);

                    // mine blocks
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await abracadabraContract.emergencyWithdraw(emergencyRecipient, []);

                    // ASSERT
                    const stratBalance = await abracadabraContract.getStrategyBalance();
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
