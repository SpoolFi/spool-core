import { BigNumber, constants } from "ethers";
import { StrategySetupStructOutput } from "../../../../build/types/TestStrategySetup";
import { IBaseStrategy, TestStrategySetup__factory } from "../../../../build/types";

const { Zero } = constants;

export type PendingStructBN = {
    deposit: BigNumber;
    sharesToWithdraw: BigNumber;
};

export type StrategySetupStructBN = {
    totalShares: BigNumber;
    index: BigNumber;
    pendingUser: PendingStructBN;
    pendingUserNext: PendingStructBN;
    pendingDepositReward: BigNumber;
    optimizedSharesWithdrawn: BigNumber;
    pendingReallocateDeposit: BigNumber;
    pendingReallocateOptimizedDeposit: BigNumber;
};

export async function setStrategyState(strat: IBaseStrategy, setup: StrategySetupStructBN) {
    const stratSetup = TestStrategySetup__factory.connect(strat.address, strat.signer);
    await stratSetup.setStrategyState(setup);
}

export async function getStrategyState(strat: IBaseStrategy): Promise<StrategySetupStructBN> {
    const stratSetup = TestStrategySetup__factory.connect(strat.address, strat.signer);
    const strategyDetailsOutput = await stratSetup.getStrategy();
    return copyStrategyDetails(strategyDetailsOutput);
}

export function copyStrategyDetails(details: StrategySetupStructOutput | StrategySetupStructBN): StrategySetupStructBN {
    return {
        totalShares: details.totalShares,
        index: BigNumber.from(details.index),
        pendingUser: {
            deposit: details.pendingUser.deposit,
            sharesToWithdraw: details.pendingUser.sharesToWithdraw,
        },
        pendingUserNext: {
            deposit: details.pendingUserNext.deposit,
            sharesToWithdraw: details.pendingUserNext.sharesToWithdraw,
        },
        pendingDepositReward: details.pendingDepositReward,
        optimizedSharesWithdrawn: details.optimizedSharesWithdrawn,
        pendingReallocateDeposit: details.pendingReallocateDeposit,
        pendingReallocateOptimizedDeposit: details.pendingReallocateOptimizedDeposit,
    };
}

export function getStrategySetupObject(): StrategySetupStructBN {
    return {
        totalShares: Zero,
        index: Zero,
        pendingUser: {
            deposit: Zero,
            sharesToWithdraw: Zero,
        },
        pendingUserNext: {
            deposit: Zero,
            sharesToWithdraw: Zero,
        },
        pendingDepositReward: Zero,
        optimizedSharesWithdrawn: Zero,
        pendingReallocateDeposit: Zero,
        pendingReallocateOptimizedDeposit: Zero,
    };
}
