import { expect, use } from "chai";
import { Wallet } from "ethers";
import { solidity } from "ethereum-waffle";
import { reset } from "./shared/utilities";
import { AccountsFixture, deploymentFixture } from "./shared/fixtures";
import { ethers, waffle } from "hardhat";
import { RiskProviderRegistry__factory } from "../build/types/factories/RiskProviderRegistry__factory";

use(solidity);

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

    beforeEach("load fixtures", async () => {
        ({ accounts } = await loadFixture(deploymentFixture));
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
});
