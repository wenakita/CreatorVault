import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { EagleRegistryClient, SOLANA_MAINNET_EID, WSOL_ADDRESS } from '../../solana-sdk/src';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Deploy and initialize Eagle Registry on Solana Mainnet
 * 
 * Prerequisites:
 * 1. Build the program: `anchor build`
 * 2. Deploy the program: `anchor deploy --provider.cluster mainnet`
 * 3. Update the program ID in Anchor.toml and lib.rs
 * 4. Rebuild: `anchor build`
 * 5. Run this script to initialize
 * 
 * IMPORTANT: Ensure you have sufficient SOL for deployment (~2-5 SOL)
 */

const SOLANA_MAINNET_RPC = process.env.SOLANA_MAINNET_RPC || 'https://api.mainnet-beta.solana.com';

// LayerZero Mainnet Endpoint Program ID
// TODO: Update with actual LayerZero V2 endpoint address for Solana
const LZ_MAINNET_ENDPOINT = new PublicKey('76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6');

async function main() {
  console.log('🚀 Deploying Eagle Registry to Solana Mainnet\n');
  console.log('⚠️  WARNING: This will deploy to MAINNET and consume real SOL!\n');

  // Load deployer wallet
  const walletPath = path.join(process.env.HOME!, '.config', 'solana', 'id.json');
  
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet not found at ${walletPath}. Please create one with: solana-keygen new`);
  }

  const walletSecret = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  const deployerKeypair = Keypair.fromSecretKey(new Uint8Array(walletSecret));
  
  console.log('Deployer:', deployerKeypair.publicKey.toBase58());

  // Connect to mainnet
  const connection = new Connection(SOLANA_MAINNET_RPC, 'confirmed');
  const wallet = new Wallet(deployerKeypair);

  // Check balance
  const balance = await connection.getBalance(deployerKeypair.publicKey);
  console.log('Balance:', balance / 1e9, 'SOL');
  
  if (balance < 0.5e9) {
    throw new Error('Insufficient balance! Need at least 0.5 SOL for initialization');
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

  console.log('\n📝 Initializing registry on mainnet...');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Initialize
  try {
    const tx = await client.initialize(
      SOLANA_MAINNET_EID,
      new PublicKey(WSOL_ADDRESS),
      LZ_MAINNET_ENDPOINT
    );

    console.log('\n✅ Registry initialized on mainnet!');
    console.log('Transaction:', `https://explorer.solana.com/tx/${tx}`);
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

    console.log('\n✅ Next steps:');
    console.log('1. Verify the program on Solana Explorer');
    console.log('2. Register all EVM peer chains');
    console.log('3. Update EVM registries with Solana data');
    console.log('4. Test cross-chain messaging');
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

