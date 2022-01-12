import { expect, use } from "chai";
import { BigNumber, constants } from "ethers";
import { solidity, MockProvider, createFixtureLoader } from "ethereum-waffle";
import { IBaseStrategy } from "../../../build/types/IBaseStrategy";
import { IERC20 } from "../../../build/types/IERC20";
import { TestStrategySetup__factory } from "../../../build/types/factories/TestStrategySetup__factory";
import { BarnBridgeMultiRewardStrategy__factory } from "../../../build/types/factories/BarnBridgeMultiRewardStrategy__factory";
import { BarnBridgeMultiContracts } from "../../shared/constants";
import { underlyingTokensFixture, mainnetConst, TokensFixture, AccountsFixture } from "../../shared/fixtures";
import { Tokens } from "../../shared/constants";

import {
    reset,
    mineBlocks,
    SECS_DAY,
    getRewardSwapPathV2Direct,
    getRewardSwapPathV2Custom,
    getRewardSwapPathV3Custom,
    encodeDepositSlippage,
    getMillionUnits,
    UNISWAP_V3_FEE,
    BasisPoints,
} from "../../shared/utilities";

import { getStrategySetupObject, getStrategyState, setStrategyState } from "./shared/stratSetupUtilities";

const { Zero, AddressZero } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

const bondUsdcDirectPath = getRewardSwapPathV2Direct();
const bondUsdcPath = getRewardSwapPathV2Custom(["0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"]);

const aaveSwapPath = getRewardSwapPathV3Custom(UNISWAP_V3_FEE._3000, [
    { address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", fee: UNISWAP_V3_FEE._3000 },
    { address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", fee: UNISWAP_V3_FEE._500 },
]);

const swapData = [
    { slippage: 1, path: bondUsdcPath },
    { slippage: 1, path: aaveSwapPath },
];

const swapDataUSDC = [
    { slippage: 1, path: bondUsdcDirectPath },
    { slippage: 1, path: bondUsdcPath },
];

type BBStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
    contracts: BarnBridgeMultiContracts;
    swapData: {
        slippage: number;
        path: string;
    }[];
};

const strategyAssets: BBStratSetup[] = [
    {
        name: "DAI",
        contracts: mainnetConst.barnBridge.aDAI,
        swapData: swapData
    },
    {
        name: "USDC",
        contracts: mainnetConst.barnBridge.aUSDC,
        swapData: swapDataUSDC,
    },
    {
        name: "USDT",
        contracts: mainnetConst.barnBridge.aUSDT,
        swapData: swapDataUSDC,
    },
];

describe("Strategies Unit Test: BarnBridge multi reward", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    describe(`Deployment: Gatekeeping`, () => {
        it("Should fail deploying Barn Bridge Multi Reward Strategy with smart yeild address 0", async () => {
            const BarnBridgeMultiRewardStrategy = new BarnBridgeMultiRewardStrategy__factory().connect(accounts.administrator);
            await expect(
                BarnBridgeMultiRewardStrategy.deploy(
                    AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001"
                )
            ).to.be.revertedWith("BarnBridgeMultiRewardStrategy::constructor: ISmartYield address cannot be 0");
        });

        it("Should fail deploying Barn Bridge Multi Reward Strategy with smart pool address 0", async () => {
            const BarnBridgeMultiRewardStrategy = new BarnBridgeMultiRewardStrategy__factory().connect(accounts.administrator);
            await expect(
                BarnBridgeMultiRewardStrategy.deploy(
                    "0x0000000000000000000000000000000000000001",
                    AddressZero,
                    "0x0000000000000000000000000000000000000001"
                )
            ).to.be.revertedWith("BarnBridgeMultiRewardStrategy::constructor: IPoolMulti address cannot be 0");
        });
    });

    strategyAssets.forEach(({ name, contracts, swapData }) => {
        describe(`Asset: ${name}`, () => {
            let token: IERC20;

            before(async () => {
                const {tokens} = await loadFixture(underlyingTokensFixture);
                token = tokens[name];
            });

            describe(`Deployment: ${name}`, () => {
                it("Should deploy", async () => {
                    await new BarnBridgeMultiRewardStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(contracts.SmartYield.address, contracts.MultiPool.address, token.address);
                });
            });

            describe(`Functions: ${name}`, () => {
                let barnBridgeContract: IBaseStrategy;
                let implAddress: string;

                let millionUnits: BigNumber;

                before(async () => {
                    const barnBridgeImpl = await new BarnBridgeMultiRewardStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(contracts.SmartYield.address, contracts.MultiPool.address, token.address);

                    implAddress = barnBridgeImpl.address;

                    millionUnits = getMillionUnits(mainnetConst.tokens[name].units);
                });

                beforeEach(async () => {
                    // deploy proxy for a strategy
                    const barnBridgeProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        implAddress
                    );
                    barnBridgeContract = BarnBridgeMultiRewardStrategy__factory.connect(
                        barnBridgeProxy.address,
                        accounts.administrator
                    );
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(barnBridgeContract, stratSetup);
                    token.transfer(barnBridgeContract.address, depositAmount);

                    const depositSlippage = encodeDepositSlippage(0);

                    // ACT
                    await barnBridgeContract.process([depositSlippage], false, []);

                    // ASSERT
                    const balance = await barnBridgeContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(barnBridgeContract);
                    expect(strategyDetails.totalShares).to.beCloseTo(depositAmount, BasisPoints.Basis_100);
                    expect(strategyDetails.totalShares).to.equal(balance);
                });

                it("Process deposit twice, should redeposit rewards", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(barnBridgeContract, stratSetup);
                    token.transfer(barnBridgeContract.address, depositAmount);

                    console.log("barnBridgeContract.process([], false, []);");
                    const depositSlippage = encodeDepositSlippage(0);
                    await barnBridgeContract.process([depositSlippage], false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(barnBridgeContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(barnBridgeContract, stratSetup2);
                    token.transfer(barnBridgeContract.address, depositAmount);

                    // ACT
                    await barnBridgeContract.process([depositSlippage], true, swapData);

                    // ASSERT
                    const balance = await barnBridgeContract.getStrategyBalance();
                    // account fot 0.5% fee
                    expect(balance).to.be.greaterWithTolerance(depositAmount.mul(2), BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(barnBridgeContract);
                    expect(strategyDetails.totalShares).to.be.greaterWithTolerance(depositAmount.mul(2), BasisPoints.Basis_100);
                });

                it("Process withraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(barnBridgeContract, stratSetupDeposit);
                    token.transfer(barnBridgeContract.address, depositAmount);
                    const depositSlippage = encodeDepositSlippage(0);
                    const balance1 = await barnBridgeContract.getStrategyBalance();
                    console.log("balance1", balance1.toString());
                    await barnBridgeContract.process([depositSlippage], false, []);

                    const balance2 = await barnBridgeContract.getStrategyBalance();
                    console.log("balance2", balance2.toString());

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(barnBridgeContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(barnBridgeContract, stratSetupWithdraw);

                    // ACT
                    const balance3 = await barnBridgeContract.getStrategyBalance();
                    console.log("balance3", balance3.toString());
                    await barnBridgeContract.process([0], false, []);

                    // ASSERT
                    const balance = await barnBridgeContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(barnBridgeContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);
                });

                it("Claim rewards, should claim and swap rewards for the underlying currency", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(barnBridgeContract, stratSetupDeposit);
                    token.transfer(barnBridgeContract.address, depositAmount);
                    const depositSlippage = encodeDepositSlippage(0);
                    await barnBridgeContract.process([depositSlippage], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await barnBridgeContract.claimRewards(swapData);

                    // ASSERT
                    const strategyDetails = await getStrategyState(barnBridgeContract);
                    expect(strategyDetails.pendingDepositReward).to.be.gte(Zero);
                });

                it("Fast withdraw, remove shares", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(barnBridgeContract, stratSetupDeposit);
                    token.transfer(barnBridgeContract.address, depositAmount);
                    const depositSlippage = encodeDepositSlippage(0);
                    await barnBridgeContract.process([depositSlippage], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(barnBridgeContract);

                    // ACT
                    await barnBridgeContract.fastWithdraw(stratSetupWithdraw.totalShares, [0], swapData);

                    // ASSERT
                    const balance = await barnBridgeContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(barnBridgeContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    // check if balance is greater than initial, as we claim the rewards as well
                    const tokenBalance = await token.balanceOf(barnBridgeContract.address);
                    // account fot 0.5% fee
                    expect(tokenBalance).to.be.greaterWithTolerance(depositAmount, BasisPoints.Basis_100);
                });

                it("Emergency withdraw, should withdraw all funds and send it to the recipient", async () => {
                    // ARRANGE
                    const emergencyRecipient = accounts.user0.address;
                    const tokenBalanceBefore = await token.balanceOf(emergencyRecipient);

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(barnBridgeContract, stratSetupDeposit);
                    token.transfer(barnBridgeContract.address, depositAmount);
                    const depositSlippage = encodeDepositSlippage(0);
                    await barnBridgeContract.process([depositSlippage], false, []);

                    // add pending deposit
                    const pendingDeposit = millionUnits.div(5);
                    const stratSetupDepositpending = getStrategySetupObject();
                    stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                    stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                    await setStrategyState(barnBridgeContract, stratSetupDepositpending);

                    const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                    token.transfer(barnBridgeContract.address, totalPendingDeposit);

                    // mine blocks
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await barnBridgeContract.emergencyWithdraw(emergencyRecipient, []);

                    // ASSERT
                    const stratBalance = await barnBridgeContract.getStrategyBalance();
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
