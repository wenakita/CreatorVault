use solana_sdk::signature::{Keypair, Signer};
use rayon::prelude::*;
use indicatif::{ProgressBar, ProgressStyle};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

fn main() {
    println!("🦅 Eagle Vanity Address Generator");
    println!("Searching for: 47...EAGL\n");

    let found = Arc::new(AtomicBool::new(false));
    let attempts = Arc::new(AtomicU64::new(0));
    
    let pb = ProgressBar::new_spinner();
    pb.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.green} [{elapsed_precise}] {msg}")
            .unwrap()
    );

    let start = Instant::now();
    
    // Spawn threads to search in parallel
    let result = (0..num_cpus::get()).into_par_iter().find_map_any(|_| {
        loop {
            if found.load(Ordering::Relaxed) {
                return None;
            }

            let keypair = Keypair::new();
            let pubkey = keypair.pubkey().to_string();
            
            let count = attempts.fetch_add(1, Ordering::Relaxed);
            
            if count % 100_000 == 0 {
                let elapsed = start.elapsed().as_secs();
                let rate = if elapsed > 0 { count / elapsed } else { count };
                pb.set_message(format!(
                    "Searched: {} keys | Rate: {}/s",
                    count, rate
                ));
            }

            // Check if it matches our pattern: starts with "47" and ends with "EAGL"
            if pubkey.starts_with("47") && pubkey.ends_with("EAGL") {
                found.store(true, Ordering::Relaxed);
                pb.finish_with_message("Found!");
                return Some(keypair);
            }
        }
    });

    if let Some(keypair) = result {
        let pubkey = keypair.pubkey().to_string();
        let elapsed = start.elapsed();
        let total_attempts = attempts.load(Ordering::Relaxed);
        
        println!("\n✅ SUCCESS!");
        println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        println!("Address: {}", pubkey);
        println!("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        println!("\nStats:");
        println!("  Time: {:.2}s", elapsed.as_secs_f64());
        println!("  Attempts: {}", total_attempts);
        println!("  Rate: {:.0} keys/s", total_attempts as f64 / elapsed.as_secs_f64());
        
        // Save keypair to file
        let filename = format!("{}.json", pubkey);
        let keypair_bytes = keypair.to_bytes();
        let json = format!("[{}]", 
            keypair_bytes.iter()
                .map(|b| b.to_string())
                .collect::<Vec<_>>()
                .join(",")
        );
        
        std::fs::write(&filename, json).expect("Failed to write keypair");
        println!("\n💾 Keypair saved to: {}", filename);
    } else {
        println!("\n❌ Search interrupted");
    }
}

