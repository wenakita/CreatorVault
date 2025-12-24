#!/bin/bash
# Deploy AKITA Ajna Strategy on Base
# Source: https://faqs.ajna.finance/info/deployment-addresses-and-bridges

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   AKITA Ajna Strategy Deployment${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Configuration
AKITA_TOKEN="0x5b674196812451b7cec024fe9d22d2c0b172fa75"
AKITA_VAULT="0xA015954E2606d08967Aee3787456bB3A86a46A42"
WETH="0x4200000000000000000000000000000000000006"
USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

# Ajna Addresses on Base (official)
AJNA_ERC20_FACTORY="0x214f62B5836D83f3D6c4f71F174209097B1A779C"
AJNA_POOL_INFO_UTILS="0x97fa9b0909C238D170C1ab3B5c728A3a45BBEcBa"

# Check if private key is set
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${YELLOW}⚠️  PRIVATE_KEY not set. Export it first:${NC}"
    echo "export PRIVATE_KEY=your_private_key_here"
    exit 1
fi

# Get deployer address
DEPLOYER=$(cast wallet address $PRIVATE_KEY)
echo -e "${GREEN}Deployer:${NC} $DEPLOYER"
echo ""

# ============================================
# STEP 1: Check if AKITA/WETH pool exists
# ============================================
echo -e "${BLUE}Step 1: Checking if AKITA/WETH Ajna pool exists...${NC}"

# Try different interest rates (Ajna uses rate as part of pool identifier)
RATES=(
    "50000000000000000"   # 5%
    "100000000000000000"  # 10%
    "150000000000000000"  # 15%
)

POOL_ADDRESS=""
for RATE in "${RATES[@]}"; do
    RESULT=$(cast call $AJNA_ERC20_FACTORY \
        "deployedPools(bytes32,address)(address)" \
        $(cast keccak $(cast abi-encode "f(address,address,uint256)" $AKITA_TOKEN $WETH $RATE)) \
        $AJNA_ERC20_FACTORY 2>/dev/null || echo "0x0000000000000000000000000000000000000000")
    
    if [ "$RESULT" != "0x0000000000000000000000000000000000000000" ]; then
        POOL_ADDRESS=$RESULT
        echo -e "${GREEN}✅ Found existing pool at:${NC} $POOL_ADDRESS"
        echo -e "${GREEN}   Interest rate:${NC} $(echo "scale=2; $RATE / 1000000000000000000 * 100" | bc)%"
        break
    fi
done

if [ -z "$POOL_ADDRESS" ] || [ "$POOL_ADDRESS" == "0x0000000000000000000000000000000000000000" ]; then
    echo -e "${YELLOW}⚠️  No existing AKITA/WETH pool found${NC}"
    echo -e "${YELLOW}   You need to create one first via Ajna UI or factory${NC}"
    echo -e "${YELLOW}   Visit: https://summer.fi/ajna (or use deployPool below)${NC}"
    echo ""
    echo -e "${BLUE}To deploy a new pool:${NC}"
    echo "cast send $AJNA_ERC20_FACTORY \\"
    echo "  \"deployPool(address,address,uint256)(address)\" \\"
    echo "  $AKITA_TOKEN \\"
    echo "  $WETH \\"
    echo "  50000000000000000 \\"
    echo "  --rpc-url base --private-key \$PRIVATE_KEY"
    echo ""
    read -p "Deploy new pool? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Deploying AKITA/WETH pool with 5% interest rate...${NC}"
        POOL_ADDRESS=$(cast send $AJNA_ERC20_FACTORY \
            "deployPool(address,address,uint256)(address)" \
            $AKITA_TOKEN \
            $WETH \
            50000000000000000 \
            --rpc-url base \
            --private-key $PRIVATE_KEY \
            --json | jq -r '.logs[0].topics[1]' | cast --to-address)
        echo -e "${GREEN}✅ Pool deployed at:${NC} $POOL_ADDRESS"
    else
        echo "Deployment cancelled."
        exit 0
    fi
fi
echo ""

# ============================================
# STEP 2: Deploy AjnaStrategy
# ============================================
echo -e "${BLUE}Step 2: Deploying AjnaStrategy contract...${NC}"

STRATEGY_ADDRESS=$(forge create contracts/strategies/AjnaStrategy.sol:AjnaStrategy \
    --rpc-url base \
    --private-key $PRIVATE_KEY \
    --constructor-args \
        $AKITA_VAULT \
        $AKITA_TOKEN \
        $AJNA_ERC20_FACTORY \
        $WETH \
        $DEPLOYER \
    --json | jq -r '.deployedTo')

if [ -z "$STRATEGY_ADDRESS" ] || [ "$STRATEGY_ADDRESS" == "null" ]; then
    echo -e "${YELLOW}❌ Deployment failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ AjnaStrategy deployed at:${NC} $STRATEGY_ADDRESS"
echo ""

# ============================================
# STEP 3: Configure Strategy
# ============================================
echo -e "${BLUE}Step 3: Configuring AjnaStrategy...${NC}"

# Set Ajna pool
echo "Setting Ajna pool..."
cast send $STRATEGY_ADDRESS \
    "setAjnaPool(address)" \
    $POOL_ADDRESS \
    --rpc-url base \
    --private-key $PRIVATE_KEY

# Initialize approvals
echo "Initializing approvals..."
cast send $STRATEGY_ADDRESS \
    "initializeApprovals()" \
    --rpc-url base \
    --private-key $PRIVATE_KEY

echo -e "${GREEN}✅ Strategy configured${NC}"
echo ""

# ============================================
# STEP 4: Add to Vault
# ============================================
echo -e "${BLUE}Step 4: Adding strategy to AKITA vault...${NC}"

cast send $AKITA_VAULT \
    "addStrategy(address,uint256)" \
    $STRATEGY_ADDRESS \
    100 \
    --rpc-url base \
    --private-key $PRIVATE_KEY

echo -e "${GREEN}✅ Strategy added to vault with weight 100${NC}"
echo ""

# ============================================
# Summary
# ============================================
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}   ✅ DEPLOYMENT COMPLETE!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "${GREEN}Ajna Pool:${NC}      $POOL_ADDRESS"
echo -e "${GREEN}Strategy:${NC}       $STRATEGY_ADDRESS"
echo -e "${GREEN}Vault:${NC}          $AKITA_VAULT"
echo -e "${GREEN}Bucket Index:${NC}   3696 (middle bucket)"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Update frontend/src/config/contracts.ts:"
echo "   strategies: { ajna: '$STRATEGY_ADDRESS' }"
echo ""
echo "2. Deploy AKITA/USDC strategy (same process with USDC)"
echo ""
echo "3. Deploy AKITA/WETH LP strategy (CreatorCharmStrategy)"
echo ""
echo "4. Set vault minimumTotalIdle to 12.5M AKITA:"
echo "   cast send $AKITA_VAULT 'setMinimumTotalIdle(uint256)' 12500000000000000000000000"
echo ""
echo "5. Test activation flow!"
echo ""
echo -e "${GREEN}🚀 Ready to go!${NC}"

