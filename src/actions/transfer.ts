import { type ByteArray, formatEther, parseEther, type Hex } from "viem";
import {
    type Action,
    composeContext,
    generateObjectDeprecated,
    type HandlerCallback,
    ModelClass,
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
} from "@elizaos/core";

import { initWalletProvider, type WalletProvider } from "../providers/wallet.ts";
import type { Transaction, TransferParams } from "../types/index.ts";
import { transferTemplate } from "../templates/index.ts";

// Add token mapping for common tokens
const TOKEN_ADDRESSES: Record<string, Record<string, `0x${string}`>> = {
    arbitrum: {
        ETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
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

// Exported for tests
export class TransferAction {
    constructor(private walletProvider: WalletProvider) {}

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

    async transfer(params: TransferParams): Promise<Transaction> {
        console.log(
            `Transferring: ${params.amount} tokens to (${params.toAddress} on ${params.fromChain})`
        );

        if (!params.data) {
            params.data = "0x";
        }

        this.walletProvider.switchChain(params.fromChain);

        const walletClient = this.walletProvider.getWalletClient(
            params.fromChain
        );

        try {
            const hash = await walletClient.sendTransaction({
                account: walletClient.account,
                to: params.toAddress,
                value: parseEther(params.amount),
                data: params.data as Hex,
                kzg: {
                    blobToKzgCommitment: (_: ByteArray): ByteArray => {
                        throw new Error("Function not implemented.");
                    },
                    computeBlobKzgProof: (
                        _blob: ByteArray,
                        _commitment: ByteArray
                    ): ByteArray => {
                        throw new Error("Function not implemented.");
                    },
                },
                chain: undefined,
            });

            return {
                hash,
                from: walletClient.account.address,
                to: params.toAddress,
                value: parseEther(params.amount),
                data: params.data as Hex,
            };
        } catch (error) {
            throw new Error(`Transfer failed: ${error.message}`);
        }
    }
}

const buildTransferDetails = async (
    state: State,
    runtime: IAgentRuntime,
    wp: WalletProvider
): Promise<TransferParams> => {
    const chains = Object.keys(wp.chains);
    state.supportedChains = chains.map((item) => `"${item}"`).join("|");

    const context = composeContext({
        state,
        template: transferTemplate,
    });

    const transferDetails = (await generateObjectDeprecated({
        runtime,
        context,
        modelClass: ModelClass.SMALL,
    })) as TransferParams;

    const existingChain = wp.chains[transferDetails.fromChain];

    if (!existingChain) {
        throw new Error(
            "The chain " +
                transferDetails.fromChain +
                " not configured yet. Add the chain or choose one from configured: " +
                chains.toString()
        );
    }

    return transferDetails;
};

export const transferAction: Action = {
    name: "transfer",
    description: "Transfer tokens between addresses on the same chain",
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

        console.log("Transfer action handler called");
        
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

        const walletProvider = await initWalletProvider(runtime, userId);
        const action = new TransferAction(walletProvider);

        // Compose transfer context
        const paramOptions = await buildTransferDetails(
            state,
            runtime,
            walletProvider
        );

        try {
            const transferResp = await action.transfer(paramOptions);
            if (callback) {
                callback({
                    text: `Successfully transferred ${paramOptions.amount} tokens to ${paramOptions.toAddress}\nTransaction Hash: ${transferResp.hash}`,
                    content: {
                        success: true,
                        hash: transferResp.hash,
                        amount: formatEther(transferResp.value),
                        recipient: transferResp.to,
                        chain: paramOptions.fromChain,
                    },
                });
            }
            return true;
        } catch (error) {
            console.error("Error during token transfer:", error);
            if (callback) {
                callback({
                    text: `Error transferring tokens: ${error.message}`,
                    content: { error: error.message },
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
                user: "assistant",
                content: {
                    text: "I'll help you transfer 1 ETH to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                    action: "SEND_TOKENS",
                },
            },
            {
                user: "user",
                content: {
                    text: "Transfer 1 ETH to 0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
                    action: "SEND_TOKENS",
                },
            },
        ],
    ],
    similes: ["SEND_TOKENS", "TOKEN_TRANSFER", "MOVE_TOKENS"],
};