#!/bin/bash
# Deploy Ajna Strategy for ANY Creator Coin on Base
# Usage: ./DEPLOY_CREATOR_AJNA.sh <CREATOR_TOKEN_ADDRESS> <VAULT_ADDRESS>

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   Creator Ajna Strategy Deployment${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check arguments
if [ $# -lt 2 ]; then
    echo -e "${RED}Usage: $0 <CREATOR_TOKEN_ADDRESS> <VAULT_ADDRESS>${NC}"
    echo ""
    echo "Example:"
    echo "  ./DEPLOY_CREATOR_AJNA.sh 0x5b674196812451b7cec024fe9d22d2c0b172fa75 0xA015954E2606d08967Aee3787456bB3A86a46A42"
    echo ""
    exit 1
fi

CREATOR_TOKEN=$1
CREATOR_VAULT=$2

# Common addresses
WETH="0x4200000000000000000000000000000000000006"
USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

# Ajna Addresses on Base (official)
AJNA_ERC20_FACTORY="0x214f62B5836D83f3D6c4f71F174209097B1A779C"
AJNA_POOL_INFO_UTILS="0x97fa9b0909C238D170C1ab3B5c728A3a45BBEcBa"

# Uniswap V4 PoolManager for price lookup
UNISWAP_V4_POOL_MANAGER="0x498581fF718922c3f8e6A244956aF099B2652b2b"

# Check if private key is set
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${YELLOW}⚠️  PRIVATE_KEY not set. Export it first:${NC}"
    echo "export PRIVATE_KEY=your_private_key_here"
    exit 1
fi

# Get deployer address
DEPLOYER=$(cast wallet address $PRIVATE_KEY)
echo -e "${GREEN}Deployer:${NC}        $DEPLOYER"
echo -e "${GREEN}Creator Token:${NC}   $CREATOR_TOKEN"
echo -e "${GREEN}Creator Vault:${NC}   $CREATOR_VAULT"
echo ""

# Get token info
echo -e "${BLUE}Fetching token information...${NC}"
TOKEN_NAME=$(cast call $CREATOR_TOKEN "name()(string)" 2>/dev/null || echo "Unknown")
TOKEN_SYMBOL=$(cast call $CREATOR_TOKEN "symbol()(string)" 2>/dev/null || echo "???")
echo -e "${GREEN}Token:${NC} $TOKEN_NAME ($TOKEN_SYMBOL)"
echo ""

# ============================================
# STEP 0: Get current market price from V4 pool
# ============================================
echo -e "${BLUE}Step 0: Fetching current market price from Uniswap V4 pool...${NC}"

SUGGESTED_BUCKET=3696  # Default middle bucket
POOL_FOUND=false

# Try to query token contract for its pool key
echo -e "${BLUE}   Checking if token has getPoolKey() function...${NC}"
POOL_KEY_RESULT=$(cast call $CREATOR_TOKEN \
    "getPoolKey()(address,address,uint24,int24,address)" \
    2>/dev/null || echo "")

if [ ! -z "$POOL_KEY_RESULT" ]; then
    # Parse the pool key tuple
    CURRENCY0=$(echo $POOL_KEY_RESULT | awk '{print $1}')
    CURRENCY1=$(echo $POOL_KEY_RESULT | awk '{print $2}')
    FEE=$(echo $POOL_KEY_RESULT | awk '{print $3}')
    TICK_SPACING=$(echo $POOL_KEY_RESULT | awk '{print $4}')
    HOOKS=$(echo $POOL_KEY_RESULT | awk '{print $5}')
    
    echo -e "${GREEN}✅ Pool key from token contract:${NC}"
    echo -e "${GREEN}   Currency0:    $CURRENCY0${NC}"
    echo -e "${GREEN}   Currency1:    $CURRENCY1${NC}"
    echo -e "${GREEN}   Fee:          $FEE ($(echo "scale=2; $FEE / 10000" | bc)%)${NC}"
    echo -e "${GREEN}   TickSpacing:  $TICK_SPACING${NC}"
    echo -e "${GREEN}   Hooks:        $HOOKS${NC}"
    
    # Encode PoolKey
    POOL_KEY=$(cast abi-encode "f(address,address,uint24,int24,address)" \
        $CURRENCY0 $CURRENCY1 $FEE $TICK_SPACING $HOOKS)
    POOL_ID=$(cast keccak $POOL_KEY)
    
    echo -e "${BLUE}   Querying PoolManager for current price...${NC}"
    
    # Query slot0 from PoolManager
    SLOT0=$(cast call $UNISWAP_V4_POOL_MANAGER \
        "getSlot0(bytes32)(uint160,int24,uint24,uint24)" \
        $POOL_ID 2>/dev/null || echo "")
    
    if [ ! -z "$SLOT0" ] && [ "$SLOT0" != "0" ]; then
        POOL_FOUND=true
        echo -e "${GREEN}✅ Found Uniswap V4 pool${NC}"
        
        # Extract tick (second value)
        TICK=$(echo $SLOT0 | awk '{print $2}')
        echo -e "${GREEN}   Current tick:${NC} $TICK"
        
        # Check if we need to invert tick (if creator token is currency1)
        if [[ "$CURRENCY1" == "$CREATOR_TOKEN" ]]; then
            TICK=$((-1 * TICK))
            echo -e "${GREEN}   Adjusted tick (${TOKEN_SYMBOL} price):${NC} $TICK"
        fi
        
        # Ajna buckets: bucket = 3696 + (tick / 100)
        TICK_OFFSET=$((TICK / 100))
        SUGGESTED_BUCKET=$((3696 + TICK_OFFSET))
        
        # Clamp to valid range (0-7387)
        if [ $SUGGESTED_BUCKET -lt 0 ]; then
            SUGGESTED_BUCKET=0
        elif [ $SUGGESTED_BUCKET -gt 7387 ]; then
            SUGGESTED_BUCKET=7387
        fi
        
        echo -e "${GREEN}   Suggested Ajna bucket:${NC} $SUGGESTED_BUCKET"
        echo -e "${GREEN}   (Based on current market price)${NC}"
    else
        echo -e "${YELLOW}⚠️  Could not query V4 pool${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Token does not have getPoolKey() function${NC}"
    echo -e "${YELLOW}   Will use default bucket 3696 (can adjust after deployment)${NC}"
fi

if [ "$POOL_FOUND" = false ]; then
    echo -e "${YELLOW}⚠️  No V4 pool found, using default bucket 3696${NC}"
    echo -e "${YELLOW}   You can adjust the bucket after deployment using setBucketIndex()${NC}"
fi

echo ""
read -p "Use suggested bucket $SUGGESTED_BUCKET? (Y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Nn]$ ]]; then
    read -p "Enter custom bucket index (0-7387): " SUGGESTED_BUCKET
fi

echo -e "${GREEN}Using bucket index:${NC} $SUGGESTED_BUCKET"
echo ""

# ============================================
# STEP 1: Check if Creator/WETH Ajna pool exists
# ============================================
echo -e "${BLUE}Step 1: Checking if ${TOKEN_SYMBOL}/WETH Ajna pool exists...${NC}"

# Try different interest rates
RATES=(
    "50000000000000000"   # 5%
    "100000000000000000"  # 10%
    "150000000000000000"  # 15%
)

POOL_ADDRESS=""
for RATE in "${RATES[@]}"; do
    RESULT=$(cast call $AJNA_ERC20_FACTORY \
        "deployedPools(bytes32,address)(address)" \
        $(cast keccak $(cast abi-encode "f(address,address,uint256)" $CREATOR_TOKEN $WETH $RATE)) \
        $AJNA_ERC20_FACTORY 2>/dev/null || echo "0x0000000000000000000000000000000000000000")
    
    if [ "$RESULT" != "0x0000000000000000000000000000000000000000" ]; then
        POOL_ADDRESS=$RESULT
        echo -e "${GREEN}✅ Found existing pool at:${NC} $POOL_ADDRESS"
        echo -e "${GREEN}   Interest rate:${NC} $(echo "scale=2; $RATE / 1000000000000000000 * 100" | bc)%"
        break
    fi
done

if [ -z "$POOL_ADDRESS" ] || [ "$POOL_ADDRESS" == "0x0000000000000000000000000000000000000000" ]; then
    echo -e "${YELLOW}⚠️  No existing ${TOKEN_SYMBOL}/WETH Ajna pool found${NC}"
    echo ""
    echo -e "${BLUE}To deploy a new pool:${NC}"
    echo "cast send $AJNA_ERC20_FACTORY \\"
    echo "  \"deployPool(address,address,uint256)(address)\" \\"
    echo "  $CREATOR_TOKEN \\"
    echo "  $WETH \\"
    echo "  50000000000000000 \\"
    echo "  --rpc-url base --private-key \$PRIVATE_KEY"
    echo ""
    read -p "Deploy new pool? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}Deploying ${TOKEN_SYMBOL}/WETH pool with 5% interest rate...${NC}"
        POOL_ADDRESS=$(cast send $AJNA_ERC20_FACTORY \
            "deployPool(address,address,uint256)(address)" \
            $CREATOR_TOKEN \
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
        $CREATOR_VAULT \
        $CREATOR_TOKEN \
        $AJNA_ERC20_FACTORY \
        $WETH \
        $DEPLOYER \
    --json | jq -r '.deployedTo')

if [ -z "$STRATEGY_ADDRESS" ] || [ "$STRATEGY_ADDRESS" == "null" ]; then
    echo -e "${RED}❌ Deployment failed${NC}"
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

# Set bucket index (if not default 3696)
if [ $SUGGESTED_BUCKET -ne 3696 ]; then
    echo "Setting bucket index to $SUGGESTED_BUCKET..."
    cast send $STRATEGY_ADDRESS \
        "setBucketIndex(uint256)" \
        $SUGGESTED_BUCKET \
        --rpc-url base \
        --private-key $PRIVATE_KEY
fi

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
echo -e "${BLUE}Step 4: Adding strategy to vault...${NC}"

cast send $CREATOR_VAULT \
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
echo -e "${GREEN}Token:${NC}          $TOKEN_NAME ($TOKEN_SYMBOL)"
echo -e "${GREEN}Token Address:${NC}  $CREATOR_TOKEN"
echo -e "${GREEN}Ajna Pool:${NC}      $POOL_ADDRESS"
echo -e "${GREEN}Strategy:${NC}       $STRATEGY_ADDRESS"
echo -e "${GREEN}Vault:${NC}          $CREATOR_VAULT"
echo -e "${GREEN}Bucket Index:${NC}   $SUGGESTED_BUCKET"
if [ "$POOL_FOUND" = true ]; then
    echo -e "${GREEN}Price Source:${NC}   Uniswap V4 (from token contract)"
else
    echo -e "${GREEN}Price Source:${NC}   Default (middle bucket)"
fi
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Update frontend config with strategy address:"
echo "   strategies: { ajna: '$STRATEGY_ADDRESS' }"
echo ""
echo "2. (Optional) Deploy additional strategies for diversification"
echo ""
echo "3. Set vault minimumTotalIdle if needed:"
echo "   cast send $CREATOR_VAULT 'setMinimumTotalIdle(uint256)' <AMOUNT>"
echo ""
echo "4. Test the strategy:"
echo "   cast call $STRATEGY_ADDRESS 'getTotalAssets()(uint256)'"
echo ""
echo -e "${GREEN}🚀 Ready to go!${NC}"

