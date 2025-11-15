import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import {
  EagleRegistryClient,
  EVM_CHAIN_EIDS,
  EAGLE_REGISTRY_EVM,
} from '../../solana-sdk/src';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Configure peer EVM chains in the Solana registry
 * This registers all 7 EVM chains where Eagle Registry is deployed
 */

const SOLANA_RPC = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
const IS_DEVNET = process.env.SOLANA_CLUSTER === 'devnet';

// EVM Chain configurations
const EVM_CHAINS = [
  { eid: EVM_CHAIN_EIDS.ETHEREUM, name: 'Ethereum' },
  { eid: EVM_CHAIN_EIDS.ARBITRUM, name: 'Arbitrum One' },
  { eid: EVM_CHAIN_EIDS.BASE, name: 'Base' },
  { eid: EVM_CHAIN_EIDS.BSC, name: 'BNB Chain' },
  { eid: EVM_CHAIN_EIDS.SONIC, name: 'Sonic' },
  { eid: EVM_CHAIN_EIDS.AVALANCHE, name: 'Avalanche' },
  { eid: EVM_CHAIN_EIDS.HYPEREVM, name: 'HyperEVM' },
];

async function main() {
  console.log('🔗 Configuring EVM peer chains in Solana registry\n');

  // Load deployer wallet
  const walletPath = path.join(process.env.HOME!, '.config', 'solana', 'id.json');
  
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet not found at ${walletPath}`);
  }

  const walletSecret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const deployerKeypair = Keypair.fromSecretKey(new Uint8Array(walletSecret));
  
  console.log('Authority:', deployerKeypair.publicKey.toBase58());
  console.log('Cluster:', IS_DEVNET ? 'Devnet' : 'Mainnet');

  // Connect to Solana
  const connection = new Connection(SOLANA_RPC, 'confirmed');
  const wallet = new Wallet(deployerKeypair);

  // Check balance
  const balance = await connection.getBalance(deployerKeypair.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL\n');

  // Initialize client
  const client = new EagleRegistryClient(connection, wallet);

  // Verify registry exists
  const registry = await client.fetchRegistry();
  if (!registry) {
    throw new Error('Registry not initialized! Run deploy script first.');
  }

  console.log('Registry PDA:', client.getRegistryPDA()[0].toBase58());
  console.log('Registry Authority:', registry.authority.toBase58());
  
  if (registry.authority.toBase58() !== deployerKeypair.publicKey.toBase58()) {
    throw new Error('Wallet is not the registry authority!');
  }

  // Convert EVM registry address to bytes32
  const peerAddressBytes = EagleRegistryClient.ethereumAddressToBytes32(EAGLE_REGISTRY_EVM);

  console.log('\nEVM Registry Address:', EAGLE_REGISTRY_EVM);
  console.log('As bytes32:', peerAddressBytes.map(b => b.toString(16).padStart(2, '0')).join(''));
  console.log('\nRegistering peer chains...\n');

  // Register each EVM chain
  for (const chain of EVM_CHAINS) {
    try {
      // Check if already registered
      const existing = await client.fetchPeerChain(chain.eid);
      
      if (existing) {
        console.log(`✅ ${chain.name} (EID ${chain.eid}) - Already registered`);
        continue;
      }

      // Register new peer
      console.log(`📝 Registering ${chain.name} (EID ${chain.eid})...`);
      
      const tx = await client.registerPeerChain(
        chain.eid,
        chain.name,
        peerAddressBytes
      );

      console.log(`✅ ${chain.name} registered!`);
      console.log(`   Tx: https://explorer.solana.com/tx/${tx}${IS_DEVNET ? '?cluster=devnet' : ''}`);
      console.log(`   PDA: ${client.getPeerPDA(chain.eid)[0].toBase58()}\n`);

      // Brief delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Failed to register ${chain.name}:`, error);
    }
  }

  console.log('\n🎉 Peer chain configuration complete!');
  console.log('\nRegistered peers:');
  
  for (const chain of EVM_CHAINS) {
    const peer = await client.fetchPeerChain(chain.eid);
    if (peer) {
      console.log(`  ✅ ${peer.chainName} (EID ${peer.chainEid}) - Active: ${peer.isActive}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

