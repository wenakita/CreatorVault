#!/bin/bash

# GENERATE VANITY ADDRESS FOR EAGLE OFT
# 
# This script uses the Rust vanity generator to find a CREATE2 salt
# that produces an address starting with 0x47
#
# Usage: ./scripts/generate-vanity-address.sh

set -e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🎯 GENERATING VANITY ADDRESS (0x47...)                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Read bytecode hash from generated file
if [ ! -f "bytecode-hashes.json" ]; then
    echo "❌ bytecode-hashes.json not found!"
    echo "   Run: npx hardhat run scripts/generate-bytecode-hash.ts"
    exit 1
fi

BYTECODE_HASH=$(node -p "require('./bytecode-hashes.json').contracts.EagleShareOFT.initCodeHash.slice(2)")

echo "📦 Using EagleShareOFT bytecode hash:"
echo "   0x$BYTECODE_HASH"
echo ""

# Factory address (update this to your actual factory)
FACTORY_ADDRESS=${FACTORY_ADDRESS:-"695d6B3628B4701E7eAfC0bc511CbAF23f6003eE"}

echo "🏭 Factory Address:"
echo "   0x$FACTORY_ADDRESS"
echo ""

# Target pattern
PREFIX="47"
SUFFIX="EA91E"

echo "🎯 Target Pattern:"
echo "   0x${PREFIX}...${SUFFIX}"
echo ""
echo "⚠️  This will take time! Complexity:"
echo "   - Prefix '47' (2 chars): ~256 attempts"
echo "   - Suffix 'EA91E' (5 chars): ~1,048,576 attempts"  
echo "   - Combined: ~268 million attempts"
echo "   - Expected time: 10-60 seconds (depending on CPU)"
echo ""
echo "🚀 Starting vanity search..."
echo "   (Press Ctrl+C to cancel)"
echo ""

# Build and run the vanity generator
cd vanity-generator

# Build in release mode for maximum speed
cargo build --release 2>&1 | grep -E "Compiling|Finished" || true

echo ""
echo "🔍 Searching for matching salt..."
echo ""

# Run the generator
./target/release/vanity-generator "$BYTECODE_HASH" "$FACTORY_ADDRESS" "$PREFIX" "$SUFFIX"

RESULT=$?

if [ $RESULT -eq 0 ]; then
    echo ""
    echo "╔══════════════════════════════════════════════════════════╗"
    echo "║  ✅ VANITY SALT FOUND!                                   ║"
    echo "╚══════════════════════════════════════════════════════════╝"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Copy the salt from above"
    echo "   2. Update SALT in scripts/deploy-matching-addresses-all.ts"
    echo "   3. Deploy on all chains with this salt"
    echo "   4. Result: 0x47...EA91E on every chain! 🎉"
    echo ""
else
    echo ""
    echo "❌ Vanity search failed or was cancelled"
    exit 1
fi

