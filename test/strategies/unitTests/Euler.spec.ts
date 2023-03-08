import { expect, use } from "chai";
import { BigNumber, constants, Signer } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import { IBaseStrategy, IERC20, TestStrategySetup__factory, EulerStrategy__factory, EulerNoReward__factory } from "../../../build/types";
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

const swapPathWeth10000 = getRewardSwapPathV3Weth(UNISWAP_V3_FEE._10000, UNISWAP_V3_FEE._500);

const swapData = [{ slippage: 1, path: swapPathWeth10000 }];

type EulerStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
    swapData: { slippage: number; path: string; }[];
    contract: string;
    args: string[];
};

const strategyAssets: EulerStratSetup[] = [
    {
        name: "DAI",
        swapData: swapData,
        contract: "EulerNoReward",
        args: [ 
                mainnetConst.euler.euler.address, 
                mainnetConst.euler.eDAI.address, 
                mainnetConst.tokens.DAI.contract.address, 
                AddressZero
              ]
    },
    {
        name: "USDC",
        swapData: swapData,
        contract: "EulerStrategy",
        args: [ 
                mainnetConst.euler.euler.address, 
                mainnetConst.euler.eUSDC.address, 
                mainnetConst.tokens.USDC.contract.delegator.address, 
                mainnetConst.euler.stakingRewardsUSDC.address, 
                AddressZero
              ]
    },
    {
        name: "USDT",
        swapData: swapData,
        contract: "EulerStrategy",
        args: [
                mainnetConst.euler.euler.address, 
                mainnetConst.euler.eUSDT.address, 
                mainnetConst.tokens.USDT.contract.address, 
                mainnetConst.euler.stakingRewardsUSDT.address, 
                AddressZero
              ]
    },
];

async function deployFactory(name : string, args : string[], account : Signer) : Promise<any> {
    switch (name) {
        case "EulerStrategy":
            // @ts-ignore
            return await new EulerStrategy__factory().connect(account).deploy(...args);
        case "EulerNoReward":
            // @ts-ignore
            return await new EulerNoReward__factory().connect(account).deploy(...args);
        default:
            throw new Error("Invalid contract name");
    }
}

const depositSlippages = [encodeDepositSlippage(0)];

describe("Strategies Unit Test: Euler", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    it("Should fail deploying Euler with euler address 0", async () => {
        const EulerNoReward = new EulerNoReward__factory().connect(accounts.administrator);
        await expect(
            EulerNoReward.deploy(
                AddressZero, 
                "0x0000000000000000000000000000000000000001", 
                "0x0000000000000000000000000000000000000001", 
                AddressZero
            )
        ).to.be.revertedWith("EulerNoReward::constructor: Euler address cannot be 0");

        const EulerStrategy = new EulerStrategy__factory().connect(accounts.administrator);
        await expect(
            EulerStrategy.deploy(
                AddressZero, 
                "0x0000000000000000000000000000000000000001", 
                "0x0000000000000000000000000000000000000001", 
                mainnetConst.euler.stakingRewardsUSDC.address,
                AddressZero
            )
        ).to.be.revertedWith("EulerStrategy::constructor: Euler address cannot be 0");
    });

    it("Should fail deploying Euler with underlying address mismatch", async () => {
        const EulerNoReward = new EulerNoReward__factory().connect(accounts.administrator);
        await expect(
            EulerNoReward.deploy(
                "0x0000000000000000000000000000000000000001", 
                mainnetConst.euler.eDAI.address,
                "0x0000000000000000000000000000000000000001", 
                AddressZero
            )
        ).to.be.revertedWith("EulerNoReward::constructor: Underlying mismatch");

        const EulerStrategy = new EulerStrategy__factory().connect(accounts.administrator);
        await expect(
            EulerStrategy.deploy(
                "0x0000000000000000000000000000000000000001", 
                mainnetConst.euler.eUSDC.address,
                "0x0000000000000000000000000000000000000001", 
                mainnetConst.euler.stakingRewardsUSDC.address,
                AddressZero
            )
        ).to.be.revertedWith("EulerStrategy::constructor: Underlying mismatch");
    });

    describe(`Gatekeeping`, () => {
        it("Claim rewards on no reward strategy, should throw as Euler has no rewards", async () => {
            const { tokens } = await loadFixture(underlyingTokensFixture);
            const eulerContract = await new EulerNoReward__factory()
                .connect(accounts.administrator)
                .deploy(
                    mainnetConst.euler.euler.address, 
                    mainnetConst.euler.eDAI.address, 
                    tokens.DAI.address, 
                    AddressZero
                );

            // ACT
            await expect(eulerContract.claimRewards([])).to.be.revertedWith(
                "NoRewardStrategy::_processRewards: Strategy does not have rewards"
            );
        });
    });

    strategyAssets.forEach(({ name, swapData, contract, args }) => {
        describe(`Asset: ${name}`, () => {
            let token: IERC20;
            before(async () => {
                const { tokens } = await loadFixture(underlyingTokensFixture);
                token = tokens[name];
            });

            describe(`Deployment: ${name}`, () => {
                it("Should deploy", async () => {
                    await deployFactory(contract, args, accounts.administrator);
                });
            });

            describe(`Functions: ${name}`, () => {
                let eulerContract: IBaseStrategy;
                let implAddress: string;
                let millionUnits: BigNumber;

                before(async () => {
                    const eulerStrategyImpl = await deployFactory(contract, args, accounts.administrator);
                    implAddress = eulerStrategyImpl.address;

                    millionUnits = getMillionUnits(mainnetConst.tokens[name].units);
                });

                beforeEach(async () => {
                    // deploy proxy for a strategy
                    const eulerStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        implAddress
                    );

                    eulerContract = EulerStrategy__factory.connect(
                        eulerStrategyProxy.address,
                        accounts.administrator
                    );
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(eulerContract, stratSetup);
                    token.transfer(eulerContract.address, depositAmount);

                    // ACT
                    await eulerContract.process(depositSlippages, false, []);

                    // ASSERT
                    const balance = await eulerContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(eulerContract);

                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_1);
                    const totalShares = balance.mul(10**6).sub(10**5);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_01);
                });

                it("Process deposit twice, should deposit the second time and get the same number of shares", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(eulerContract, stratSetup);
                    token.transfer(eulerContract.address, depositAmount);

                    await eulerContract.process(depositSlippages, false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(eulerContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(eulerContract, stratSetup2);
                    token.transfer(eulerContract.address, depositAmount);

                    // ACT
                    await eulerContract.process(depositSlippages, false, []);

                    // ASSERT
                    const balance = await eulerContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount.mul(2), BasisPoints.Basis_1);

                    const totalShares = balance.mul(10**6).sub(10**5);
                    const strategyDetails = await getStrategyState(eulerContract);
                    expect(strategyDetails.totalShares).to.beCloseTo(totalShares, BasisPoints.Basis_1);

                    const shares1 = stratSetup2.totalShares;
                    const shares2 = strategyDetails.totalShares.sub(shares1);

                    expect(shares1).to.beCloseTo(shares2, BasisPoints.Basis_1);
                });

                it("Process withdraw, should withdraw from strategy", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(eulerContract, stratSetupDeposit);
                    token.transfer(eulerContract.address, depositAmount);
                    await eulerContract.process(depositSlippages, false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(eulerContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(eulerContract, stratSetupWithdraw);

                    // ACT
                    await eulerContract.process([0], false, []);

                    // ASSERT
                    const balance = await eulerContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(eulerContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);
                });

                it("Claim rewards, should claim and swap rewards for the underlying currency", async () => {
                    // ARRANGE
                    //
                    if(name === "DAI") {
                        // DAI has no rewards
                        return;
                    }

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(eulerContract, stratSetupDeposit);
                    token.transfer(eulerContract.address, depositAmount);
                    await eulerContract.process(depositSlippages, false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await eulerContract.claimRewards(swapData);

                    // ASSERT
                    const strategyDetails = await getStrategyState(eulerContract);
                    expect(strategyDetails.pendingDepositReward).to.be.gte(Zero);
                });

                it("Fast withdraw, remove shares", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(eulerContract, stratSetupDeposit);
                    token.transfer(eulerContract.address, depositAmount);
                    await eulerContract.process(depositSlippages, false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(eulerContract);

                    // ACT
                    await eulerContract.fastWithdraw(stratSetupWithdraw.totalShares, [0], []);

                    // ASSERT

                    const balance = await eulerContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(eulerContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    const daiBalance = await token.balanceOf(eulerContract.address);
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
                    await setStrategyState(eulerContract, stratSetupDeposit);
                    token.transfer(eulerContract.address, depositAmount);
                    await eulerContract.process(depositSlippages, false, []);

                    // add pending deposit
                    const pendingDeposit = millionUnits.div(5);
                    const stratSetupDepositpending = getStrategySetupObject();
                    stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                    stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                    await setStrategyState(eulerContract, stratSetupDepositpending);

                    const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                    token.transfer(eulerContract.address, totalPendingDeposit);

                    // mine blocks
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await eulerContract.emergencyWithdraw(emergencyRecipient, []);

                    // ASSERT
                    const stratBalance = await eulerContract.getStrategyBalance();
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
