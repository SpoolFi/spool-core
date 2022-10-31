
import { expect, use } from "chai";
import { BigNumber, BigNumberish, constants } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import {
    IBaseStrategy,
    IERC20,
    TestStrategySetup__factory,
    MorphoAaveContractHelper__factory,
    TransparentUpgradeableProxy__factory,
    MorphoAaveStrategy__factory,
} from "../../../build/types";
import { AccountsFixture, mainnetConst, TokensFixture, underlyingTokensFixture } from "../../shared/fixtures";
import { Tokens } from "../../shared/constants";

import {
    BasisPoints,
    encodeDepositSlippage,
    getMillionUnits,
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
    aToken: string;
    swapPath: string;
};

const strategyAssets: MorphoStratSetup[] = [
    {
        underlying: "DAI",
        aToken: mainnetConst.aave.aDAI.address,
        swapPath: swapPathWeth,
    },
    {
        underlying: "USDC",
        aToken: mainnetConst.aave.aUSDC.address,
        swapPath: swapPathWeth,
    },
    {
        underlying: "USDT",
        aToken: mainnetConst.aave.aUSDT.address,
        swapPath: swapPathWeth,
    },
];

describe("Strategies Unit Test: Morpho-Aave", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    describe(`Deployment Gatekeeping`, () => {
        it("Should fail deploying Morpho-Aave Strategy with Morpho address 0", async () => {
            const MorphoStrategy = new MorphoAaveStrategy__factory().connect(accounts.administrator);
            await expect(
                MorphoStrategy.deploy(
                    AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                )
            ).to.be.revertedWith("MorphoAaveStrategy::constructor: Morpho address cannot be 0");
        });

        it("Should fail deploying Morpho-Aave Strategy with aToken address 0", async () => {
            const MorphoStrategy = new MorphoAaveStrategy__factory().connect(accounts.administrator);
            await expect(
                MorphoStrategy.deploy(
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001",
                )
            ).to.be.revertedWith("MorphoAaveStrategy::constructor: aToken address cannot be 0");
        });

        strategyAssets.forEach(({ underlying, aToken, swapPath }) => {
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

                    let morphoHelper = await new MorphoAaveContractHelper__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.morpho.Aave.Proxy.address,
                            mainnetConst.tokens.AAVE.contract.address,
                            aToken,
                            token.address,
                            morphoStrategyProxy.address
                        );

                    const helperProxy = await new TransparentUpgradeableProxy__factory()
                        .connect(accounts.administrator)
                        .deploy(morphoHelper.address, "0x0000000000000000000000000000000000000001", "0x");

                    morphoHelper = MorphoAaveContractHelper__factory.connect(
                        helperProxy.address,
                        accounts.administrator
                    );

                        const morphoStrategy = await new MorphoAaveStrategy__factory()
                            .connect(accounts.administrator)
                            .deploy(
                                mainnetConst.morpho.Aave.Proxy.address,
                                mainnetConst.tokens.AAVE.contract.address,
                                aToken,
                                token.address,
                                morphoHelper.address,
                                mainnetConst.morpho.Aave.Lens.address,
                                AddressZero

                            );

                        await morphoStrategyProxy.setImplementation(morphoStrategy.address);
                    });
                });

                describe(`Functions: ${underlying}`, () => {
                    let morphoContract: IBaseStrategy;
                    let hundredThousandUnits: BigNumber;

                    before(async () => {
                        hundredThousandUnits = getMillionUnits(mainnetConst.tokens[underlying].units);
                    });

                    beforeEach(async () => {
                        const morphoStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                            AddressZero
                        );

                    let morphoHelper = await new MorphoAaveContractHelper__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.morpho.Aave.Proxy.address,
                            mainnetConst.tokens.AAVE.contract.address,
                            aToken,
                            token.address,
                            morphoStrategyProxy.address
                        );

                    const helperProxy = await new TransparentUpgradeableProxy__factory()
                        .connect(accounts.administrator)
                        .deploy(morphoHelper.address, "0x0000000000000000000000000000000000000001", "0x");

                    morphoHelper = MorphoAaveContractHelper__factory.connect(
                        helperProxy.address,
                        accounts.administrator
                    );

                        const morphoStrategy = await new MorphoAaveStrategy__factory()
                            .connect(accounts.administrator)
                            .deploy(
                                mainnetConst.morpho.Aave.Proxy.address,
                                mainnetConst.tokens.AAVE.contract.address,
                                aToken,
                                token.address,
                                morphoHelper.address,
                                mainnetConst.morpho.Aave.Lens.address,
                                AddressZero
                            );

                        await morphoStrategyProxy.setImplementation(morphoStrategy.address);

                        morphoContract = MorphoAaveStrategy__factory.connect(
                            morphoStrategyProxy.address,
                            accounts.administrator
                        );
                    });

                    it("Process deposit, should deposit in strategy", async () => {
                        // ARRANGE
                        const depositAmount = hundredThousandUnits;
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
                        const depositAmount = hundredThousandUnits;
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
                        // AaveIncentivesController not yet added on MorphoAave so can't claim rewards yet.
                        //await morphoContract.process(depositSlippage, true, [{ slippage: 1, path: swapPath }]);
                        await morphoContract.process(depositSlippage, true, []);

                        // ASSERT
                        const balance = await morphoContract.getStrategyBalance();
                        expect(balance).to.be.gte(depositAmount.mul(2));

                        const strategyDetails = await getStrategyState(morphoContract);
                        const totalShares = balance.mul(10**6).mul(2).sub(10**5);
                        expect(strategyDetails.totalShares).to.be.lt(totalShares);
                    });

                    it("Process withdraw, should withdraw from strategy", async () => {
                        // ARRANGE

                        // deposit
                        const depositAmount = hundredThousandUnits;
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


                    // AaveIncentivesController not yet added on MorphoAave so can't claim rewards yet.
                    it.skip("Claim rewards, should claim and swap rewards for the underlying currency", async () => {
                        // ARRANGE

                        // deposit
                        const depositAmount = hundredThousandUnits;
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
                        const depositAmount = hundredThousandUnits;
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
                        // AaveIncentivesController not yet added on MorphoAave so can't claim rewards yet.
                        //await morphoContract.fastWithdraw(
                        //    stratSetupWithdraw.totalShares,
                        //    [],
                        //    [{ slippage: 1, path: swapPath }]
                        //);
                        await morphoContract.fastWithdraw(
                            stratSetupWithdraw.totalShares,
                            [],
                            []
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
                        const depositAmount = hundredThousandUnits;
                        const maxBalLeft = depositAmount.div(1000).mul(1);
                        const stratSetupDeposit = getStrategySetupObject();
                        stratSetupDeposit.pendingUser.deposit = depositAmount;
                        await setStrategyState(morphoContract, stratSetupDeposit);
                        await token.transfer(morphoContract.address, depositAmount);
                        await morphoContract.process(withdrawSlippage, false, []);

                        // add pending deposit
                        const pendingDeposit = hundredThousandUnits.div(5);
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
