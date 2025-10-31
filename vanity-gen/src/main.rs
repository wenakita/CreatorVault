use clap::Parser;
use rayon::prelude::*;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tiny_keccak::{Hasher, Keccak};

#[derive(Parser, Debug)]
#[command(author, version, about = "CREATE2 Vanity Address Generator", long_about = None)]
struct Args {
    /// Init code hash (with or without 0x prefix)
    #[arg(short, long)]
    init_hash: String,

    /// CREATE2 factory address (with or without 0x prefix)
    #[arg(short, long)]
    factory: String,

    /// Address prefix (without 0x)
    #[arg(short, long)]
    prefix: String,

    /// Address suffix
    #[arg(short, long)]
    suffix: String,

    /// Number of threads (default: number of CPU cores)
    #[arg(short, long)]
    threads: Option<usize>,
}

fn strip_0x(s: &str) -> &str {
    s.strip_prefix("0x").unwrap_or(s)
}

fn calculate_create2_address(factory: &[u8; 20], salt: &[u8; 32], init_code_hash: &[u8; 32]) -> [u8; 20] {
    let mut hasher = Keccak::v256();
    hasher.update(&[0xff]);
    hasher.update(factory);
    hasher.update(salt);
    hasher.update(init_code_hash);
    
    let mut hash = [0u8; 32];
    hasher.finalize(&mut hash);
    
    let mut address = [0u8; 20];
    address.copy_from_slice(&hash[12..32]);
    address
}

fn matches_pattern(address: &[u8; 20], prefix: &str, suffix: &str) -> bool {
    let addr_hex = hex::encode(address);
    addr_hex.starts_with(&prefix.to_lowercase()) && addr_hex.ends_with(&suffix.to_lowercase())
}

fn num_cpus() -> usize {
    std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4)
}

fn main() {
    let args = Args::parse();

    println!("\n╔═══════════════════════════════════════════════════════════╗");
    println!("║  🚀 RUST VANITY ADDRESS GENERATOR                         ║");
    println!("║     CREATE2 Pattern Matcher                               ║");
    println!("╚═══════════════════════════════════════════════════════════╝\n");

    let threads = args.threads.unwrap_or_else(num_cpus);

    // Parse inputs
    let factory_hex = strip_0x(&args.factory);
    let init_hash_hex = strip_0x(&args.init_hash);
    
    let factory: [u8; 20] = hex::decode(factory_hex)
        .expect("Invalid factory address")
        .try_into()
        .expect("Factory must be 20 bytes");
    
    let init_code_hash: [u8; 32] = hex::decode(init_hash_hex)
        .expect("Invalid init code hash")
        .try_into()
        .expect("Init code hash must be 32 bytes");

    println!("Configuration:");
    println!("  Factory:     0x{}", hex::encode(factory));
    println!("  Init Hash:   0x{}", hex::encode(init_code_hash));
    println!("  Prefix:      {}", args.prefix);
    println!("  Suffix:      {}", args.suffix);
    println!("  Threads:     {}", threads);
    
    // Estimate difficulty
    let prefix_bits = args.prefix.len() * 4;
    let suffix_bits = args.suffix.len() * 4;
    let total_bits = prefix_bits + suffix_bits;
    let expected_attempts = 1u64 << total_bits;
    
    println!("\n⚙️  Difficulty:");
    println!("  Prefix bits: {} ({} chars)", prefix_bits, args.prefix.len());
    println!("  Suffix bits: {} ({} chars)", suffix_bits, args.suffix.len());
    println!("  Total bits:  {}", total_bits);
    println!("  Expected:    ~{} attempts", format_number(expected_attempts));
    println!("\n🔍 Searching...\n");

    let found = Arc::new(AtomicBool::new(false));
    let attempts = Arc::new(AtomicU64::new(0));
    let start_time = Instant::now();

    // Spawn progress reporter
    let attempts_clone = Arc::clone(&attempts);
    let found_clone = Arc::clone(&found);
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(std::time::Duration::from_secs(2));
            if found_clone.load(Ordering::Relaxed) {
                break;
            }
            let count = attempts_clone.load(Ordering::Relaxed);
            let elapsed = start_time.elapsed().as_secs_f64();
            let rate = count as f64 / elapsed;
            println!("  {:>12} attempts | {:.1}s | {:.0} H/s", 
                format_number(count), elapsed, rate);
        }
    });

    // Parallel search
    let result = (0..threads).into_par_iter().find_map_any(|thread_id| {
        let mut salt_value = thread_id as u64 * 1_000_000;
        let mut local_attempts = 0u64;
        
        loop {
            if found.load(Ordering::Relaxed) {
                return None;
            }

            // Generate salt
            let mut salt = [0u8; 32];
            salt[24..32].copy_from_slice(&salt_value.to_be_bytes());

            // Calculate address
            let address = calculate_create2_address(&factory, &salt, &init_code_hash);

            // Check match
            if matches_pattern(&address, &args.prefix, &args.suffix) {
                found.store(true, Ordering::Relaxed);
                let total_attempts = attempts.fetch_add(local_attempts, Ordering::Relaxed) + local_attempts;
                return Some((salt, address, total_attempts));
            }

            salt_value += 1;
            local_attempts += 1;

            // Update global counter periodically
            if local_attempts % 10000 == 0 {
                attempts.fetch_add(10000, Ordering::Relaxed);
                local_attempts = 0;
            }
        }
    });

    let elapsed = start_time.elapsed();

    if let Some((salt, address, total_attempts)) = result {
        println!("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        println!("✅ FOUND MATCHING SALT!");
        println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        println!("Salt:      0x{}", hex::encode(salt));
        println!("Address:   0x{}", hex::encode(address));
        println!("Attempts:  {}", format_number(total_attempts));
        println!("Time:      {:.2}s", elapsed.as_secs_f64());
        println!("Rate:      {:.0} H/s", total_attempts as f64 / elapsed.as_secs_f64());
        println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    } else {
        println!("\n❌ Search was interrupted or failed\n");
    }
}

fn format_number(n: u64) -> String {
    let s = n.to_string();
    let mut result = String::new();
    for (i, c) in s.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            result.insert(0, ',');
        }
        result.insert(0, c);
    }
    result
}
