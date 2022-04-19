import { writeFile } from "fs/promises";
import { ethers } from "hardhat";

export async function main() {
    const startTime = Date.now();

    const tx = {
        from: "0x7d812b62dc15e6f4073eba8a2ba8db19c4e40704", // USDT holder
        to: "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
        data: "0xa9059cbb00000000000000000000000028c6c06298d514db089934071355e5743bf21d60000000000000000000000000000000000000000000000000000000006cc74a40",
    };

    const traceTx = await ethers.provider.send("debug_traceCall", [tx, "latest", { enableMemory: true }]);

    const execTime = Date.now() - startTime;

    console.log("execTime:", execTime / 1000);

    console.log(traceTx);
    console.log("done tracing");
    await writeFile("scripts/data/debug_traceCall.json", JSON.stringify(traceTx, null, 2), "utf8");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
