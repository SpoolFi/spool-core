import { expect, use } from "chai";
import { constants } from "ethers";
import { solidity, MockProvider, createFixtureLoader } from "ethereum-waffle";
import { underlyingTokensFixture, AccountsFixture } from "../../shared/fixtures";
import { reset } from "../../shared/utilities";
import { MasterChefUsdcStrategy__factory } from "../../../build/types/factories/MasterChefUsdcStrategy__factory";

const { AddressZero } = constants;

use(solidity);

const myProvider = new MockProvider();
const loadFixture = createFixtureLoader(myProvider.getWallets(), myProvider);

describe("Strategies Unit Test: AAVE", () => {
    let accounts: AccountsFixture;

    before(async () => {
        await reset();
        ({ accounts } = await loadFixture(underlyingTokensFixture));
    });

    describe(`Deployment Gatekeeping`, () => {        
        it("Should fail deploying MasterChef with Masterchef address 0", async () => {
            const MasterChefUsdcStrategy = new MasterChefUsdcStrategy__factory().connect(accounts.administrator);
            await expect(
                MasterChefUsdcStrategy.deploy(
                    AddressZero,
                    "0x0000000000000000000000000000000000000001",
                    1,
                )
            ).to.be.revertedWith("MasterChefStrategyBase::constructor: Masterchef address cannot be 0");
        });
    });
});
