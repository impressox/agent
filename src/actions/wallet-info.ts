import type { IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { composeContext, elizaLogger, generateObjectDeprecated, ModelClass } from "@elizaos/core";
import { initWalletProvider } from "../providers/wallet.ts";
import type { SupportedChain } from "../types/index.ts";
import { walletInfoTemplate } from "../templates/index.ts";

export class WalletInfoAction {
    constructor() { }

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
    template: walletInfoTemplate,
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
                callback({
                    text: "⚠️ I couldn't find your account information. Please make sure you're logged in properly or reconnect your wallet."
                });
            }
            return false;
        }

        try {
            const action = new WalletInfoAction();
            // Extract parameters from message content
            const walletContext = composeContext({
                state,
                template: walletInfoTemplate,
            });
            const content = await generateObjectDeprecated({
                runtime,
                context: walletContext,
                modelClass: ModelClass.LARGE,
            });

            const chainName = (content.chain as SupportedChain) || "arbitrum"; // Default to arbitrum if not specified
            const walletInfo = await action.getWalletInfo(runtime, userId, chainName);

            if (callback) {
                if (walletInfo.balance === "0") {
                    callback({
                        text: `🪙 I noticed your wallet on ${walletInfo.chainName} has a balance of 0 ${walletInfo.nativeCurrency.symbol}.\n\nNo worries — you can deposit funds to this address:\n\`${walletInfo.address}\`\n\nWould you like me to help you bridge assets or swap from another network?`
                    });
                } else {
                    callback({
                        text: `🪪 Here's your wallet info:\n\n🔗 Network: ${walletInfo.chainName} (${walletInfo.chainId})\n💼 Address: \`${walletInfo.address}\`\n💰 Balance: ${walletInfo.balance} ${walletInfo.nativeCurrency.symbol}\n\nLet me know if you'd like to swap tokens or send crypto next!`,
                        content: walletInfo
                    });
                }
            }
            return true;
        } catch (error) {
            console.error("Error in wallet info handler:", error.message);
            if (callback) {
                callback({
                    text: `❌ Oops! I ran into an issue while retrieving your wallet info: ${error.message}\n\nPlease try again in a moment or check your connection.`
                });
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
