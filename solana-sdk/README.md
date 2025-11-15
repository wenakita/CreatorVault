# Eagle Registry Solana SDK

TypeScript SDK for interacting with the Eagle Registry Solana program via LayerZero V2.

## Installation

```bash
yarn install
yarn build
```

## Quick Start

```typescript
import { Connection, Keypair } from '@solana/web3.js';
import { Wallet } from '@coral-xyz/anchor';
import { EagleRegistryClient, SOLANA_MAINNET_EID, WSOL_ADDRESS } from '@eagle/solana-sdk';

// Connect to Solana
const connection = new Connection('https://api.mainnet-beta.solana.com');
const wallet = new Wallet(yourKeypair);

// Initialize client
const client = new EagleRegistryClient(connection, wallet);

// Fetch registry
const registry = await client.fetchRegistry();
console.log('Solana EID:', registry.solanaEid);
```

## Features

- ✅ Initialize and configure Solana registry
- ✅ Register EVM peer chains
- ✅ Fetch registry and peer configurations
- ✅ Ethereum address ↔ bytes32 conversion utilities
- ✅ LayerZero V2 integration (via Umi)

## API Reference

### EagleRegistryClient

#### Constructor

```typescript
new EagleRegistryClient(connection: Connection, wallet: any, programId?: PublicKey)
```

#### Methods

##### `initialize(solanaEid, wsolAddress, lzEndpoint): Promise<string>`
Initialize the registry with Solana configuration.

##### `updateConfig(newEndpoint?, isActive?): Promise<string>`
Update registry configuration.

##### `registerPeerChain(chainEid, chainName, peerAddress): Promise<string>`
Register an EVM peer chain.

##### `fetchRegistry(): Promise<RegistryConfig | null>`
Fetch the registry configuration.

##### `fetchPeerChain(chainEid): Promise<PeerChainConfig | null>`
Fetch a peer chain configuration.

##### `getRegistryPDA(): [PublicKey, number]`
Get the PDA for the main registry config.

##### `getPeerPDA(chainEid): [PublicKey, number]`
Get the PDA for a peer chain config.

#### Static Methods

##### `ethereumAddressToBytes32(address: string): number[]`
Convert Ethereum address (0x...) to bytes32 array.

##### `bytes32ToEthereumAddress(bytes: number[]): string`
Convert bytes32 array to Ethereum address.

## Constants

```typescript
export const SOLANA_MAINNET_EID = 30168;
export const WSOL_ADDRESS = 'So11111111111111111111111111111111111111112';

export const EVM_CHAIN_EIDS = {
  ETHEREUM: 30101,
  ARBITRUM: 30110,
  BASE: 30184,
  BSC: 30102,
  SONIC: 30332,
  AVALANCHE: 30106,
  HYPEREVM: 30367,
};

export const EAGLE_REGISTRY_EVM = '0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e';
```

## Documentation

See [SOLANA_INTEGRATION.md](../SOLANA_INTEGRATION.md) for comprehensive documentation.

## License

MIT

