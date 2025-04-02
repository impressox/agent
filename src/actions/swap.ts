import type { IAgentRuntime, Memory, State } from "@elizaos/core";
import {
    composeContext,
    generateObjectDeprecated,
    ModelClass,
    elizaLogger,
} from "@elizaos/core";
import { initWalletProvider, type WalletProvider } from "../providers/wallet.ts";
import { swapTemplate } from "../templates/index.js";
import type { SwapParams, Transaction } from "../types/index.ts";
import {
    type Address,
    type Hex,
    parseAbi,
    parseUnits,
    Chain,
} from "viem";
import { convertViemChainToRelayChain, RelayClient, TESTNET_RELAY_API, getClient, createClient } from "@reservoir0x/relay-sdk";

export { swapTemplate };

// Add token mapping for common tokens
const TOKEN_ADDRESSES: Record<string, Record<string, `0x${string}`>> = {
    arbitrum: {
        ETH: "0x0000000000000000000000000000000000000000",
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        USDC: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        USDT: "0xfadfd7c7bcdbfc5fe26a5c9ab5d5b22a0c6d1c1"
    },
    arbitrumsepolia: {
        ETH: "0x0000000000000000000000000000000000000000",
        WETH: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",
        USDC: "0xf3C3351D6Bd0098EEb33ca8f830FAf2a141Ea2E1",
        USDT: "0x30fA2FbE15c1EaDfbEF28C188b7B8dbd3c1Ff2eB"
    },
    base: {
        ETH: "0x0000000000000000000000000000000000000000",
        WETH: "0x4200000000000000000000000000000000000006",
        USDC: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        USDT: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb"
    },
    sepolia: {
        ETH: "0x0000000000000000000000000000000000000000",
        WETH: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
        USDC: "0xf08A50178dfcDe18524640EA6618a1f965821715",
        USDT: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0"
    }
};

export class SwapAction {
    private relayClient: RelayClient;

    constructor(private walletProvider: WalletProvider) {
        try {
            const chains = Object.values(this.walletProvider.chains).map(c => convertViemChainToRelayChain(c as Chain));

            if (!TESTNET_RELAY_API) {
                throw new Error("TESTNET_RELAY_API is not defined");
            }

            createClient({
                baseApiUrl: TESTNET_RELAY_API,
                chains
            });
        } catch (error) {
            elizaLogger.error("Error initializing RelayClient:", error);
            throw error;
        }
    }

    getTokenAddress(chain: string, tokenSymbol: string): `0x${string}` {
        // If token is already an address, return it with checksum
        if (tokenSymbol.startsWith("0x") && tokenSymbol.length === 42) {
            return tokenSymbol.toLowerCase() as `0x${string}`;
        }

        // Convert symbol to uppercase for consistency
        const symbol = tokenSymbol.toUpperCase();

        // Check if token exists in mapping
        const chainTokens = TOKEN_ADDRESSES[chain.toLowerCase()];
        if (chainTokens && chainTokens[symbol]) {
            return chainTokens[symbol].toLowerCase() as `0x${string}`;
        }

        throw new Error(`Token ${tokenSymbol} not supported. Please provide a valid token address.`);
    }

    async getTokenDecimals(chain: string, tokenAddress: Address): Promise<number> {
        try {
            // For native ETH, return 18
            if (tokenAddress === "0x0000000000000000000000000000000000000000") {
                return 18;
            }

            // For other tokens, try to read decimals from contract
            const decimalsAbi = parseAbi([
                "function decimals() view returns (uint8)",
            ]);
            const decimals = await this.walletProvider
                .getPublicClient(chain as any)
                .readContract({
                    address: tokenAddress,
                    abi: decimalsAbi,
                    functionName: "decimals",
                });
            return decimals;
        } catch (error) {
            elizaLogger.error("Error getting token decimals:", error);
            // Default to 18 decimals if not found
            return 18;
        }
    }

    async swap(params: SwapParams): Promise<Transaction> {
        const walletClient = this.walletProvider.getWalletClient(params.chain);
        const [fromAddress] = await walletClient.getAddresses();

        // Convert token symbols to addresses
        const fromTokenAddress = this.getTokenAddress(params.chain, params.fromToken);
        const toTokenAddress = this.getTokenAddress(params.chain, params.toToken);

        // Get token decimals
        const fromTokenDecimals = await this.getTokenDecimals(params.chain, fromTokenAddress);

        try {
            let balance = await this.walletProvider.getBalanceForChainAndToken(params.chain, fromTokenAddress, fromTokenDecimals);;

            if (parseUnits(balance, fromTokenDecimals) < parseUnits(params.amount, fromTokenDecimals)) {
                throw new Error(`Insufficient balance. Please deposit funds to address ${this.walletProvider.getAddress()} to continue the transaction.`);
            }
            const chain = this.walletProvider.getChainConfigs(params.chain);
            // Get quote from Relay
            const quote = await getClient()?.actions.getQuote({
                chainId: chain.id,
                toChainId: chain.id,
                currency: fromTokenAddress,
                toCurrency: toTokenAddress,
                amount: parseUnits(params.amount, fromTokenDecimals).toString(),
                wallet: walletClient as any,
                tradeType: "EXACT_INPUT"
            });

            if (!quote) {
                throw new Error("No routes found");
            }

            // Execute the swap
            const tx = await getClient()?.actions.execute({
                quote,
                wallet: walletClient as any,
                onProgress: ({ steps, fees, breakdown, currentStep, currentStepItem, txHashes, details }) => {
                    console.log("Transaction submitted");
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
                chainId: chain.id
            };
        } catch (error) {
            elizaLogger.error("Error in swap:", error.message);
            throw error;
        }
    }
}

export const swapAction = {
    name: "swap",
    description: "Swap tokens on the same chain",
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
                callback({ text: "Error: User ID is required" });
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
            chain: content.chain,
            fromToken: content.inputToken,
            toToken: content.outputToken,
            amount: content.amount,
            slippage: content.slippage,
        };

        try {
            const swapResp = await action.swap(swapOptions);
            if (callback) {
                callback({
                    text: `Successfully swap ${swapOptions.amount} ${swapOptions.fromToken} tokens to ${swapOptions.toToken}\nTransaction Hash: ${swapResp.hash}`,
                    content: {
                        success: true,
                        hash: swapResp.hash,
                        recipient: swapResp.to,
                        chain: content.chain,
                    },
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error in swap handler:", error.message);
            if (callback) {
                callback({ text: `Error: ${error.message}` });
            }
            return false;
        }
    },
    template: swapTemplate,
    validate: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
        return true;
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Swap 1 ETH for USDC on Base",
                    action: "TOKEN_SWAP",
                },
            },
            {
                user: "user",
                content: {
                    text: "Swap 0.1 ETH for 0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0 on Arbitrum Sepolia",
                    action: "TOKEN_SWAP",
                }
            }
        ],
    ],
    similes: ["TOKEN_SWAP", "EXCHANGE_TOKENS", "TRADE_TOKENS"],
};