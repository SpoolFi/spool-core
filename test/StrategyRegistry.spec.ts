import { expect, use } from "chai";
import { createFixtureLoader, MockProvider, solidity } from "ethereum-waffle";
import { AccountsFixture, deploymentFixture, MockStrategyFixture, SpoolFixture } from "./shared/fixtures";
import { reset } from "./shared/utilities";
import { ProxyAdmin__factory } from "../build/types";
import hre from "hardhat";

use(solidity);

const myProvider = new MockProvider();
let loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

describe("Strategy Registry", () => {
    let spool: SpoolFixture;
    let accounts: AccountsFixture;
    let strategies: MockStrategyFixture;

    before(async () => {
        await reset();
        loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);
        ({ spool, strategies, accounts } = await loadFixture(deploymentFixture));
    });

    it("Should find strategy in registry", async () => {
        // ARRANGE
        const strategyAddress = strategies.strategyAddresses[0];

        // ACT
        const implementation = await spool.strategyRegistry.strategyImplementations(strategyAddress);

        // ASSERT
        expect(implementation).to.equal(strategyAddress);
    });

    it("Should upgrade strategy implementation", async () => {
        // ARRANGE
        const strategyAddress = strategies.strategyAddresses[0];
        const newImplementation = "0x0000000000000000000000000000000000000001";
        const registryAddress = spool.strategyRegistry.address;
        const abiCoder = new hre.ethers.utils.AbiCoder();
        const encodedImplementation = abiCoder.encode(["address"], [newImplementation]);

        // ACT
        const tx = await spool.proxyAdmin.upgradeAndCall(registryAddress, strategyAddress, encodedImplementation);
        await tx.wait();
        const implementation = await spool.strategyRegistry.strategyImplementations(strategyAddress);

        // ASSERT
        expect(implementation).to.equal(newImplementation);
    });

    it("Should not be able to change admin", async () => {
        // ARRANGE
        const newAdmin = await new ProxyAdmin__factory().connect(accounts.administrator).deploy();

        // ACT
        let tx = spool.strategyRegistry.changeAdmin(newAdmin.address);

        // ASSERT
        await expect(tx).to.be.revertedWith("StrategyRegistry::_ifAdmin: Can only be invoked by admin");
    });

    it("Should change admin", async () => {
        // ARRANGE
        const newAdmin = await new ProxyAdmin__factory().connect(accounts.administrator).deploy();
        const registry = spool.strategyRegistry.address;

        // ACT
        let tx = await spool.proxyAdmin.changeProxyAdmin(registry, newAdmin.address);
        await tx.wait();
        const admin = await spool.strategyRegistry.admin();

        // ASSERT
        expect(admin).to.be.equal(newAdmin.address);
    });

    it("Should not be able to upgrade with old admin", async () => {
        // ARRANGE
        const strategyAddress = strategies.strategyAddresses[0];
        const newImplementation = "0x0000000000000000000000000000000000000002";
        const registryAddress = spool.strategyRegistry.address;
        const abiCoder = new hre.ethers.utils.AbiCoder();
        const encodedImplementation = abiCoder.encode(["address"], [newImplementation]);

        // ACT
        let tx = spool.proxyAdmin.upgradeAndCall(registryAddress, strategyAddress, encodedImplementation);

        // ASSERT
        await expect(tx).to.be.revertedWith("StrategyRegistry::_ifAdmin: Can only be invoked by admin");
    });
});
