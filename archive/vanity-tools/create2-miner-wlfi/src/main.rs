use sha3::{Digest, Keccak256};
use rayon::prelude::*;
use indicatif::{ProgressBar, ProgressStyle};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

/// Arachnid's Deterministic CREATE2 Factory
const FACTORY: [u8; 20] = hex_literal::hex!("4e59b44847b379578588920cA78FbF26c0B4956C");

/// WLFI OFT init code hash (computed from ComputeWLFIOFTHash.s.sol)
/// Name: "World Liberty Financial", Symbol: "WLFI"
const INIT_CODE_HASH: [u8; 32] = hex_literal::hex!("3fa5882f6f78e2c24e62f625902b7218c06f2efb09e176b4b6aedceab7cc8608");

/// Target prefix (0x47)
const PREFIX: [u8; 1] = [0x47];

/// Target suffix (0ea91e - exact match to EAGLE pattern)
const SUFFIX_BYTES: [u8; 3] = [0x0e, 0xa9, 0x1e]; // Match: 0x...0ea91e (3 full bytes, matching EAGLE)

fn main() {
    println!("========================================");
    println!("WLFI OFT CREATE2 Vanity Miner");
    println!("========================================");
    println!();
    println!("Target: 0x47...0ea91e (exact match to EAGLE pattern)");
    println!("Factory: 0x{}", hex::encode(FACTORY));
    println!();
    
    // Check init code hash is set
    if INIT_CODE_HASH == [0u8; 32] {
        eprintln!("ERROR: INIT_CODE_HASH not set!");
        eprintln!();
        eprintln!("Run this first:");
        eprintln!("  forge script script/layerzero/ComputeWLFIOFTHash.s.sol");
        eprintln!();
        eprintln!("Then update INIT_CODE_HASH in src/main.rs");
        std::process::exit(1);
    }
    
    println!("Init code hash: 0x{}", hex::encode(INIT_CODE_HASH));
    println!();
    println!("Mining with {} threads...", rayon::current_num_threads());
    println!();
    
    let found = Arc::new(AtomicBool::new(false));
    let attempts = Arc::new(AtomicU64::new(0));
    let start_time = Instant::now();
    
    // Progress bar
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.green} [{elapsed_precise}] {msg}")
            .unwrap()
    );
    
    // Spawn progress updater
    let pb_clone = pb.clone();
    let attempts_clone = attempts.clone();
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(1));
            let count = attempts_clone.load(Ordering::Relaxed);
            let elapsed = start_time.elapsed().as_secs_f64();
            let rate = count as f64 / elapsed;
            pb_clone.set_message(format!(
                "{} attempts ({:.2} MH/s)",
                count,
                rate / 1_000_000.0
            ));
        }
    });
    
    // Mine in parallel
    (0u64..u64::MAX).into_par_iter().find_any(|&salt| {
        if found.load(Ordering::Relaxed) {
            return false;
        }
        
        attempts.fetch_add(1, Ordering::Relaxed);
        
        let address = compute_create2_address(salt);
        
        // Check prefix (0x47)
        if address[0] != PREFIX[0] {
            return false;
        }
        
        // Check suffix (0ea91e) - exact match to EAGLE pattern
        let last_three = [address[17], address[18], address[19]];
        if last_three[0] != SUFFIX_BYTES[0] {
            return false;
        }
        if last_three[1] != SUFFIX_BYTES[1] {
            return false;
        }
        if last_three[2] != SUFFIX_BYTES[2] {
            return false;
        }
        
        // Found it!
        found.store(true, Ordering::Relaxed);
        pb.finish_with_message("Found!");
        
        println!();
        println!("========================================");
        println!("FOUND!");
        println!("========================================");
        println!();
        println!("Salt:    0x{:064x}", salt);
        println!("Address: 0x{}", hex::encode(address));
        println!();
        println!("Attempts: {}", attempts.load(Ordering::Relaxed));
        println!("Time:     {:.2}s", start_time.elapsed().as_secs_f64());
        println!();
        println!("Update DeployWLFIOFTExact.s.sol:");
        println!("  SALT = 0x{:064x};", salt);
        println!("  TARGET_ADDRESS = 0x{};", hex::encode(address));
        println!();
        
        true
    });
    
    if !found.load(Ordering::Relaxed) {
        println!("Mining stopped without finding address");
    }
}

fn compute_create2_address(salt: u64) -> [u8; 20] {
    let mut hasher = Keccak256::new();
    
    // keccak256(0xff ++ factory ++ salt ++ init_code_hash)
    hasher.update(&[0xff]);
    hasher.update(&FACTORY);
    hasher.update(&[0u8; 24]); // Pad salt to 32 bytes
    hasher.update(&salt.to_be_bytes());
    hasher.update(&INIT_CODE_HASH);
    
    let hash = hasher.finalize();
    
    // Take last 20 bytes
    let mut address = [0u8; 20];
    address.copy_from_slice(&hash[12..32]);
    address
}

// Helper macro for hex literals
mod hex_literal {
    macro_rules! hex {
        ($s:literal) => {{
            const fn decode_hex(s: &str) -> [u8; $s.len() / 2] {
                let bytes = s.as_bytes();
                let mut result = [0u8; $s.len() / 2];
                let mut i = 0;
                while i < result.len() {
                    let hi = match bytes[i * 2] {
                        b'0'..=b'9' => bytes[i * 2] - b'0',
                        b'a'..=b'f' => bytes[i * 2] - b'a' + 10,
                        b'A'..=b'F' => bytes[i * 2] - b'A' + 10,
                        _ => panic!("invalid hex"),
                    };
                    let lo = match bytes[i * 2 + 1] {
                        b'0'..=b'9' => bytes[i * 2 + 1] - b'0',
                        b'a'..=b'f' => bytes[i * 2 + 1] - b'a' + 10,
                        b'A'..=b'F' => bytes[i * 2 + 1] - b'A' + 10,
                        _ => panic!("invalid hex"),
                    };
                    result[i] = (hi << 4) | lo;
                    i += 1;
                }
                result
            }
            decode_hex($s)
        }};
    }
    pub(crate) use hex;
}
