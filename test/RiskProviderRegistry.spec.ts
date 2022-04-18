import { expect, use } from "chai";
import { Wallet } from "ethers";
import { solidity } from "ethereum-waffle";
import { AccountsFixture, deploymentFixture, MockStrategyFixture, SpoolFixture } from "./shared/fixtures";
import { ethers, waffle } from "hardhat";
import { reset } from "./shared/utilities";
import { RiskProviderRegistry__factory } from "../build/types";

const { waffleChai } = require("@ethereum-waffle/chai");

use(solidity);
use(waffleChai);

const createFixtureLoader = waffle.createFixtureLoader;

describe("RiskProviderRegistry", () => {
    let wallet: Wallet, other: Wallet;
    let loadFixture: ReturnType<typeof createFixtureLoader>;

    before("create fixture loader", async () => {
        await reset();
        [wallet, other] = await (ethers as any).getSigners();
        loadFixture = createFixtureLoader([wallet, other]);
    });

    let accounts: AccountsFixture;
    let spool: SpoolFixture;
    let strategies: MockStrategyFixture;

    beforeEach("create fixture loader", async () => {
        ({ accounts, spool, strategies } = await loadFixture(deploymentFixture));
        await spool.riskProviderRegistry.addProvider(accounts.riskProvider.address, 0);
        expect(await spool.riskProviderRegistry.isProvider(accounts.riskProvider.address)).to.be.true;
    });

    describe("contract setup tests", () => {
        it("Should fail deploying the Risk Provider with address 0", async () => {
            const RiskProviderRegistry = await new RiskProviderRegistry__factory().connect(accounts.administrator);
            await expect(
                RiskProviderRegistry.deploy(ethers.constants.AddressZero, "0x0000000000000000000000000000000000000001")
            ).to.be.revertedWith("RiskProviderRegistry::constructor: Fee Handler address cannot be 0");
        });

        it("Should fail deploying the Risk Provider with address 0", async () => {
            const RiskProviderRegistry = await new RiskProviderRegistry__factory().connect(accounts.administrator);
            await expect(
                RiskProviderRegistry.deploy("0x0000000000000000000000000000000000000001", ethers.constants.AddressZero)
            ).to.be.revertedWith("SpoolOwnable::constructor: Spool owner contract address cannot be 0");
        });
    });

    describe("provider tests", () => {
        it("Should try to add the same provider again and fail", async () => {
            await expect(spool.riskProviderRegistry.addProvider(accounts.riskProvider.address, 0)).to.be.revertedWith(
                "RiskProviderRegistry::addProvider: Provider already exists"
            );
        });

        it("Should try to remove an inexistent provider", async () => {
            await expect(spool.riskProviderRegistry.removeProvider(accounts.user0.address)).to.be.revertedWith(
                "RiskProviderRegistry::removeProvider: Provider does not exist"
            );
            expect(await spool.riskProviderRegistry.isProvider(accounts.administrator.address)).to.be.false;
        });

        it("Should remove an existing provider", async () => {
            await spool.riskProviderRegistry.removeProvider(accounts.riskProvider.address);
            expect(await spool.riskProviderRegistry.isProvider(accounts.riskProvider.address)).to.be.false;
        });
    });

    describe("risk tests", () => {
        it("Should set risks using strategies for provider set", async () => {
            let strategiesToSet = [strategies.strategyAddresses[0], strategies.strategyAddresses[1]];
            let riskScores = [1, 2];

            await spool.riskProviderRegistry.connect(accounts.riskProvider).setRisks(strategiesToSet, riskScores);

            expect(
                await spool.riskProviderRegistry.getRisk(accounts.riskProvider.address, strategiesToSet[0])
            ).to.be.equal(riskScores[0]);
            expect(
                await spool.riskProviderRegistry.getRisk(accounts.riskProvider.address, strategiesToSet[1])
            ).to.be.equal(riskScores[1]);
            riskScores = [2, 3];

            await spool.riskProviderRegistry.connect(accounts.riskProvider).setRisk(strategiesToSet[0], riskScores[0]);
            await spool.riskProviderRegistry.connect(accounts.riskProvider).setRisk(strategiesToSet[1], riskScores[1]);

            let risks = await spool.riskProviderRegistry.getRisks(accounts.riskProvider.address, strategiesToSet);
            expect(risks[0]).to.be.equal(riskScores[0]);
            expect(risks[1]).to.be.equal(riskScores[1]);
        });

        it("Should try to set risks from non-provider account and fail", async () => {
            let strategiesToSet = [strategies.strategyAddresses[0], strategies.strategyAddresses[1]];
            let riskScores = [1, 2];

            await expect(
                spool.riskProviderRegistry.connect(accounts.user0.address).setRisks(strategiesToSet, riskScores)
            ).to.be.revertedWith("RiskProviderRegistry::setRisks: Insufficient Privileges");

            await expect(
                spool.riskProviderRegistry.connect(accounts.user0.address).setRisk(strategiesToSet[0], riskScores[0])
            ).to.be.revertedWith("RiskProviderRegistry::setRisk: Insufficient Privileges");
        });

        it("Should try to set risks with invalid risk scores", async () => {
            let strategiesToSet = [strategies.strategyAddresses[0], strategies.strategyAddresses[1]];

            let maxRiskScore = await spool.riskProviderRegistry.MAX_RISK_SCORE();
            let riskScores = [1, maxRiskScore + 1];

            await expect(
                spool.riskProviderRegistry.connect(accounts.riskProvider).setRisks(strategiesToSet, riskScores)
            ).to.be.revertedWith("RiskProviderRegistry::_setRisk: Risk score too big");
        });

        it("Should try to set risks with invalid array sizes and fail", async () => {
            let strategiesToSet = [strategies.strategyAddresses[0], strategies.strategyAddresses[1]];
            let riskScores = [1];

            await expect(
                spool.riskProviderRegistry.connect(accounts.riskProvider).setRisks(strategiesToSet, riskScores)
            ).to.be.revertedWith("RiskProviderRegistry::setRisks: Strategies and risk scores lengths don't match");
        });
    });
});
