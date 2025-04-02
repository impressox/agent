import type { IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { elizaLogger } from "@elizaos/core";
import { initWalletProvider } from "../providers/wallet.ts";
import type { SupportedChain } from "../types/index.ts";

export class WalletInfoAction {
    constructor() {}

    async getWalletInfo(runtime: IAgentRuntime, userId: string, chainName: SupportedChain) {
        try {
            const provider = await initWalletProvider(runtime, userId);
            
            // Get wallet address
            const address = provider.getAddress();

            // Get wallet balance
            const balance = await provider.getWalletBalanceForChain(chainName);

            // Get chain config
            const chainConfig = provider.getChainConfigs(chainName);

            return {
                address,
                balance: balance || "0",
                chainId: chainConfig.id,
                chainName: chainConfig.name,
                nativeCurrency: chainConfig.nativeCurrency
            };
        } catch (error) {
            elizaLogger.error("Error getting wallet info:", error);
            throw error;
        }
    }
}

export const walletInfoAction = {
    name: "wallet-info",
    description: "Get current wallet information including address, balance and chain details",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: Record<string, unknown>,
        callback?: HandlerCallback
    ) => {
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        console.log("Wallet info action handler called");
        
        // Get userId from actorsData
        const userId = state.actorsData?.find((actor) => actor.username === state.senderName)?.id;

        if (!userId) {
            elizaLogger.warn("User ID is not available in state");
            if (callback) {
                callback({ text: "Error: User ID is required" });
            }
            return false;
        }

        try {
            const action = new WalletInfoAction();
            const chainName = (state.chainId as SupportedChain) || "arbitrum"; // Default to arbitrum if not specified
            const walletInfo = await action.getWalletInfo(runtime, userId, chainName);

            if (callback) {
                callback({
                    text: `Wallet Information:\nAddress: ${walletInfo.address}\nBalance: ${walletInfo.balance} ${walletInfo.nativeCurrency.symbol}\nChain: ${walletInfo.chainName} (${walletInfo.chainId})`,
                    content: walletInfo
                });
            }
            return true;
        } catch (error) {
            console.error("Error in wallet info handler:", error.message);
            if (callback) {
                callback({ text: `Error: ${error.message}` });
            }
            return false;
        }
    },
    validate: async (runtime: IAgentRuntime) => {
        return true;
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Show my wallet info",
                    action: "WALLET_INFO",
                },
            },
        ],
    ],
    similes: ["WALLET_INFO", "GET_WALLET", "SHOW_WALLET"],
};
