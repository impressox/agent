import type { IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import {
    composeContext,
    generateObjectDeprecated,
    ModelClass,
    elizaLogger,
} from "@elizaos/core";
import {
    createConfig,
    executeRoute,
    type ExtendedChain,
    getRoutes,
} from "@lifi/sdk";

import { initWalletProvider, type WalletProvider } from "../providers/wallet.ts";
import { bridgeTemplate } from "../templates/index.ts";
import type { BridgeParams, Transaction } from "../types/index.ts";
import { parseEther } from "viem";

export { bridgeTemplate };

// Add type for Telegram message
interface TelegramMessage extends Memory {
    from?: {
        id: number;
    };
}

// Add token mapping for common tokens
const TOKEN_ADDRESSES: Record<string, Record<string, `0x${string}`>> = {
    arbitrum: {
        ETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
        USDC: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
        USDT: "0xfadfd7c7bcdbfc5fe26a5c9ab5d5b22a0c6d1c1"
    },
    arbitrumSepolia: {
        ETH: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // WETH
        USDC: "0x75faf114eafb1BD4eD4158D358e94834c6B7b7c3",
        USDT: "0x4c36388bE6F416A29C8d8EDB3f0f9B9B9b5b3b3b"
    },
    base: {
        ETH: "0x4200000000000000000000000000000000000006", // WETH
        USDC: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        USDT: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb"
    }
};

export class BridgeAction {
    private config;

    constructor(private walletProvider: WalletProvider) {
        this.config = createConfig({
            integrator: "eliza",
            chains: Object.values(this.walletProvider.chains).map((config) => ({
                id: config.id,
                name: config.name,
                key: config.name.toLowerCase(),
                chainType: "EVM",
                nativeToken: {
                    ...config.nativeCurrency,
                    chainId: config.id,
                    address: TOKEN_ADDRESSES[config.name.toLowerCase()]?.ETH || "0x0000000000000000000000000000000000000000",
                    coinKey: config.nativeCurrency.symbol,
                },
                metamask: {
                    chainId: `0x${config.id.toString(16)}`,
                    chainName: config.name,
                    nativeCurrency: config.nativeCurrency,
                    rpcUrls: [config.rpcUrls.default.http[0]],
                    blockExplorerUrls: [config.blockExplorers.default.url],
                },
                diamondAddress: "0x0000000000000000000000000000000000000000",
                coin: config.nativeCurrency.symbol,
                mainnet: true,
            })) as ExtendedChain[],
        });
    }

    private getTokenAddress(chain: string, tokenSymbol: string): `0x${string}` {
        // If token is already an address, return it
        if (tokenSymbol.startsWith("0x") && tokenSymbol.length === 42) {
            return tokenSymbol as `0x${string}`;
        }

        // Convert symbol to uppercase for consistency
        const symbol = tokenSymbol.toUpperCase();
        
        // Check if token exists in mapping
        const chainTokens = TOKEN_ADDRESSES[chain.toLowerCase()];
        if (chainTokens && chainTokens[symbol]) {
            return chainTokens[symbol];
        }

        throw new Error(`Token ${tokenSymbol} not supported. Please provide a valid token address.`);
    }

    async bridge(params: BridgeParams): Promise<Transaction> {
        const walletClient = this.walletProvider.getWalletClient(
            params.fromChain
        );
        const [fromAddress] = await walletClient.getAddresses();

        // Convert token symbols to addresses
        const fromTokenAddress = this.getTokenAddress(params.fromChain, params.fromToken);
        const toTokenAddress = this.getTokenAddress(params.toChain, params.toToken);

        const routes = await getRoutes({
            fromChainId: this.walletProvider.getChainConfigs(params.fromChain)
                .id,
            toChainId: this.walletProvider.getChainConfigs(params.toChain).id,
            fromTokenAddress: fromTokenAddress,
            toTokenAddress: toTokenAddress,
            fromAmount: parseEther(params.amount).toString(),
            fromAddress: fromAddress,
            toAddress: params.toAddress || fromAddress,
        });

        if (!routes.routes.length) throw new Error("No routes found");

        const execution = await executeRoute(routes.routes[0], this.config);
        const process = execution.steps[0]?.execution?.process[0];

        if (!process?.status || process.status === "FAILED") {
            throw new Error("Transaction failed");
        }

        return {
            hash: process.txHash as `0x${string}`,
            from: fromAddress,
            to: routes.routes[0].steps[0].estimate
                .approvalAddress as `0x${string}`,
            value: BigInt(params.amount),
            chainId: this.walletProvider.getChainConfigs(params.fromChain).id,
        };
    }
}

export const bridgeAction = {
    name: "bridge",
    description: "Bridge tokens between different chains",
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

        console.log("Bridge action handler called");
        
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
        const action = new BridgeAction(walletProvider);

        // Compose bridge context
        const bridgeContext = composeContext({
            state,
            template: bridgeTemplate,
        });
        const content = await generateObjectDeprecated({
            runtime,
            context: bridgeContext,
            modelClass: ModelClass.LARGE,
        });

        const bridgeOptions: BridgeParams = {
            fromChain: content.fromChain,
            toChain: content.toChain,
            fromToken: content.token,
            toToken: content.token,
            toAddress: content.toAddress,
            amount: content.amount,
        };

        try {
            const bridgeResp = await action.bridge(bridgeOptions);
            if (callback) {
                callback({
                    text: `Successfully bridge ${bridgeOptions.amount} ${bridgeOptions.fromToken} tokens from ${bridgeOptions.fromChain} to ${bridgeOptions.toChain}\nTransaction Hash: ${bridgeResp.hash}`,
                    content: {
                        success: true,
                        hash: bridgeResp.hash,
                        recipient: bridgeResp.to,
                        chain: bridgeOptions.fromChain,
                    },
                });
            }
            return true;
        } catch (error) {
            console.error("Error in bridge handler:", error.message);
            if (callback) {
                callback({ text: `Error: ${error.message}` });
            }
            return false;
        }
    },
    template: bridgeTemplate,
    validate: async (runtime: IAgentRuntime) => {
        return true; // No need to validate MongoDB config anymore
    },
    examples: [
        [
            {
                user: "user",
                content: {
                    text: "Bridge 1 ETH from Ethereum to Base",
                    action: "CROSS_CHAIN_TRANSFER",
                },
            },
        ],
    ],
    similes: ["CROSS_CHAIN_TRANSFER", "CHAIN_BRIDGE", "MOVE_CROSS_CHAIN"],
};