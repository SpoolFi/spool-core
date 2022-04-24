import { expect, use } from "chai";
import { BigNumber } from "ethers";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import { deploymentFixture } from "./shared/fixtures";
import {
    BasisPoints,
    createVault,
    customConstants,
    getBitwiseProportions,
    getBitwiseStrategies,
    getProportionsFromBitwise,
    getStrategyIndexes,
    reset,
    setReallocationTable,
    TEN_UNITS_E8,
    TestContext,
    VaultDetailsStruct,
} from "./shared/utilities";
import { Vault } from "../build/types";

const { MaxUint128 } = customConstants;

use(solidity);

const myProvider = new MockProvider();
let loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

describe("Vault Reallocation", () => {
    describe("Reallocation one side test", () => {
        let vault: Vault;
        let vaultCreation: VaultDetailsStruct;
        const context: TestContext = {
            reallocationTable: [],
        };

        before(async () => {
            await reset();
            console.log("getting deployment..");
            loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);
            const { accounts, tokens, spool, strategies } = await loadFixture(deploymentFixture);

            await spool.riskProviderRegistry.addProvider(accounts.riskProvider.address, 0);

            vaultCreation = {
                underlying: tokens.USDC.address,
                strategies: [
                    strategies.chefStrategiesNoRewards[0].address,
                    strategies.chefStrategiesNoRewards[1].address,
                ],
                proportions: [6000, 4000],
                creator: accounts.rewardNotifier.address,
                vaultFee: 2000,
                riskProvider: accounts.riskProvider.address,
                riskTolerance: 0,
                name: "Test",
            };

            console.log("create vault..");
            vault = await createVault(spool.controller, vaultCreation, accounts.rewardNotifier);

            // user 0 deposit
            await tokens.USDC.transfer(accounts.user0.address, TEN_UNITS_E8);
            await tokens.USDC.connect(accounts.user0).approve(vault.address, TEN_UNITS_E8);
            await vault.connect(accounts.user0).deposit(vaultCreation.strategies, TEN_UNITS_E8, true);

            // user 1 deposit
            await tokens.USDC.transfer(accounts.user1.address, TEN_UNITS_E8);
            await tokens.USDC.connect(accounts.user1).approve(vault.address, TEN_UNITS_E8);
            await vault.connect(accounts.user1).deposit(vaultCreation.strategies, TEN_UNITS_E8, true);

            const stratIndexes = [...Array(strategies.strategyAddresses.length).keys()];
            const slippages = Array.from(Array(strategies.strategyAddresses.length), () => []);

            const rewardSlippages = Array.from(Array(strategies.strategyAddresses.length), () => {
                return { doClaim: false, swapData: [{ slippage: 0, path: [] }] };
            });

            await spool.spool
                .connect(accounts.doHardWorker)
                .batchDoHardWork(stratIndexes, slippages, rewardSlippages, strategies.strategyAddresses);
        });

        it("should initialize reallocation for vault", async () => {
            const { accounts, tokens, spool, strategies } = await loadFixture(deploymentFixture);

            const newProportions = [4000, 6000];
            const vaultStratIndex = getStrategyIndexes(vaultCreation.strategies, strategies.strategyAddresses);

            const vaults = [
                {
                    vault: vault.address,
                    strategiesCount: vaultStratIndex.length, // strategies count
                    strategiesBitwise: getBitwiseStrategies(vaultStratIndex).toString(),
                    newProportions: getBitwiseProportions(newProportions).toString(),
                },
            ];

            const empty2dArray = [[]];

            const tx = await spool.spool
                .connect(accounts.allocationProvider)
                .reallocateVaults(vaults, strategies.strategyAddresses, empty2dArray);

            await setReallocationTable(tx, spool.spool, context);

            const bitwiseProportions = await vault.proportions();
            let proportions = getProportionsFromBitwise(bitwiseProportions, vaultCreation.strategies.length);

            expect(proportions[0]).to.equal(newProportions[0].toString());
            expect(proportions[1]).to.equal(newProportions[1].toString());

            const totalDeposit = TEN_UNITS_E8.add(TEN_UNITS_E8);

            const totalDepositS0 = totalDeposit.mul(BigNumber.from(6000)).div(BigNumber.from(10000));
            const totalDepositS1 = totalDeposit.mul(BigNumber.from(4000)).div(BigNumber.from(10000));

            expect(await spool.spool.callStatic.getStratUnderlying(vaultCreation.strategies[0])).to.be.closeTo(
                totalDepositS0,
                10
            );
            expect(await spool.spool.callStatic.getStratUnderlying(vaultCreation.strategies[1])).to.be.closeTo(
                totalDepositS1,
                10
            );
        });

        it("should revert withdrawing while reallocating", async () => {
            await expect(vault.withdraw(vaultCreation.strategies, 0, true)).to.be.revertedWith("NRED");
        });

        it("should execute doHardWork after reallocation", async () => {
            const { accounts, tokens, spool, strategies } = await loadFixture(deploymentFixture);

            const stratIndexes = getStrategyIndexes(strategies.strategyAddresses, strategies.strategyAddresses);
            const slippages = Array.from(Array(strategies.strategyAddresses.length), () => []);

            const priceSlippages = Array.from(Array(strategies.strategyAddresses.length), () => {
                return { min: 0, max: MaxUint128 };
            });

            const rewardSlippages = Array.from(Array(strategies.strategyAddresses.length), () => {
                return { doClaim: false, swapData: [] };
            });

            const withdrawData = {
                reallocationTable: context.reallocationTable,
                priceSlippages: priceSlippages,
                rewardSlippages: rewardSlippages,
                stratIndexes: stratIndexes,
                slippages: slippages,
            };

            const depositData = {
                stratIndexes: stratIndexes,
                slippages: slippages,
            };

            await spool.spool
                .connect(accounts.doHardWorker)
                .batchDoHardWorkReallocation(withdrawData, depositData, strategies.strategyAddresses, true);

            const totalDeposit = TEN_UNITS_E8.add(TEN_UNITS_E8);

            const totalDepositS0 = totalDeposit.mul(BigNumber.from(4000)).div(BigNumber.from(10000));
            const totalDepositS1 = totalDeposit.mul(BigNumber.from(6000)).div(BigNumber.from(10000));

            expect(await spool.spool.callStatic.getStratUnderlying(vaultCreation.strategies[0])).to.beCloseTo(
                totalDepositS0,
                BasisPoints.Basis_1
            );
            expect(await spool.spool.callStatic.getStratUnderlying(vaultCreation.strategies[1])).to.beCloseTo(
                totalDepositS1,
                BasisPoints.Basis_1
            );
        });

        it("should claim vault shares after dhw", async () => {
            const { accounts, tokens, spool, strategies } = await loadFixture(deploymentFixture);

            await vault.connect(accounts.user0).redeemVaultStrategies(vaultCreation.strategies);

            const strat0 = await spool.spool.strategies(vaultCreation.strategies[0]);
            const strat1 = await spool.spool.strategies(vaultCreation.strategies[1]);

            const vaultStratShares0 = await spool.spool.getStratVaultShares(vaultCreation.strategies[0], vault.address);
            const vaultStratShares1 = await spool.spool.getStratVaultShares(vaultCreation.strategies[1], vault.address);
            const stratUnderlying0 = await spool.spool.callStatic.getStratUnderlying(vaultCreation.strategies[0]);
            const stratUnderlying1 = await spool.spool.callStatic.getStratUnderlying(vaultCreation.strategies[1]);

            const totalDeposit = TEN_UNITS_E8.add(TEN_UNITS_E8);

            const totalDeposit0 = totalDeposit.mul(BigNumber.from(4000)).div(BigNumber.from(10000));
            const totalDeposit1 = totalDeposit.mul(BigNumber.from(6000)).div(BigNumber.from(10000));

            expect(strat0.totalShares).to.beCloseTo(vaultStratShares0, BasisPoints.Basis_3);
            expect(strat1.totalShares).to.beCloseTo(vaultStratShares1, BasisPoints.Basis_3);
            expect(stratUnderlying0).to.beCloseTo(totalDeposit0, BasisPoints.Basis_1);
            expect(stratUnderlying1).to.beCloseTo(totalDeposit1, BasisPoints.Basis_1);
        });
    });

    describe("Reallocation optimize test", () => {
        let vault0: Vault;
        let vault0Creation: VaultDetailsStruct;
        let vault1: Vault;
        let vault1Creation: VaultDetailsStruct;
        let depositPerStrat: BigNumber;
        const context: TestContext = {
            reallocationTable: [],
        };

        before(async () => {
            await reset();
            console.log("getting deployment..");
            loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);
            const { accounts, tokens, spool, strategies } = await loadFixture(deploymentFixture);

            await spool.riskProviderRegistry.addProvider(accounts.riskProvider.address, 0);

            // SETUP VAULT 0
            vault0Creation = {
                underlying: tokens.USDC.address,
                strategies: [strategies.chefStrategiesFees[0].address, strategies.chefStrategiesFees[1].address],
                proportions: [6000, 4000],
                creator: accounts.rewardNotifier.address,
                vaultFee: 2000,
                riskProvider: accounts.riskProvider.address,
                riskTolerance: 0,
                name: "Test",
            };

            console.log("strat0:", vault0Creation.strategies[0]);
            console.log("strat1:", vault0Creation.strategies[1]);

            console.log("create vault 0..");
            vault0 = await createVault(spool.controller, vault0Creation, accounts.rewardNotifier);

            // user 0 deposit
            await tokens.USDC.transfer(accounts.user0.address, TEN_UNITS_E8);
            await tokens.USDC.connect(accounts.user0).approve(vault0.address, TEN_UNITS_E8);
            await vault0.connect(accounts.user0).deposit(vault0Creation.strategies, TEN_UNITS_E8, true);

            // user 1 deposit
            await tokens.USDC.transfer(accounts.user1.address, TEN_UNITS_E8);
            await tokens.USDC.connect(accounts.user1).approve(vault0.address, TEN_UNITS_E8);
            await vault0.connect(accounts.user1).deposit(vault0Creation.strategies, TEN_UNITS_E8, true);

            // SETUP VAULT 1
            vault1Creation = {
                underlying: tokens.USDC.address,
                strategies: [strategies.chefStrategiesFees[0].address, strategies.chefStrategiesFees[1].address],
                proportions: [4000, 6000],
                creator: accounts.rewardNotifier.address,
                vaultFee: 2000,
                riskProvider: accounts.riskProvider.address,
                riskTolerance: 0,
                name: "Test",
            };

            console.log("create vault 1..");
            vault1 = await createVault(spool.controller, vault1Creation, accounts.rewardNotifier);

            // user 2 deposit
            const user2DepositAmount = TEN_UNITS_E8.mul(2);
            await tokens.USDC.transfer(accounts.user2.address, user2DepositAmount);
            await tokens.USDC.connect(accounts.user2).approve(vault1.address, user2DepositAmount);
            await vault1.connect(accounts.user2).deposit(vault1Creation.strategies, user2DepositAmount, true);

            // DO HARD WORK
            const stratIndexes = [...Array(strategies.strategyAddresses.length).keys()];
            const slippages = Array.from(Array(strategies.strategyAddresses.length), () => []);
            const rewardSlippages = Array.from(Array(strategies.strategyAddresses.length), () => {
                return { doClaim: false, swapData: [] };
            });

            await spool.spool
                .connect(accounts.doHardWorker)
                .batchDoHardWork(stratIndexes, slippages, rewardSlippages, strategies.strategyAddresses);

            depositPerStrat = TEN_UNITS_E8.mul(2);

            expect(await spool.spool.callStatic.getStratUnderlying(vault0Creation.strategies[0])).to.equal(
                depositPerStrat
            );
            expect(await spool.spool.callStatic.getStratUnderlying(vault0Creation.strategies[1])).to.equal(
                depositPerStrat
            );
        });

        it("should initialize reallocation for both vaults (same amounts in opposite direction)", async () => {
            const { accounts, tokens, spool, strategies } = await loadFixture(deploymentFixture);

            const vaultStratIndexes = getStrategyIndexes(vault0Creation.strategies, strategies.strategyAddresses);

            const newProportions0 = [4000, 6000];
            const newProportions1 = [6000, 4000];

            vault0Creation.proportions = newProportions0;
            vault1Creation.proportions = newProportions1;

            const vaults = [
                {
                    vault: vault0.address,
                    strategiesCount: vaultStratIndexes.length, // strategies count
                    strategiesBitwise: getBitwiseStrategies(vaultStratIndexes).toString(),
                    newProportions: getBitwiseProportions(newProportions0).toString(),
                },
                {
                    vault: vault1.address,
                    strategiesCount: vaultStratIndexes.length, // strategies count
                    strategiesBitwise: getBitwiseStrategies(vaultStratIndexes).toString(),
                    newProportions: getBitwiseProportions(newProportions1).toString(),
                },
            ];

            const empty2dArray = [[]];

            const tx = await spool.spool
                .connect(accounts.allocationProvider)
                .reallocateVaults(vaults, strategies.strategyAddresses, empty2dArray);

            await setReallocationTable(tx, spool.spool, context);
        });

        it("doHardWork, vaults should exchange shares, without getting hit by the fee", async () => {
            const { accounts, tokens, spool, strategies } = await loadFixture(deploymentFixture);

            const stratIndexes = getStrategyIndexes(strategies.strategyAddresses, strategies.strategyAddresses);
            const slippages = Array.from(Array(strategies.strategyAddresses.length), () => []);

            const priceSlippages = Array.from(Array(strategies.strategyAddresses.length), () => {
                return { min: 0, max: MaxUint128 };
            });

            const rewardSlippages = Array.from(Array(strategies.strategyAddresses.length), () => {
                return { doClaim: false, swapData: [] };
            });

            const withdrawData = {
                reallocationTable: context.reallocationTable,
                priceSlippages: priceSlippages,
                rewardSlippages: rewardSlippages,
                stratIndexes: stratIndexes,
                slippages: slippages,
            };

            const depositData = {
                stratIndexes: stratIndexes,
                slippages: slippages,
            };

            await spool.spool
                .connect(accounts.doHardWorker)
                .batchDoHardWorkReallocation(withdrawData, depositData, strategies.strategyAddresses, true);

            expect(await spool.spool.callStatic.getStratUnderlying(vault0Creation.strategies[0])).to.be.closeTo(
                depositPerStrat,
                1
            );
            expect(await spool.spool.callStatic.getStratUnderlying(vault0Creation.strategies[1])).to.be.closeTo(
                depositPerStrat,
                1
            );
        });

        it("strategies should have same amount of shares after reallocation", async () => {
            const { accounts, tokens, spool, strategies } = await loadFixture(deploymentFixture);
            
            const stratUnderlying0 = await spool.spool.callStatic.getStratUnderlying(vault0Creation.strategies[0]);
            const stratUnderlying1 = await spool.spool.callStatic.getStratUnderlying(vault0Creation.strategies[1]);
            
            expect(stratUnderlying0).to.beCloseTo(depositPerStrat, BasisPoints.Basis_01);
            expect(stratUnderlying1).to.beCloseTo(depositPerStrat, BasisPoints.Basis_01);
        });

        it("should claim vault0 shares after dhw", async () => {
            const { accounts, tokens, spool, strategies } = await loadFixture(deploymentFixture);

            await vault0.connect(accounts.user0).redeemVaultStrategies(vault0Creation.strategies);


            const vaultStratShares0 = await spool.spool.getStratVaultShares(
                vault0Creation.strategies[0],
                vault0.address
            );
            const vaultStratShares1 = await spool.spool.getStratVaultShares(
                vault0Creation.strategies[1],
                vault0.address
            );

            const strat0 = await spool.spool.strategies(vault0Creation.strategies[0]);
            const strat1 = await spool.spool.strategies(vault0Creation.strategies[1]);

            const totalVaultShares0 = strat0.totalShares.mul(BigNumber.from(4000)).div(BigNumber.from(10000));
            const totalVaultShares1 = strat1.totalShares.mul(BigNumber.from(6000)).div(BigNumber.from(10000));

            expect(vaultStratShares0).to.beCloseTo(totalVaultShares0, BasisPoints.Basis_1);
            expect(vaultStratShares1).to.beCloseTo(totalVaultShares1, BasisPoints.Basis_1);
        });

        it("should claim vault1 shares after dhw", async () => {
            const { accounts, spool } = await loadFixture(deploymentFixture);

            await vault1.connect(accounts.user0).redeemVaultStrategies(vault1Creation.strategies);

            const vaultStratShares0 = await spool.spool.getStratVaultShares(
                vault1Creation.strategies[0],
                vault1.address
            );
            const vaultStratShares1 = await spool.spool.getStratVaultShares(
                vault1Creation.strategies[1],
                vault1.address
            );

            const strat0 = await spool.spool.strategies(vault1Creation.strategies[0]);
            const strat1 = await spool.spool.strategies(vault1Creation.strategies[1]);

            const totalVaultShares0 = strat0.totalShares.mul(BigNumber.from(6000)).div(BigNumber.from(10000));
            const totalVaultShares1 = strat1.totalShares.mul(BigNumber.from(4000)).div(BigNumber.from(10000));

            expect(vaultStratShares0).to.beCloseTo(totalVaultShares0, BasisPoints.Basis_1);
            expect(vaultStratShares1).to.beCloseTo(totalVaultShares1, BasisPoints.Basis_1);
        });
    });
});
