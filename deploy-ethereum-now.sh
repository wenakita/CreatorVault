#!/bin/bash

# 🦅 Eagle Vault - Ethereum Mainnet Deployment
# Simple, clean deployment for Ethereum only

set -e  # Exit on error

echo "🦅 EAGLE VAULT - ETHEREUM MAINNET DEPLOYMENT"
echo "============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check environment
echo -e "${BLUE}📋 Checking environment...${NC}"

if [ -z "$ETHEREUM_RPC_URL" ]; then
    echo -e "${RED}❌ ETHEREUM_RPC_URL not set${NC}"
    exit 1
fi

if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}❌ PRIVATE_KEY not set${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment OK${NC}"
echo ""

# Get deployer address
DEPLOYER=$(cast wallet address $PRIVATE_KEY)
echo -e "${BLUE}👤 Deployer: $DEPLOYER${NC}"

# Check balance
BALANCE=$(cast balance $DEPLOYER --rpc-url $ETHEREUM_RPC_URL)
BALANCE_ETH=$(cast --to-unit $BALANCE ether)
echo -e "${BLUE}💰 Balance: $BALANCE_ETH ETH${NC}"

# Check gas price
GAS_PRICE=$(cast gas-price --rpc-url $ETHEREUM_RPC_URL)
GAS_PRICE_GWEI=$(cast --to-unit $GAS_PRICE gwei)
echo -e "${BLUE}⛽ Gas Price: $GAS_PRICE_GWEI gwei${NC}"
echo ""

# Confirm deployment
echo -e "${YELLOW}⚠️  About to deploy to ETHEREUM MAINNET${NC}"
echo -e "${YELLOW}⚠️  This will use real ETH${NC}"
echo ""
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo -e "${RED}❌ Deployment cancelled${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🚀 Starting deployment...${NC}"
echo ""

# Create deployment log
LOG_FILE="deployment-$(date +%Y%m%d-%H%M%S).log"
exec > >(tee -a "$LOG_FILE") 2>&1

# Deploy using Foundry
echo -e "${BLUE}📦 Compiling contracts...${NC}"
forge build

echo ""
echo -e "${BLUE}🚀 Deploying contracts to Ethereum...${NC}"
echo ""

# Check if there's a Foundry deployment script
if [ -f "script/DeployProduction.s.sol" ]; then
    echo -e "${BLUE}Using Foundry deployment script...${NC}"
    forge script script/DeployProduction.s.sol:DeployProduction \
        --rpc-url $ETHEREUM_RPC_URL \
        --private-key $PRIVATE_KEY \
        --broadcast \
        --verify \
        --etherscan-api-key $ETHERSCAN_API_KEY \
        -vvv
elif [ -f "script/Deploy.s.sol" ]; then
    echo -e "${BLUE}Using Foundry deployment script...${NC}"
    forge script script/Deploy.s.sol:Deploy \
        --rpc-url $ETHEREUM_RPC_URL \
        --private-key $PRIVATE_KEY \
        --broadcast \
        --verify \
        --etherscan-api-key $ETHERSCAN_API_KEY \
        -vvv
else
    echo -e "${YELLOW}⚠️  No Foundry script found, trying Hardhat...${NC}"
    
    # Try LayerZero Hardhat deployment
    if grep -q "lz:deploy" package.json; then
        echo -e "${BLUE}Using LayerZero deployment...${NC}"
        npx hardhat lz:deploy --network ethereum
    else
        echo -e "${RED}❌ No deployment method found${NC}"
        echo -e "${YELLOW}Available options:${NC}"
        echo "  1. Create script/Deploy.s.sol for Foundry"
        echo "  2. Use Hardhat with lz:deploy"
        echo "  3. Create custom deployment script"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${BLUE}📄 Deployment log saved to: $LOG_FILE${NC}"
echo ""

# Show broadcast files
if [ -d "broadcast" ]; then
    echo -e "${BLUE}📁 Broadcast files:${NC}"
    find broadcast -name "*.json" -type f | tail -5
fi

echo ""
echo -e "${GREEN}🎉 Ethereum deployment successful!${NC}"

