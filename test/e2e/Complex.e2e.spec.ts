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
    doDeposits,
    doEvmRevert,
    doEvmSnapshot,
    doWithdrawAll,
    doWithdrawRandom,
    getRandomAmount,
    getRandomItems,
    getUserVaultActions,
    printReallocationTable,
    printStrategyBalances,
    reallocateVaults,
    reallocateVaultsEqual,
    REALLOCATION_TYPE,
    sliceElements,
    UserVaultActions,
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

describe("Complex End to End Tests [ @skip-on-coverage ]", function () {
    let context: Context;
    let snapshotId: string;

    beforeEach("load fixtures", async function () {
        snapshotId = await doEvmSnapshot();
        context = await buildContext();

        console.log("Strats");
        const stratNames = Object.keys(context.strategies[context.network])
            .filter((s) => s != "All")
            .flatMap((s) => Object.keys((context.strategies[context.network] as any)[s]).map((st) => s + st));

        console.table(stratNames.map((stratName, i) => [stratName, context.strategies[context.network].All[i]]));
    });

    afterEach("Reset to snapshot", async function () {
        await doEvmRevert(snapshotId);
    });

    describe("Scenario Complex 1.1", function () {
        it("Should deposit and withdraw (single vault, simple)", async function () {
            context.scope = "Scenario Complex 1.1";
            const users = getRandomItems(context.users, 10);
            await testVaultDepositandWithdrawInTheSameIndex(context, [VAULT_NAMES[0]], users);
        });
    });

    describe("Scenario Complex 2.1", function () {
        it("Should deposit, withdraw and reallocate simultaneously", async function () {
            context.scope = "Scenario Complex 2.1";
            await depositWithdrawReallocateSimultaniously(context, VAULT_NAMES);
        });
    });

    describe("Scenario Complex 3.1", function () {
        it("Triple Reallocation", async function () {
            context.scope = "Scenario Complex 3.1";
            const users = getRandomItems(context.users, 10);
            await testVaultsTripleReallocation(context, VAULT_NAMES, users);
        });
    });
});

async function testVaultDepositandWithdrawInTheSameIndex(
    context: Context,
    vaults: string[],
    users: SignerWithAddress[]
) {
    // ARRANGE
    let balances = users.map(() => getRandomAmount(100, 100_000));
    const userVaultActions = getUserVaultActions();

    const s1 = await doBalanceSnapshot(context, users, vaults, userVaultActions);

    const numberOfFirstDepositors = Math.floor(users.length / 2);
    const firstDepositors = users.slice(0, numberOfFirstDepositors);
    const secondDepositors = users.slice(numberOfFirstDepositors);

    // ACT
    await doDeposits(context, firstDepositors, vaults, balances, userVaultActions);

    const s2 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    await doHardWork(context, true);
    const s3 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    assertDoHardWorkSnapshotsPrimitive(s1, s2, s3, userVaultActions, context);
    assertVaultStrategyProportions(s3, context);

    await doWithdrawAll(context, firstDepositors, vaults, userVaultActions);
    balances = users.map(() => getRandomAmount(100, 100_000));
    await doDeposits(context, secondDepositors, vaults, balances, userVaultActions);

    const s4 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    await doHardWork(context, false);
    const s5 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    assertDoHardWorkSnapshotsPrimitive(s3, s4, s5, userVaultActions, context);
    assertVaultStrategyProportions(s5, context);
    
    await doWithdrawAll(context, secondDepositors, vaults, userVaultActions);

    const s6 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    await doHardWork(context, false);
    const s7 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    assertDoHardWorkSnapshotsPrimitive(s5, s6, s7, userVaultActions, context);

    await doClaim(context, users, vaults, userVaultActions);

    const s8 = await doBalanceSnapshot(context, users, vaults, userVaultActions);

    assertClaimSnapshotsPrimitive(s7, s8, userVaultActions, context);
}

export async function doDepositsRandom(
    context: Context,
    users: SignerWithAddress[],
    vaults: string[],
    fromAmount: number,
    toAmount: number,
    userVaultActions: UserVaultActions,
    transferFromVault: boolean = true
) {
    for (const vaultName of vaults) {
        for (let i = 0; i < users.length; i++) {
            
            const balance = getRandomAmount(fromAmount, toAmount)
            await doDeposit(context, users[i], vaultName, balance.toString(), userVaultActions, transferFromVault);
        }
    }
}

async function depositWithdrawReallocateSimultaniously(
    context: Context,
    vaults: string[]
) {
    // ARRANGE
    const users = getRandomItems(context.users, 60);
    let usersLeft = users;
    let user0: SignerWithAddress[];
    [user0, usersLeft] = sliceElements(usersLeft, 1);

    const userVaultActions = getUserVaultActions();

    // ACT

    // DHW1
    console.log("DHW1");
    let depositors1: SignerWithAddress[];
    [depositors1, usersLeft] = sliceElements(usersLeft, 10);
    await doDepositsRandom(context, [...user0, ...depositors1], vaults, 100, 10_000, userVaultActions);

    // DHW1
    console.log("DHW1");
    await doHardWork(context, true);

    // WITHDRAW1
    console.log("WITHDRAW1");
    const [withdrawers1, depositors1Left] = sliceElements(depositors1, 3);
    await doWithdrawRandom(context, withdrawers1, vaults, userVaultActions);

    // DEPOSIT2
    console.log("DEPOSIT2");
    let depositors2: SignerWithAddress[];
    [depositors2, usersLeft] = sliceElements(usersLeft, 10);
    await doDepositsRandom(context, depositors2, vaults, 20_000, 50_000, userVaultActions);

    // DHW2
    console.log("DHW2");
    await doHardWork(context, true);
    
    // DEPOSIT3
    console.log("DEPOSIT3");
    let depositors3: SignerWithAddress[];
    [depositors3, usersLeft] = sliceElements(usersLeft, 5);
    await doDepositsRandom(context, depositors3, vaults, 40_000, 70_000, userVaultActions);

    // WITHDRAW2
    console.log("WITHDRAW2");
    const [withdrawers2, depositors2Left] = sliceElements(depositors2, 1);
    await doWithdrawRandom(context, withdrawers2, vaults, userVaultActions);

    // DHW3
    console.log("DHW3");
    await doHardWork(context, true);

    // DEPOSIT4
    console.log("DEPOSIT4");
    let depositors4: SignerWithAddress[];
    [depositors4, usersLeft] = sliceElements(usersLeft, 10);
    await doDepositsRandom(context, depositors4, vaults, 100, 3000, userVaultActions);

    // WITHDRAW3
    console.log("WITHDRAW3");
    const [withdrawers3, depositors3Left] = sliceElements(depositors3, 2);
    await doWithdrawRandom(context, withdrawers3, vaults, userVaultActions);
    
    // REALLOCATE
    console.log("REALLOCATE");
    const reallocationTable = await reallocateVaultsEqual(context, vaults);
    printReallocationTable(reallocationTable);

    // DEPOSIT5
    console.log("DEPOSIT5");
    let depositors5: SignerWithAddress[];
    [depositors5, usersLeft] = sliceElements(usersLeft, 2);
    await doDepositsRandom(context, depositors5, vaults, 70_000, 90_000, userVaultActions);

    // DHW4 - REALLOCATION
    console.log("DHW4 - REALLOCATION");
    await doHardWorkReallocation(context, false, reallocationTable);

    await printStrategyBalances(context);

    // DEPOSIT6
    console.log("DEPOSIT6");
    let depositors6: SignerWithAddress[];
    [depositors6, usersLeft] = sliceElements(usersLeft, 4);
    await doDepositsRandom(context, depositors6, vaults, 90_000, 100_000, userVaultActions);

    // WITHDRAW5
    console.log("WITHDRAW5");
    await doWithdrawRandom(context, depositors1Left, vaults, userVaultActions);

    // DHW5
    console.log("DHW5");
    await doHardWork(context, true);
    console.log("DHW5 ASSERT");

    // WITHDRAW6
    console.log("WITHDRAW6");
    // withdraw all users left
    const participatingUsers = users.slice(0, users.length - usersLeft.length);
    await doWithdrawAll(context, participatingUsers, vaults, userVaultActions);

    // DHW6
    await doHardWork(context, true);

    const s98 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    console.log("CLAIM");
    await doClaim(context, participatingUsers, vaults, userVaultActions);
    const s99 = await doBalanceSnapshot(context, users, vaults, userVaultActions);

    assertClaimSnapshotsPrimitive(s98, s99, userVaultActions, context);
}

async function testVaultsTripleReallocation(context: Context, vaults: string[], users: SignerWithAddress[]) {
    // ARRANGE
    const userVaultActions = getUserVaultActions();

    const s1 = await doBalanceSnapshot(context, users, vaults, userVaultActions);

    // ACT
    await doDepositsRandom(context, users, vaults, 100, 100_000, userVaultActions);

    // DHW1
    const s2 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    await doHardWork(context, false);
    const s3 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    assertDoHardWorkSnapshotsPrimitive(s1, s2, s3, userVaultActions, context);
    assertVaultStrategyProportions(s3, context);

    // SET REALLOCATION1
    const reallocationTable1 = await reallocateVaults(context, vaults, REALLOCATION_TYPE._40);
    printReallocationTable(reallocationTable1);

    // DHW2 - REALLOCATION
    await doHardWorkReallocation(context, false, reallocationTable1);
    const s4 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    assertDoHardWorkSnapshotsPrimitive(s3, s3, s4, userVaultActions, context);
    assertVaultStrategyProportions(s4, context);
    await printStrategyBalances(context);

    // SET REALLOCATION2
    const reallocationTable2 = await reallocateVaults(context, vaults, REALLOCATION_TYPE._100);
    printReallocationTable(reallocationTable2);

    // DHW3 - REALLOCATION
    await doHardWorkReallocation(context, false, reallocationTable2);
    const s5 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    assertDoHardWorkSnapshotsPrimitive(s4, s4, s5, userVaultActions, context);
    assertVaultStrategyProportions(s5, context);
    await printStrategyBalances(context);

    // SET REALLOCATION5
    const reallocationTable3 = await reallocateVaultsEqual(context, vaults);
    printReallocationTable(reallocationTable3);

    // DHW4 - REALLOCATION
    await doHardWorkReallocation(context, false, reallocationTable3);
    const s6 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    assertDoHardWorkSnapshotsPrimitive(s5, s5, s6, userVaultActions, context);
    assertVaultStrategyProportions(s6, context);
    await printStrategyBalances(context);


    await doWithdrawAll(context, users, vaults, userVaultActions);

    // DHW5
    const s7 = await doBalanceSnapshot(context, users, vaults, userVaultActions);
    await doHardWork(context, false);
    const s8 = await doBalanceSnapshot(context, users, vaults, userVaultActions);

    assertDoHardWorkSnapshotsPrimitive(s6, s7, s8, userVaultActions, context);

    await doClaim(context, users, vaults, userVaultActions);

    const s9 = await doBalanceSnapshot(context, users, vaults, userVaultActions);

    assertClaimSnapshotsPrimitive(s8, s9, userVaultActions, context);
}
