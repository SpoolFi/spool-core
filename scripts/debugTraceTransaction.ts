import { ethers } from "hardhat";
import axios from "axios";
import { config as dotenvConfig } from "dotenv";
import _ from "lodash";
import * as fs from "fs";
import { writeFile } from "fs/promises";

dotenvConfig();

const ABI_FILE = "./scripts/data/simulator_abi.json";

const provider = new ethers.providers.JsonRpcProvider(process.env.MAINNET_URL);
const events = [
    "RewardsAccrued(address,uint256)",
    "Transfer(address,address,uint256)",
    "AssetIndexUpdated(address,uint256)",
];

export async function main() {
    const txHash = "<TX_HASH>";
    const topics = _.reduce(
        events,
        (result: any, value, b) => {
            result[ethers.utils.id(value)] = value;
            return result;
        },
        {}
    );
    console.log(Object.keys(topics));
    const trace = await doTrace(txHash, buildTracer(Object.keys(topics)));
    trace.forEach((log: any) => {
        log.eventName = topics[log.topics[0]];
    });

    console.log(trace);
}

async function loadAbis(txHash: string) {
    if (fs.existsSync(ABI_FILE)) {
        return JSON.parse(fs.readFileSync(ABI_FILE, "utf8"));
    }

    const trace = await doTrace(txHash, buildTracer([]));
    let contracts = trace.map((log: any) => log.contract);
    contracts = _.uniq(contracts);

    const abis: any = {};
    for (const contract of contracts) {
        abis[contract] = JSON.parse(await getABI(contract));
    }
    await writeFile(ABI_FILE, JSON.stringify(abis, null, 2), "utf8");
}

async function getABI(contract: string) {
    const response = await axios.get(
        `https://api.etherscan.io/api?module=contract&action=getabi&address=${contract}&apikey=${process.env.ETHERSCAN_KEY}`
    );
    return response.data.result;
}

async function doTrace(txHash: string, tracer: string) {
    const startTime = Date.now();
    const traceTx = await provider.send("debug_traceTransaction", [
        txHash,
        {
            enableMemory: true,
            timeout: "10m",
            tracer,
        },
    ]);
    traceTx.forEach((log: any) => {
        log.data = ethers.utils.hexlify(Object.keys(log.data).map((key: string) => log.data[key]));
        log.contract = ethers.utils.hexlify(Object.keys(log.contract).map((key: string) => log.contract[key]));
    });

    const execTime = Date.now() - startTime;
    console.log("execTime:", execTime / 1000);
    return traceTx;
}

function buildTracer(topics: string[]) {
    let topicsCondition = "";
    if (topics.length) {
        const elements = topics.map((t: string) => ` "${t}" == "0x" + log.stack.peek(2).toString(16) `);
        topicsCondition = `if (!(${elements.join("||")})) return;`;
    }

    const dataParse = `
        contract: log.contract.getAddress(),
        pc: log.getPC(),
        op: log.op.toString(),  
        dataUint: log.memory.getUint(parseInt(log.stack.peek(0))),
        data: log.memory.slice(parseInt(log.stack.peek(0), parseInt(log.stack.peek(1)) + parseInt(log.stack.peek(0)))),`;

    return `{
        retVal: [],
        step: function(log,db) {
           if(log.op.toNumber() == 0xA1) {
             ${topicsCondition}
             this.retVal.push(
                {
                    ${dataParse}
                    topics: ["0x" + log.stack.peek(2).toString(16)]
             });
           } else if(log.op.toNumber() == 0xA2) {
             ${topicsCondition}
             this.retVal.push(
                {
                    ${dataParse}
                    topics: ["0x" + log.stack.peek(2).toString(16), "0x" + log.stack.peek(3).toString(16)]
             });
           } else if(log.op.toNumber() == 0xA3) {
             ${topicsCondition}
             this.retVal.push(
                {
                    ${dataParse}
                    topics: ["0x" + log.stack.peek(2).toString(16),
                        "0x" + log.stack.peek(3).toString(16),
                        "0x" + log.stack.peek(4).toString(16)]
             });
           } else if(log.op.toNumber() == 0xA4) {
             ${topicsCondition}
             this.retVal.push(
                {
                    ${dataParse}
                    topics: ["0x" + log.stack.peek(2).toString(16),
                        "0x" + log.stack.peek(3).toString(16),
                        "0x" + log.stack.peek(4).toString(16),
                        "0x" + log.stack.peek(5).toString(16)]
             });
           }
        },
        fault: function(log,db) {this.retVal.push("FAULT: " + JSON.stringify(log))},
        result: function(ctx,db) {return this.retVal}
        }`;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
