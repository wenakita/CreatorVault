import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import fs from "fs";

// Program ID (deployed on devnet)
const PROGRAM_ID = new PublicKey("7wSrZXHF6BguZ1qwkXdZcNf3qyV2MPNvcztQLwrh9qPJ");

// Devnet connection
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function initialize() {
  console.log("🚀 Initializing Eagle Registry on Solana Devnet...\n");

  // Load wallet keypair
  const walletPath = process.env.HOME + "/.config/solana/id.json";
  const walletKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  console.log("👛 Wallet:", walletKeypair.publicKey.toBase58());
  
  // Try to get balance, but don't fail if network issue
  try {
    const balance = await connection.getBalance(walletKeypair.publicKey);
    console.log("💰 Balance:", balance / 1e9, "SOL\n");
  } catch (e) {
    console.log("💰 Balance: (unable to fetch - network issue)\n");
  }

  // Set up Anchor provider
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Load program IDL
  const idlPath = "../../target/idl/eagle_registry_solana.json";
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  
  // Create program instance with explicit program ID
  const program = new Program(idl as anchor.Idl, PROGRAM_ID, provider) as any;

  // Derive registry PDA
  const [registryPda, registryBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("registry")],
    program.programId
  );

  console.log("📝 Registry PDA:", registryPda.toBase58());
  console.log("🔢 Registry Bump:", registryBump);
  console.log("");

  // Check if already initialized
  try {
    const registryAccount = await program.account.registryConfig.fetch(registryPda);
    console.log("✅ Registry already initialized!");
    console.log("   Authority:", registryAccount.authority.toBase58());
    console.log("   Chain Count:", registryAccount.chainCount);
    return;
  } catch (e) {
    console.log("⚠️  Registry not initialized yet, proceeding...\n");
  }

  // LayerZero endpoint for Solana devnet
  // Official LayerZero V2 Endpoint on Solana
  const lzEndpoint = new PublicKey("76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6");

  console.log("🔧 Initializing with:");
  console.log("   Authority:", walletKeypair.publicKey.toBase58());
  console.log("   LZ Endpoint:", lzEndpoint.toBase58());
  console.log("");

  try {
    const tx = await program.methods
      .initialize(lzEndpoint)
      .accounts({
        registryConfig: registryPda,
        authority: walletKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Registry initialized!");
    console.log("📝 Transaction:", tx);
    console.log("");
    console.log("🔗 View on Solana Explorer:");
    console.log(`   https://explorer.solana.com/tx/${tx}?cluster=devnet`);
  } catch (error) {
    console.error("❌ Initialization failed:", error);
    throw error;
  }
}

initialize()
  .then(() => {
    console.log("\n✅ Initialization complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });

