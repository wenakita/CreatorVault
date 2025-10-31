#!/bin/bash

# Deploy EagleRegistry with vanity address using cast

SALT="0x0000000000000000000000000000000000000000000000000468000009c96c5f"
EXPECTED="0x47102B300E9d4ec5A250840158a92D2e740eA91E"
DEPLOYER="0x7310Dd6EF89b7f829839F140C6840bc929ba2031"

# Get bytecode
BYTECODE=$(jq -r '.bytecode.object' out/EagleRegistry.sol/EagleRegistry.json)

# Encode constructor (owner address)
CONSTRUCTOR=$(cast abi-encode "constructor(address)" $DEPLOYER)

# Combine
INIT_CODE="${BYTECODE}${CONSTRUCTOR:2}"

echo "Deploying EagleRegistry with CREATE2..."
echo "Expected address: $EXPECTED"
echo ""

# Deploy
cast send --create $INIT_CODE \
  --rpc-url ethereum \
  --account deployer \
  --legacy

