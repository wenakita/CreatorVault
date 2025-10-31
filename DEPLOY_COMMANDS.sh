#!/bin/bash
# 🚀 Eagle OVault Production Deployment Commands
# Date: October 31, 2025
# Network: Ethereum Mainnet

set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🦅 EAGLE OVAULT PRODUCTION DEPLOYMENT                  ║"
echo "║     Network: Ethereum Mainnet (Chain ID: 1)             ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Navigate to project directory
cd /home/akitav2/.cursor/worktrees/eagle-ovault-clean__WSL__ubuntu-24.04_/8fkjs

# Load environment variables
source .env

# Verify environment variables are set
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ ERROR: PRIVATE_KEY not set in .env"
    exit 1
fi

if [ -z "$ETHEREUM_RPC_URL" ]; then
    echo "❌ ERROR: ETHEREUM_RPC_URL not set in .env"
    exit 1
fi

echo "✅ Environment variables loaded"
echo ""

# Display deployment info
echo "📋 DEPLOYMENT CONFIGURATION:"
echo "   Script: script/DeployProductionVanity.s.sol"
echo "   Network: Ethereum Mainnet"
echo "   RPC: ${ETHEREUM_RPC_URL:0:30}..."
echo ""

echo "📦 CONTRACTS TO DEPLOY:"
echo "   1. EagleOVault        → 0x47b12BFd18dfe769687a5A72AdA7C281A86BE8D6"
echo "   2. EagleShareOFT      → 0x47E593E960334B5ac4Ab8EA2495141a30c0eA91E [PREMIUM]"
echo "   3. EagleVaultWrapper  → 0x475bEB9BAC7BD0eA9F0458AD0D50Ea7f8f4e94b3"
echo "   4. CharmStrategyUSD1  → 0x4732CE204d399e0f02D9BB6FE439f2e4d243C2Db"
echo ""

echo "⚠️  WARNING: This will deploy to MAINNET and spend real ETH!"
echo ""
echo "Press Ctrl+C within 10 seconds to cancel..."
sleep 10

echo ""
echo "🚀 Starting deployment..."
echo ""

# Run deployment with broadcast and verification
forge script script/DeployProductionVanity.s.sol:DeployProductionVanity \
  --rpc-url "$ETHEREUM_RPC_URL" \
  --broadcast \
  --verify \
  --slow \
  -vvv

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 NEXT STEPS:"
echo "   1. Verify all addresses match expected vanity addresses"
echo "   2. Transfer ownership to multisig: 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3"
echo "   3. Verify contracts on Etherscan (if auto-verify failed)"
echo "   4. Test with small amounts (max 100 WLFI)"
echo ""

