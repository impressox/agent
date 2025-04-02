# Product Context: EspressoX

## Purpose
EspressoX addresses the growing need for seamless cross-chain token transfers and swaps in the fragmented blockchain ecosystem. As the blockchain space expands with multiple Layer 2 solutions and sidechains, users need efficient ways to move assets between different networks.

## Problems Solved

### 1. Cross-Chain Complexity
- Simplifies the complex process of moving tokens between different blockchain networks
- Abstracts away technical complexities of cross-chain bridges
- Provides unified interface for multiple chains

### 2. Token Accessibility
- Enables easy access to tokens across different chains
- Supports major tokens (ETH, USDC, USDT)
- Facilitates liquidity movement between networks

### 3. Integration Challenges
- Integrates with Relay SDK for optimal routing
- Standardizes interaction with different blockchain networks
- Provides consistent error handling and transaction monitoring

## How It Works

### Core Flow
1. User initiates bridge/swap action
2. System validates parameters and wallet state
3. Relay SDK finds optimal routes
4. Transaction is executed and monitored
5. User receives confirmation and transaction details

### Key Components
1. Wallet Provider
   - Manages blockchain connections
   - Handles address management
   - Ensures secure transactions

2. Action System
   - Processes bridge requests
   - Handles token swaps
   - Manages transaction flow

3. Route Finding
   - Integrates with Relay SDK for route discovery
   - Optimizes for best execution path
   - Handles multiple token pairs

## User Experience Goals

### 1. Simplicity
- Clear and straightforward bridging process
- Intuitive parameter handling
- Meaningful error messages

### 2. Reliability
- Consistent transaction execution
- Robust error handling
- Clear transaction status updates

### 3. Security
- Secure wallet integration
- Protected transaction handling
- Validated token transfers

### 4. Performance
- Quick route discovery
- Efficient transaction execution
- Minimal waiting times

## Integration Context
- Built on ElizaOS framework
- Uses Relay SDK for routing
- Supports multiple client types (via ElizaOS adapters)
- Compatible with major EVM chains
