#!/bin/bash
PK=$(grep "^PRIVATE_KEY=" .env | cut -d'=' -f2)

echo "=== Quick Vanity Deployment ==="
echo "Getting bytecode..."

BYTECODE=$(forge inspect EagleOVault bytecode 2>/dev/null)
ARGS=$(cast abi-encode "constructor(address,address,address,address,address,address)" \
  0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6 \
  0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d \
  0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d \
  0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d \
  0xE592427A0AEce92De3Edee1F18E0157C05861564 \
  0x7310Dd6EF89b7f829839F140C6840bc929ba2031)

INIT="${BYTECODE}${ARGS:2}"

echo "Deploying..."
cast send 0x4e59b44847b379578588920cA78FbF26c0B4956C \
  "deploy(bytes,bytes32)(address)" \
  "$INIT" \
  "0x000000000000000000000000000000000000000000000000a400000002a45bb1" \
  --rpc-url https://eth.llamarpc.com \
  --private-key "$PK" \
  --gas-limit 30000000
