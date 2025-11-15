import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { EagleRegistrySolana } from "../target/types/eagle_registry_solana";
import { assert } from "chai";

describe("eagle-registry-solana", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.EagleRegistrySolana as Program<EagleRegistrySolana>;
  
  // Test constants
  const SOLANA_EID = 40168; // Devnet EID
  const WSOL_ADDRESS = new PublicKey("So11111111111111111111111111111111111111112");
  const LZ_ENDPOINT = new PublicKey("11111111111111111111111111111112"); // Placeholder
  
  // EVM test data
  const ETHEREUM_EID = 30101;
  const ETHEREUM_NAME = "Ethereum";
  const ETHEREUM_REGISTRY_ADDRESS = "0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e";
  
  let registryPda: PublicKey;
  let registryBump: number;
  let ethereumPeerPda: PublicKey;
  let ethereumPeerBump: number;

  before(async () => {
    // Derive PDAs
    [registryPda, registryBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("registry")],
      program.programId
    );

    [ethereumPeerPda, ethereumPeerBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("peer"),
        Buffer.from(new Uint8Array(new Uint32Array([ETHEREUM_EID]).buffer))
      ],
      program.programId
    );
  });

  describe("initialize", () => {
    it("should initialize the registry", async () => {
      const tx = await program.methods
        .initialize(SOLANA_EID, WSOL_ADDRESS, LZ_ENDPOINT)
        .accounts({
          registryConfig: registryPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Initialize transaction signature", tx);

      // Fetch and verify registry
      const registry = await program.account.registryConfig.fetch(registryPda);
      
      assert.equal(registry.authority.toBase58(), provider.wallet.publicKey.toBase58());
      assert.equal(registry.solanaEid, SOLANA_EID);
      assert.equal(registry.wsolAddress.toBase58(), WSOL_ADDRESS.toBase58());
      assert.equal(registry.lzEndpoint.toBase58(), LZ_ENDPOINT.toBase58());
      assert.equal(registry.isActive, true);
      assert.equal(registry.bump, registryBump);
    });

    it("should fail to initialize twice", async () => {
      try {
        await program.methods
          .initialize(SOLANA_EID, WSOL_ADDRESS, LZ_ENDPOINT)
          .accounts({
            registryConfig: registryPda,
            authority: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        assert.fail("Expected error when initializing twice");
      } catch (error) {
        // Expected error - account already exists
        assert.include(error.toString(), "already in use");
      }
    });
  });

  describe("updateConfig", () => {
    it("should update the registry endpoint", async () => {
      const newEndpoint = Keypair.generate().publicKey;

      const tx = await program.methods
        .updateConfig(newEndpoint, null)
        .accounts({
          registryConfig: registryPda,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      console.log("Update config transaction signature", tx);

      // Verify update
      const registry = await program.account.registryConfig.fetch(registryPda);
      assert.equal(registry.lzEndpoint.toBase58(), newEndpoint.toBase58());
    });

    it("should update the registry active status", async () => {
      const tx = await program.methods
        .updateConfig(null, false)
        .accounts({
          registryConfig: registryPda,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      console.log("Update active status transaction signature", tx);

      // Verify update
      let registry = await program.account.registryConfig.fetch(registryPda);
      assert.equal(registry.isActive, false);

      // Set back to active for other tests
      await program.methods
        .updateConfig(null, true)
        .accounts({
          registryConfig: registryPda,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      registry = await program.account.registryConfig.fetch(registryPda);
      assert.equal(registry.isActive, true);
    });

    it("should fail when called by non-authority", async () => {
      const otherUser = Keypair.generate();

      try {
        await program.methods
          .updateConfig(null, false)
          .accounts({
            registryConfig: registryPda,
            authority: otherUser.publicKey,
          })
          .signers([otherUser])
          .rpc();
        
        assert.fail("Expected error when non-authority updates config");
      } catch (error) {
        // Expected error - unauthorized
        assert.include(error.toString(), "has_one");
      }
    });
  });

  describe("registerPeerChain", () => {
    it("should register Ethereum peer chain", async () => {
      // Convert Ethereum address to bytes32
      const peerAddress = ethereumAddressToBytes32(ETHEREUM_REGISTRY_ADDRESS);

      const tx = await program.methods
        .registerPeerChain(ETHEREUM_EID, ETHEREUM_NAME, peerAddress)
        .accounts({
          registryConfig: registryPda,
          peerConfig: ethereumPeerPda,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      console.log("Register peer chain transaction signature", tx);

      // Verify peer
      const peer = await program.account.peerChainConfig.fetch(ethereumPeerPda);
      
      assert.equal(peer.chainEid, ETHEREUM_EID);
      assert.equal(peer.chainName, ETHEREUM_NAME);
      assert.deepEqual(Array.from(peer.peerAddress), peerAddress);
      assert.equal(peer.isActive, true);
      assert.equal(peer.bump, ethereumPeerBump);
    });

    it("should fail to register peer with name too long", async () => {
      const longName = "A".repeat(33); // Max is 32
      const peerAddress = ethereumAddressToBytes32(ETHEREUM_REGISTRY_ADDRESS);
      const testEid = 12345;

      const [testPeerPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("peer"),
          Buffer.from(new Uint8Array(new Uint32Array([testEid]).buffer))
        ],
        program.programId
      );

      try {
        await program.methods
          .registerPeerChain(testEid, longName, peerAddress)
          .accounts({
            registryConfig: registryPda,
            peerConfig: testPeerPda,
            authority: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        
        assert.fail("Expected error when name is too long");
      } catch (error) {
        // Expected error - name too long
        assert.include(error.toString(), "NameTooLong");
      }
    });

    it("should fail when called by non-authority", async () => {
      const otherUser = Keypair.generate();
      const peerAddress = ethereumAddressToBytes32(ETHEREUM_REGISTRY_ADDRESS);
      const testEid = 12346;

      const [testPeerPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("peer"),
          Buffer.from(new Uint8Array(new Uint32Array([testEid]).buffer))
        ],
        program.programId
      );

      try {
        await program.methods
          .registerPeerChain(testEid, "Test Chain", peerAddress)
          .accounts({
            registryConfig: registryPda,
            peerConfig: testPeerPda,
            authority: otherUser.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([otherUser])
          .rpc();
        
        assert.fail("Expected error when non-authority registers peer");
      } catch (error) {
        // Expected error - unauthorized
        assert.include(error.toString(), "has_one");
      }
    });
  });

  describe("lzReceive", () => {
    it("should receive message from registered peer", async () => {
      const srcEid = ETHEREUM_EID;
      const sender = ethereumAddressToBytes32(ETHEREUM_REGISTRY_ADDRESS);
      const nonce = new anchor.BN(1);
      const guid = new Array(32).fill(0);
      const message = Buffer.from([0, 1, 2, 3]); // Action type 0 + data

      const tx = await program.methods
        .lzReceive(srcEid, sender, nonce, guid, Array.from(message))
        .accounts({
          registryConfig: registryPda,
          peerConfig: ethereumPeerPda,
          lzEndpoint: LZ_ENDPOINT,
        })
        .rpc();

      console.log("LZ receive transaction signature", tx);

      // Message should be processed successfully
      // In a real scenario, we'd verify state changes based on message content
    });

    it("should fail to receive empty message", async () => {
      const srcEid = ETHEREUM_EID;
      const sender = ethereumAddressToBytes32(ETHEREUM_REGISTRY_ADDRESS);
      const nonce = new anchor.BN(2);
      const guid = new Array(32).fill(0);
      const emptyMessage: number[] = [];

      try {
        await program.methods
          .lzReceive(srcEid, sender, nonce, guid, emptyMessage)
          .accounts({
            registryConfig: registryPda,
            peerConfig: ethereumPeerPda,
            lzEndpoint: LZ_ENDPOINT,
          })
          .rpc();
        
        assert.fail("Expected error when receiving empty message");
      } catch (error) {
        // Expected error - empty message
        assert.include(error.toString(), "EmptyMessage");
      }
    });

    it("should fail to receive message from unknown peer", async () => {
      const unknownEid = 99999;
      const sender = ethereumAddressToBytes32(ETHEREUM_REGISTRY_ADDRESS);
      const nonce = new anchor.BN(3);
      const guid = new Array(32).fill(0);
      const message = Buffer.from([0, 1, 2, 3]);

      const [unknownPeerPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("peer"),
          Buffer.from(new Uint8Array(new Uint32Array([unknownEid]).buffer))
        ],
        program.programId
      );

      try {
        await program.methods
          .lzReceive(unknownEid, sender, nonce, guid, Array.from(message))
          .accounts({
            registryConfig: registryPda,
            peerConfig: unknownPeerPda,
            lzEndpoint: LZ_ENDPOINT,
          })
          .rpc();
        
        assert.fail("Expected error when receiving from unknown peer");
      } catch (error) {
        // Expected error - account doesn't exist
        assert.include(error.toString(), "AccountNotInitialized");
      }
    });

    it("should fail when registry is inactive", async () => {
      // Disable registry
      await program.methods
        .updateConfig(null, false)
        .accounts({
          registryConfig: registryPda,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      const srcEid = ETHEREUM_EID;
      const sender = ethereumAddressToBytes32(ETHEREUM_REGISTRY_ADDRESS);
      const nonce = new anchor.BN(4);
      const guid = new Array(32).fill(0);
      const message = Buffer.from([0, 1, 2, 3]);

      try {
        await program.methods
          .lzReceive(srcEid, sender, nonce, guid, Array.from(message))
          .accounts({
            registryConfig: registryPda,
            peerConfig: ethereumPeerPda,
            lzEndpoint: LZ_ENDPOINT,
          })
          .rpc();
        
        assert.fail("Expected error when registry is inactive");
      } catch (error) {
        // Expected error - registry inactive
        assert.include(error.toString(), "RegistryInactive");
      }

      // Re-enable registry
      await program.methods
        .updateConfig(null, true)
        .accounts({
          registryConfig: registryPda,
          authority: provider.wallet.publicKey,
        })
        .rpc();
    });
  });

  describe("sendQuery", () => {
    it("should send query to registered peer", async () => {
      const dstEid = ETHEREUM_EID;
      const queryType = 1;
      const queryData = Buffer.from([1, 2, 3, 4]);

      const tx = await program.methods
        .sendQuery(dstEid, queryType, Array.from(queryData))
        .accounts({
          registryConfig: registryPda,
          peerConfig: ethereumPeerPda,
          lzEndpoint: LZ_ENDPOINT,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      console.log("Send query transaction signature", tx);

      // Query should be sent successfully
      // In a real scenario with LayerZero integration, we'd verify the message was sent
    });

    it("should fail when registry is inactive", async () => {
      // Disable registry
      await program.methods
        .updateConfig(null, false)
        .accounts({
          registryConfig: registryPda,
          authority: provider.wallet.publicKey,
        })
        .rpc();

      const dstEid = ETHEREUM_EID;
      const queryType = 1;
      const queryData = Buffer.from([1, 2, 3, 4]);

      try {
        await program.methods
          .sendQuery(dstEid, queryType, Array.from(queryData))
          .accounts({
            registryConfig: registryPda,
            peerConfig: ethereumPeerPda,
            lzEndpoint: LZ_ENDPOINT,
            authority: provider.wallet.publicKey,
          })
          .rpc();
        
        assert.fail("Expected error when registry is inactive");
      } catch (error) {
        // Expected error - registry inactive
        assert.include(error.toString(), "RegistryInactive");
      }

      // Re-enable registry
      await program.methods
        .updateConfig(null, true)
        .accounts({
          registryConfig: registryPda,
          authority: provider.wallet.publicKey,
        })
        .rpc();
    });
  });
});

// Helper function to convert Ethereum address to bytes32
function ethereumAddressToBytes32(address: string): number[] {
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

