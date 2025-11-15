#!/bin/bash

# Eagle Registry Solana - CLI-based Initialization
# Uses solana CLI commands directly to avoid Node.js networking issues in WSL2

set -e

PROGRAM_ID="7wSrZXHF6BguZ1qwkXdZcNf3qyV2MPNvcztQLwrh9qPJ"
LZ_ENDPOINT="76y77prsiCMvXMjuoZ5VRrhG5qYBrUMYTE5WgHqgjEn6"
DEVNET_URL="https://api.devnet.solana.com"

echo "🚀 Eagle Registry Solana - CLI Initialization"
echo ""

# Check wallet
WALLET=$(solana-keygen pubkey ~/.config/solana/id.json 2>/dev/null || echo "NOT_FOUND")
if [ "$WALLET" = "NOT_FOUND" ]; then
    echo "❌ Wallet not found at ~/.config/solana/id.json"
    exit 1
fi

echo "👛 Wallet: $WALLET"

# Check balance
BALANCE=$(solana balance --url $DEVNET_URL 2>/dev/null | awk '{print $1}')
echo "💰 Balance: $BALANCE SOL"
echo ""

# Find Registry PDA (using Node.js since it's just computation, no network)
node << 'EOF'
const { PublicKey } = require('@solana/web3.js');
const programId = new PublicKey('7wSrZXHF6BguZ1qwkXdZcNf3qyV2MPNvcztQLwrh9qPJ');
const [pda, bump] = PublicKey.findProgramAddressSync([Buffer.from('registry')], programId);
console.log('📍 Registry PDA:', pda.toBase58());
console.log('   Bump:', bump);
EOF

echo ""
echo "⚠️  Note: CLI-based initialization requires manual transaction building"
echo "    This is complex due to Anchor's custom instruction format."
echo ""
echo "💡 Recommended: Use Codespaces environment where networking works properly"
echo "    Or wait for the program to be redeployed from an environment with proper tooling"
