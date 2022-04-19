import { expect, use } from "chai";
import { BigNumber, constants } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import {
    ERC20__factory,
    HarvestStrategy__factory,
    IBaseStrategy,
    IERC20,
    IHarvestController__factory,
    TestStrategySetup__factory,
} from "../../../build/types";
import { AccountsFixture, mainnetConst, TokensFixture, underlyingTokensFixture } from "../../shared/fixtures";
import { HarvestContracts, Tokens } from "../../shared/constants";

import {
    BasisPoints,
    getMillionUnits,
    getRewardSwapPathV2Weth,
    impersonate,
    mineBlocks,
    reset,
    SECS_DAY,
} from "../../shared/utilities";

import { getStrategySetupObject, getStrategyState, setStrategyState } from "./shared/stratSetupUtilities";

const { Zero, AddressZero } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

const swapPathWeth = getRewardSwapPathV2Weth();

type HarvestStratSetup = {
    name: keyof TokensFixture & keyof Tokens;
    contracts: HarvestContracts;
    swapPath: string;
};

const strategyAssets: HarvestStratSetup[] = [
    {
        name: "DAI",
        contracts: mainnetConst.harvest.DAI,
        swapPath: swapPathWeth,
    },
    {
        name: "USDC",
        contracts: mainnetConst.harvest.USDC,
        swapPath: swapPathWeth,
    },
    {
        name: "USDT",
        contracts: mainnetConst.harvest.USDT,
        swapPath: swapPathWeth,
    },
];

const whitelistStrategy = async (address: string) => {
    await IHarvestController__factory.connect(
        mainnetConst.harvest.Controller.address,
        await impersonate(mainnetConst.harvest.Governance.address)
    ).addToWhitelist(address);
};

describe("Strategies Unit Test: Harvest", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    it("Should fail deploying Harvest with token address 0", async () => {
        const HarvestStrategy = await new HarvestStrategy__factory().connect(accounts.administrator);
        await expect(
            HarvestStrategy.deploy(
                AddressZero,
                "0x0000000000000000000000000000000000000001",
                "0x0000000000000000000000000000000000000001",
                "0x0000000000000000000000000000000000000001"
            )
        ).to.be.revertedWith("ClaimFullSingleRewardStrategy::constructor: Token address cannot be 0");
    });

    strategyAssets.forEach(({ name, contracts, swapPath }) => {
        describe(`Asset: ${name}`, () => {
            let token: IERC20;

            before(async () => {
                const { tokens } = await loadFixture(underlyingTokensFixture);
                token = tokens[name];
            });

            describe(`Deployment: ${name}`, () => {
                it("Should deploy", async () => {
                    await new HarvestStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.harvest.FARM.address,
                            contracts.Vault.address,
                            contracts.Pool.address,
                            token.address
                        );
                });
            });

            describe(`Functions: ${name}`, () => {
                let harvestContract: IBaseStrategy;
                let implAddress: string;
                let millionUnits: BigNumber;

                before(async () => {
                    const harvestStrategyImpl = await new HarvestStrategy__factory()
                        .connect(accounts.administrator)
                        .deploy(
                            mainnetConst.harvest.FARM.address,
                            contracts.Vault.address,
                            contracts.Pool.address,
                            token.address
                        );

                    implAddress = harvestStrategyImpl.address;

                    millionUnits = getMillionUnits(mainnetConst.tokens[name].units);
                });

                beforeEach(async () => {
                    // deploy proxy for a strategy
                    const compoundStrategyProxy = await new TestStrategySetup__factory(accounts.administrator).deploy(
                        implAddress
                    );

                    await whitelistStrategy(compoundStrategyProxy.address);

                    harvestContract = HarvestStrategy__factory.connect(
                        compoundStrategyProxy.address,
                        accounts.administrator
                    );
                });

                it("Process deposit, should deposit in strategy", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(harvestContract, stratSetup);
                    token.transfer(harvestContract.address, depositAmount);

                    // ACT
                    await harvestContract.process([], false, []);

                    // ASSERT
                    const balance = await harvestContract.getStrategyBalance();
                    expect(balance).to.beCloseTo(depositAmount, BasisPoints.Basis_100);

                    const strategyDetails = await getStrategyState(harvestContract);

                    expect(strategyDetails.totalShares).to.beCloseTo(depositAmount, BasisPoints.Basis_100);
                    expect(strategyDetails.totalShares).to.beCloseTo(balance, BasisPoints.Basis_100);
                });

                it("Process deposit twice, should redeposit rewards", async () => {
                    // ARRANGE
                    const depositAmount = millionUnits;
                    const stratSetup = getStrategySetupObject();
                    stratSetup.pendingUser.deposit = depositAmount;
                    await setStrategyState(harvestContract, stratSetup);
                    token.transfer(harvestContract.address, depositAmount);

                    await harvestContract.process([], false, []);

                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetup2 = await getStrategyState(harvestContract);
                    stratSetup2.pendingUser.deposit = depositAmount;
                    await setStrategyState(harvestContract, stratSetup2);
                    token.transfer(harvestContract.address, depositAmount);

                    // ACT
                    await harvestContract.process([], true, [{ slippage: 1, path: swapPath }]);

                    // ASSERT
                    const balance = await harvestContract.getStrategyBalance();
                    expect(balance).to.be.greaterWithTolerance(depositAmount.mul(2), BasisPoints.Basis_1);

                    const strategyDetails = await getStrategyState(harvestContract);
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
                    await setStrategyState(harvestContract, stratSetupDeposit);
                    token.transfer(harvestContract.address, depositAmount);
                    await harvestContract.process([], false, []);

                    // set withdraw
                    const stratSetupWithdraw = await getStrategyState(harvestContract);
                    stratSetupWithdraw.pendingUser.deposit = Zero;
                    stratSetupWithdraw.pendingUser.sharesToWithdraw = stratSetupWithdraw.totalShares;
                    await setStrategyState(harvestContract, stratSetupWithdraw);

                    // ACT
                    await harvestContract.process([], false, []);

                    // ASSERT
                    const balance = await harvestContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(harvestContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);
                });

                it("Claim rewards, should claim and swap rewards for the underlying currency", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(harvestContract, stratSetupDeposit);
                    token.transfer(harvestContract.address, depositAmount);
                    await harvestContract.process([], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await harvestContract.claimRewards([{ slippage: 1, path: swapPath }]);

                    // ASSERT
                    const strategyDetails = await getStrategyState(harvestContract);

                    const farm = ERC20__factory.connect(
                        "0xa0246c9032bC3A600820415aE600c6388619A14D",
                        harvestContract.signer
                    );

                    expect(await farm.balanceOf("0x22bB10A016B1eb7bFFD304862051aA3fCe723F74")).to.be.gt(Zero);
                });

                it("Fast withdraw, remove shares", async () => {
                    // ARRANGE

                    // deposit
                    const depositAmount = millionUnits;
                    const stratSetupDeposit = getStrategySetupObject();
                    stratSetupDeposit.pendingUser.deposit = depositAmount;
                    await setStrategyState(harvestContract, stratSetupDeposit);
                    token.transfer(harvestContract.address, depositAmount);
                    await harvestContract.process([], false, []);

                    // mine block, to gain reward
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    const stratSetupWithdraw = await getStrategyState(harvestContract);

                    // ACT
                    await harvestContract.fastWithdraw(
                        stratSetupWithdraw.totalShares,
                        [],
                        [{ slippage: 1, path: swapPath }]
                    );

                    // ASSERT

                    const balance = await harvestContract.getStrategyBalance();
                    expect(balance).to.equal(Zero);

                    const strategyDetails = await getStrategyState(harvestContract);
                    expect(strategyDetails.totalShares).to.equal(Zero);

                    // check if balance is greater than initial, as we claim the rewards as well
                    const daiBalance = await token.balanceOf(harvestContract.address);
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
                    await setStrategyState(harvestContract, stratSetupDeposit);
                    token.transfer(harvestContract.address, depositAmount);
                    await harvestContract.process([], false, []);

                    // add pending deposit
                    const pendingDeposit = millionUnits.div(5);
                    const stratSetupDepositpending = getStrategySetupObject();
                    stratSetupDepositpending.pendingUser.deposit = pendingDeposit;
                    stratSetupDepositpending.pendingUserNext.deposit = pendingDeposit;
                    await setStrategyState(harvestContract, stratSetupDepositpending);

                    const totalPendingDeposit = pendingDeposit.add(pendingDeposit);
                    token.transfer(harvestContract.address, totalPendingDeposit);

                    // mine blocks
                    console.log("mining blocks...");
                    await mineBlocks(100, SECS_DAY);
                    console.log("mined");

                    // ACT
                    await harvestContract.emergencyWithdraw(emergencyRecipient, []);

                    // ASSERT
                    const stratBalance = await harvestContract.getStrategyBalance();
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
