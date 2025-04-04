import type { IAgentRuntime, Memory, State } from "@elizaos/core";
import {
    composeContext,
    generateObjectDeprecated,
    ModelClass,
    elizaLogger,
    settings,
} from "@elizaos/core";
import { initWalletProvider, type WalletProvider } from "../providers/wallet.ts";
import { swapTemplate } from "../templates/index.js";
import type { SwapParams, Transaction, QuoteResponse, SupportedChain } from "../types/index.ts";
import { formatClientMessage } from "../utils/format.ts";
import {
    type Address,
    type Hex,
    parseAbi,
    parseUnits,
    Chain,
    isAddress,
} from "viem";
import { convertViemChainToRelayChain, RelayClient, TESTNET_RELAY_API, getClient, createClient, MAINNET_RELAY_API } from "@reservoir0x/relay-sdk";
import { getTokenAddress, getTokenDecimals } from "../utils/token.ts";

export { swapTemplate };

export class SwapAction {
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

    async swap(params: SwapParams): Promise<Transaction> {
        // Validate and convert chain parameters
        const sourceChain = params.fromChain as SupportedChain;
        const destChain = params.toChain as SupportedChain;
        // Determine operation type
        type OperationType = 'swap' | 'bridge' | 'cross-chain-swap';
        const getOperationType = (): OperationType => {
            if (sourceChain === destChain) return 'swap';
            return params.fromToken.toUpperCase() === params.toToken.toUpperCase()
                ? 'bridge'  // Different chains, same token = Bridge
                : 'cross-chain-swap';  // Different chains, different tokens = Cross-chain swap
        };
        const operationType = getOperationType();

        const walletClient = this.walletProvider.getWalletClient(sourceChain);
        const [fromAddress] = await walletClient.getAddresses();

        // Convert token symbols to addresses
        const fromTokenAddress = getTokenAddress(sourceChain, params.fromToken);
        const toTokenAddress = getTokenAddress(destChain, params.toToken);

        // Get token decimals
        const fromTokenDecimals = await getTokenDecimals(this.walletProvider, sourceChain, fromTokenAddress);

        try {
            let balance = await this.walletProvider.getBalanceForChainAndToken(sourceChain, fromTokenAddress, fromTokenDecimals);;

            const minBalance = parseUnits(params.amount, fromTokenDecimals);
            const userBalance = parseUnits(balance, fromTokenDecimals);

            if (userBalance < minBalance) {
                const action = operationType === 'bridge'
                    ? 'bridge'
                    : operationType === 'cross-chain-swap'
                        ? 'cross-chain swap'
                        : 'swap';
                throw new Error(`❌ Oops! You need more ${params.fromToken} for this ${action}.\n\nRequired: ${params.amount}\nYour Balance: ${balance}\n\nNo worries! Just deposit some funds to:\n${this.walletProvider.getAddress()}\n\nThen we can help you complete your transaction! 😊`);
            }

            const fromChainConfig = this.walletProvider.getChainConfigs(sourceChain);
            const toChainConfig = this.walletProvider.getChainConfigs(destChain);

            // Get quote from Relay
            // Get quote with cross-chain routing if needed
            const recipient = params.toAddress && isAddress(params.toAddress) ? params.toAddress : this.walletProvider.getAddress()
            const client = getClient();
            if (!client) {
                throw new Error("Relay client not initialized");
            }
            const quote = await client?.actions.getQuote({
                chainId: fromChainConfig.id,
                toChainId: toChainConfig.id,
                currency: fromTokenAddress,
                toCurrency: toTokenAddress,
                recipient: recipient,
                amount: parseUnits(params.amount, fromTokenDecimals).toString(),
                wallet: walletClient as any,
                tradeType: "EXACT_INPUT" as const
            });

            if (!quote) {
                const recipientInfo = recipient ? ` for ${recipient}` : '';
                const actionPhrase = operationType === 'bridge'
                    ? `bridge ${params.fromToken} from ${params.fromChain} to ${params.toChain}${recipientInfo}`
                    : operationType === 'cross-chain-swap'
                        ? `swap ${params.fromToken} to ${params.toToken} across chains (${params.fromChain} → ${params.toChain})${recipientInfo}`
                        : `swap ${params.fromToken} to ${params.toToken} on ${params.fromChain}${recipientInfo}`;

                throw new Error(`❌ I couldn't find a good route to ${actionPhrase}.\n\nLet me help you with some options:\n- Try a smaller amount 💡\n- Let's try a different token pair 🔄\n- We can check other popular pairs 💪\n\nJust let me know what you prefer! 😊`);
            }

            // Execute the swap/bridge
            // Execute the swap/bridge
            const tx = await client?.actions.execute({
                quote,
                wallet: walletClient as any,
                onProgress: ({ steps, currentStepItem }) => {
                    if (currentStepItem) {
                        const progressState = currentStepItem.progressState || "";
                        let message = "";

                        if (progressState === "signing") {
                            message = "⌛ Waiting for signature...";
                        } else if (progressState === "posting") {
                            message = "📝 Submitting transaction...";
                        } else if (progressState === "confirming") {
                            message = operationType !== 'swap'
                                ? "⏳ Confirming on source chain..."
                                : "⏳ Confirming transaction...";
                        } else if (steps.length > 1) {
                            message = operationType === 'bridge'
                                ? "🌉 Bridging tokens to destination chain..."
                                : operationType === 'cross-chain-swap'
                                    ? "🔄 Processing cross-chain swap..."
                                    : "⏳ Processing swap...";
                        } else if (currentStepItem.status === "complete") {
                            message = operationType === 'bridge'
                                ? "✅ Bridge initiated! Tokens will arrive on destination chain"
                                : operationType === 'cross-chain-swap'
                                    ? "✅ Cross-chain swap completed! Funds are being transferred"
                                    : "✅ Swap completed!";
                        } else {
                            message = `🔄 ${progressState || "Processing"}...`;
                        }

                        elizaLogger.log(`${operationType} Progress: ${message}`);
                    }
                }
            });

            const lastStep = tx.steps[tx.steps.length - 1];
            const lastTxHash = lastStep.items[lastStep.items.length - 1].internalTxHashes[0];
            const lastItem = lastStep.items[lastStep.items.length - 1];
            return {
                hash: lastTxHash.txHash as `0x${string}`,
                from: fromAddress,
                to: lastItem.data?.to as `0x${string}` || "0x0000000000000000000000000000000000000000",
                value: BigInt(lastItem.data?.value || "0"),
                data: lastItem.data?.data as Hex || "0x",
                chainId: fromChainConfig.id,
                fromChain: fromChainConfig.name,
                toChain: toChainConfig.name,
            };
        } catch (error) {
            elizaLogger.error("Error in swap:", error);

            // Format user-friendly error messages
            const actionName = operationType === 'bridge' ? 'bridge' :
                operationType === 'cross-chain-swap' ? 'cross-chain swap' : 'swap';

            if (error.message?.toLowerCase().includes("insufficient")) {
                throw new Error(`❌ Just a heads up! You need more ${params.fromToken} for this ${actionName}.\n\nDon't worry though! Once you've topped up your balance, I'll help you complete the transaction right away! 💪`);
            }
            if (error.message?.toLowerCase().includes("slippage")) {
                throw new Error(`❌ The price movement is a bit high right now! Here's what we can do:\n\n💡 Try these options:\n- Let's reduce the amount a bit\n- We can try a different token pair\n- Or I can help you adjust the slippage settings\n\nWhich would you prefer? 😊`);
            }
            if (error.message?.toLowerCase().includes("route") || error.message?.toLowerCase().includes("no quote")) {
                const actionPhrase = operationType === 'bridge'
                    ? `bridge ${params.fromToken} between chains`
                    : operationType === 'cross-chain-swap'
                        ? `swap ${params.fromToken} to ${params.toToken} across chains`
                        : `swap ${params.fromToken} to ${params.toToken}`;

                throw new Error(`❌ I couldn't find a good way to ${actionPhrase}.\n\n💡 Let's try one of these:\n- Use a different amount\n- Try another token pair\n- Wait for better liquidity\n\nI'm here to help you find the best option! 🤝`);
            }
            if (error.message?.toLowerCase().includes("user denied") || error.message?.toLowerCase().includes("rejected")) {
                throw new Error("❌ No problem! You rejected the transaction. Whenever you're ready to try again, I'm here to help! 😊");
            }
            if (error.message?.toLowerCase().includes("gas")) {
                throw new Error("❌ Looks like gas prices are a bit tricky right now! Let's wait for better market conditions, or I can help you try with a different amount! 💡");
            }

            // Fallback error
            throw new Error(`❌ Oops! Something unexpected happened with the ${actionName}.\n\n💡 Let's try these options:\n- Reduce the amount a bit\n- Try another token pair\n- Or let me know if you need help troubleshooting!\n\nI'm here to make sure we get your transaction done successfully! 🚀`);
        }
    }
}

export const swapAction = {
    name: "swap",
    description: "Swap or bridge tokens between chains",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: any,
        callback?: any
    ) => {
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        elizaLogger.log("Swap action handler called");

        // Get userId from actorsData
        const userId = state.actorsData?.find((actor) => actor.username === state.senderName)?.id;

        if (!userId) {
            elizaLogger.warn("User ID is not available in state");
            if (callback) {
                callback({ text: "❌ Authentication Error: User ID not found. Please ensure you are properly authenticated." });
            }
            return false;
        }

        elizaLogger.log("User ID:", userId);

        const walletProvider = await initWalletProvider(
            runtime,
            userId
        );
        const action = new SwapAction(walletProvider);

        // Compose swap context
        const swapContext = composeContext({
            state,
            template: swapTemplate,
        });
        const content = await generateObjectDeprecated({
            runtime,
            context: swapContext,
            modelClass: ModelClass.LARGE,
        });

        const swapOptions: SwapParams = {
            fromChain: content.fromChain,
            toChain: content.toChain || content.fromChain, // Default to same chain if not specified
            fromToken: content.fromToken,
            toToken: content.toToken,
            amount: content.amount,
            toAddress: content.toAddress
        };

        // Determine operation type for the handler
        const operationType = swapOptions.fromChain !== swapOptions.toChain
            ? swapOptions.fromToken.toUpperCase() === swapOptions.toToken.toUpperCase()
                ? 'bridge'
                : 'cross-chain-swap'
            : 'swap';

        try {
            const swapResp = await action.swap(swapOptions);
            if (callback) {
                const clientType = (state?.client as { platform?: string })?.platform;
                let operationSymbol = operationType === 'bridge' ? '🌉' : operationType === 'cross-chain-swap' ? '⛓️' : '💱';
                let actionName = operationType === 'bridge' ? 'bridge' : operationType === 'cross-chain-swap' ? 'cross-chain swap' : 'swap';

                const successMessage = `🎉 Great news! Your ${actionName} was successful!\n\n` +
                    `${operationSymbol} ${swapOptions.amount} ${swapOptions.fromToken} ➜ ${swapOptions.toToken}\n` +
                    (operationType !== 'swap' ? `From ${swapResp.fromChain} to ${swapResp.toChain}\n` : `🔗 Chain: ${swapResp.fromChain}\n`) +
                    `👤 Recipient: ${swapResp.to}\n` +
                    `\n📝 Transaction: ${swapResp.hash}\n\n` +
                    `Your tokens are on their way! ${operationType === 'bridge'
                        ? `🌉 The bridge is processing and tokens will arrive on ${swapResp.toChain} soon`
                        : operationType === 'cross-chain-swap'
                            ? `⛓️ The cross-chain swap is processing and tokens will arrive on ${swapResp.toChain} soon`
                            : '✨ Check your wallet for confirmation'
                    } 😊\n\n` +
                    `Need anything else? I'm here to help! 🤝`;

                callback({
                    text: formatClientMessage(successMessage, clientType),
                    content: {
                        success: true,
                        hash: swapResp.hash,
                        recipient: swapResp.to,
                        fromChain: swapResp.fromChain,
                        toChain: swapResp.toChain,
                        operationType: operationType
                    },
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in swap handler:", error.message);
            if (callback) {
                const clientType = (state?.client as { platform?: string })?.platform;
                callback({ text: formatClientMessage(error.message, clientType) });
            }
            return false;
        }
    },
    template: swapTemplate,
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        return true;
    },
    examples: [
        // Same-chain swaps
        [
            {
                user: "user",
                content: {
                    text: "Swap 1 ETH for USDC on Base",
                    action: "TOKEN_SWAP",
                },
            }
        ],
        // Cross-chain bridges
        [
            {
                user: "user",
                content: {
                    text: "Bridge 0.1 ETH from Base to Arbitrum",
                    action: "TOKEN_SWAP",
                }
            }
        ],
    ],
    similes: ["TOKEN_SWAP", "BRIDGE", "EXCHANGE_TOKENS", "TRADE_TOKENS"],
};
