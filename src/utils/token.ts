import { Address, parseAbi } from "viem";
import { WalletProvider } from "../plugins";
import { elizaLogger } from "@elizaos/core";

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

export const getTokenAddress = (chain: string, tokenSymbol: string): `0x${string}` => {
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

    throw new Error(`❌ Token Error: ${tokenSymbol} is not supported on ${chain}.\n\nSupported tokens:\n${Object.keys(chainTokens || {}).join(", ")}\n\nOr provide a valid token address.`);
}

export const getTokenDecimals = async(walletProvider: WalletProvider, chain: string, tokenAddress: Address): Promise<number> => {
        try {
            // For native ETH, return 18
            if (tokenAddress === "0x0000000000000000000000000000000000000000") {
                return 18;
            }

            // For other tokens, try to read decimals from contract
            const decimalsAbi = parseAbi([
                "function decimals() view returns (uint8)",
            ]);
            const decimals = await walletProvider
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