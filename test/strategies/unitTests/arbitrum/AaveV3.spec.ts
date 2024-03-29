import { expect, use } from "chai";
import { BigNumber, constants } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import { AaveV3Strategy__factory, IBaseStrategy, IERC20, TestStrategySetup__factory } from "../../../../build/types";
import { AccountsFixture, arbitrumConst, TokensFixture, underlyingTokensFixture } from "../../../shared/fixtures";
import { Tokens } from "../../../shared/constants";

import {
    BasisPoints,
    getMillionUnits,
    getRewardSwapPathV3Custom,
    mineBlocks,
    reset,
    SECS_DAY,
    UNISWAP_V3_FEE,
} from "../../../shared/utilities";

import { getStrategySetupObject, getStrategyState, setStrategyState } from "./../shared/stratSetupUtilities";

const { Zero, AddressZero } = constants;

use(solidity);


const swapPath = getRewardSwapPathV3Custom(UNISWAP_V3_FEE._3000, [
    // AAVE
    { address: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", fee: UNISWAP_V3_FEE._3000 },
    // WETH
    { address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", fee: UNISWAP_V3_FEE._500 },
]);


const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

const strategyAssets: (keyof TokensFixture & keyof Tokens)[] = ["DAI", "USDC", "USDT"];

describe("Strategies Unit Test: Arbitrum - AaveV3", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    describe(`Deployment Gatekeeping`, () => {

        it("Should fail deploying Aave with Pool Addresses Provider address 0", async () => {
            const AaveV3Strategy = new AaveV3Strategy__factory().connect(accounts.administrator);
            await expect(
                AaveV3Strategy.deploy(
                    AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001", 
                    AddressZero,

                )
            ).to.be.revertedWith("AaveV3Strategy::constructor: PoolAddressesProvider address cannot be 0");
        });

        it("Should fail deploying Aave with Aave Rewards Controller address 0", async () => {
            const AaveV3Strategy = new AaveV3Strategy__factory().connect(accounts.administrator);
            await expect(
                AaveV3Strategy.deploy(
                    "0x0000000000000000000000000000000000000001",
                    AddressZero,
                    "0x0000000000000000000000000000000000000001", 
                    AddressZero,

                )
            ).to.be.revertedWith("AaveV3Strategy::constructor: RewardsController address cannot be 0");
        });
    });

    strategyAssets.forEach((name) => {
        describe(`Asset: ${name}`, () => {
            let token: IERC20;

            before(async () => {
                const { tokens } = await loadFixture(underlyingTokensFixture);
                token = tokens[name];
            });

            describe(`Deployment: ${name}`, () => {
                it("Should deploy", async () => {
                    await new AaveV3Strategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            arbitrumConst.aave.PoolAddressesProvider.address,
                            arbitrumConst.aave.RewardsController.address,
                            token.address, 
                            AddressZero,
                        );
                });
            });

            describe(`Functions: ${name}`, () => {
                let aaveContract: IBaseStrategy;
                let implAddress: string;
                let millionUnits: BigNumber;

                before(async () => {
                    const aaveImpl = await new AaveV3Strategy__factory(accounts.administrator).deploy(
                        arbitrumConst.aave.PoolAddressesProvider.address,
                        arbitrumConst.aave.RewardsController.address,
                        token.address, 
                        AddressZero,
                    );

                    implAddress = aaveImpl.address;

                    millionUnits = getMillionUnits(arbitrumConst.tokens[name].units);
                });

                beforeEach(async () => {
                    // deploy proxy for a strategy
                    const aaveDaiProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        implAddress
                    );
                    aaveContract = AaveV3Strategy__factory.connect(aaveDaiProxy.address, accounts.administrator);
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE

                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(aaveContract, stratSetup);
                    token.transfer(aaveContract.address, depositAmount);

                    // ACT
                    await aaveContract.process([], false, []);

                    // ASSERT
                    const balance = await aaveContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_1);

                    const strategyDetails = await getStrategyState(aaveContract);
                    const totalShares = depositAmount.mul(10**6).sub(10**5);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_01);
                });

                it("Process deposit twice, should consider protocol yield", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(aaveContract, stratSetup);
                    token.transfer(aaveContract.address, depositAmount);

                    await aaveContract.process([], false, []);

                    // mine blocks, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // setup second deposit
                    const stratSetup2 = await getStrategyState(aaveContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(aaveContract, stratSetup2);
                    token.transfer(aaveContract.address, depositAmount);

                    // ACT
                    await aaveContract.process([], false, []);

                    // ASSERT
                    const balance = await aaveContract.getStrategyBalance();
                    expect(balance).to.be.gt(depositAmount.mul(2));

                    const strategyDetails = await getStrategyState(aaveContract);
                    const totalShares = depositAmount.mul(10**6).mul(2).sub(10**5);
                    // total shares should be less or equal, as protocol generates yield, so shares are not 1 to 1 with deposit anymore
                    // so second user gets less shares than first
                    expect(strategyDetails.totalShares).to.be.lte(totalShares);
                });

                it("Process withdraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(aaveContract, stratSetupDeposit);
                    token.transfer(aaveContract.address, depositAmount);
                    await aaveContract.process([], false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(aaveContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(aaveContract, stratSetupWithdraw);

                    // ACT
                    await aaveContract.process([], false, []);

                    // ASSERT
                    const balance = await aaveContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(aaveContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);
                });

                // NOTE:
                // No rewards yet on Arbitrum for AaveV3. So this test is not possible yet.
                it.skip("Claim rewards, should deposit in strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(aaveContract, stratSetupDeposit);
                    token.transfer(aaveContract.address, depositAmount);
                    await aaveContract.process([], false, []);

                    // mine blocks, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await aaveContract.claimRewards([{ slippage: 1, path: swapPath }]);

                    // ASSERT
                    const strategyDetails = await getStrategyState(aaveContract);
                    expect(strategyDetails.pendingDepositReward).to.be.gt(Zero);
                });

                it("Fast withdraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(aaveContract, stratSetupDeposit);
                    token.transfer(aaveContract.address, depositAmount);
                    await aaveContract.process([], false, []);

                    // mine blocks, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    const stratSetupWithdraw = await getStrategyState(aaveContract);
                    await aaveContract.fastWithdraw(stratSetupWithdraw.totalShares, [], []);

                    // ASSERT
                    const balance = await aaveContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(aaveContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    // check if balance is greater than initial, as we claim the rewards as well
                    const tokenBalance = await token.balanceOf(aaveContract.address);
                    expect(tokenBalance).to.be.greaterWithTolerance(depositAmount, BasisPoints.Basis_1);
                });

                it("Emergency withdraw, should withdraw all funds and send it to the recipient", async () => {
                    // ARRANGE
                    const emergencyRecipient = accounts.user0.address;
                    const tokenBalanceBefore = await token.balanceOf(emergencyRecipient);

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(aaveContract, stratSetupDeposit);
                    token.transfer(aaveContract.address, depositAmount);
                    await aaveContract.process([], false, []);

                    // add pending deposit
                    const pendingDeposit = millionUnits.div(5);
                    const stratSetupDepositpending = getStrategySetupObject();
                    stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                    stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                    await setStrategyState(aaveContract, stratSetupDepositpending);

                    const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                    token.transfer(aaveContract.address, totalPendingDeposit);

                    // mine blocks
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await aaveContract.emergencyWithdraw(emergencyRecipient, []);

                    // ASSERT
                    const stratBalance = await aaveContract.getStrategyBalance();
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
