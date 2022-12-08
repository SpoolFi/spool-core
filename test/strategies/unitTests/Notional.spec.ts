import { expect, use } from "chai";
import { BigNumber, constants } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import {
    NotionalContractHelper__factory,
    NotionalStrategy__factory,
    IBaseStrategy,
    IERC20,
    TestStrategySetup__factory,
    TransparentUpgradeableProxy__factory,
} from "../../../build/types";
import { AccountsFixture, mainnetConst, TokensFixture, underlyingTokensFixture } from "../../shared/fixtures";
import { nToken, Tokens } from "../../shared/constants";

import {
    BasisPoints,
    encodeDepositSlippage,
    getMillionUnits,
    getRewardSwapPathBalancer,
    mineBlocks,
    PathBalancerAsset,
    PathBalancerSwap,
    resetToBlockNumber,
    SECS_DAY,
} from "../../shared/utilities";

import { getStrategySetupObject, getStrategyState, setStrategyState } from "./shared/stratSetupUtilities";

const { Zero, AddressZero } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);
const mainnetBlock = 15082700;
const depositSlippage = encodeDepositSlippage(0);

const baseSwap : PathBalancerSwap = 
    {
        poolId: '0x5122e01d819e58bb2e22528c0d68d310f0aa6fd7000200000000000000000163', // 80 NOTE - 20 WETH
        indexIn: 0,
        indexOut: 1
    }


const swapDAI : PathBalancerSwap[] = [
    baseSwap,
    {
        poolId: '0x0b09dea16768f0799065c475be02919503cb2a3500020000000000000000001a', // 40 DAI - 60 WETH
        indexIn: 1,
        indexOut: 2
    }
]

const swapUSDC : PathBalancerSwap[] = [ 
    baseSwap,
    {
        poolId: '0x96646936b91d6b9d7d0c47c496afbf3d6ec7b6f8000200000000000000000019', // 50 USDC - 50 WETH
        indexIn: 1,
        indexOut: 2
    }
]

const assetsDAI : PathBalancerAsset[] = [
    { asset: mainnetConst.notional.NOTE.address, },
    { asset: mainnetConst.tokens.WETH.contract.address, },
    { asset: mainnetConst.tokens.DAI.contract.address }
]

const assetsUSDC : PathBalancerAsset[] = [
    { asset: mainnetConst.notional.NOTE.address, },
    { asset: mainnetConst.tokens.WETH.contract.address, },
    { asset: mainnetConst.tokens.USDC.contract.delegator.address }
]

const swapPathBalancerNOTEDAI = getRewardSwapPathBalancer(swapDAI, assetsDAI);
const swapPathBalancerNOTEUSDC = getRewardSwapPathBalancer(swapUSDC, assetsUSDC);


type NotionalStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
    nToken: nToken;
    swapPath: string;
};

const strategyAssets: NotionalStratSetup[] = [
    {
        name: "DAI",
        nToken: mainnetConst.notional.nDAI,
        swapPath: swapPathBalancerNOTEDAI,
    },
    {
        name: "USDC",
        nToken: mainnetConst.notional.nUSDC,
        swapPath: swapPathBalancerNOTEUSDC,
    },
];

describe("Strategies Unit Test: Notional", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await resetToBlockNumber(mainnetBlock);
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    describe(`Deployment Gatekeeping`, () => {
        it("Should fail deploying Notional Strategy with nToken address 0", async () => {
            const NotionalStrategy = new NotionalStrategy__factory().connect(accounts.administrator);
            await expect(
                NotionalStrategy.deploy(
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001"
                )
            ).to.be.revertedWith("NotionalStrategy::constructor: nToken address cannot be 0");
        });

        it("Should fail deploying Notional Strategy with notional address 0", async () => {
            const NotionalStrategy = new NotionalStrategy__factory().connect(accounts.administrator);
            await expect(
                NotionalStrategy.deploy(
                    AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                )
            ).to.be.revertedWith("NotionalStrategy::constructor: Notional address cannot be 0");
        });

        it("Should fail deploying Notional Strategy with the wrong strategy helper", async () => {
            const { tokens } = await loadFixture(underlyingTokensFixture);

            let notionalHelper = await new NotionalContractHelper__factory().connect(accounts.administrator).deploy(
                mainnetConst.notional.Proxy.address,
                mainnetConst.notional.NOTE.address,
                strategyAssets[0].nToken.contract.address,
                strategyAssets[0].nToken.id,
                tokens.DAI.address,
                "0x0000000000000000000000000000000000000001"
            );
            const helperProxy = await new TransparentUpgradeableProxy__factory()
                .connect(accounts.administrator)
                .deploy(notionalHelper.address, "0x0000000000000000000000000000000000000001", "0x");
            notionalHelper = NotionalContractHelper__factory.connect(helperProxy.address, accounts.administrator);

            const NotionalStrategy = new NotionalStrategy__factory().connect(accounts.administrator);
            await expect(
                NotionalStrategy.deploy(
                    mainnetConst.notional.Proxy.address,
                    mainnetConst.notional.NOTE.address,
                    "0x0000000000000000000000000000000000000001",
                    strategyAssets[0].nToken.id,
                    tokens.DAI.address,
                    notionalHelper.address
                )
            ).to.be.revertedWith("NotionalStrategy::constructor: nToken is not the same as helpers nToken");
        });
    });

    strategyAssets.forEach(({ name, nToken, swapPath }) => {
        describe(`Asset: ${name}`, () => {
            let tokens: TokensFixture;
            let token: IERC20;

            before(async () => {
                ({ tokens } = await loadFixture(underlyingTokensFixture));
                token = tokens[name];
            });

            describe(`Deployment: ${name}`, () => {
                it("Should deploy", async () => {
                    const notionalStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        AddressZero
                    );

                    let notionalHelper = await new NotionalContractHelper__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.notional.Proxy.address,
                            mainnetConst.notional.NOTE.address,
                            nToken.contract.address,
                            nToken.id,
                            token.address,
                            notionalStrategyProxy.address
                        );

                    const helperProxy = await new TransparentUpgradeableProxy__factory()
                        .connect(accounts.administrator)
                        .deploy(notionalHelper.address, "0x0000000000000000000000000000000000000001", "0x");
                    notionalHelper = NotionalContractHelper__factory.connect(
                        helperProxy.address,
                        accounts.administrator
                    );

                    const notionalStrategy = await new NotionalStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.notional.Proxy.address,
                            mainnetConst.notional.NOTE.address,
                            nToken.contract.address,
                            nToken.id,
                            token.address,
                            notionalHelper.address
                        );

                    await notionalStrategyProxy.setImplementation(notionalStrategy.address);
                });
            });

            describe(`Functions: ${name}`, () => {
                let notionalContract: IBaseStrategy;
                let millionUnits: BigNumber;

                before(async () => {
                    millionUnits = getMillionUnits(mainnetConst.tokens[name].units);
                });

                beforeEach(async () => {
                    // deploy proxy for a strategy
                    const notionalStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        AddressZero
                    );

                    let notionalHelper = await new NotionalContractHelper__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.notional.Proxy.address,
                            mainnetConst.notional.NOTE.address,
                            nToken.contract.address,
                            nToken.id,
                            token.address,
                            notionalStrategyProxy.address
                        );

                    const helperProxy = await new TransparentUpgradeableProxy__factory()
                        .connect(accounts.administrator)
                        .deploy(notionalHelper.address, "0x0000000000000000000000000000000000000001", "0x");
                    notionalHelper = NotionalContractHelper__factory.connect(
                        helperProxy.address,
                        accounts.administrator
                    );

                    const compStrategy = await new NotionalStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.notional.Proxy.address,
                            mainnetConst.notional.NOTE.address,
                            nToken.contract.address,
                            nToken.id,
                            token.address,
                            notionalHelper.address
                        );

                    await notionalStrategyProxy.setImplementation(compStrategy.address);

                    notionalContract = NotionalStrategy__factory.connect(
                        notionalStrategyProxy.address,
                        accounts.administrator
                    );
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(notionalContract, stratSetup);
                    await token.transfer(notionalContract.address, depositAmount);

                    // ACT
                    await notionalContract.process([depositSlippage], false, []);

                    // ASSERT
                    const balance = await notionalContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(notionalContract);

                    const totalShares = depositAmount.mul(10**6).sub(10**5);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_100);
                });

                it("Process deposit twice, should redeposit rewards", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(notionalContract, stratSetup);
                    await token.transfer(notionalContract.address, depositAmount);

                    await notionalContract.process([depositSlippage], false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(notionalContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(notionalContract, stratSetup2);
                    await token.transfer(notionalContract.address, depositAmount);

                    // ACT
                    await notionalContract.process([depositSlippage], true, [{ slippage: 1, path: swapPath }]);

                    // ASSERT
                    const balance = await notionalContract.getStrategyBalance();
                    expect(balance).to.be.gt(depositAmount.mul(2));

                    const strategyDetails = await getStrategyState(notionalContract);
                    const totalShares = balance.mul(10**6).mul(2).sub(10**5);
                    expect(strategyDetails.totalShares).to.be.lt(totalShares);
                });

                it("Process withraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(notionalContract, stratSetupDeposit);
                    await token.transfer(notionalContract.address, depositAmount);
                    await notionalContract.process([depositSlippage], false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(notionalContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(notionalContract, stratSetupWithdraw);

                    // ACT
                    await notionalContract.process([0], false, []);

                    // ASSERT
                    const balance = await notionalContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(notionalContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);
                });

                it("Claim rewards, should claim and swap rewards for the underlying currency", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(notionalContract, stratSetupDeposit);
                    await token.transfer(notionalContract.address, depositAmount);
                    await notionalContract.process([depositSlippage], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await notionalContract.claimRewards([{ slippage: 1, path: swapPath }]);

                    // ASSERT
                    const strategyDetails = await getStrategyState(notionalContract);
                    expect(strategyDetails.pendingDepositReward).to.be.gt(Zero);
                });

                it("Fast withdraw, remove shares", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const depositAmountWithSlippage = depositAmount.div(10000).mul(9950);
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(notionalContract, stratSetupDeposit);
                    await token.transfer(notionalContract.address, depositAmount);
                    await notionalContract.process([depositSlippage], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(notionalContract);

                    // ACT
                    await notionalContract.fastWithdraw(
                        stratSetupWithdraw.totalShares,
                        [0],
                        [{ slippage: 1, path: swapPath }]
                    );

                    // ASSERT

                    const balance = await notionalContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(notionalContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    // check if balance is greater than initial w/ slippage tolerance, as we claim the rewards as well
                    const tokenBalance = await token.balanceOf(notionalContract.address);
                    expect(tokenBalance).to.be.gt(depositAmountWithSlippage);
                });

                it("Emergency withdraw, should withdraw all funds and send it to the recipient", async () => {
                    // ARRANGE
                    const emergencyRecipient = accounts.user0.address;
                    const tokenBalanceBefore = await token.balanceOf(emergencyRecipient);

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(notionalContract, stratSetupDeposit);
                    await token.transfer(notionalContract.address, depositAmount);
                    await notionalContract.process([depositSlippage], false, []);

                    // add pending deposit
                    const pendingDeposit = millionUnits.div(5);
                    const stratSetupDepositpending = getStrategySetupObject();
                    stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                    stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                    await setStrategyState(notionalContract, stratSetupDepositpending);

                    const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                    await token.transfer(notionalContract.address, totalPendingDeposit);

                    // mine blocks
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await notionalContract.emergencyWithdraw(emergencyRecipient, []);

                    // ASSERT
                    const stratBalance = await notionalContract.getStrategyBalance();
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
