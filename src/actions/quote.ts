import type { IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { composeContext, elizaLogger, generateObjectDeprecated, ModelClass, settings } from "@elizaos/core";
import { initWalletProvider, WalletProvider } from "../providers/wallet.ts";
import { SwapAction } from "./swap.ts";
import { formatUnits, parseUnits, Chain } from "viem";
import { convertViemChainToRelayChain, createClient, getClient, MAINNET_RELAY_API, TESTNET_RELAY_API } from "@reservoir0x/relay-sdk";
import type { SupportedChain } from "../types/index.ts";
import { quoteTemplate } from "../templates/index.ts";

import { formatClientMessage } from "../utils/index.ts";
import { getTokenAddress, getTokenDecimals } from "../utils/token.ts";

export class QuoteAction {
    constructor(private walletProvider: WalletProvider) {
        try {
            const chains = Object.values(this.walletProvider.chains).map(c => convertViemChainToRelayChain(c as Chain));

            createClient({
                baseApiUrl: settings.MAIN_NET_MODE === "true" ? MAINNET_RELAY_API : TESTNET_RELAY_API,
                chains
            });
        } catch (error) {
            elizaLogger.error("Error initializing RelayClient:", error);
            throw error;
        }
    }

    async getQuote(
        runtime: IAgentRuntime,
        userId: string,
        fromChain: SupportedChain,
        toChain: SupportedChain,
        fromToken: string,
        toToken: string,
        amount: string
    ) {
        try {
            const walletProvider = await initWalletProvider(runtime, userId);
            const fromTokenAddress = getTokenAddress(fromChain, fromToken);
            const toTokenAddress = getTokenAddress(toChain, toToken);
            const fromTokenDecimals = await getTokenDecimals(walletProvider, fromChain, fromTokenAddress);

            const fromChainConfig = walletProvider.getChainConfigs(fromChain as SupportedChain);
            const toChainConfig = walletProvider.getChainConfigs(toChain as SupportedChain);
            const walletClient = walletProvider.getWalletClient(fromChain as SupportedChain);

            const quote = await getClient()?.actions.getQuote({
                chainId: fromChainConfig.id,
                toChainId: toChainConfig.id,
                currency: fromTokenAddress,
                toCurrency: toTokenAddress,
                amount: parseUnits(amount, fromTokenDecimals).toString(),
                wallet: walletClient as any,
                tradeType: "EXACT_INPUT"
            });

            return {
                fromChain: fromChainConfig.name,
                toChain: toChainConfig.name,
                quote
            };
        } catch (error) {
            elizaLogger.error("Error getting quote:", error);
            throw error;
        }
    }
}

export const quoteAction = {
    name: "quote",
    description: "Get a quote for token swap",
    template: quoteTemplate,
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback?: HandlerCallback
    ) => {
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        elizaLogger.log("Quote action handler called");

        // Get userId from actorsData
        const userId = state.actorsData?.find((actor) => actor.username === state.senderName)?.id;

        if (!userId) {
            elizaLogger.warn("User ID is not available in state");
            if (callback) {
                callback({ text: "❌ Authentication Error: User ID not found. Please ensure you are properly authenticated." });
            }
            return false;
        }

        try {
            const walletProvider = await initWalletProvider(runtime, userId);

            // Extract parameters from message content
            const quoteContext = composeContext({
                state,
                template: quoteTemplate,
            });
            const content = await generateObjectDeprecated({
                runtime,
                context: quoteContext,
                modelClass: ModelClass.LARGE,
            });

            const params = {
                fromChain: content.fromChain as SupportedChain,
                toChain: content.toChain || content.fromChain as SupportedChain, // Default to same chain if not specified
                fromToken: content?.fromToken as string,
                toToken: content?.toToken as string,
                amount: content?.amount as string
            };

            const { fromChain, toChain, fromToken, toToken, amount } = params;
            const amountIn = amount || "1"; // Default to 1 if not specified
            if ((!fromChain && !toChain) || !fromToken || !toToken) {
                throw new Error("❌ Missing required parameters. Please specify chain, fromToken, toToken and amount.");
            }

            // Convert token symbols to addresses
            const fromTokenAddress = getTokenAddress(fromChain, fromToken);
            const toTokenAddress = getTokenAddress(toChain, toToken);

            // Get quote from Relay

            const quoteAction = new QuoteAction(walletProvider);
            const quoteResult = await quoteAction.getQuote(
                runtime,
                userId,
                fromChain,
                toChain,
                fromTokenAddress,
                toTokenAddress,
                amountIn
            );
            const tochainInfo = quoteResult.toChain ? ` → ${quoteResult.toChain}` : "";

            if (!quoteResult.quote) {
                throw new Error(`❌ No route found for ${fromToken} → ${toToken} on ${quoteResult.fromChain}${tochainInfo}`);
            }

            // Get output amount from quote response
            const quoteData = quoteResult.quote.steps[0].items[0].data;
            const quoteDetail = quoteResult.quote.details;
            const outputAmount = quoteDetail?.currencyOut.amountFormatted || "0";
            const priceImpact = quoteDetail?.totalImpact.percent || "0";
            const gasFee = quoteData?.gas || "0";

            const clientType = (state?.client as { platform?: string })?.platform;
            const quoteMessage = `💱 Swap Quote\n\n` +
                `From: ${amount} ${fromToken}\n` +
                `To: ~${outputAmount} ${toToken}\n` +
                `Chain: ${quoteResult.fromChain}${tochainInfo}\n\n` +
                `Price Impact: ${Number(priceImpact).toFixed(2)}%\n` +
                `Estimated Gas: ~${gasFee} gwei\n\n`;

            if (callback) {
                callback({
                    text: formatClientMessage(quoteMessage, clientType),
                    content: {
                        fromToken,
                        toToken,
                        fromChain,
                        toChain,
                        outputAmount,
                        priceImpact,
                        gasFee
                    }
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error in quote handler:", error.message);
            if (callback) {
                const clientType = (state?.client as { platform?: string })?.platform;
                callback({ text: formatClientMessage(error.message, clientType) });
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
                    text: "Get quote for swapping 1 ETH to USDC on Base",
                    action: "QUOTE",
                },
            },
            {
                user: "user",
                content: {
                    text: "Get quote for swapping 1 ETH to ETH from Arbitrum to Base",
                    action: "QUOTE",
                },
            },
            {
                user: "user",
                content: {
                    text: "Check price for 0.1 ETH to USDT on Arbitrum",
                    action: "QUOTE",
                }
            },
            {
                user: "user",
                content: {
                    text: "Check price for 0.1 ETH to ETH from Base to Arbitrum",
                    action: "QUOTE",
                }
            }
        ],
    ],
    similes: ["QUOTE", "CHECK_PRICE", "GET_RATE", "FIND_RATE", "QUOTE_PRICE", "GET_QUOTE"],
};
