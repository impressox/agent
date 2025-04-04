import type { Route, Token } from "@lifi/types";
import type {
    Account,
    Address,
    Chain,
    Hash,
    HttpTransport,
    PublicClient,
    WalletClient,
    Log,
} from "viem";
import * as viemChains from "viem/chains";

const _SupportedChainList = Object.keys(viemChains) as Array<
    keyof typeof viemChains
>;
export type SupportedChain = (typeof _SupportedChainList)[number];

// Transaction types
export interface Transaction {
    hash: Hash;
    from: Address;
    to: Address;
    value: bigint;
    data?: `0x${string}`;
    chainId?: number;
    logs?: Log[];
    fromChain?: string | null;
    toChain?: string | null;
}

// Token types
export interface TokenWithBalance {
    token: Token;
    balance: bigint;
    formattedBalance: string;
    priceUSD: string;
    valueUSD: string;
}

export interface WalletBalance {
    chain: SupportedChain;
    address: Address;
    totalValueUSD: string;
    tokens: TokenWithBalance[];
}

// Chain configuration
export interface ChainMetadata {
    chainId: number;
    name: string;
    chain: Chain;
    rpcUrl: string;
    nativeCurrency: {
        name: string;
        symbol: string;
        decimals: number;
    };
    blockExplorerUrl: string;
}

export interface ChainConfig {
    chain: Chain;
    publicClient: PublicClient<HttpTransport, Chain, Account | undefined>;
    walletClient?: WalletClient;
}

// Action parameters
export interface TransferParams {
    fromChain: SupportedChain;
    toAddress: Address;
    amount: string;
    data?: `0x${string}`;
}

export interface SwapParams {
    fromChain: SupportedChain;
    toChain: SupportedChain;
    fromToken: Address;
    toToken: Address;
    amount: string;
    toAddress?: Address;
}

export interface BebopRoute {
    data: string;
    approvalTarget: Address;
    sellAmount: string;
    from: Address;
    to: Address;
    value: string;
    gas: string;
    gasPrice: string;
}

export interface QuoteParams {
    fromChain: SupportedChain;
    toChain: SupportedChain;
    fromToken: Address;
    toToken: Address;
}
// Plugin configuration
export interface EvmPluginConfig {
    rpcUrl?: {
        ethereum?: string;
        abstract?: string;
        base?: string;
        sepolia?: string;
        bsc?: string;
        arbitrum?: string;
        avalanche?: string;
        polygon?: string;
        optimism?: string;
        cronos?: string;
        gnosis?: string;
        fantom?: string;
        fraxtal?: string;
        klaytn?: string;
        celo?: string;
        moonbeam?: string;
        aurora?: string;
        harmonyOne?: string;
        moonriver?: string;
        arbitrumNova?: string;
        mantle?: string;
        linea?: string;
        scroll?: string;
        filecoin?: string;
        taiko?: string;
        zksync?: string;
        canto?: string;
        alienx?: string;
        gravity?: string;
    };
    secrets?: {
        EVM_PRIVATE_KEY: string;
    };
    testMode?: boolean;
    multicall?: {
        batchSize?: number;
        wait?: number;
    };
}

// LiFi types
export type LiFiStatus = {
    status: "PENDING" | "DONE" | "FAILED";
    substatus?: string;
    error?: Error;
};

export type LiFiRoute = {
    transactionHash: Hash;
    transactionData: `0x${string}`;
    toAddress: Address;
    status: LiFiStatus;
};

// Provider types
export interface TokenData extends Token {
    symbol: string;
    decimals: number;
    address: Address;
    name: string;
    logoURI?: string;
    chainId: number;
}

export interface TokenPriceResponse {
    priceUSD: string;
    token: TokenData;
}

export interface TokenListResponse {
    tokens: TokenData[];
}

export interface ProviderError extends Error {
    code?: number;
    data?: unknown;
}

export enum VoteType {
    AGAINST = 0,
    FOR = 1,
    ABSTAIN = 2,
}

export interface Proposal {
    targets: Address[];
    values: bigint[];
    calldatas: `0x${string}`[];
    description: string;
}

export interface VoteParams {
    chain: SupportedChain;
    governor: Address;
    proposalId: string;
    support: VoteType;
}

export interface QueueProposalParams extends Proposal {
    chain: SupportedChain;
    governor: Address;
}

export interface ExecuteProposalParams extends Proposal {
    chain: SupportedChain;
    governor: Address;
    proposalId: string;
}

export interface ProposeProposalParams extends Proposal {
    chain: SupportedChain;
    governor: Address;
}

// Wallet types
export interface UserWallet {
    userId: string;
    privateKey: string;
    address: Address;
    createdAt: Date;
    updatedAt: Date;
}

export type OperationType = 'swap' | 'bridge' | 'cross-chain-swap';

export interface TransactionResponse {
    success: boolean;
    hash: string;
    recipient: string;
    fromChain: string;
    toChain: string;
    operationType: OperationType;
}

// Relay SDK types
export interface QuoteResponse {
    route: {
        steps: Array<{
            action: string;
            description: string;
            fromToken: string;
            toToken: string;
            fromAmount: string;
            toAmount: string;
            fromChain: string;
            toChain: string;
        }>;
    };
    estimatedGas: string;
    totalSteps: number;
}
