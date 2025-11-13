#!/bin/bash
set -e

cd /home/akitav2/eagle-ovault-clean
source .env

echo "=== Building Contract ==="
forge build 2>&1 | grep -E "Compiling|Solc|Success|Error" | head -10

if [ ! -f "out/CharmStrategyWETH.sol/CharmStrategyWETH.json" ]; then
    echo "ERROR: CharmStrategyWETH.json not found"
    exit 1
fi

echo ""
echo "=== Extracting Bytecode ==="
BYTECODE=$(jq -r '.bytecode.object' out/CharmStrategyWETH.sol/CharmStrategyWETH.json)

# Constructor args
VAULT="0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953"
CHARM_VAULT="0x3314e248F3F752Cd16939773D83bEb3a362F0AEF"
WLFI="0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6"
WETH="0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
USD1="0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d"
USDC="0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
ROUTER="0xE592427A0AEce92De3Edee1F18E0157C05861564"
DEPLOYER=$(cast wallet address --private-key $PRIVATE_KEY)

echo "Deployer: $DEPLOYER"
echo ""
echo "=== Encoding Constructor Args ==="
ARGS=$(cast abi-encode "constructor(address,address,address,address,address,address,address,address)" $VAULT $CHARM_VAULT $WLFI $WETH $USD1 $USDC $ROUTER $DEPLOYER)

# Remove 0x prefix from args
ARGS_CLEAN=${ARGS#0x}

# Combine bytecode and args
FULL_BYTECODE="${BYTECODE}${ARGS_CLEAN}"

echo "Deploying..."
echo ""

# Deploy
RESULT=$(cast send --create "${FULL_BYTECODE}" --private-key $PRIVATE_KEY --rpc-url https://eth.llamarpc.com --legacy --json 2>&1)

# Extract address
NEW_ADDRESS=$(echo "$RESULT" | jq -r '.contractAddress')

if [ "$NEW_ADDRESS" = "null" ] || [ -z "$NEW_ADDRESS" ]; then
    echo "ERROR: Deployment failed"
    echo "$RESULT"
    exit 1
fi

echo "=== SUCCESS ==="
echo "New WETH Strategy: $NEW_ADDRESS"
echo ""
echo "=== Initializing Approvals ==="
cast send "$NEW_ADDRESS" "initializeApprovals()" --private-key $PRIVATE_KEY --rpc-url https://eth.llamarpc.com --legacy | grep "status"

echo ""
echo "=== NEXT STEPS ==="
echo "1. Add to vault: cast send 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \"addStrategy(address,uint256)\" $NEW_ADDRESS 5000 --private-key \$PRIVATE_KEY --rpc-url https://eth.llamarpc.com --legacy"
echo "2. Sync: cast send 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \"syncBalances()\" --private-key \$PRIVATE_KEY --rpc-url https://eth.llamarpc.com --legacy"
echo "3. Deploy: cast send 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953 \"forceDeployToStrategies()\" --private-key \$PRIVATE_KEY --rpc-url https://eth.llamarpc.com --legacy --gas-limit 5000000"

