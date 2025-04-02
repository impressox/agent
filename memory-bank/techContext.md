# Technical Context: EspressoX

## Technology Stack

### Core Technologies
- **Language**: TypeScript (Node.js >=22)
- **Package Manager**: pnpm
- **Build Tools**: tsup
- **Process Manager**: PM2

### Key Dependencies

#### Blockchain & DeFi
```json
{
    "@reservoir0x/relay-sdk": "^1.6.12",
    "viem": "^2.24.3"
}
```

#### ElizaOS Framework
```json
{
    "@elizaos/core": "0.1.9",
    "@elizaos/plugin-bootstrap": "0.1.9",
    "@elizaos/plugin-node": "0.1.9"
}
```

#### Database Adapters
```json
{
    "@elizaos/adapter-mongodb": "^0.25.6-alpha.1",
    "@elizaos/adapter-postgres": "0.1.9",
    "@elizaos/adapter-sqlite": "0.1.9"
}
```

#### Client Adapters
```json
{
    "@elizaos/client-auto": "0.1.9",
    "@elizaos/client-direct": "0.1.9",
    "@elizaos/client-discord": "0.1.9",
    "@elizaos/client-telegram": "0.1.9",
    "@elizaos/client-twitter": "0.1.9"
}
```

## Development Environment

### Project Structure
```
/
├── src/
│   ├── actions/       # Bridge, swap, transfer actions
│   ├── cache/         # Caching layer
│   ├── chat/          # Chat interaction handling
│   ├── clients/       # Client implementations
│   ├── config/        # Configuration management
│   ├── database/      # Database interactions
│   ├── plugins/       # Plugin system
│   ├── providers/     # Wallet provider
│   ├── services/      # Business logic services
│   ├── templates/     # Action templates
│   └── types/         # TypeScript type definitions
├── scripts/           # Utility scripts
└── characters/        # Character configurations
```

### Build Configuration

#### TypeScript Config (tsconfig.json)
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true
  }
}
```

### Development Scripts
```json
{
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "start": "tsc && node --loader ts-node/esm src/index.ts",
    "clean": "./scripts/clean.sh",
    "start:service:all": "pm2 start pnpm --name=\"all\" --restart-delay=3000 --max-restarts=10 -- run start:all",
    "stop:service:all": "pm2 stop all"
  }
}
```

## Tool Usage Patterns

### 1. Development Tools
- **VSCode**: Primary IDE
- **PM2**: Process management
- **tsup**: Build tooling
- **ts-node**: TypeScript execution

### 2. Testing Tools
- Unit testing setup pending
- Integration testing infrastructure needed
- Manual testing through client adapters

### 3. Deployment Tools
- Docker support (Dockerfile and compose files)
- PM2 for process management
- Environment configuration via .env

## Technical Constraints

### 1. Node.js Version
- Requires Node.js version 22 or higher
- Uses ES Modules (type: "module")
- Leverages modern JavaScript features

### 2. Network Requirements
- RPC endpoint availability
- Chain-specific requirements
- Network stability for cross-chain operations

### 3. Dependencies
- Relay SDK constraints
- ElizaOS framework version compatibility
- Blockchain network compatibility

## Configuration Management

### 1. Environment Variables
- RPC URLs
- API keys
- Network configurations

### 2. Chain Configurations
```typescript
{
    id: number;
    name: string;
    nativeCurrency: {
        symbol: string;
        decimals: number;
    };
    rpcUrls: {
        default: {
            http: string[];
        };
    };
    blockExplorers: {
        default: {
            url: string;
        };
    };
}
```

### 3. Token Configurations
```typescript
{
    [chain: string]: {
        [token: string]: `0x${string}`;
    };
}
```

## Development Practices

### 1. Code Organization
- Modular architecture
- Clear separation of concerns
- Type-safe implementations

### 2. Error Handling
- Comprehensive error types
- Consistent error propagation
- Detailed error logging

### 3. Security Practices
- Input validation
- Transaction verification
- Secure configuration management
