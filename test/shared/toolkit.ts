import {
    ERC20,
    ERC20__factory,
    IERC20__factory,
    IVault__factory,
    MockToken__factory,
    RewardsHelper__factory,
    SlippagesHelper__factory,
    SpoolDoHardWorkReallocationHelper__factory,
    Vault__factory,
} from "../../build/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther } from "ethers/lib/utils";
import {
    BasisPoints,
    getBitwiseProportions,
    getBitwiseStrategies,
    getStrategyIndexes,
    impersonate,
    parseUnits,
    whitelistStrategy,
} from "./utilities";
import { mainnet } from "./constants";
import { BigNumber, BigNumberish, constants, Wallet } from "ethers";
import { Context, NamedVault } from "../../scripts/infrastructure";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { accountsFixture, tokensFixture } from "./fixtures";
import hre, { ethers } from "hardhat";
import { expect } from "chai";

import { loadSpoolInfra, loadVaults, writeContracts } from "../../scripts/deployUtils";

import seedrandom from "seedrandom";

const spoolTokenAddress = "0x40803cea2b2a32bda1be61d3604af6a814e70976";
const spoolTokenHolder = "0xf6bc2e3b1f939c435d9769d078a6e5048aabd463";
var rng = seedrandom("some random seed.", { global: true });

type Snapshot = {
    vaults: {
        [key: string]: VaultSnapshot;
    };
    users: {
        [key: string]: {
            vaults: {
                [key: string]: UserVaultSnapshot;
            };
            assets: {
                [key: string]: UserAssetSnapshot;
            };
        };
    };
};

type VaultSnapshot = {
    totalShares: string;
    totalUnderlying: string;
    depositAmount1: string;
    withdrawShares1: string;
    depositAmount2: string;
    withdrawShares2: string;
    balance: string;
};

type UserAssetSnapshot = {
    balance: string;
};

type UserVaultSnapshot = {
    // user vault values
    shares: string;
    activeDeposit: string;
    owed: string;
    withdrawnDeposits: string;
    userTotalUnderlying: string;
    depositAmount1: string;
    withdrawShares1: string;
    depositAmount2: string;
    withdrawShares2: string;
};

type UserVaultActions = {
    [key: string]: {
        [key: string]: {
            deposit: BigNumber;
            withdrawal: BigNumber;
            claim: boolean;
        };
    };
};

const ASSETS = ["DAI", "USDC", "USDT"];

function getVaultElement(context: Context, vaultName: string): NamedVault {
    if (!context.vaults) {
        throw Error("Vaults not initialized.");
    }

    return context.vaults[vaultName];
}

export async function buildContext(): Promise<Context> {
    let tx: any;
    const accounts = await accountsFixture(hre);
    const tokens = await tokensFixture(accounts.administrator);
    const slippagesHelper = (await new SlippagesHelper__factory().connect(accounts.administrator).deploy()).connect(
        hre.ethers.provider
    );

    const reallocationHelper = (
        await new SpoolDoHardWorkReallocationHelper__factory().connect(accounts.administrator).deploy()
    ).connect(hre.ethers.provider);

    const rewardsHelper = (await new RewardsHelper__factory().connect(accounts.administrator).deploy()).connect(
        hre.ethers.provider
    );

    await writeContracts(hre, {
        slippagesHelper,
        reallocationHelper,
        rewardsHelper,
    });

    const signers = await hre.ethers.getSigners();

    const context: any = {
        accounts,
        tokens,
        strategies: { All: [] },
        infra: await loadSpoolInfra(accounts, hre),
        helperContracts: {
            slippagesHelper: slippagesHelper.address,
            reallocationHelper: reallocationHelper.address,
            rewardsHelper: rewardsHelper.address,
        },
        users: signers.slice(20, 80),
        vaults: await loadVaults(hre),
    };

    const abiCoder = new hre.ethers.utils.AbiCoder();
    let data = abiCoder.encode(["address"], [reallocationHelper.address]);
    await context.infra.proxyAdmin.upgradeAndCall(
        context.infra.strategyRegistry.address,
        reallocationHelper.address,
        data
    );

    data = abiCoder.encode(["address"], [slippagesHelper.address]);
    await context.infra.proxyAdmin.upgradeAndCall(
        context.infra.strategyRegistry.address,
        slippagesHelper.address,
        data
    );

    const strategyNames: any = {
        Aave: "Aave",
        Compound: "Compound",
        Convex: "ConvexShared",
        Curve: "Curve3pool",
        Harvest: "Harvest",
        Idle: "Idle",
        Yearn: "Yearn",
    };

    for (const stratKey of Object.keys(strategyNames)) {
        for (const asset of ["DAI", "USDC", "USDT"]) {
            const stratAddress = (await hre.deployments.get(`${strategyNames[stratKey]}Strategy${asset}`)).address;
            context.strategies[stratKey] = context.strategies[stratKey] || {};
            context.strategies[stratKey][asset] = stratAddress;
            context.strategies["All"].push(stratAddress);
        }
    }

    tx = await context.infra.spool.setDoHardWorker(accounts.doHardWorker.address, true);
    await tx.wait();
    tx = await context.infra.spool.setAllocationProvider(accounts.allocationProvider.address, true);
    await tx.wait();
    tx = await context.infra.controller.setEmergencyWithdrawer(accounts.administrator.address, true);
    await tx.wait();
    tx = await context.infra.controller.setEmergencyRecipient(accounts.administrator.address);
    await tx.wait();

    await whitelistStrategy(context.infra.spool.address);

    return context;
}

export async function doDeposit(
    context: Context,
    user: Wallet | SignerWithAddress,
    vaultName: string,
    amount: string,
    userVaultActions: UserVaultActions,
    transferFromVault: boolean = true
) {
    console.log(context.scope + `>> Depositing vault: ${vaultName}, user: ${user.address}, amount: ${amount}`);

    const vaultElement = getVaultElement(context, vaultName);
    const vault = Vault__factory.connect(vaultElement.address, hre.ethers.provider);
    const underlying_ = context.tokens[vaultElement.underlying];
    const underlying = ERC20__factory.connect(underlying_.address, hre.ethers.provider);
    const decimals = await underlying.decimals();
    const amountInWei = parseUnits(amount, decimals);

    await underlying.connect(user).approve(vault.address, amountInWei);
    await vault.connect(user).deposit(vaultElement.strategies, amountInWei, transferFromVault);

    const userVaultAction = getUserVaultAction(user.address, vaultName, userVaultActions);
    userVaultAction.deposit = userVaultAction.deposit.add(amountInWei);
}

export async function doClaim(
    context: Context,
    users: SignerWithAddress[],
    vaults: string[],
    userVaultActions: UserVaultActions,
    doRedeemVault: boolean = true,
    doRedeemUser: boolean = true
) {
    for (const vaultName of vaults) {
        for (const user of users) {
            console.log(context.scope + `>> Claim vault: ${vaultName}, user: ${user.address}`);
            const vaultElement = getVaultElement(context, vaultName);
            const vault = Vault__factory.connect(vaultElement.address, hre.ethers.provider);
            const tx = await vault.connect(user).claim(doRedeemVault, vaultElement.strategies, doRedeemUser);
            await tx.wait();

            const userVaultAction = getUserVaultAction(user.address, vaultName, userVaultActions);
            userVaultAction.claim = true;
        }
    }
}

export async function doClaimRewards(context: Context, vaults: string[], users: SignerWithAddress[]) {
    for (const vaultName of vaults) {
        for (const user of users) {
            console.log(context.scope + `>> Claim rewards: ${vaultName}, user: ${user.address}`);
            const vaultElement = getVaultElement(context, vaultName);
            const vault = Vault__factory.connect(vaultElement.address, user);

            await vault.getActiveRewards(user.address);
        }
    }
}

export async function doTransferAssetsToWallets(wallets: SignerWithAddress[], value: string) {
    await ethers.provider.send("hardhat_setBalance", [spoolTokenHolder, parseEther("1000").toHexString()]);

    for (const wallet of wallets) {
        await doTransferAssetsToUser(wallet.address, value);
    }
}

export async function doTransferAssetsToUser(userAddress: string, value: string) {
    const constants = mainnet();

    await transferFunds(
        userAddress,
        constants.tokens.DAI.contract.address,
        constants.tokens.DAI.holder,
        value,
        constants.tokens.DAI.units
    );
    await transferFunds(
        userAddress,
        constants.tokens.USDC.contract.delegator.address,
        constants.tokens.USDC.holder,
        value,
        constants.tokens.USDC.units
    );
    await transferFunds(
        userAddress,
        constants.tokens.USDT.contract.address,
        constants.tokens.USDT.holder,
        value,
        constants.tokens.USDT.units
    );
    await transferFunds(userAddress, spoolTokenAddress, spoolTokenHolder, value, 18);
}

export async function transferFunds(
    userAddress: string,
    tokenAddress: string,
    holderAddress: string,
    amount: string,
    units: number
) {
    const holder = await impersonate(holderAddress);
    const token = ERC20__factory.connect(tokenAddress, holder);
    await token.connect(holder).transfer(userAddress, parseUnits(amount, units));
}

export async function doAddVaultRewards(
    context: Context,
    vaultName: string,
    rewardDurationDays: number,
    decimals: number = 18
) {
    const SECS_DAY: number = 86400;
    console.log(context.scope + `>> Add vault rewards, vault: ${vaultName}`);

    const vaultElement = getVaultElement(context, vaultName);
    const vault = Vault__factory.connect(vaultElement.address, context.accounts.administrator);

    const rewardTokensCount = await vault.rewardTokensCount();

    const rewardToken = await new MockToken__factory()
        .connect(context.accounts.administrator)
        .deploy(`Vault Reward Token ${rewardTokensCount}`, `REWARD${rewardTokensCount}`, decimals);

    const rewardDuration = rewardDurationDays * SECS_DAY;
    const rewardAmount = BigNumber.from(rewardDurationDays);
    await rewardToken.approve(vaultElement.address, rewardAmount);
    await vault.addToken(rewardToken.address, rewardDuration, rewardAmount);

    console.log(context.scope + ">> Vault rewards added.");
}

export function getUserVaultActions(): UserVaultActions {
    return {};
}

function getUserVaultAction(userAddress: string, vaultName: string, userVaultAction: UserVaultActions) {
    if (!userVaultAction[userAddress]) {
        userVaultAction[userAddress] = {};
    }

    if (!userVaultAction[userAddress][vaultName]) {
        userVaultAction[userAddress][vaultName] = {
            deposit: constants.Zero,
            withdrawal: constants.Zero,
            claim: false,
        };
    }

    return userVaultAction[userAddress][vaultName];
}

export async function doWithdraw(
    context: Context,
    user: Wallet | SignerWithAddress,
    vaultName: string,
    shares: BigNumberish,
    userVaultActions: UserVaultActions
) {
    console.log(
        context.scope + `>> Withdrawing vault: ${vaultName}, user: ${user.address}, amount: ${shares.toString()}`
    );

    const vaultElement = getVaultElement(context, vaultName);
    const vault = Vault__factory.connect(vaultElement.address, user);
    const tx = await vault.withdraw(vaultElement.strategies, shares, false);
    await tx.wait();

    const userVaultAction = getUserVaultAction(user.address, vaultName, userVaultActions);
    userVaultAction.withdrawal = userVaultAction.withdrawal.add(shares);
}

export async function doWithdrawAll(
    context: Context,
    users: SignerWithAddress[],
    vaults: string[],
    userVaultActions: UserVaultActions
) {
    for (const vaultName of vaults) {
        for (const user of users) {
            console.log(
                context.scope + `>> Withdrawing vault: ${vaultName}, user: ${user.address}, amount: all shares`
            );

            const vaultElement = getVaultElement(context, vaultName);
            const vault = Vault__factory.connect(vaultElement.address, user);
            const userShares = (await vault.callStatic.getUpdatedUser(vaultElement.strategies))[0];

            await vault.withdraw(vaultElement.strategies, 0, true);

            const userVaultAction = getUserVaultAction(user.address, vaultName, userVaultActions);
            userVaultAction.withdrawal = userVaultAction.withdrawal.add(userShares);
        }
    }
}

export async function doDeployVault(
    hre: HardhatRuntimeEnvironment,
    context: Context,
    vaultName: string,
    underlying: "DAI" | "USDC" | "USDT",
    riskTolerance: number = 3,
    vaultFee: number = 2000
): Promise<{ [p: string]: NamedVault }> {
    console.log(context.scope + `>> Deploying vault: ${vaultName}`);

    const strats: number[] = []; // indexes of strats. empty indicates all.
    const proportions: number[] = []; // proportions of each strat. must be same size as strats. empty indicates even proportions.
    const strategies: any = context.strategies;
    let underlyingStrategies = Object.keys(strategies)
        .filter((s) => s != "All")
        .map((key) => strategies[key][underlying]);

    let underlyingStrategiesFiltered =
        strats.length === 0 ? underlyingStrategies : strats.map((index) => underlyingStrategies[index]);

    let proportionsArg: number[] =
        proportions.length === 0
            ? Array(underlyingStrategiesFiltered.length).fill(Math.floor(10000 / underlyingStrategiesFiltered.length))
            : proportions;

    const totalProp = proportionsArg.reduce((sum, prop) => sum + prop, 0);
    proportionsArg[0] += 10000 - totalProp;

    console.log(context.scope + "Vault proportions:");
    console.table(proportionsArg);

    const vaultCreation = {
        underlying: context.tokens[underlying].address,
        strategies: underlyingStrategiesFiltered,
        proportions: proportionsArg,
        creator: context.accounts.administrator.address,
        vaultFee: vaultFee,
        riskProvider: context.accounts.administrator.address,
        riskTolerance: riskTolerance,
        name: vaultName,
    };

    const controller = context.infra.controller;
    const administrator = context.accounts.administrator;
    const vaultAddress = await controller.callStatic.createVault(vaultCreation);

    try {
        await hre.ethers.provider.send("evm_setNextBlockTimestamp", [Math.floor(Date.now() / 1000)]);
    } catch (e) {}

    const vaultCreate = await controller.connect(administrator).createVault(vaultCreation);
    await vaultCreate.wait();

    context.vaults = context.vaults || {};
    context.vaults[vaultName] = {
        address: vaultAddress,
        strategies: underlyingStrategiesFiltered,
        underlying,
    };

    console.log(context.scope + `>> Deployed vault ${vaultName} at ${vaultAddress}.`);
    return context.vaults;
}

/**
 * Limitations:
 * - executed right afer DHW
 * - a user only does only deposits or withdrawals in the same DHW period
 * - vaults do not generate profit
 *
 * @param snapshot1 before user action (DEPOSIT/WITHDRAW)
 * @param snapshot2 after user action (DEPOSIT/WITHDRAW)
 * @param snapshot3 after DHW
 * @param userVaultActions Aggregated actions of a user in a vault
 * @param context Spool contracts and user context
 */
export function assertDoHardWorkSnapshotsPrimitive(
    snapshot1: Snapshot,
    snapshot2: Snapshot,
    snapshot3: Snapshot,
    userVaultActions: UserVaultActions,
    context: Context
) {
    console.log(context.scope + ">> ASSERT: DoHardWork");

    const userVaultSharesSum = Object.keys(snapshot2.vaults).reduce((vaults, vaultNme) => {
        vaults[vaultNme] = constants.Zero;
        return vaults;
    }, {} as { [keys: string]: BigNumber });

    const userSnapshots1 = snapshot1.users;
    const userSnapshots2 = snapshot2.users;
    const userSnapshots3 = snapshot3.users;

    for (const user in userSnapshots2) {
        const vaultsBeforeAction = userSnapshots1[user].vaults;
        const vaults = userSnapshots2[user].vaults;

        console.log(context.scope + `\t>> ASSERT: User: ${user}`);

        for (const vaultName in vaults) {
            const userVaultBeforeAction = vaultsBeforeAction[vaultName];
            const userVaultBefore = vaults[vaultName];
            console.log(`\t\t>> ASSERT: UserVault: ${vaultName}`);
            const userVaultAfter = userSnapshots3[user].vaults[vaultName];

            // check if we deposited
            const depositAmount1 = BigNumber.from(userVaultBefore.depositAmount1);
            if (!depositAmount1.isZero()) {
                console.log(`\t\t\t>> ASSERT: DEPOSITED: ${depositAmount1.toString()}`);

                const underlyingDiff = BigNumber.from(userVaultAfter.userTotalUnderlying).sub(
                    userVaultBefore.userTotalUnderlying
                );
                const activeDepositDiff = BigNumber.from(userVaultAfter.activeDeposit).sub(
                    userVaultBefore.activeDeposit
                );
                const sharesDiff = BigNumber.from(userVaultAfter.shares).sub(userVaultBefore.shares);

                expect(underlyingDiff).to.beCloseTo(
                    depositAmount1,
                    BasisPoints.Basis_3,
                    "Bad user underlying value difference"
                );
                expect(activeDepositDiff).to.beCloseTo(
                    depositAmount1,
                    BasisPoints.Basis_3,
                    "Bad user active deposit difference"
                );
                expect(sharesDiff).to.beCloseTo(depositAmount1, BasisPoints.Basis_3, "Bad user shares difference");
                console.log(`\t\t\t>> ASSERT: DEPOSITED OK`);
            }

            const withdrawShares1 = BigNumber.from(userVaultBefore.withdrawShares1);
            if (!withdrawShares1.isZero()) {
                console.log(`\t\t\t>> ASSERT: WITHDRAWN SHARES: ${withdrawShares1.toString()}`);
                const vaultDetails1 = snapshot1.vaults[vaultName];

                const withdrawAmount = withdrawShares1
                    .mul(vaultDetails1.totalUnderlying)
                    .div(vaultDetails1.totalShares);

                const underlyingDiff = BigNumber.from(userVaultBeforeAction.userTotalUnderlying).sub(
                    userVaultAfter.userTotalUnderlying
                );
                const activeDepositDiff = BigNumber.from(userVaultBefore.activeDeposit).sub(
                    userVaultAfter.activeDeposit
                );
                const sharesDiff = BigNumber.from(userVaultBeforeAction.shares).sub(userVaultAfter.shares);
                const owedDiff = BigNumber.from(userVaultAfter.owed).sub(userVaultBefore.owed);

                expect(underlyingDiff).to.beCloseTo(
                    withdrawAmount,
                    BasisPoints.Basis_3,
                    "Bad user underlying value difference"
                );
                expect(activeDepositDiff).to.beCloseTo(
                    withdrawAmount,
                    BasisPoints.Basis_3,
                    "Bad user active deposit difference"
                );
                expect(sharesDiff).to.beCloseTo(withdrawShares1, BasisPoints.Basis_3, "Bad user shares difference");
                expect(owedDiff).to.beCloseTo(withdrawAmount, BasisPoints.Basis_3, "Bad user owed difference");
                console.log(context.scope + `\t\t\t>> ASSERT: WITHDRAWN OK`);
            }

            if (depositAmount1.isZero() && withdrawShares1.isZero()) {
                expect(BigNumber.from(userVaultAfter.userTotalUnderlying)).to.beCloseTo(
                    userVaultBefore.userTotalUnderlying,
                    BasisPoints.Basis_1,
                    "Bad user underlying value difference"
                );
                expect(BigNumber.from(userVaultAfter.activeDeposit)).to.beCloseTo(
                    userVaultBefore.activeDeposit,
                    BasisPoints.Basis_1,
                    "Bad user active deposit difference"
                );
                expect(BigNumber.from(userVaultAfter.shares)).to.beCloseTo(
                    userVaultBefore.shares,
                    BasisPoints.Basis_1,
                    "Bad user shares difference"
                );
                expect(BigNumber.from(userVaultAfter.owed)).to.beCloseTo(
                    userVaultBefore.owed,
                    BasisPoints.Basis_1,
                    "Bad user owed difference"
                );
            }

            userVaultSharesSum[vaultName] = userVaultSharesSum[vaultName].add(userVaultAfter.shares);
        }
    }

    const vaultSnapshots = snapshot2.vaults;
    for (let vaultName in vaultSnapshots) {
        const vaultBefore = vaultSnapshots[vaultName];
        const vaultAfter = snapshot3.vaults[vaultName];

        const vaultDetails = vaultSnapshots[vaultName];

        console.log(context.scope + `\t>> ASSERT: Vault: ${vaultName}`);
        console.log(`\t\t>> ASSERT: Vault shares: ${vaultAfter.totalShares}`);

        let expectedUnderlyingDiff = constants.Zero;
        let expectedSharesDiff = constants.Zero;

        // check if we deposited
        const depositAmount1 = BigNumber.from(vaultDetails.depositAmount1);
        if (!depositAmount1.isZero()) {
            expectedUnderlyingDiff = expectedUnderlyingDiff.add(depositAmount1);
            expectedSharesDiff = expectedSharesDiff.add(depositAmount1);
        }

        const withdrawShares1 = BigNumber.from(vaultDetails.withdrawShares1);
        let withdrawAmount = constants.Zero;
        if (!withdrawShares1.isZero()) {
            withdrawAmount = withdrawShares1.mul(vaultDetails.totalUnderlying).div(vaultDetails.totalShares);

            expectedUnderlyingDiff = expectedUnderlyingDiff.sub(withdrawAmount);
            expectedSharesDiff = expectedSharesDiff.sub(withdrawShares1);
        }

        if (depositAmount1.isZero() && withdrawShares1.isZero()) {
            expect(BigNumber.from(vaultAfter.totalUnderlying)).to.beCloseTo(
                vaultBefore.totalUnderlying,
                BasisPoints.Basis_1,
                "Bad vault underlying value difference after reallocation"
            );
            expect(BigNumber.from(vaultAfter.totalShares)).to.beCloseTo(
                vaultBefore.totalShares,
                BasisPoints.Basis_1,
                "Bad vault share difference after reallocation"
            );
        } else {
            const underlyingDiff = BigNumber.from(vaultAfter.totalUnderlying).sub(vaultBefore.totalUnderlying);
            const sharesDiff = BigNumber.from(vaultAfter.totalShares).sub(vaultBefore.totalShares);
            expect(underlyingDiff).to.beCloseTo(
                expectedUnderlyingDiff,
                BasisPoints.Basis_3,
                "Bad vault underlying value difference"
            );
            expect(sharesDiff).to.beCloseTo(expectedUnderlyingDiff, BasisPoints.Basis_3, "Bad vault share difference");
        }

        if (!userVaultSharesSum[vaultName].isZero()) {
            expect(userVaultSharesSum[vaultName]).to.be.equalOrLowerCloseTo(
                vaultAfter.totalShares,
                BasisPoints.Basis_01,
                "Bad total vault vs total user share amount"
            );
        } else {
            // account for some dust of shres left in the vault from rounding errors
            expect(BigNumber.from(vaultAfter.totalShares)).to.be.lt(
                500,
                "Bad total vault vs total user share amount when user sum is 0"
            );
        }

        console.log(context.scope + `\t\t>> ASSERT: Vault: OK`);
    }
}

/**
 * Limitations:
 * - executed right afer claim
 * - ONLY WORKS WHEN a user has withdrawn full deposit (can claim multiple times, but users shouldn't have shares anymore at the end)
 * - vaults do not generate profit
 *
 * @param snapshot1 before user CLAIM
 * @param snapshot2 after user CLAIM
 * @param userVaultActions Aggregated actions of a user in a vault
 * @param context Spool contracts and user context
 */
export function assertClaimSnapshotsPrimitive(
    snapshot1: Snapshot,
    snapshot2: Snapshot,
    userVaultActions: UserVaultActions,
    context: Context
) {
    console.log(context.scope + ">> ASSERT: Claim");
    const userSnapshots1 = snapshot1.users;
    const userSnapshots2 = snapshot2.users;

    for (const user in userVaultActions) {
        console.log(context.scope + `\t>> ASSERT: User: ${user}`);

        const balances: any = {
            deposit: { DAI: constants.Zero, USDT: constants.Zero, USDC: constants.Zero },
            withdrawal: { DAI: constants.Zero, USDT: constants.Zero, USDC: constants.Zero },
            owed: { DAI: constants.Zero, USDT: constants.Zero, USDC: constants.Zero },
        };

        if (userVaultActions[user]) {
            for (const vaultName in userVaultActions[user]) {
                console.log(`\t\t>> ASSERT: UserVault: ${vaultName}`);
                const userVaultAction = userVaultActions[user][vaultName];
                console.log(`\t\t\t>> ASSERT: did claim: ${userVaultAction.claim}`);

                if (userVaultAction.claim) {
                    const userVaultAction = userVaultActions[user][vaultName];
                    let deposit = userVaultAction.deposit;
                    const vaultBefore = userSnapshots1[user].vaults[vaultName];
                    const vaultAfter = userSnapshots2[user].vaults[vaultName];

                    // remove deposit from previous DHW, it was not claimed
                    const userTotalUnderlying = BigNumber.from(vaultBefore.userTotalUnderlying);
                    if (!userTotalUnderlying.isZero()) {
                        deposit = deposit.sub(userTotalUnderlying);
                    }

                    const assetName = context.vaults[vaultName].underlying;

                    console.log(`\t\t\t>> ASSERT: assetName: ${assetName}`);
                    console.log(`\t\t\t>> ASSERT: deposit: ${deposit.toString()}`);
                    console.log(`\t\t\t>> ASSERT: userVaultAction.deposit: ${userVaultAction.deposit.toString()}`);
                    console.log(`\t\t\t>> ASSERT: userTotalUnderlyingBefore: ${userTotalUnderlying.toString()}`);
                    console.log(
                        `\t\t\t>> ASSERT: userTotalUnderlyingaAfter: ${BigNumber.from(
                            vaultAfter.userTotalUnderlying
                        ).toString()}`
                    );

                    balances["deposit"][assetName] = balances["deposit"][assetName].add(deposit);
                    balances["withdrawal"][assetName] = balances["withdrawal"][assetName].add(
                        userVaultAction.withdrawal
                    );
                    balances["owed"][assetName] = balances["owed"][assetName].add(vaultBefore.owed);

                    expect(BigNumber.from(vaultAfter.owed)).to.be.equal(0, "Owed amount not 0");
                }
            }

            for (const assetName of ["DAI", "USDC", "USDT"]) {
                const asset1 = userSnapshots1[user].assets[assetName].balance;
                const asset2 = userSnapshots2[user].assets[assetName].balance;
                const userErc20Diff = BigNumber.from(asset2).sub(asset1);

                console.log(`\t\t>> ASSERT: asset1: ${asset1}`);
                console.log(`\t\t>> ASSERT: asset2: ${asset2}`);
                console.log(`\t\t>> ASSERT: userErc20Diff: ${userErc20Diff.toString()}`);

                expect(balances.deposit[assetName]).to.beCloseTo(
                    userErc20Diff,
                    BasisPoints.Basis_3,
                    "Bad user claim deposit amount"
                );
                expect(balances.withdrawal[assetName]).to.beCloseTo(
                    userErc20Diff,
                    BasisPoints.Basis_3,
                    "Bad user claim withdraw amount"
                );
                expect(balances.owed[assetName]).to.beCloseTo(
                    userErc20Diff,
                    BasisPoints.Basis_3,
                    "Bad user claim owed amount"
                );
            }
        }
    }
}

export async function doBalanceSnapshot(
    context: Context,
    users: SignerWithAddress[],
    vaults: string[],
    userVaultActions: UserVaultActions
): Promise<Snapshot> {
    console.log(context.scope + ">> MAKING A SNAPSHOT");
    const snapshot: Snapshot = {
        vaults: {},
        users: {},
    };

    const vaultSnapshots = snapshot.vaults;
    for (let vaultName of vaults) {
        const vaultDetails = context.vaults[vaultName];
        const vault = Vault__factory.connect(vaultDetails.address, ethers.provider);
        const balance = await getVaultBalance(vaultDetails.address);
        const data = await vault.callStatic.getUpdatedVault(vaultDetails.strategies);

        vaultSnapshots[vaultName] = {
            totalUnderlying: data[0].toString(),
            totalShares: data[1].toString(),
            depositAmount1: data[2].toString(),
            withdrawShares1: data[3].toString(),
            depositAmount2: data[4].toString(),
            withdrawShares2: data[5].toString(),
            balance: balance.toString(),
        };
    }

    const userSnapshots = snapshot.users;
    await Promise.all(
        users.map(async (user) => {
            userSnapshots[user.address] = {
                vaults: {},
                assets: {},
            };

            const userVaults = userVaultActions[user.address];
            for (let vaultName in userVaults) {
                const vaultDetails = context.vaults[vaultName];
                const vault = Vault__factory.connect(vaultDetails.address, ethers.provider);
                const data = await vault.callStatic.getUpdatedUser(vaultDetails.strategies, { from: user.address });

                userSnapshots[user.address].vaults[vaultName] = {
                    shares: data[0].toString(),
                    activeDeposit: data[1].toString(),
                    owed: data[2].toString(),
                    withdrawnDeposits: data[3].toString(),
                    userTotalUnderlying: data[4].toString(),
                    depositAmount1: data[5].toString(),
                    withdrawShares1: data[6].toString(),
                    depositAmount2: data[7].toString(),
                    withdrawShares2: data[8].toString(),
                };
            }

            for (const assetKey of ASSETS) {
                const token: ERC20 = (context.tokens as any)[assetKey];
                const balance = await token.balanceOf(user.address);
                userSnapshots[user.address].assets[assetKey] = { balance: balance.toString() };
            }
        })
    );

    return snapshot;
}

async function getVaultBalance(vaultAddress: string) {
    const vault = IVault__factory.connect(vaultAddress, ethers.provider);
    const tokenAddress = await vault.underlying();
    const token = IERC20__factory.connect(tokenAddress, ethers.provider);
    const balance = await token.balanceOf(vaultAddress);
    return balance;
}

export function getRandomItem<T>(items: Array<T>): T {
    return items[Math.floor(Math.random() * items.length)];
}

export function getRandomItems<T>(items: Array<T>, count: number): T[] {
    const result: T[] = [];
    if (count > items.length) {
        throw new Error(`Cannot get ${count} elements, items list has total of ${items.length} elements`);
    } else if (count == items.length) {
        return items;
    }

    let i = 0;
    while (i < count) {
        const item = getRandomItem(items);
        if (!result.includes(item)) {
            result.push(item);
            i++;
        }
    }

    return result;
}

export function getRandomAmount(min: number, max: number) {
    return Math.floor(Math.random() * max) + min;
}

export function getRandomAmountBN(min: BigNumberish, max: BigNumberish) {
    return BigNumber.from(max)
        .sub(min)
        .mul(Math.floor(Math.random() * 1000))
        .div(1000)
        .add(min);
}

export async function doEvmRevert(snapshotId: string) {
    if (snapshotId) {
        console.log(">> Reverting to snapshot", snapshotId);
        await ethers.provider.send("evm_revert", [snapshotId]);
    }
}

export async function doEvmSnapshot() {
    const snapshotId = await ethers.provider.send("evm_snapshot", []);
    console.log(">> Created a snapshot:", snapshotId);
    return snapshotId;
}

export async function reallocateVaultEqual(context: Context, vaultNames: string[]) {
    const vaults = [];

    for (let vaultName of vaultNames) {
        const vault = context.vaults[vaultName];
        const vaultStratIndexes = getStrategyIndexes(vault.strategies, context.strategies.All);
        const newProportions = [1429, 1429, 1429, 1429, 1428, 1428, 1428];

        vaults.push({
            vault: vault.address,
            strategiesCount: vaultStratIndexes.length, // strategies count
            strategiesBitwise: getBitwiseStrategies(vaultStratIndexes).toString(),
            newProportions: getBitwiseProportions(newProportions).toString(),
        });
    }

    const empty2dArray = [[]];

    const reallocationTable = await context.infra.spool
        .connect(context.accounts.allocationProvider)
        .callStatic.reallocateVaults(vaults, context.strategies.All, empty2dArray);

    const tx = await context.infra.spool
        .connect(context.accounts.allocationProvider)
        .reallocateVaults(vaults, context.strategies.All, empty2dArray);

    await tx.wait();

    return reallocationTable;
}

export async function addRewards(
    context: Context,
    vaults: string[],
    user: SignerWithAddress,
    hre: HardhatRuntimeEnvironment
) {
    const spoolHolder = "0xf6bc2e3b1f939c435d9769d078a6e5048aabd463";
    const spoolTokenAddress = "0x40803cea2b2a32bda1be61d3604af6a814e70976";
    const spoolHolderSigner = await impersonate(spoolHolder);
    const rewardToken = ERC20__factory.connect(spoolTokenAddress, spoolHolderSigner);
    const tx = await rewardToken.transfer(user.address, hre.ethers.utils.parseEther("100"));
    await tx.wait();

    for (let vaultName of vaults) {
        const vault = Vault__factory.connect(context.vaults[vaultName].address, user);
        const rewardDuration = 30 * 60 * 60 * 24;
        const rewardAmount = hre.ethers.utils.parseEther("166666");
        await rewardToken.connect(user).approve(vault.address, rewardAmount);
        await vault.addToken(rewardToken.address, rewardDuration, rewardAmount);
    }
}
