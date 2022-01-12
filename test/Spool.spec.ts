import { expect, use } from "chai";
import { Wallet } from "ethers";
import { solidity } from "ethereum-waffle";
import {
    AccountsFixture,
    deploymentFixture,
    SpoolFixture,
    MockStrategyFixture,
    TokensFixture,
} from "./shared/fixtures";
import { ethers, waffle } from "hardhat";
import { VaultDetailsStruct } from "../build/types/Controller";
const { waffleChai } = require("@ethereum-waffle/chai");
import { Vault } from "../build/types/Vault";
import { createVault, reset } from "./shared/utilities";
import { Spool__factory } from "../build/types/factories/Spool__factory";

use(solidity);
use(waffleChai);

const createFixtureLoader = waffle.createFixtureLoader;

describe("Spool", () => {
    let accounts: AccountsFixture;
    let strategies: MockStrategyFixture;
    let tokens: TokensFixture;
    let wallet: Wallet, other: Wallet;
    let loadFixture: ReturnType<typeof createFixtureLoader>;

    let spool: SpoolFixture;
    let vault: Vault;
    let vaultCreation: VaultDetailsStruct;

    before("create fixture loader", async () => {
        await reset();
        [wallet, other] = await (ethers as any).getSigners();
        loadFixture = createFixtureLoader([wallet, other]);

        ({ accounts, spool, strategies, tokens } = await loadFixture(deploymentFixture));
        await spool.riskProviderRegistry.addProvider(accounts.riskProvider.address, 0);

        vaultCreation = {
            underlying: tokens.USDC.address,
            strategies: [
                strategies.chefStrategies[0].address,
                strategies.chefStrategiesFees[0].address,
                strategies.chefStrategiesFees[1].address,
            ],
            proportions: [4500, 2500, 3000],
            creator: accounts.rewardNotifier.address,
            vaultFee: 2000,
            riskProvider: accounts.riskProvider.address,
            riskTolerance: 0,
            name: "Test",
        };

        console.log("create vault..");
        vault = await createVault(spool.controller, vaultCreation, accounts.rewardNotifier);
    });

    describe("contract setup tests", () => {
        it("Should fail deploying the Spool with Spool address 0", async () => {
            const SpoolFactory = await new Spool__factory().connect(accounts.administrator);
            await expect(
                SpoolFactory.deploy(
                    ethers.constants.AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    "0x0000000000000000000000000000000000000001"
                )
            ).to.be.revertedWith("SpoolOwnable::constructor: Spool owner contract address cannot be 0");
        });

        it("Should fail deploying the vault factory with Controller address 0", async () => {
            const SpoolFactory = await new Spool__factory().connect(accounts.administrator);
            await expect(
                SpoolFactory.deploy(
                    "0x0000000000000000000000000000000000000001",
                    ethers.constants.AddressZero,
                    "0x0000000000000000000000000000000000000001"
                )
            ).to.be.revertedWith("BaseSpool::constructor: Controller or FastWithdraw address cannot be 0");
        });
    });

    describe("Spool public functions", () => {
        it("Should get underlying with no shares", async () => {
            const actual = await spool.spool.callStatic.getUnderlying(strategies.strategyAddresses[0]);
            expect(actual).to.be.equal(0);
        });

        it("Should get strategy underlying", async () => {
            const actual = await spool.spool.callStatic.getStratUnderlying(strategies.strategyAddresses[0]);
            expect(actual).to.be.equal(0);
        });

        it("Should get strategy underlying", async () => {
            const actual = await spool.spool.callStatic.getStratUnderlying(strategies.strategyAddresses[0]);
            expect(actual).to.be.equal(0);
        });

        it("Should get vault total underlying at index 0", async () => {
            const actual = await spool.spool.callStatic.getVaultTotalUnderlyingAtIndex(
                strategies.strategyAddresses[0],
                0
            );
            expect(actual).to.be.equal(0);
        });

        it("Should get completed global index", async () => {
            const actual = await spool.spool.callStatic.getCompletedGlobalIndex();
            expect(actual).to.be.equal(1);
        });

        it("Should get active global index if batch is not completed", async () => {
            const actual = await spool.spool.getActiveGlobalIndex();
            expect(actual).to.be.equal(2);
        });

        it("Should get vault strat shares", async () => {
            const actual = await spool.spool.getStratVaultShares(strategies.strategyAddresses[0], vault.address);
            expect(actual).to.be.equal(0);
        });

        it("Should not be in mid reallocation", async () => {
            const actual = await spool.spool.isMidReallocation();
            expect(actual).to.be.equal(false);
        });
    });
});
