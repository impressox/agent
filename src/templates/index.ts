export const walletInfoTemplate = `You are an AI assistant specialized in retrieving blockchain wallet information.

First, review the recent user messages:

<recent_messages>
{{recentMessages}}
</recent_messages>

Here is a list of supported chains:
<supported_chains>
{{supportedChains}}
</supported_chains>

Your task is to determine the blockchain network (chain) from the user message, if specified. If not explicitly mentioned, default to "arbitrum".

Extract and return the chain in the following JSON format:

\`\`\`json
{
  "chain": "ethereum" | "base" | "sepolia" | "bsc" | "arbitrum" | "arbitrumSepolia" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | "alienx"
}
\`\`\`
`;

export const swapTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Here's a list of supported chains:
<supported_chains>
{{supportedChains}}
</supported_chains>

Extract the following information about the requested token swap:
- fromToken: Input token symbol or address (the token being sold)
- toToken: Output token symbol or address (the token being bought)
- Amount to swap: Must be a string representing the amount in ether (only number without coin symbol, e.g., "0.1")
- FromChain: The chain the swap is initiated from (must be one of the supported chains)
- ToChain: The destination chain (optional, default to fromChain if not cross-chain)
- ToAddress: Recipient address (optional, must be a valid Ethereum address)

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined:

\`\`\`json
{
    "fromToken": string | null,
    "toToken": string | null,
    "amount": string | null,
    "fromChain": "ethereum" | "abstract" | "base" | "sepolia" | "bsc" | "arbitrum" | "arbitrumSepolia" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | "alienx" | null,
    "toChain": "ethereum" | "abstract" | "base" | "sepolia" | "bsc" | "arbitrum" | "arbitrumSepolia" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | "alienx" | null,
    "toAddress": string | null
}
\`\`\`
`;

export const quoteTemplate = `You are an AI assistant specialized in processing token swap quote requests. Your task is to extract structured information to retrieve a swap quote.

First, review the conversation history and wallet context:

<recent_messages>
{{recentMessages}}
</recent_messages>

<wallet_info>
{{walletInfo}}
</wallet_info>

List of supported chains:
<supported_chains>
{{supportedChains}}
</supported_chains>

Your goal is to extract the following information:
- fromChain: The chain the swap is initiated from (must be one of the supported chains)
- toChain: The destination chain (optional, default to fromChain if not cross-chain)
- fromToken: Symbol or address of the token being sold
- toToken: Symbol or address of the token being bought
- amount: The amount of the input token to swap, must be a string representing a number without any symbol (e.g., "1.5")

Return the information in the following JSON format. Use null for any values that cannot be determined:

\`\`\`json
{
  "fromChain": "ethereum" | "base" | "sepolia" | "bsc" | "arbitrum" | "arbitrumSepolia" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | "alienx" | null,
  "toChain": "ethereum" | "base" | "sepolia" | "bsc" | "arbitrum" | "arbitrumSepolia" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | "alienx" | null,
  "fromToken": string | null,
  "toToken": string | null,
  "amount": string | null
}
\`\`\`
`;

export const transferTemplate = `You are an AI assistant specialized in processing cryptocurrency transfer requests. Your task is to extract specific information from user messages and format it into a structured JSON response.

First, review the recent messages from the conversation:

<recent_messages>
{{recentMessages}}
</recent_messages>

Here's a list of supported chains:
<supported_chains>
{{supportedChains}}
</supported_chains>

Your goal is to extract the following information about the requested transfer:
1. Chain to execute on (must be one of the supported chains)
2. Amount to transfer (in ETH, without the coin symbol)
3. Recipient address (must be a valid Ethereum address)
4. Token symbol or address (if not a native token transfer)

Before providing the final JSON output, show your reasoning process inside <analysis> tags. Follow these steps:

1. Identify the relevant information from the user's message:
   - Quote the part of the message mentioning the chain.
   - Quote the part mentioning the amount.
   - Quote the part mentioning the recipient address.
   - Quote the part mentioning the token (if any).

2. Validate each piece of information:
   - Chain: List all supported chains and check if the mentioned chain is in the list.
   - Amount: Attempt to convert the amount to a number to verify it's valid.
   - Address: Check that it starts with "0x" and count the number of characters (should be 42).
   - Token: Note whether it's a native transfer or if a specific token is mentioned.

3. If any information is missing or invalid, prepare an appropriate error message.

4. If all information is valid, summarize your findings.

5. Prepare the JSON structure based on your analysis.

After your analysis, provide the final output in a JSON markdown block. All fields except 'token' are required. The JSON should have this structure:

\`\`\`json
{
    "fromChain": string,
    "amount": string,
    "toAddress": string,
    "token": string | null
}
\`\`\`

Remember:
- The chain name must be a string and must exactly match one of the supported chains.
- The amount should be a string representing the number without any currency symbol.
- The recipient address must be a valid Ethereum address starting with "0x".
- If no specific token is mentioned (i.e., it's a native token transfer), set the "token" field to null.

Now, process the user's request and provide your response.
`;

export const proposeTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested proposal:
- Targets
- Values
- Calldatas
- Description
- Governor address
- Chain to execute on

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined:

\`\`\`json
{
    "targets": string[] | null,
    "values": string[] | null,
    "calldatas": string[] | null,
    "description": string | null,
    "governor": string | null
    "chain": "ethereum" | "base" | "sepolia" | "bsc" | "arbitrum" | "arbitrumSepolia" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | null,
}
\`\`\`
`;

export const voteTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested vote:
- Proposal ID
- Support (1 for yes, 2 for no, 3 for abstain)
- Governor address
- Chain to execute on

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined:

\`\`\`json
{
    "proposalId": string | null,
    "support": number | null,
    "governor": string | null
    "chain": "ethereum" | "base" | "sepolia" | "bsc" | "arbitrum" | "arbitrumSepolia" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | null,
}
\`\`\`
`;

export const queueProposalTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested proposal:
- Targets
- Values
- Calldatas
- Description
- Governor address
- Chain to execute on

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined:

\`\`\`json
{
    "targets": string[] | null,
    "values": string[] | null,
    "calldatas": string[] | null,
    "description": string | null,
    "governor": string | null
    "chain": "ethereum" | "base" | "sepolia" | "bsc" | "arbitrum" | "arbitrumSepolia" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | null,
}
\`\`\`
`;

export const executeProposalTemplate = `Given the recent messages and wallet information below:

{{recentMessages}}

{{walletInfo}}

Extract the following information about the requested proposal:
- Targets
- Values
- Calldatas
- Description
- Governor address
- Chain to execute on

Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined:

\`\`\`json
{
    "targets": string[] | null,
    "values": string[] | null,
    "calldatas": string[] | null,
    "description": string | null,
    "governor": string | null
    "chain": "ethereum" | "base" | "sepolia" | "bsc" | "arbitrum" | "arbitrumSepolia" | "avalanche" | "polygon" | "optimism" | "cronos" | "gnosis" | "fantom" | "klaytn" | "celo" | "moonbeam" | "aurora" | "harmonyOne" | "moonriver" | "arbitrumNova" | "mantle" | "linea" | "scroll" | "filecoin" | "taiko" | "zksync" | "canto" | null,
}
\`\`\`
`;