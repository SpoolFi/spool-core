
import { expect, use } from "chai";
import { BigNumber, constants } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import {
    MorphoStrategy__factory,
    IBaseStrategy,
    IERC20,
    TestStrategySetup__factory,
    MorphoContractHelper__factory,
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

const { Zero, AddressZero } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

const swapPathWeth = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._3000, UNISWAP_V3_FEE._500);
const depositSlippage = [ encodeDepositSlippage(0) ];
const withdrawSlippage = [ 0 ];

type MorphoStratSetup = {
    underlying: keyof TokensFixture & keyof Tokens;
    cToken: string;
    swapPath: string;
};

const strategyAssets: MorphoStratSetup[] = [
    {
        underlying: "DAI",
        cToken: mainnetConst.compound.cDAI.delegator.address,
        swapPath: swapPathWeth,
    },
    {
        underlying: "USDC",
        cToken: mainnetConst.compound.cUSDC.address,
        swapPath: swapPathWeth,
    },
    {
        underlying: "USDT",
        cToken: mainnetConst.compound.cUSDT.delegator.address,
        swapPath: swapPathWeth,
    },
];

describe.only("Strategies Unit Test: Morpho", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    describe(`Deployment Gatekeeping`, () => {
        it("Should fail deploying Morpho Strategy with Morpho address 0", async () => {
            const MorphoStrategy = new MorphoStrategy__factory().connect(accounts.administrator);
            await expect(
                MorphoStrategy.deploy(
                    AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                )
            ).to.be.revertedWith("MorphoStrategy::constructor: Morpho address cannot be 0");
        });

        it("Should fail deploying Morpho Strategy with cToken address 0", async () => {
            const MorphoStrategy = new MorphoStrategy__factory().connect(accounts.administrator);
            await expect(
                MorphoStrategy.deploy(
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                )
            ).to.be.revertedWith("MorphoStrategy::constructor: cToken address cannot be 0");
        });

        strategyAssets.forEach(({ underlying, cToken, swapPath }) => {
            describe(`Asset: ${underlying}`, () => {
                let tokens: TokensFixture;
                let token: IERC20;

                before(async () => {
                    ({ tokens } = await loadFixture(underlyingTokensFixture));
                    token = tokens[underlying];
                });

                describe(`Deployment: ${underlying}`, () => {
                    it("Should deploy", async () => {
                        const morphoStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                            AddressZero
                        );

                    let morphoHelper = await new MorphoContractHelper__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.morpho.Proxy.address,
                            mainnetConst.compound.COMP.address,
                            cToken,
                            token.address,
                            morphoStrategyProxy.address
                        );

                    const helperProxy = await new TransparentUpgradeableProxy__factory()
                        .connect(accounts.administrator)
                        .deploy(morphoHelper.address, "0x0000000000000000000000000000000000000001", "0x");

                    morphoHelper = MorphoContractHelper__factory.connect(
                        helperProxy.address,
                        accounts.administrator
                    );

                        const morphoStrategy = await new MorphoStrategy__factory()
                            .connect(accounts.administrator)
                            .deploy(
                                mainnetConst.morpho.Proxy.address,
                                mainnetConst.compound.COMP.address,
                                cToken,
                                token.address,
                                morphoHelper.address
                            );

                        await morphoStrategyProxy.setImplementation(morphoStrategy.address);
                    });
                });

                describe(`Functions: ${underlying}`, () => {
                    let morphoContract: IBaseStrategy;
                    let millionUnits: BigNumber;

                    before(async () => {
                        millionUnits = getMillionUnits(mainnetConst.tokens[underlying].units);
                    });

                    beforeEach(async () => {
                        const morphoStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                            AddressZero
                        );

                    let morphoHelper = await new MorphoContractHelper__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.morpho.Proxy.address,
                            mainnetConst.compound.COMP.address,
                            cToken,
                            token.address,
                            morphoStrategyProxy.address
                        );

                    const helperProxy = await new TransparentUpgradeableProxy__factory()
                        .connect(accounts.administrator)
                        .deploy(morphoHelper.address, "0x0000000000000000000000000000000000000001", "0x");

                    morphoHelper = MorphoContractHelper__factory.connect(
                        helperProxy.address,
                        accounts.administrator
                    );

                        const morphoStrategy = await new MorphoStrategy__factory()
                            .connect(accounts.administrator)
                            .deploy(
                                mainnetConst.morpho.Proxy.address,
                                mainnetConst.compound.COMP.address,
                                cToken,
                                token.address,
                                morphoHelper.address
                            );

                        await morphoStrategyProxy.setImplementation(morphoStrategy.address);

                        morphoContract = MorphoStrategy__factory.connect(
                            morphoStrategyProxy.address,
                            accounts.administrator
                        );
                    });

                    it("Process deposit, should deposit in strategy", async () => {
                        // ARRANGE
                        const depositAmount = millionUnits;
                        const stratSetup = getStrategySetupObject();
                        stratSetup.pendingUser.deposit = depositAmount;
                        await setStrategyState(morphoContract, stratSetup);
                        await token.transfer(morphoContract.address, depositAmount);

                        // ACT
                        await morphoContract.process(depositSlippage, false, []);

                        // ASSERT
                        const balance = await morphoContract.getStrategyBalance();
                        expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                        const strategyDetails = await getStrategyState(morphoContract);

                        expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_1);
                        const totalShares = depositAmount.mul(10**6).sub(10**5);
                        expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_01);
                    });

                    it("Process deposit twice, should redeposit rewards", async () => {
                        // ARRANGE
                        const depositAmount = millionUnits;
                        const stratSetup = getStrategySetupObject();
                        stratSetup.pendingUser.deposit = depositAmount;
                        await setStrategyState(morphoContract, stratSetup);
                        await token.transfer(morphoContract.address, depositAmount);

                        await morphoContract.process(depositSlippage, false, []);

                        console.log("mining blocks...");
                        await mineBlocks(100, SECS_DAY);
                        console.log("mined");

                        const stratSetup2 = await getStrategyState(morphoContract);
                        stratSetup2.pendingUser.deposit = depositAmount;
                        await setStrategyState(morphoContract, stratSetup2);
                        await token.transfer(morphoContract.address, depositAmount);

                        // ACT
                        await morphoContract.process(depositSlippage, true, [{ slippage: 1, path: swapPath }]);

                        // ASSERT
                        const balance = await morphoContract.getStrategyBalance();
                        expect(balance).to.be.gt(depositAmount.mul(2));

                        const strategyDetails = await getStrategyState(morphoContract);
                        const totalShares = balance.mul(10**6).mul(2).sub(10**5);
                        expect(strategyDetails.totalShares).to.be.lt(totalShares);
                    });

                    it("Process withdraw, should withdraw from strategy", async () => {
                        // ARRANGE

                        // deposit
                        const depositAmount = millionUnits;
                        const maxBalLeft = depositAmount.div(1000).mul(1);
                        const stratSetupDeposit = getStrategySetupObject();
                        stratSetupDeposit.pendingUser.deposit = depositAmount;
                        await setStrategyState(morphoContract, stratSetupDeposit);
                        await token.transfer(morphoContract.address, depositAmount);
                        await morphoContract.process(withdrawSlippage, false, []);

                        // set withdraw
                        const stratSetupWithdraw = await getStrategyState(morphoContract);
                        stratSetupWithdraw.pendingUser.deposit = Zero;
                        stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                        await setStrategyState(morphoContract, stratSetupWithdraw);

                        // ACT
                        await morphoContract.process(withdrawSlippage, false, []);

                        // ASSERT
                        const balance = await morphoContract.getStrategyBalance();
                        expect(balance.lte(maxBalLeft));

                        const strategyDetails = await getStrategyState(morphoContract);
                        expect(strategyDetails.totalShares).to.equal(Zero);
                    });

                    it("Claim rewards, should claim and swap rewards for the underlying currency", async () => {
                        // ARRANGE

                        // deposit
                        const depositAmount = millionUnits;
                        const stratSetupDeposit = getStrategySetupObject();
                        stratSetupDeposit.pendingUser.deposit = depositAmount;
                        await setStrategyState(morphoContract, stratSetupDeposit);
                        await token.transfer(morphoContract.address, depositAmount);
                        await morphoContract.process(depositSlippage, false, []);

                        // mine block, to gain reward
                        console.log("mining blocks...");
                        await mineBlocks(100, SECS_DAY);
                        console.log("mined");

                        // ACT
                        await morphoContract.claimRewards([{ slippage: 1, path: swapPath }]);

                        // ASSERT
                        const strategyDetails = await getStrategyState(morphoContract);
                        expect(strategyDetails.pendingDepositReward).to.be.gt(Zero);
                    });

                    it("Fast withdraw, remove shares", async () => {
                        // ARRANGE

                        // deposit
                        const depositAmount = millionUnits;
                        const maxBalLeft = depositAmount.div(1000).mul(1);
                        const stratSetupDeposit = getStrategySetupObject();
                        stratSetupDeposit.pendingUser.deposit = depositAmount;
                        await setStrategyState(morphoContract, stratSetupDeposit);
                        await token.transfer(morphoContract.address, depositAmount);
                        await morphoContract.process(withdrawSlippage, false, []);

                        // mine block, to gain reward
                        console.log("mining blocks...");
                        await mineBlocks(100, SECS_DAY);
                        console.log("mined");

                        const stratSetupWithdraw = await getStrategyState(morphoContract);

                        // ACT
                        await morphoContract.fastWithdraw(
                            stratSetupWithdraw.totalShares,
                            [],
                            [{ slippage: 1, path: swapPath }]
                        );

                        // ASSERT

                        const balance = await morphoContract.getStrategyBalance();
                        expect(balance.lte(maxBalLeft));

                        const strategyDetails = await getStrategyState(morphoContract);
                        expect(strategyDetails.totalShares).to.equal(Zero);

                        // check if balance is greater than initial, as we claim the rewards as well
                        const tokenBalance = await token.balanceOf(morphoContract.address);
                        expect(tokenBalance).to.be.gt(depositAmount);
                    });

                    it("Emergency withdraw, should withdraw all funds and send it to the recipient", async () => {
                        // ARRANGE
                        const emergencyRecipient = accounts.user0.address;
                        const tokenBalanceBefore = await token.balanceOf(emergencyRecipient);

                        // deposit
                        const depositAmount = millionUnits;
                        const maxBalLeft = depositAmount.div(1000).mul(1);
                        const stratSetupDeposit = getStrategySetupObject();
                        stratSetupDeposit.pendingUser.deposit = depositAmount;
                        await setStrategyState(morphoContract, stratSetupDeposit);
                        await token.transfer(morphoContract.address, depositAmount);
                        await morphoContract.process(withdrawSlippage, false, []);

                        // add pending deposit
                        const pendingDeposit = millionUnits.div(5);
                        const stratSetupDepositpending = getStrategySetupObject();
                        stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                        stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                        await setStrategyState(morphoContract, stratSetupDepositpending);

                        const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                        await token.transfer(morphoContract.address, totalPendingDeposit);

                        // mine blocks
                        console.log("mining blocks...");
                        await mineBlocks(100, SECS_DAY);
                        console.log("mined");

                        // ACT
                        await morphoContract.emergencyWithdraw(emergencyRecipient, []);

                        // ASSERT
                        const stratBalance = await morphoContract.getStrategyBalance();
                        expect(stratBalance.lte(maxBalLeft));

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
});    
