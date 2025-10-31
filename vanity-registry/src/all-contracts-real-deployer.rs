use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};
use std::fs;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

#[derive(Serialize, Deserialize, Clone)]
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

#[derive(Serialize)]
struct AllResults {
    results: Vec<VanityResult>,
    total_time_seconds: f64,
    deployer: String,
}

fn main() {
    println!("\n╔══════════════════════════════════════════════════════════╗");
    println!("║  🦀 VANITY GENERATOR - ALL CONTRACTS                   ║");
    println!("║      Real Deployer: 0x7310Dd6EF89b7f829839F140C6840bc929ba2031 ║");
    println!("║      Pattern: 0x47...ea91e (FULL MATCH)                 ║");
    println!("╚══════════════════════════════════════════════════════════╝\n");

    // YOUR ACTUAL DEPLOYER ADDRESS
    let deployer = "0x7310Dd6EF89b7f829839F140C6840bc929ba2031";
    let deployer_bytes = hex::decode(&deployer[2..]).expect("Invalid deployer address");

    println!("Deployer: {}", deployer);
    println!("Pattern:  0x47...ea91e (FULL)");
    println!();

    let mut all_results = Vec::new();
    let total_start = Instant::now();

    // Contract 1: EagleShareOFT (PREMIUM - full pattern)
    println!("═══════════════════════════════════════════════════════════");
    println!("CONTRACT 1/4: EagleShareOFT [PREMIUM VANITY]");
    println!("═══════════════════════════════════════════════════════════\n");
    
    let oft_result = generate_vanity_oft(&deployer_bytes, deployer);
    all_results.push(oft_result);
    
    println!("\n");

    // Contract 2: EagleOVault (partial pattern 0x47...)
    println!("═══════════════════════════════════════════════════════════");
    println!("CONTRACT 2/4: EagleOVault [PARTIAL VANITY]");
    println!("═══════════════════════════════════════════════════════════\n");
    
    let vault_result = generate_vanity_vault(&deployer_bytes, deployer);
    all_results.push(vault_result);
    
    println!("\n");

    // Contract 3: EagleVaultWrapper (partial pattern 0x47...)
    println!("═══════════════════════════════════════════════════════════");
    println!("CONTRACT 3/4: EagleVaultWrapper [PARTIAL VANITY]");
    println!("═══════════════════════════════════════════════════════════\n");
    
    let wrapper_result = generate_vanity_wrapper(&deployer_bytes, deployer);
    all_results.push(wrapper_result);
    
    println!("\n");

    // Contract 4: CharmStrategyUSD1 (partial pattern 0x47...)
    println!("═══════════════════════════════════════════════════════════");
    println!("CONTRACT 4/4: CharmStrategyUSD1 [PARTIAL VANITY]");
    println!("═══════════════════════════════════════════════════════════\n");
    
    let strategy_result = generate_vanity_strategy(&deployer_bytes, deployer);
    all_results.push(strategy_result);

    let total_elapsed = total_start.elapsed();

    // Save all results
    let all_results_json = AllResults {
        results: all_results.clone(),
        total_time_seconds: total_elapsed.as_secs_f64(),
        deployer: deployer.to_string(),
    };

    let json = serde_json::to_string_pretty(&all_results_json).unwrap();
    fs::write("../vanity-addresses-real-deployer.json", json)
        .expect("Failed to write results file");

    println!("\n");
    println!("╔══════════════════════════════════════════════════════════╗");
    println!("║  ✅ ALL CONTRACTS COMPLETE!                             ║");
    println!("╚══════════════════════════════════════════════════════════╝\n");
    println!("Total Time: {:.2} minutes", total_elapsed.as_secs_f64() / 60.0);
    println!();
    println!("Results saved to: vanity-addresses-real-deployer.json");
    println!();
    
    // Print summary
    println!("SUMMARY:");
    println!("═══════════════════════════════════════════════════════════");
    for result in &all_results {
        println!("{:20} → {}", result.contract_name, result.address);
    }
    println!("═══════════════════════════════════════════════════════════");
}

fn generate_vanity_oft(deployer_bytes: &[u8], deployer: &str) -> VanityResult {
    let artifact_path = "../out/EagleShareOFT.sol/EagleShareOFT.json";
    let artifact_content = fs::read_to_string(artifact_path)
        .expect("Failed to read EagleShareOFT artifact");
    
    let artifact: serde_json::Value = serde_json::from_str(&artifact_content)
        .expect("Failed to parse artifact JSON");
    
    let bytecode_hex = artifact["bytecode"]["object"]
        .as_str()
        .expect("Bytecode not found")
        .trim_start_matches("0x");
    
    let name = "Eagle";
    let symbol = "EAGLE";
    let registry = "0x47c2e78bCCCdF3E4Ad835c1c2df3Fb760b0EA91E";
    let delegate = deployer;
    
    let constructor_args = format!(
        "{:0>64}{:0>64}{:0>64}{:0>64}{}{}",
        "80",
        "c0",
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
    println!("Searching for FULL pattern: 0x47...ea91e");
    println!();
    
    find_vanity_full_pattern(deployer_bytes, &init_code_hash, "EagleShareOFT", deployer)
}

fn generate_vanity_vault(deployer_bytes: &[u8], deployer: &str) -> VanityResult {
    let artifact_path = "../out/EagleOVault.sol/EagleOVault.json";
    let artifact_content = fs::read_to_string(artifact_path)
        .expect("Failed to read EagleOVault artifact");
    
    let artifact: serde_json::Value = serde_json::from_str(&artifact_content)
        .expect("Failed to parse artifact JSON");
    
    let bytecode_hex = artifact["bytecode"]["object"]
        .as_str()
        .expect("Bytecode not found")
        .trim_start_matches("0x");
    
    let wlfi = "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6";
    let usd1 = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
    let price_feed = "0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d";
    let pool = "0x4637Ea6eCf7E16C99E67E941ab4d7d52eAc7c73d";
    let router = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
    
    let constructor_args = format!(
        "{:0>64}{:0>64}{:0>64}{:0>64}{:0>64}{:0>64}",
        &wlfi[2..],
        &usd1[2..],
        &price_feed[2..],
        &pool[2..],
        &router[2..],
        &deployer[2..]
    );
    
    let init_code = format!("{}{}", bytecode_hex, constructor_args);
    let init_code_bytes = hex::decode(&init_code).expect("Invalid init code");
    
    let mut hasher = Keccak256::new();
    hasher.update(&init_code_bytes);
    let init_code_hash = hasher.finalize();
    
    println!("Init Code Hash: 0x{}", hex::encode(&init_code_hash));
    println!("Searching for PARTIAL pattern: 0x47...");
    println!();
    
    find_vanity_partial_pattern(deployer_bytes, &init_code_hash, "EagleOVault", deployer)
}

fn generate_vanity_wrapper(deployer_bytes: &[u8], deployer: &str) -> VanityResult {
    let artifact_path = "../out/EagleVaultWrapper.sol/EagleVaultWrapper.json";
    let artifact_content = fs::read_to_string(artifact_path)
        .expect("Failed to read EagleVaultWrapper artifact");
    
    let artifact: serde_json::Value = serde_json::from_str(&artifact_content)
        .expect("Failed to parse artifact JSON");
    
    let bytecode_hex = artifact["bytecode"]["object"]
        .as_str()
        .expect("Bytecode not found")
        .trim_start_matches("0x");
    
    // Use placeholder addresses (will be updated in deployment script)
    let vault = "0x0000000000000000000000000000000000000001";
    let oft = "0x0000000000000000000000000000000000000002";
    
    let constructor_args = format!(
        "{:0>64}{:0>64}{:0>64}{:0>64}",
        &vault[2..],
        &oft[2..],
        &deployer[2..],
        &deployer[2..]
    );
    
    let init_code = format!("{}{}", bytecode_hex, constructor_args);
    let init_code_bytes = hex::decode(&init_code).expect("Invalid init code");
    
    let mut hasher = Keccak256::new();
    hasher.update(&init_code_bytes);
    let init_code_hash = hasher.finalize();
    
    println!("Init Code Hash: 0x{}", hex::encode(&init_code_hash));
    println!("Searching for PARTIAL pattern: 0x47...");
    println!();
    
    find_vanity_partial_pattern(deployer_bytes, &init_code_hash, "EagleVaultWrapper", deployer)
}

fn generate_vanity_strategy(deployer_bytes: &[u8], deployer: &str) -> VanityResult {
    let artifact_path = "../out/CharmStrategyUSD1.sol/CharmStrategyUSD1.json";
    let artifact_content = fs::read_to_string(artifact_path)
        .expect("Failed to read CharmStrategyUSD1 artifact");
    
    let artifact: serde_json::Value = serde_json::from_str(&artifact_content)
        .expect("Failed to parse artifact JSON");
    
    let bytecode_hex = artifact["bytecode"]["object"]
        .as_str()
        .expect("Bytecode not found")
        .trim_start_matches("0x");
    
    // Use placeholder for vault (will be updated in deployment script)
    let vault = "0x0000000000000000000000000000000000000001";
    let charm_vault = "0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71";
    let wlfi = "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6";
    let usd1 = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
    let router = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
    
    let constructor_args = format!(
        "{:0>64}{:0>64}{:0>64}{:0>64}{:0>64}{:0>64}",
        &vault[2..],
        &charm_vault[2..],
        &wlfi[2..],
        &usd1[2..],
        &router[2..],
        &deployer[2..]
    );
    
    let init_code = format!("{}{}", bytecode_hex, constructor_args);
    let init_code_bytes = hex::decode(&init_code).expect("Invalid init code");
    
    let mut hasher = Keccak256::new();
    hasher.update(&init_code_bytes);
    let init_code_hash = hasher.finalize();
    
    println!("Init Code Hash: 0x{}", hex::encode(&init_code_hash));
    println!("Searching for PARTIAL pattern: 0x47...");
    println!();
    
    find_vanity_partial_pattern(deployer_bytes, &init_code_hash, "CharmStrategyUSD1", deployer)
}

fn find_vanity_full_pattern(
    deployer: &[u8],
    init_code_hash: &[u8],
    contract_name: &str,
    deployer_str: &str,
) -> VanityResult {
    let found = Arc::new(AtomicBool::new(false));
    let attempts = Arc::new(AtomicU64::new(0));
    let start = Instant::now();

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

            let address = calculate_create2_address(deployer, &salt_32, init_code_hash);

            // FULL PATTERN: 0x47...ea91e
            if address[0] == 0x47
                && address[17] == 0x0e
                && address[18] == 0xa9
                && address[19] == 0x1e
            {
                found.store(true, Ordering::Relaxed);
                Some((salt_32, address, i))
            } else {
                None
            }
        });

    let elapsed = start.elapsed();
    let total_attempts = attempts.load(Ordering::Relaxed);

    if let Some((salt, address, _)) = result {
        println!("✅ FOUND!");
        println!("Salt:    0x{}", hex::encode(salt));
        println!("Address: 0x{}", hex::encode(address));
        println!("Time:    {:.2} seconds", elapsed.as_secs_f64());

        VanityResult {
            contract_name: contract_name.to_string(),
            salt: format!("0x{}", hex::encode(salt)),
            address: format!("0x{}", hex::encode(address)),
            deployer: deployer_str.to_string(),
            attempts: total_attempts,
            time_seconds: elapsed.as_secs_f64(),
            pattern: "0x47...ea91e".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    } else {
        panic!("Vanity address not found");
    }
}

fn find_vanity_partial_pattern(
    deployer: &[u8],
    init_code_hash: &[u8],
    contract_name: &str,
    deployer_str: &str,
) -> VanityResult {
    let found = Arc::new(AtomicBool::new(false));
    let attempts = Arc::new(AtomicU64::new(0));
    let start = Instant::now();

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

            let address = calculate_create2_address(deployer, &salt_32, init_code_hash);

            // PARTIAL PATTERN: just 0x47...
            if address[0] == 0x47 {
                found.store(true, Ordering::Relaxed);
                Some((salt_32, address, i))
            } else {
                None
            }
        });

    let elapsed = start.elapsed();
    let total_attempts = attempts.load(Ordering::Relaxed);

    if let Some((salt, address, _)) = result {
        println!("✅ FOUND!");
        println!("Salt:    0x{}", hex::encode(salt));
        println!("Address: 0x{}", hex::encode(address));
        println!("Time:    {:.2} seconds", elapsed.as_secs_f64());

        VanityResult {
            contract_name: contract_name.to_string(),
            salt: format!("0x{}", hex::encode(salt)),
            address: format!("0x{}", hex::encode(address)),
            deployer: deployer_str.to_string(),
            attempts: total_attempts,
            time_seconds: elapsed.as_secs_f64(),
            pattern: "0x47...".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }
    } else {
        panic!("Vanity address not found");
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

