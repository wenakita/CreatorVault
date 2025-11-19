use rayon::prelude::*;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tiny_keccak::{Hasher, Keccak};

/// Standard CREATE2 Factory (immutable-create2-factory)
/// https://github.com/Arachnid/deterministic-deployment-proxy
const CREATE2_FACTORY: &str = "0x4e59b44847b379578588920cA78FbF26c0B4956C";

/// CharmStrategyWETH Init Bytecode Hash (FIXED VERSION with constructor args)
const INIT_CODE_HASH: &str = "0x36b22c74af57426b6ff9d510eec2b7793aee4ebd90a5c763f032f0561e525309";

/// Target prefix (0x47)
const TARGET_PREFIX: &[u8] = &[0x47];

fn hex_to_bytes(hex: &str) -> Vec<u8> {
    let hex = hex.strip_prefix("0x").unwrap_or(hex);
    hex::decode(hex).expect("Invalid hex string")
}

fn compute_create2_address(factory: &[u8], salt: &[u8; 32], init_code_hash: &[u8]) -> [u8; 20] {
    let mut hasher = Keccak::v256();
    
    // keccak256(0xff ++ factory ++ salt ++ initCodeHash)
    hasher.update(&[0xff]);
    hasher.update(factory);
    hasher.update(salt);
    hasher.update(init_code_hash);
    
    let mut output = [0u8; 32];
    hasher.finalize(&mut output);
    
    // Take last 20 bytes (address)
    let mut address = [0u8; 20];
    address.copy_from_slice(&output[12..]);
    address
}

fn matches_prefix(address: &[u8; 20], prefix: &[u8]) -> bool {
    address.starts_with(prefix)
}

fn main() {
    println!("🦅 Eagle CREATE2 Vanity Address Miner");
    println!("{}", "=".repeat(60));
    println!();
    println!("🎯 Target Prefix: 0x{}", hex::encode(TARGET_PREFIX));
    println!("🏭 Factory:       {}", CREATE2_FACTORY);
    println!("📦 Init Hash:     {}", INIT_CODE_HASH);
    println!();
    println!("🚀 Mining with {} threads...", rayon::current_num_threads());
    println!("{}", "=".repeat(60));
    println!();

    let factory = hex_to_bytes(CREATE2_FACTORY);
    let init_code_hash = hex_to_bytes(INIT_CODE_HASH);
    
    let found = Arc::new(AtomicBool::new(false));
    let attempts = Arc::new(AtomicU64::new(0));
    let start_time = Instant::now();
    
    // Spawn a thread to print progress
    let attempts_clone = Arc::clone(&attempts);
    let found_clone = Arc::clone(&found);
    std::thread::spawn(move || {
        let start = Instant::now();
        loop {
            std::thread::sleep(std::time::Duration::from_secs(5));
            if found_clone.load(Ordering::Relaxed) {
                break;
            }
            let count = attempts_clone.load(Ordering::Relaxed);
            let elapsed = start.elapsed().as_secs_f64();
            let rate = count as f64 / elapsed;
            println!("⏱️  Attempts: {:>12} | Rate: {:>10.0} H/s | Time: {:.1}s", 
                     count, rate, elapsed);
        }
    });

    // Parallel mining using par_bridge for unbounded iterator
    let result = (0u64..).into_iter().par_bridge().find_map_any(|nonce| {
        if found.load(Ordering::Relaxed) {
            return None;
        }
        
        // Create salt from nonce
        let mut salt = [0u8; 32];
        salt[24..].copy_from_slice(&nonce.to_be_bytes());
        
        // Compute address
        let address = compute_create2_address(&factory, &salt, &init_code_hash);
        
        // Update attempts counter
        attempts.fetch_add(1, Ordering::Relaxed);
        
        // Check if it matches
        if matches_prefix(&address, TARGET_PREFIX) {
            found.store(true, Ordering::Relaxed);
            Some((salt, address, nonce))
        } else {
            None
        }
    });

    let elapsed = start_time.elapsed();
    let total_attempts = attempts.load(Ordering::Relaxed);
    
    println!();
    println!("{}", "=".repeat(60));
    
    if let Some((salt, address, nonce)) = result {
        println!("✅ FOUND MATCHING ADDRESS!");
        println!("{}", "=".repeat(60));
        println!();
        println!("🎉 Address:  0x{}", hex::encode(address));
        println!("🔑 Salt:     0x{}", hex::encode(salt));
        println!("🔢 Nonce:    {}", nonce);
        println!();
        println!("📊 Statistics:");
        println!("   Attempts: {}", total_attempts);
        println!("   Time:     {:.2}s", elapsed.as_secs_f64());
        println!("   Rate:     {:.0} H/s", total_attempts as f64 / elapsed.as_secs_f64());
        println!();
        println!("{}", "=".repeat(60));
        println!("📝 DEPLOYMENT INSTRUCTIONS");
        println!("{}", "=".repeat(60));
        println!();
        println!("1. Use this salt in your CREATE2 deployment:");
        println!("   Salt: 0x{}", hex::encode(salt));
        println!();
        println!("2. Deploy via CREATE2 Factory:");
        println!("   Factory: {}", CREATE2_FACTORY);
        println!("   Function: deploy(bytes memory bytecode, bytes32 salt)");
        println!();
        println!("3. The deployed address will be:");
        println!("   0x{}", hex::encode(address));
        println!();
        println!("🔗 Verify with Etherscan CREATE2 Calculator:");
        println!("   https://etherscan.io/address/{}", CREATE2_FACTORY);
        println!();
    } else {
        println!("❌ Mining interrupted");
    }
    
    println!("{}", "=".repeat(60));
}

