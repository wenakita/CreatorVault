#!/bin/bash
set -e

echo "=== Deploying Vanity Vault with Foundry + CREATE2 ==="
echo ""

FACTORY="0x4e59b44847b379578588920cA78FbF26c0B4956C"
SALT="0x000000000000000000000000000000000000000000000000a400000002a45bb1"
EXPECTED="0x4792348b352e1118ddc252664c977477f30ea91e"

WLFI="0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6"
USD1="0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d"
USD1_FEED="0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d"
POOL="0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d"
ROUTER="0xE592427A0AEce92De3Edee1F18E0157C05861564"
OWNER="0x7310Dd6EF89b7f829839F140C6840bc929ba2031"

echo "🎯 Target: $EXPECTED (0x47...ea91e ✅)"
echo "Salt: $SALT"
echo ""

# Get bytecode and encode constructor args
echo "📦 Building init code..."
BYTECODE=$(forge inspect EagleOVault bytecode)
ENCODED_ARGS=$(cast abi-encode "constructor(address,address,address,address,address,address)" $WLFI $USD1 $USD1_FEED $POOL $ROUTER $OWNER)
INIT_CODE="${BYTECODE}${ENCODED_ARGS:2}"

echo "Bytecode size: $((${#BYTECODE} / 2 / 1024)) KB"
echo "Total init code: $((${#INIT_CODE} / 2 / 1024)) KB"
echo ""

# Deploy via CREATE2
echo "🚀 Deploying via CREATE2 factory..."
echo ""

cast send $FACTORY \
  "deploy(bytes,bytes32)(address)" \
  "$INIT_CODE" \
  "$SALT" \
  --rpc-url https://eth.llamarpc.com \
  --private-key "$PRIVATE_KEY" \
  --gas-limit 30000000 \
  --legacy \
  --confirmations 1

echo ""
echo "✅ Deployment complete!"
echo "Expected address: $EXPECTED"
echo "Verify: https://etherscan.io/address/$EXPECTED"
