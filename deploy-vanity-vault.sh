#!/bin/bash
# Deploy optimized EagleOVault with vanity address using Foundry

set -e
export PRIVATE_KEY=$(grep "^PRIVATE_KEY=" .env | cut -d'=' -f2)

FACTORY="0x4e59b44847b379578588920cA78FbF26c0B4956C"
SALT="0x000000000000000000000000000000000000000000000000a400000002a45bb1"
EXPECTED="0x4792348b352e1118ddc252664c977477f30ea91e"

WLFI="0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6"
USD1="0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d"
USD1_FEED="0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d"
POOL="0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d"
ROUTER="0xE592427A0AEce92De3Edee1F18E0157C05861564"
OWNER="0x7310Dd6EF89b7f829839F140C6840bc929ba2031"

echo "=== Deploying VANITY Vault with Foundry ==="
echo ""
echo "🎯 Target: $EXPECTED"
echo "Pattern: 0x47...ea91e ✅"
echo "Salt: $SALT"
echo ""

# Build and get bytecode
echo "📦 Building contract..."
forge build --contracts contracts/EagleOVault.sol --force > /dev/null 2>&1

BYTECODE=$(forge inspect EagleOVault bytecode 2>/dev/null)
ENCODED_ARGS=$(cast abi-encode "constructor(address,address,address,address,address,address)" $WLFI $USD1 $USD1_FEED $POOL $ROUTER $OWNER)
INIT_CODE="${BYTECODE}${ENCODED_ARGS:2}"

echo "Bytecode size: $((${#BYTECODE} / 2 / 1024)) KB"
echo "Init code size: $((${#INIT_CODE} / 2 / 1024)) KB"
echo ""

# Deploy
echo "🚀 Deploying via CREATE2..."
echo ""

cast send $FACTORY \
  "deploy(bytes,bytes32)(address)" \
  "$INIT_CODE" \
  "$SALT" \
  --rpc-url https://eth.llamarpc.com \
  --private-key $PRIVATE_KEY \
  --gas-limit 30000000

echo ""
echo "✅ Checking deployment..."
sleep 5

CODE=$(cast code $EXPECTED --rpc-url https://eth.llamarpc.com)
if [ "$CODE" != "0x" ]; then
  echo "🎉 VANITY VAULT DEPLOYED!"
  echo "Address: $EXPECTED"
  echo "Verify: https://etherscan.io/address/$EXPECTED"
else
  echo "❌ Deployment failed - no code at address"
fi

