import { use } from "chai";
import { solidity } from "ethereum-waffle";
import { Context } from "../../scripts/infrastructure";
import {
    assertClaimSnapshotsPrimitive,
    assertDoHardWorkSnapshotsPrimitive,
    assertVaultStrategyProportions,
    buildContext,
    doBalanceSnapshot,
    doClaim,
    doDeposit,
    doEvmRevert,
    doEvmSnapshot,
    doWithdrawAll,
    getRandomAmount,
    getRandomItems,
    getUserVaultActions,
    printReallocationTable,
    printStrategyBalances,
    reallocateVaultsEqual,
} from "../shared/toolkit";
import { doHardWork, doHardWorkReallocation } from "../shared/toolkit.dhw";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

use(solidity);

const VAULTS: any = {
    DAIHigherRisk: "Genesis Spool DAI Higher Risk",
    DAILowerRisk: "Genesis Spool DAI Lower Risk",
    USDCHigherRisk: "Genesis Spool USDC Higher Risk",
    USDCLowerRisk: "Genesis Spool USDC Lower Risk",
    USDTHigherRisk: "Genesis Spool USDT Higher Risk",
    USDTLowerRisk: "Genesis Spool USDT Lower Risk",
};

const VAULT_NAMES: string[] = Object.keys(VAULTS).map((key: string) => VAULTS[key]);

describe("Flow 0 [ @skip-on-coverage ]", function () {
    let context: Context;
    let snapshotId: string;

    beforeEach("load fixtures", async function () {
        snapshotId = await doEvmSnapshot();
        context = await buildContext();
    });

    afterEach("Reset to snapshot", async function () {
        await doEvmRevert(snapshotId);
    });

    describe("Scenario 1.1", function () {
        it("Should deposit and withdraw (single vault, simple)", async function () {
            context.scope = "Scenario 1.1";
            const vaults = getRandomItems(VAULT_NAMES, 1);
            const users = getRandomItems(context.users, 2);
            await testVaultDepositWithdrawClaimSimple(context, vaults, users, false);
        });
    });

    describe("Scenario 1.2", function () {
        it("Should deposit and withdraw (multiple vaults, simple)", async function () {
            context.scope = "Scenario 1.2";
            const vaults = getRandomItems(VAULT_NAMES, 3);
            const users = getRandomItems(context.users, 20);
            await testVaultDepositWithdrawClaimSimple(context, vaults, users, false);
        });
    });

    describe("Scenario 2", function () {
        it("Should deposit and withdraw (single vault, simple, deposit twice)", async function () {
            context.scope = "Scenario 2";
            const vaults = getRandomItems(VAULT_NAMES, 1);
            const users = getRandomItems(context.users, 20);
            await testVaultDepositWithdrawClaimSimple(context, vaults, users, true);
        });
    });

    describe("Scenario 3.1", function () {
        it("Should deposit and withdraw (single random vault)", async function () {
            context.scope = "Scenario 3.1";
            const vaults = getRandomItems(VAULT_NAMES, 1);
            const users = getRandomItems(context.users, 30);
            await testVaultDepositWithdrawClaim(context, vaults, users);
        });
    });

    describe("Scenario 3.2", function () {
        it("Should deposit and withdraw (all vaults)", async function () {
            context.scope = "Scenario 3.2";
            const users = getRandomItems(context.users, 10);
            await testVaultDepositWithdrawClaim(context, VAULT_NAMES, users);
        });
    });

    describe("Scenario 3.3", function () {
        it("Should deposit and withdraw (few vaults))", async function () {
            context.scope = "Scenario 3.3";
            const users = getRandomItems(context.users, 10);
            const vaults = getRandomItems(VAULT_NAMES, 3);
            await testVaultDepositWithdrawClaim(context, vaults, users);
        });
    });

    describe("Scenario 4.1", function () {
        it("Should deposit and reallocate (single vault)", async function () {
            context.scope = "Scenario 4.1";
            const vaults = getRandomItems(VAULT_NAMES, 1);
            const users = getRandomItems(context.users, 10);
            await testVaultDepositReallocateWithdrawClaim(context, vaults, users);
        });
    });

    describe("Scenario 4.2", function () {
        it("Should deposit and reallocate (all vaults)", async function () {
            context.scope = "Scenario 4.2";
            const users = getRandomItems(context.users, 20);
            await testVaultDepositReallocateWithdrawClaim(context, VAULT_NAMES, users);
        });
    });
});

async function testVaultDepositWithdrawClaimSimple(
    context: Context,
    vaults: string[],
    users: SignerWithAddress[],
    depositTwice: boolean
) {
    // ARRANGE
    const balances = users.map(() => getRandomAmount(100, 100_000));
    const userVaultActions = getUserVaultActions();

    const s1 = await doBalanceSnapshot(context, users, vaults, userVaultActions);

    // ACT
    for (const vaultName of vaults) {
        for (let i = 0; i < users.length; i++) {
            await doDeposit(context, users[i], vaultName, balances[i].toString(), userVaultActions);

            if (depositTwice && Math.random() > 0.5) {
                const secondDeposit = getRandomAmount(1_000, 100_000);
                await doDeposit(context, users[i], vaultName, secondDeposit.toString(), userVaultActions);
                balances[i] += secondDeposit;
            }
        }
    }

    const s2 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    await doHardWork(context, true);
    const s3 = await doBalanceSnapshot(context, users, vaults, userVaultActions);

    assertDoHardWorkSnapshotsPrimitive(s1, s2, s3, userVaultActions, context);
    assertVaultStrategyProportions(s3, context);

    await doWithdrawAll(context, users, vaults, userVaultActions);

    const s4 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    await doHardWork(context, false);
    const s5 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    assertDoHardWorkSnapshotsPrimitive(s3, s4, s5, userVaultActions, context);

    await doClaim(context, users, vaults, userVaultActions);

    const s6 = await doBalanceSnapshot(context, users, vaults, userVaultActions);

    assertClaimSnapshotsPrimitive(s5, s6, userVaultActions, context);
}

async function testVaultDepositWithdrawClaim(context: Context, vaults: string[], users: SignerWithAddress[]) {
    // ARRANGE
    const balances1 = users.map(() => getRandomAmount(10_000, 100_000).toString());
    const userVaultActions = getUserVaultActions();

    const s1 = await doBalanceSnapshot(context, users, vaults, userVaultActions);

    // ACT
    for (const vaultName of vaults) {
        for (let i = 0; i < users.length; i++) {
            await doDeposit(context, users[i], vaultName, balances1[i], userVaultActions);
        }
    }

    const s2 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    await doHardWork(context, false);
    const s3 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    assertDoHardWorkSnapshotsPrimitive(s1, s2, s3, userVaultActions, context);
    assertVaultStrategyProportions(s3, context);

    const balances2 = users.map(() => getRandomAmount(10_000, 100_000).toString());

    for (const vaultName of vaults) {
        for (let i = 0; i < users.length; i++) {
            await doDeposit(context, users[i], vaultName, balances2[i], userVaultActions);
        }
    }

    const s4 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    await doHardWork(context, false);
    const s5 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    assertDoHardWorkSnapshotsPrimitive(s3, s4, s5, userVaultActions, context);
    assertVaultStrategyProportions(s5, context);

    await doWithdrawAll(context, users, vaults, userVaultActions);

    const s6 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    await doHardWork(context, false);
    const s7 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    assertDoHardWorkSnapshotsPrimitive(s5, s6, s7, userVaultActions, context);

    await doClaim(context, users, vaults, userVaultActions);

    const s8 = await doBalanceSnapshot(context, users, vaults, userVaultActions);

    assertClaimSnapshotsPrimitive(s7, s8, userVaultActions, context);
}

async function testVaultDepositReallocateWithdrawClaim(context: Context, vaults: string[], users: SignerWithAddress[]) {
    // ARRANGE
    const userVaultActions = getUserVaultActions();

    const s1 = await doBalanceSnapshot(context, users, vaults, userVaultActions);

    // ACT
    for (const vaultName of vaults) {
        for (let i = 0; i < users.length; i++) {
            const deposit = getRandomAmount(1_000, 100_000).toString();
            await doDeposit(context, users[i], vaultName, deposit, userVaultActions);
        }
    }

    const s2 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    await doHardWork(context, false);
    const s3 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    assertDoHardWorkSnapshotsPrimitive(s1, s2, s3, userVaultActions, context);
    assertVaultStrategyProportions(s3, context);

    const reallocationTable = await reallocateVaultsEqual(context, vaults);
    printReallocationTable(reallocationTable);

    await doHardWorkReallocation(context, false, reallocationTable);
    const s4 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    // reallocation DHW
    assertDoHardWorkSnapshotsPrimitive(s3, s3, s4, userVaultActions, context);
    assertVaultStrategyProportions(s4, context);
    await printStrategyBalances(context);

    await doWithdrawAll(context, users, vaults, userVaultActions);

    const s5 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    await doHardWork(context, false);
    const s6 = await doBalanceSnapshot(context, users, vaults, userVaultActions);

    assertDoHardWorkSnapshotsPrimitive(s4, s5, s6, userVaultActions, context);

    await doClaim(context, users, vaults, userVaultActions);

    const s7 = await doBalanceSnapshot(context, users, vaults, userVaultActions);

    assertClaimSnapshotsPrimitive(s6, s7, userVaultActions, context);
}
