#!/bin/bash

# Manual Registry Deployment with Vanity Address
# Pattern: 0x47...ea91e

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🦅 DEPLOY EAGLEREGISTRY WITH VANITY ADDRESS           ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Vanity address details
SALT="0x0000000000000000000000000000000000000000000000000468000009c96c5f"
EXPECTED_ADDRESS="0x47102B300E9d4ec5A250840158a92D2e740eA91E"
DEPLOYER="0x7310Dd6EF89b7f829839F140C6840bc929ba2031"
LZ_ENDPOINT="0x1a44076050125825900e736c501f859c50fE728c"

echo "Expected Address: $EXPECTED_ADDRESS"
echo "Pattern: 0x47...ea91e"
echo "Deployer: $DEPLOYER"
echo ""

# Get bytecode from compiled artifact
BYTECODE=$(jq -r '.bytecode.object' out/EagleRegistry.sol/EagleRegistry.json)

# Encode constructor args (owner address)
CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address)" $DEPLOYER)

# Combine bytecode + constructor args
INIT_CODE="${BYTECODE}${CONSTRUCTOR_ARGS:2}"

echo "📦 Init Code prepared"
echo "🔐 Using CREATE2 with salt: $SALT"
echo ""

# Deploy using CREATE2
echo "🚀 Deploying EagleRegistry..."
echo ""
echo "⚠️  You need to run this command with your PRIVATE_KEY:"
echo ""
echo "cast send --create $INIT_CODE \\"
echo "  --rpc-url https://eth.llamarpc.com \\"
echo "  --private-key \$YOUR_PRIVATE_KEY \\"
echo "  --legacy"
echo ""
echo "Or if you have PRIVATE_KEY in environment:"
echo ""
echo "cast send --create $INIT_CODE \\"
echo "  --rpc-url https://eth.llamarpc.com \\"
echo "  --private-key \$PRIVATE_KEY \\"
echo "  --legacy"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "After deployment, configure LayerZero endpoint:"
echo ""
echo "cast send $EXPECTED_ADDRESS \\"
echo "  \"setLayerZeroEndpoint(uint16,address)\" 1 $LZ_ENDPOINT \\"
echo "  --rpc-url https://eth.llamarpc.com \\"
echo "  --private-key \$PRIVATE_KEY"
echo ""

