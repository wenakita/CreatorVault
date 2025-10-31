use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};
use std::fs;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

#[derive(Serialize, Deserialize)]
struct VanityResult {
    contract_name: String,
    salt: String,
    address: String,
    deployer: String,
    attempts: u64,
    time_seconds: f64,
    pattern: String,
    timestamp: String,
}

fn main() {
    println!("\n╔══════════════════════════════════════════════════════════╗");
    println!("║  🦀 VANITY GENERATOR FOR EAGLESHAREOF ONLY             ║");
    println!("║      Pattern: 0x47...ea91e (FULL MATCH)                 ║");
    println!("╚══════════════════════════════════════════════════════════╝\n");

    let deployer = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
    let deployer_bytes = hex::decode(&deployer[2..]).expect("Invalid deployer address");

    println!("Deployer: {}", deployer);
    println!("Pattern:  0x47...ea91e (FULL)");
    println!();

    // Read EagleShareOFT artifact
    let artifact_path = "../out/EagleShareOFT.sol/EagleShareOFT.json";
    let artifact_content = fs::read_to_string(artifact_path)
        .expect("Failed to read EagleShareOFT artifact");
    
    let artifact: serde_json::Value = serde_json::from_str(&artifact_content)
        .expect("Failed to parse artifact JSON");
    
    let bytecode_hex = artifact["bytecode"]["object"]
        .as_str()
        .expect("Bytecode not found")
        .trim_start_matches("0x");
    
    // EagleShareOFT constructor args
    let name = "Eagle";
    let symbol = "EAGLE";
    let registry = "0x47c2e78bCCCdF3E4Ad835c1c2df3Fb760b0EA91E";
    let delegate = "0x7310Dd6EF89b7f829839F140C6840bc929ba2031";
    
    let constructor_args = format!(
        "{:0>64}{:0>64}{:0>64}{:0>64}{}{}",
        "80", // offset for name
        "c0", // offset for symbol
        &registry[2..],
        &delegate[2..],
        encode_string(name),
        encode_string(symbol)
    );
    
    let init_code = format!("{}{}", bytecode_hex, constructor_args);
    let init_code_bytes = hex::decode(&init_code).expect("Invalid init code");
    
    let mut hasher = Keccak256::new();
    hasher.update(&init_code_bytes);
    let init_code_hash = hasher.finalize();
    
    println!("Init Code Hash: 0x{}", hex::encode(&init_code_hash));
    println!("Init Code Size: {} bytes", init_code_bytes.len());
    println!();
    println!("🚀 Starting parallel search...");
    println!("   Using {} CPU cores", rayon::current_num_threads());
    println!();
    println!("⏱️  Estimated time: 3-10 minutes (depends on luck)");
    println!();

    let found = Arc::new(AtomicBool::new(false));
    let attempts = Arc::new(AtomicU64::new(0));
    let start = Instant::now();

    // Progress reporter thread
    let attempts_clone = attempts.clone();
    let found_clone = found.clone();
    std::thread::spawn(move || {
        let mut last_attempts = 0u64;
        loop {
            std::thread::sleep(std::time::Duration::from_secs(5));
            if found_clone.load(Ordering::Relaxed) {
                break;
            }
            let current = attempts_clone.load(Ordering::Relaxed);
            let delta = current - last_attempts;
            let speed = delta / 5;
            println!(
                "  Tried {:.1}M combinations... ({:.1}M attempts/sec)",
                current as f64 / 1_000_000.0,
                speed as f64 / 1_000_000.0
            );
            last_attempts = current;
        }
    });

    // Parallel search - FULL PATTERN
    let result = (0u64..u64::MAX)
        .into_par_iter()
        .find_map_any(|i| {
            if found.load(Ordering::Relaxed) {
                return None;
            }

            attempts.fetch_add(1, Ordering::Relaxed);

            let salt = i.to_be_bytes();
            let mut salt_32 = [0u8; 32];
            salt_32[24..].copy_from_slice(&salt);

            let address = calculate_create2_address(&deployer_bytes, &salt_32, &init_code_hash);

            // FULL PATTERN: starts with 0x47 AND ends with ea91e
            if address[0] == 0x47 && 
               address[17] == 0x0e && 
               address[18] == 0xa9 && 
               address[19] == 0x1e {
                found.store(true, Ordering::Relaxed);
                Some((salt_32, address, i))
            } else {
                None
            }
        });

    let elapsed = start.elapsed();
    let total_attempts = attempts.load(Ordering::Relaxed);

    if let Some((salt, address, _)) = result {
        println!();
        println!("✅ FOUND VANITY ADDRESS FOR EagleShareOFT!");
        println!("═══════════════════════════════════════════════════════");
        println!();
        println!("Salt:     0x{}", hex::encode(salt));
        println!("Address:  0x{}", hex::encode(address));
        println!();
        println!("Attempts: {}", total_attempts.to_formatted_string());
        println!("Time:     {:.2} seconds ({:.2} minutes)", elapsed.as_secs_f64(), elapsed.as_secs_f64() / 60.0);
        println!("Speed:    {:.1}M attempts/sec", 
                 total_attempts as f64 / elapsed.as_secs_f64() / 1_000_000.0);
        println!();
        println!("═══════════════════════════════════════════════════════");
        println!();

        let result = VanityResult {
            contract_name: "EagleShareOFT".to_string(),
            salt: format!("0x{}", hex::encode(salt)),
            address: format!("0x{}", hex::encode(address)),
            deployer: deployer.to_string(),
            attempts: total_attempts,
            time_seconds: elapsed.as_secs_f64(),
            pattern: "0x47...ea91e".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        let json = serde_json::to_string_pretty(&result).unwrap();
        fs::write("../eagleshareof-vanity.json", json)
            .expect("Failed to write result file");

        println!("✅ Saved to: eagleshareof-vanity.json");
        println!();
        println!("📝 Update script/DeployProductionVanity.s.sol:");
        println!();
        println!("bytes32 constant OFT_SALT = {};", result.salt);
        println!("address constant EXPECTED_OFT = {};", result.address);
        println!();
    } else {
        println!();
        println!("❌ Not found (this should never happen)");
    }
}

fn calculate_create2_address(deployer: &[u8], salt: &[u8; 32], init_code_hash: &[u8]) -> [u8; 20] {
    let mut hasher = Keccak256::new();
    hasher.update(&[0xff]);
    hasher.update(deployer);
    hasher.update(salt);
    hasher.update(init_code_hash);
    let hash = hasher.finalize();
    
    let mut address = [0u8; 20];
    address.copy_from_slice(&hash[12..]);
    address
}

fn encode_string(s: &str) -> String {
    let bytes = s.as_bytes();
    let len = bytes.len();
    let padded_len = ((len + 31) / 32) * 32;
    
    format!(
        "{:0>64}{}",
        format!("{:x}", len),
        hex::encode(bytes) + &"0".repeat((padded_len - len) * 2)
    )
}

trait ToFormattedString {
    fn to_formatted_string(&self) -> String;
}

impl ToFormattedString for u64 {
    fn to_formatted_string(&self) -> String {
        let s = self.to_string();
        let mut result = String::new();
        for (i, c) in s.chars().rev().enumerate() {
            if i > 0 && i % 3 == 0 {
                result.push(',');
            }
            result.push(c);
        }
        result.chars().rev().collect()
    }
}


