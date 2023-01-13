import { BigNumber, } from "ethers";
import { Context } from "../../scripts/infrastructure";
import { getNetworkName } from "./utilities";
import { getDhwSlippagesArbitrum, getReallocationSlippagesArbitrum, getSlippagesArbitrum } from "./dhwUtils/arbitrum";
import { getDhwSlippagesMainnet, getReallocationSlippagesMainnet, getSlippagesMainnet } from "./dhwUtils/mainnet";


export async function getSlippages(context: Context) {
    const network = await getNetworkName();
    switch(network){
        case "arbitrum":
            return await getSlippagesArbitrum(context);
        default:
            return await getSlippagesMainnet(context);
    }
}
export async function getDhwSlippages(context: Context, reallocationWithdrawnShares?: BigNumber[]) {
    const network = await getNetworkName();
    switch(network){
        case "arbitrum":
            return await getDhwSlippagesArbitrum(context, reallocationWithdrawnShares);
        default:
            return await getDhwSlippagesMainnet(context, reallocationWithdrawnShares);
    }
}

export async function getReallocationSlippages(context: Context, reallocationTable: BigNumber[][]) {
    const network = await getNetworkName();
    switch(network){
        case "arbitrum":
            return await getReallocationSlippagesArbitrum(context, reallocationTable);
        default:
            return await getReallocationSlippagesMainnet(context, reallocationTable);
    }
}
