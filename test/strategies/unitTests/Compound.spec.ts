import { expect, use } from "chai";
import { constants, BigNumber } from "ethers";
import { solidity, MockProvider, createFixtureLoader } from "ethereum-waffle";
import { IBaseStrategy } from "../../../build/types/IBaseStrategy";
import { IERC20 } from "../../../build/types/IERC20";
import { TestStrategySetup__factory } from "../../../build/types/factories/TestStrategySetup__factory";
import { CompoundStrategy__factory } from "../../../build/types/factories/CompoundStrategy__factory";
import { CompoundContractHelper__factory } from "../../../build/types/factories/CompoundContractHelper__factory";
import { underlyingTokensFixture, mainnetConst, TokensFixture, AccountsFixture } from "../../shared/fixtures";
import { Tokens } from "../../shared/constants";

import {
    reset,
    mineBlocks,
    SECS_DAY,
    getRewardSwapPathV3Weth,
    BasisPoints,
    UNISWAP_V3_FEE,
    getMillionUnits,
} from "../../shared/utilities";

import { getStrategySetupObject, getStrategyState, setStrategyState } from "./shared/stratSetupUtilities";

const { Zero, AddressZero } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

const swapPathWeth = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._3000, UNISWAP_V3_FEE._500);

type CompoundStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
    cToken: string;
    swapPath: string;
};

const strategyAssets: CompoundStratSetup[] = [
    {
        name: "DAI",
        cToken: mainnetConst.compound.cDAI.delegator.address,
        swapPath: swapPathWeth,
    },
    {
        name: "USDC",
        cToken: mainnetConst.compound.cUSDC.address,
        swapPath: swapPathWeth,
    },
    {
        name: "USDT",
        cToken: mainnetConst.compound.cUSDT.delegator.address,
        swapPath: swapPathWeth,
    },
];

describe("Strategies Unit Test: Compound", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    describe(`Deployment Gatekeeping`, () => {
        it("Should fail deploying Compound Strategy with cToken address 0", async () => {
            const CompoundStrategy = new CompoundStrategy__factory().connect(accounts.administrator);
            await expect(
                CompoundStrategy.deploy(
                    "0x0000000000000000000000000000000000000001",
                    AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001"
                )
            ).to.be.revertedWith("CompoundStrategy::constructor: Token address cannot be 0");
        });

        it("Should fail deploying Compound Strategy with comptroller address 0", async () => {
            const CompoundStrategy = new CompoundStrategy__factory().connect(accounts.administrator);
            await expect(
                CompoundStrategy.deploy(
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001"
                )
            ).to.be.revertedWith("CompoundStrategy::constructor: Comptroller address cannot be 0");
        });

        it("Should fail deploying Compound Strategy with the wrong strategy helper", async () => {
            const { tokens } = await loadFixture(underlyingTokensFixture);

            const compoundHelper = await new CompoundContractHelper__factory().connect(accounts.administrator).deploy(
                "0x0000000000000000000000000000000000000001",
                strategyAssets[0].cToken, // DAI cToken address
                mainnetConst.compound.COMPtroller.delegator.address,
                tokens.DAI.address,
                "0x0000000000000000000000000000000000000001"
            );

            const CompoundStrategy = new CompoundStrategy__factory().connect(accounts.administrator);
            await expect(
                CompoundStrategy.deploy(
                    "0x0000000000000000000000000000000000000001",
                    strategyAssets[1].cToken, // USDC cToken address
                    "0x0000000000000000000000000000000000000001",
                    tokens.USDC.address,
                    compoundHelper.address
                )
            ).to.be.revertedWith("CompoundStrategy::constructor: cToken is not the same as helpers cToken");
        });
    });

    strategyAssets.forEach(({ name, cToken, swapPath }) => {
        describe(`Asset: ${name}`, () => {
            let tokens: TokensFixture;
            let token: IERC20;

            before(async () => {
                ({ tokens } = await loadFixture(underlyingTokensFixture));
                token = tokens[name];
            });

            describe(`Deployment: ${name}`, () => {
                it("Should deploy", async () => {
                    const compoundStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        AddressZero
                    );

                    const compoundHelper = await new CompoundContractHelper__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.compound.COMP.address,
                            cToken,
                            mainnetConst.compound.COMPtroller.delegator.address,
                            token.address,
                            compoundStrategyProxy.address
                        );

                    const compStrategy = await new CompoundStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.compound.COMP.address,
                            cToken,
                            mainnetConst.compound.COMPtroller.delegator.address,
                            token.address,
                            compoundHelper.address
                        );

                    await compoundStrategyProxy.setImplementation(compStrategy.address);
                });
            });

            describe(`Functions: ${name}`, () => {
                let compoundContract: IBaseStrategy;
                let millionUnits: BigNumber;

                before(async () => {
                    millionUnits = getMillionUnits(mainnetConst.tokens[name].units);
                });

                beforeEach(async () => {
                    // deploy proxy for a strategy
                    const compoundStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        AddressZero
                    );

                    const compoundHelper = await new CompoundContractHelper__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.compound.COMP.address,
                            cToken,
                            mainnetConst.compound.COMPtroller.delegator.address,
                            token.address,
                            compoundStrategyProxy.address
                        );

                    const compStrategy = await new CompoundStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.compound.COMP.address,
                            cToken,
                            mainnetConst.compound.COMPtroller.delegator.address,
                            token.address,
                            compoundHelper.address
                        );

                    await compoundStrategyProxy.setImplementation(compStrategy.address);

                    compoundContract = CompoundStrategy__factory.connect(
                        compoundStrategyProxy.address,
                        accounts.administrator
                    );
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(compoundContract, stratSetup);
                    await token.transfer(compoundContract.address, depositAmount);

                    // ACT
                    await compoundContract.process([], false, []);

                    // ASSERT
                    const balance = await compoundContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(compoundContract);

                    expect(strategyDetails.totalShares).to.beCloseTo(depositAmount, BasisPoints.Basis_100);
                    expect(strategyDetails.totalShares).to.beCloseTo(balance, BasisPoints.Basis_100);
                });

                it("Process deposit twice, should redeposit rewards", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(compoundContract, stratSetup);
                    await token.transfer(compoundContract.address, depositAmount);

                    await compoundContract.process([], false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(compoundContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(compoundContract, stratSetup2);
                    await token.transfer(compoundContract.address, depositAmount);

                    // ACT
                    await compoundContract.process([], true, [{ slippage: 1, path: swapPath }]);

                    // ASSERT
                    const balance = await compoundContract.getStrategyBalance();
                    expect(balance).to.be.gt(depositAmount.mul(2));

                    const strategyDetails = await getStrategyState(compoundContract);
                    expect(strategyDetails.totalShares).to.be.greaterWithTolerance(
                        depositAmount.mul(2),
                        BasisPoints.Basis_1
                    );
                });

                it("Process withraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(compoundContract, stratSetupDeposit);
                    await token.transfer(compoundContract.address, depositAmount);
                    await compoundContract.process([], false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(compoundContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(compoundContract, stratSetupWithdraw);

                    // ACT
                    await compoundContract.process([], false, []);

                    // ASSERT
                    const balance = await compoundContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(compoundContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);
                });

                it("Claim rewards, should claim and swap rewards for the underlying currency", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(compoundContract, stratSetupDeposit);
                    await token.transfer(compoundContract.address, depositAmount);
                    await compoundContract.process([], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await compoundContract.claimRewards([{ slippage: 1, path: swapPath }]);

                    // ASSERT
                    const strategyDetails = await getStrategyState(compoundContract);
                    expect(strategyDetails.pendingDepositReward).to.be.gt(Zero);
                });

                it("Fast withdraw, remove shares", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(compoundContract, stratSetupDeposit);
                    await token.transfer(compoundContract.address, depositAmount);
                    await compoundContract.process([], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(compoundContract);

                    // ACT
                    await compoundContract.fastWithdraw(
                        stratSetupWithdraw.totalShares,
                        [],
                        [{ slippage: 1, path: swapPath }]
                    );

                    // ASSERT

                    const balance = await compoundContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(compoundContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    // check if balance is greater than initial, as we claim the rewards as well
                    const tokenBalance = await token.balanceOf(compoundContract.address);
                    expect(tokenBalance).to.be.gt(depositAmount);
                });

                it("Emergency withdraw, should withdraw all funds and send it to the recipient", async () => {
                    // ARRANGE
                    const emergencyRecipient = accounts.user0.address;
                    const tokenBalanceBefore = await token.balanceOf(emergencyRecipient);

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(compoundContract, stratSetupDeposit);
                    await token.transfer(compoundContract.address, depositAmount);
                    await compoundContract.process([], false, []);

                    // add pending deposit
                    const pendingDeposit = millionUnits.div(5);
                    const stratSetupDepositpending = getStrategySetupObject();
                    stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                    stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                    await setStrategyState(compoundContract, stratSetupDepositpending);

                    const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                    await token.transfer(compoundContract.address, totalPendingDeposit);

                    // mine blocks
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await compoundContract.emergencyWithdraw(emergencyRecipient, []);

                    // ASSERT
                    const stratBalance = await compoundContract.getStrategyBalance();
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
