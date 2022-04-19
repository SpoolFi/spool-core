import { expect, use } from "chai";
import { BigNumber, constants } from "ethers";
import { createFixtureLoader, deployMockContract, MockContract, MockProvider, solidity } from "ethereum-waffle";
import {
    IBaseStrategy,
    IdleStrategy__factory,
    IERC20,
    IIdleToken__factory,
    TestStrategySetup__factory,
} from "../../../build/types";
import { AccountsFixture, mainnetConst, TokensFixture, underlyingTokensFixture } from "../../shared/fixtures";
import { Tokens } from "../../shared/constants";

import {
    BasisPoints,
    encodeDepositSlippage,
    getMillionUnits,
    getRewardSwapPathV3Custom,
    getRewardSwapPathV3Weth,
    mineBlocks,
    reset,
    SECS_DAY,
    UNISWAP_V3_FEE,
} from "../../shared/utilities";

import { getStrategySetupObject, getStrategyState, setStrategyState } from "./shared/stratSetupUtilities";

const { Zero, AddressZero } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

// reward order: COMP, stkAAVE, IDLE

const swapPath_COMP = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._3000, UNISWAP_V3_FEE._500);

const swapPath_stkAAVE = getRewardSwapPathV3Custom(UNISWAP_V3_FEE._3000, [
    // AAVE
    { address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", fee: UNISWAP_V3_FEE._3000 },
    // WETH
    { address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", fee: UNISWAP_V3_FEE._500 },
]);

const swapPath_IDLE = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._3000, UNISWAP_V3_FEE._500);

const swapSlippages = [
    { slippage: 1, path: swapPath_COMP },
    { slippage: 1, path: swapPath_stkAAVE },
    { slippage: 1, path: swapPath_IDLE },
];

type IdleStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
    idleTokenYield: string;
};

const strategyAssets: IdleStratSetup[] = [
    {
        name: "DAI",
        idleTokenYield: mainnetConst.idle.idleDAI.address,
    },
    {
        name: "USDC",
        idleTokenYield: mainnetConst.idle.idleUSDC.address,
    },
    {
        name: "USDT",
        idleTokenYield: mainnetConst.idle.idleUSDT.address,
    },
];

const depositSlippage = encodeDepositSlippage(0);

describe("Strategies Unit Test: Idle", () => {
    let accounts: AccountsFixture;
    let idleMock: MockContract;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
        idleMock = await deployMockContract(accounts.administrator, IIdleToken__factory.abi);
    });

    it("Should fail deploying Idle Strategy with underlying address 0", async () => {
        const IdleStrategy = await new IdleStrategy__factory().connect(accounts.administrator);
        await expect(IdleStrategy.deploy(idleMock.address, AddressZero)).to.be.revertedWith(
            "BaseStrategy::constructor: Underlying address cannot be 0"
        );
    });

    strategyAssets.forEach(({ name, idleTokenYield }) => {
        describe(`Asset: ${name}`, () => {
            let token: IERC20;

            before(async () => {
                const { tokens } = await loadFixture(underlyingTokensFixture);
                token = tokens[name];
            });

            describe(`Deployment: ${name}`, () => {
                it("Should deploy", async () => {
                    await new IdleStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(idleTokenYield, token.address);
                });
            });

            describe(`Functions: ${name}`, () => {
                let idleContract: IBaseStrategy;
                let implAddress: string;
                let millionUnits: BigNumber;

                before(async () => {
                    const harvestStrategyImpl = await new IdleStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(idleTokenYield, token.address);

                    implAddress = harvestStrategyImpl.address;

                    millionUnits = getMillionUnits(mainnetConst.tokens[name].units);
                });

                beforeEach(async () => {
                    // deploy proxy for a strategy
                    const compoundStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        implAddress
                    );

                    idleContract = IdleStrategy__factory.connect(compoundStrategyProxy.address, accounts.administrator);
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(idleContract, stratSetup);
                    token.transfer(idleContract.address, depositAmount);

                    // ACT
                    await idleContract.process([depositSlippage], false, []);

                    // ASSERT
                    const balance = await idleContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(idleContract);

                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_1);
                    const totalShares = balance.mul(10**6).sub(10**5);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_01);
                });

                it("Process deposit twice, should redeposit rewards", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(idleContract, stratSetup);
                    token.transfer(idleContract.address, depositAmount);

                    await idleContract.process([depositSlippage], false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(idleContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(idleContract, stratSetup2);
                    token.transfer(idleContract.address, depositAmount);

                    // ACT
                    await idleContract.process([depositSlippage], true, swapSlippages);

                    // ASSERT
                    const balance = await idleContract.getStrategyBalance();
                    expect(balance).to.be.greaterWithTolerance(depositAmount.mul(2), BasisPoints.Basis_1);

                    const totalShares = balance.mul(10**6).mul(2).sub(10**5);
                    const strategyDetails = await getStrategyState(idleContract);
                    expect(strategyDetails.totalShares).to.be.lte(totalShares);
                });

                it("Process withraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(idleContract, stratSetupDeposit);
                    token.transfer(idleContract.address, depositAmount);
                    await idleContract.process([depositSlippage], false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(idleContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(idleContract, stratSetupWithdraw);

                    // ACT
                    await idleContract.process([0], false, swapSlippages);

                    // ASSERT
                    const balance = await idleContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(idleContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);
                });

                it("Claim rewards, should claim and swap rewards for the underlying currency", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(idleContract, stratSetupDeposit);
                    token.transfer(idleContract.address, depositAmount);
                    await idleContract.process([depositSlippage], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await idleContract.claimRewards(swapSlippages);

                    // ASSERT
                    const strategyDetails = await getStrategyState(idleContract);
                    expect(strategyDetails.pendingDepositReward).to.be.gt(Zero);
                });

                it("Fast withdraw, remove shares", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(idleContract, stratSetupDeposit);
                    token.transfer(idleContract.address, depositAmount);
                    await idleContract.process([depositSlippage], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(idleContract);

                    // ACT
                    await idleContract.fastWithdraw(stratSetupWithdraw.totalShares, [0], swapSlippages);

                    // ASSERT

                    const balance = await idleContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(idleContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    // check if balance is greater than initial, as we claim the rewards as well
                    const daiBalance = await token.balanceOf(idleContract.address);
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
                    await setStrategyState(idleContract, stratSetupDeposit);
                    token.transfer(idleContract.address, depositAmount);
                    await idleContract.process([depositSlippage], false, []);

                    // add pending deposit
                    const pendingDeposit = millionUnits.div(5);
                    const stratSetupDepositpending = getStrategySetupObject();
                    stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                    stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                    await setStrategyState(idleContract, stratSetupDepositpending);

                    const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                    token.transfer(idleContract.address, totalPendingDeposit);

                    // mine blocks
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await idleContract.emergencyWithdraw(emergencyRecipient, []);

                    // ASSERT
                    const stratBalance = await idleContract.getStrategyBalance();
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
