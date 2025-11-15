import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { EagleRegistryClient, WSOL_ADDRESS } from '../../solana-sdk/src';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Deploy and initialize Eagle Registry on Solana Devnet
 * 
 * Prerequisites:
 * 1. Build the program: `anchor build`
 * 2. Deploy the program: `anchor deploy --provider.cluster devnet`
 * 3. Update the program ID in Anchor.toml and lib.rs
 * 4. Rebuild: `anchor build`
 * 5. Run this script to initialize
 */

const SOLANA_DEVNET_RPC = process.env.SOLANA_DEVNET_RPC || 'https://api.devnet.solana.com';
const SOLANA_DEVNET_EID = 40168; // Devnet EID (different from mainnet)

// LayerZero Devnet Endpoint (placeholder - update with actual devnet endpoint)
const LZ_DEVNET_ENDPOINT = new PublicKey('11111111111111111111111111111112');

async function main() {
  console.log('🚀 Deploying Eagle Registry to Solana Devnet\n');

  // Load deployer wallet
  const walletPath = path.join(process.env.HOME!, '.config', 'solana', 'id.json');
  
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet not found at ${walletPath}. Please create one with: solana-keygen new`);
  }

  const walletSecret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const deployerKeypair = Keypair.fromSecretKey(new Uint8Array(walletSecret));
  
  console.log('Deployer:', deployerKeypair.publicKey.toBase58());

  // Connect to devnet
  const connection = new Connection(SOLANA_DEVNET_RPC, 'confirmed');
  const wallet = new Wallet(deployerKeypair);

  // Check balance
  const balance = await connection.getBalance(deployerKeypair.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL');
  
  if (balance < 1e9) {
    console.log('\n⚠️  Low balance! Get devnet SOL from:');
    console.log('https://faucet.solana.com');
    console.log('or run: solana airdrop 2');
    return;
  }

  // Initialize client
  const client = new EagleRegistryClient(connection, wallet);
  
  console.log('\nProgram ID:', client.program.programId.toBase58());

  // Check if already initialized
  const existingRegistry = await client.fetchRegistry();
  
  if (existingRegistry) {
    console.log('\n✅ Registry already initialized!');
    console.log('Registry PDA:', client.getRegistryPDA()[0].toBase58());
    console.log('Authority:', existingRegistry.authority.toBase58());
    console.log('Solana EID:', existingRegistry.solanaEid);
    console.log('WSOL:', existingRegistry.wsolAddress.toBase58());
    console.log('LZ Endpoint:', existingRegistry.lzEndpoint.toBase58());
    console.log('Active:', existingRegistry.isActive);
    return;
  }

  console.log('\n📝 Initializing registry...');

  // Initialize
  try {
    const tx = await client.initialize(
      SOLANA_DEVNET_EID,
      new PublicKey(WSOL_ADDRESS),
      LZ_DEVNET_ENDPOINT
    );

    console.log('\n✅ Registry initialized!');
    console.log('Transaction:', `https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    console.log('Registry PDA:', client.getRegistryPDA()[0].toBase58());

    // Verify
    const registry = await client.fetchRegistry();
    if (registry) {
      console.log('\n📊 Registry Config:');
      console.log('  Authority:', registry.authority.toBase58());
      console.log('  Solana EID:', registry.solanaEid);
      console.log('  WSOL:', registry.wsolAddress.toBase58());
      console.log('  LZ Endpoint:', registry.lzEndpoint.toBase58());
      console.log('  Active:', registry.isActive);
    }
  } catch (error) {
    console.error('\n❌ Failed to initialize:', error);
    throw error;
  }

  console.log('\n✨ Deployment complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

