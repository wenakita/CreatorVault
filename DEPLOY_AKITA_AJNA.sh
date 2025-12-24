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
ZORA="0x4200000000000000000000000000000000000777"

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
echo -e "${GREEN}Deployer:${NC} $DEPLOYER"
echo ""

# ============================================
# STEP 0: Get current AKITA price from AKITA/ZORA V4 pool
# ============================================
echo -e "${BLUE}Step 0: Fetching current AKITA price from AKITA/ZORA V4 pool...${NC}"

# Uniswap V4 uses PoolKey to identify pools
# PoolKey: (currency0, currency1, fee, tickSpacing, hooks)
# PoolId = keccak256(abi.encode(PoolKey))

# Sort tokens (V4 requires currency0 < currency1)
if [[ "$AKITA_TOKEN" < "$ZORA" ]]; then
    CURRENCY0=$AKITA_TOKEN
    CURRENCY1=$ZORA
else
    CURRENCY0=$ZORA
    CURRENCY1=$AKITA_TOKEN
fi

# Common V4 fee tiers and tick spacings
# fee=3000 (0.3%), tickSpacing=60
# fee=10000 (1%), tickSpacing=200

SUGGESTED_BUCKET=3696  # Default middle bucket
POOL_FOUND=false

# Try 0.3% fee tier
FEE=3000
TICK_SPACING=60
HOOKS="0x0000000000000000000000000000000000000000"  # No hooks

# Encode PoolKey for 0.3% pool
POOL_KEY=$(cast abi-encode "f(address,address,uint24,int24,address)" $CURRENCY0 $CURRENCY1 $FEE $TICK_SPACING $HOOKS)
POOL_ID=$(cast keccak $POOL_KEY)

echo -e "${BLUE}   Checking AKITA/ZORA 0.3% pool...${NC}"
echo -e "${BLUE}   PoolId: $POOL_ID${NC}"

# Query slot0 from PoolManager
SLOT0=$(cast call $UNISWAP_V4_POOL_MANAGER \
    "getSlot0(bytes32)(uint160,int24,uint24,uint24)" \
    $POOL_ID 2>/dev/null || echo "")

if [ ! -z "$SLOT0" ] && [ "$SLOT0" != "0" ]; then
    POOL_FOUND=true
    echo -e "${GREEN}✅ Found AKITA/ZORA V4 pool (0.3% fee)${NC}"
    
    # Extract tick (second value)
    TICK=$(echo $SLOT0 | awk '{print $2}')
    echo -e "${GREEN}   Current tick:${NC} $TICK"
    
    # If tokens were swapped, invert the tick
    if [[ "$CURRENCY0" == "$ZORA" ]]; then
        TICK=$((-1 * TICK))
        echo -e "${GREEN}   Adjusted tick (AKITA/ZORA):${NC} $TICK"
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
    echo -e "${GREEN}   (Based on current V4 market price)${NC}"
fi

# If 0.3% not found, try 1% fee tier
if [ "$POOL_FOUND" = false ]; then
    echo -e "${BLUE}   Checking AKITA/ZORA 1% pool...${NC}"
    FEE=10000
    TICK_SPACING=200
    
    POOL_KEY=$(cast abi-encode "f(address,address,uint24,int24,address)" $CURRENCY0 $CURRENCY1 $FEE $TICK_SPACING $HOOKS)
    POOL_ID=$(cast keccak $POOL_KEY)
    
    SLOT0=$(cast call $UNISWAP_V4_POOL_MANAGER \
        "getSlot0(bytes32)(uint160,int24,uint24,uint24)" \
        $POOL_ID 2>/dev/null || echo "")
    
    if [ ! -z "$SLOT0" ] && [ "$SLOT0" != "0" ]; then
        POOL_FOUND=true
        echo -e "${GREEN}✅ Found AKITA/ZORA V4 pool (1% fee)${NC}"
        
        TICK=$(echo $SLOT0 | awk '{print $2}')
        echo -e "${GREEN}   Current tick:${NC} $TICK"
        
        if [[ "$CURRENCY0" == "$ZORA" ]]; then
            TICK=$((-1 * TICK))
            echo -e "${GREEN}   Adjusted tick (AKITA/ZORA):${NC} $TICK"
        fi
        
        TICK_OFFSET=$((TICK / 100))
        SUGGESTED_BUCKET=$((3696 + TICK_OFFSET))
        
        if [ $SUGGESTED_BUCKET -lt 0 ]; then
            SUGGESTED_BUCKET=0
        elif [ $SUGGESTED_BUCKET -gt 7387 ]; then
            SUGGESTED_BUCKET=7387
        fi
        
        echo -e "${GREEN}   Suggested Ajna bucket:${NC} $SUGGESTED_BUCKET"
        echo -e "${GREEN}   (Based on current V4 market price)${NC}"
    fi
fi

if [ "$POOL_FOUND" = false ]; then
    echo -e "${YELLOW}⚠️  Could not find AKITA/ZORA V4 pool, using default bucket 3696${NC}"
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
echo -e "${GREEN}Bucket Index:${NC}   $SUGGESTED_BUCKET"
if [ "$POOL_FOUND" = true ]; then
    echo -e "${GREEN}Price Source:${NC}   AKITA/ZORA Uniswap V4 pool"
    echo -e "${GREEN}PoolManager:${NC}    $UNISWAP_V4_POOL_MANAGER"
else
    echo -e "${GREEN}Price Source:${NC}   Default (middle bucket)"
fi
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

