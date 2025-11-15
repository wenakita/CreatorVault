import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { Umi, createSignerFromKeypair, signerIdentity, publicKey as umiPublicKey } from '@metaplex-foundation/umi';
import { EagleRegistrySolana } from './types/eagle_registry_solana';
import idl from './idl/eagle_registry_solana.json';

export interface RegistryConfig {
  authority: PublicKey;
  solanaEid: number;
  wsolAddress: PublicKey;
  lzEndpoint: PublicKey;
  isActive: boolean;
  bump: number;
}

export interface PeerChainConfig {
  chainEid: number;
  chainName: string;
  peerAddress: number[];
  isActive: boolean;
  bump: number;
}

export class EagleRegistryClient {
  public program: Program<EagleRegistrySolana>;
  public umi: Umi;
  public connection: Connection;

  constructor(
    connection: Connection,
    wallet: any,
    programId?: PublicKey
  ) {
    this.connection = connection;
    
    // Initialize Anchor provider
    const provider = new AnchorProvider(
      connection,
      wallet,
      AnchorProvider.defaultOptions()
    );

    // Initialize program
    const pid = programId || new PublicKey(idl.address);
    this.program = new Program(idl as any, provider) as Program<EagleRegistrySolana>;

    // Initialize Umi for LayerZero integration
    this.umi = createUmi(connection.rpcEndpoint);
    
    if (wallet.payer) {
      const signer = createSignerFromKeypair(this.umi, {
        publicKey: umiPublicKey(wallet.payer.publicKey.toBase58()),
        secretKey: wallet.payer.secretKey
      });
      this.umi.use(signerIdentity(signer));
    }
  }

  /**
   * Get the PDA for the main registry config
   */
  getRegistryPDA(): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('registry')],
      this.program.programId
    );
  }

  /**
   * Get the PDA for a peer chain config
   */
  getPeerPDA(chainEid: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('peer'), Buffer.from(new Uint8Array(new Uint32Array([chainEid]).buffer))],
      this.program.programId
    );
  }

  /**
   * Initialize the registry
   */
  async initialize(
    solanaEid: number,
    wsolAddress: PublicKey,
    lzEndpoint: PublicKey
  ): Promise<string> {
    const [registryPDA] = this.getRegistryPDA();

    const tx = await this.program.methods
      .initialize(solanaEid, wsolAddress, lzEndpoint)
      .accounts({
        registryConfig: registryPDA,
        authority: this.program.provider.publicKey!,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Update registry configuration
   */
  async updateConfig(
    newEndpoint?: PublicKey,
    isActive?: boolean
  ): Promise<string> {
    const [registryPDA] = this.getRegistryPDA();

    const tx = await this.program.methods
      .updateConfig(newEndpoint || null, isActive !== undefined ? isActive : null)
      .accounts({
        registryConfig: registryPDA,
        authority: this.program.provider.publicKey!,
      })
      .rpc();

    return tx;
  }

  /**
   * Register a peer EVM chain
   */
  async registerPeerChain(
    chainEid: number,
    chainName: string,
    peerAddress: number[] // 32-byte array
  ): Promise<string> {
    if (peerAddress.length !== 32) {
      throw new Error('Peer address must be 32 bytes');
    }

    const [registryPDA] = this.getRegistryPDA();
    const [peerPDA] = this.getPeerPDA(chainEid);

    const tx = await this.program.methods
      .registerPeerChain(chainEid, chainName, Array.from(peerAddress))
      .accounts({
        registryConfig: registryPDA,
        peerConfig: peerPDA,
        authority: this.program.provider.publicKey!,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    return tx;
  }

  /**
   * Fetch the registry configuration
   */
  async fetchRegistry(): Promise<RegistryConfig | null> {
    const [registryPDA] = this.getRegistryPDA();
    
    try {
      const account = await this.program.account.registryConfig.fetch(registryPDA);
      return account as RegistryConfig;
    } catch {
      return null;
    }
  }

  /**
   * Fetch a peer chain configuration
   */
  async fetchPeerChain(chainEid: number): Promise<PeerChainConfig | null> {
    const [peerPDA] = this.getPeerPDA(chainEid);
    
    try {
      const account = await this.program.account.peerChainConfig.fetch(peerPDA);
      return account as PeerChainConfig;
    } catch {
      return null;
    }
  }

  /**
   * Convert Ethereum address (0x...) to bytes32 array
   */
  static ethereumAddressToBytes32(address: string): number[] {
    // Remove 0x prefix if present
    const hex = address.startsWith('0x') ? address.slice(2) : address;
    
    // Pad to 32 bytes (64 hex chars) with leading zeros
    const padded = hex.padStart(64, '0');
    
    // Convert to byte array
    const bytes: number[] = [];
    for (let i = 0; i < padded.length; i += 2) {
      bytes.push(parseInt(padded.substr(i, 2), 16));
    }
    
    return bytes;
  }

  /**
   * Convert bytes32 array to Ethereum address
   */
  static bytes32ToEthereumAddress(bytes: number[]): string {
    // Take last 20 bytes (Ethereum address is 20 bytes)
    const addressBytes = bytes.slice(-20);
    const hex = addressBytes.map(b => b.toString(16).padStart(2, '0')).join('');
    return '0x' + hex;
  }
}

export default EagleRegistryClient;

