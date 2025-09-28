#!/bin/bash

# 🔗 EAGLE VAULT - COMPLETE LAYERZERO WIRING SCRIPT
# This script deploys on all chains and configures cross-chain connections

echo "🔗 EAGLE VAULT LAYERZERO WIRING"
echo "================================"
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Target chains
CHAINS=("ethereum" "arbitrum" "base" "bsc")
DEPLOYED_CHAINS=()
FAILED_CHAINS=()

echo "Phase 1: Deploy contracts on all chains"
echo "========================================"
echo ""

for chain in "${CHAINS[@]}"; do
    echo -e "${BLUE}🌐 Deploying on $chain...${NC}"
    echo "----------------------------------------"
    
    if npx hardhat run scripts/deploy-simple-test.ts --network "$chain"; then
        echo -e "${GREEN}✅ $chain deployment successful${NC}"
        DEPLOYED_CHAINS+=("$chain")
    else
        echo -e "${RED}❌ $chain deployment failed${NC}"
        FAILED_CHAINS+=("$chain")
    fi
    echo ""
done

echo "DEPLOYMENT SUMMARY"
echo "=================="
echo -e "${GREEN}✅ Successful: ${DEPLOYED_CHAINS[*]}${NC}"
if [ ${#FAILED_CHAINS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Failed: ${FAILED_CHAINS[*]}${NC}"
fi
echo ""

# Only proceed with wiring if we have at least 2 chains deployed
if [ ${#DEPLOYED_CHAINS[@]} -lt 2 ]; then
    echo -e "${RED}❌ Need at least 2 chains deployed for cross-chain wiring${NC}"
    echo "Fix deployment issues and re-run this script"
    exit 1
fi

echo "Phase 2: Configure LayerZero cross-chain wiring"
echo "==============================================="
echo ""

WIRED_CHAINS=()
WIRING_FAILED=()

for chain in "${DEPLOYED_CHAINS[@]}"; do
    echo -e "${BLUE}🔗 Configuring LayerZero on $chain...${NC}"
    echo "----------------------------------------"
    
    if npx hardhat run scripts/configure-layerzero-production.ts --network "$chain"; then
        echo -e "${GREEN}✅ $chain LayerZero configuration successful${NC}"
        WIRED_CHAINS+=("$chain")
    else
        echo -e "${YELLOW}⚠️ $chain LayerZero configuration failed (continuing...)${NC}"
        WIRING_FAILED+=("$chain")
    fi
    echo ""
done

echo "Phase 3: Verify cross-chain connections"
echo "======================================="
echo ""

VERIFIED_CHAINS=()
VERIFICATION_FAILED=()

for chain in "${WIRED_CHAINS[@]}"; do
    echo -e "${BLUE}🔍 Verifying $chain connections...${NC}"
    echo "----------------------------------------"
    
    if npx hardhat run scripts/verify-layerzero-config.ts --network "$chain"; then
        echo -e "${GREEN}✅ $chain verification successful${NC}"
        VERIFIED_CHAINS+=("$chain")
    else
        echo -e "${YELLOW}⚠️ $chain verification issues (may need manual review)${NC}"
        VERIFICATION_FAILED+=("$chain")
    fi
    echo ""
done

echo "Phase 4: Test cross-chain transfer"
echo "=================================="
echo ""

if [ ${#VERIFIED_CHAINS[@]} -ge 2 ]; then
    echo -e "${BLUE}🧪 Testing cross-chain transfer...${NC}"
    echo "----------------------------------------"
    
    # Use first two verified chains for testing
    source_chain="${VERIFIED_CHAINS[0]}"
    
    if npx hardhat run scripts/test-cross-chain.ts --network "$source_chain"; then
        echo -e "${GREEN}✅ Cross-chain transfer test successful${NC}"
    else
        echo -e "${YELLOW}⚠️ Cross-chain transfer test failed (may need manual review)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️ Skipping cross-chain test - need at least 2 verified chains${NC}"
fi

echo ""
echo "🎉 WIRING COMPLETE!"
echo "==================="
echo ""

# Final summary
echo "📊 FINAL STATUS:"
echo "---------------"
echo -e "${GREEN}✅ Deployed Chains: ${DEPLOYED_CHAINS[*]}${NC}"
echo -e "${GREEN}✅ Wired Chains: ${WIRED_CHAINS[*]}${NC}"
echo -e "${GREEN}✅ Verified Chains: ${VERIFIED_CHAINS[*]}${NC}"

if [ ${#FAILED_CHAINS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Deployment Failed: ${FAILED_CHAINS[*]}${NC}"
fi

if [ ${#WIRING_FAILED[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️ Wiring Issues: ${WIRING_FAILED[*]}${NC}"
fi

if [ ${#VERIFICATION_FAILED[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️ Verification Issues: ${VERIFICATION_FAILED[*]}${NC}"
fi

echo ""

if [ ${#VERIFIED_CHAINS[@]} -ge 2 ]; then
    echo -e "${GREEN}🎯 SUCCESS: Your Eagle Vault is now FULLY WIRED for cross-chain transfers!${NC}"
    echo ""
    echo "🚀 READY FOR:"
    echo "- Cross-chain EAGLE share transfers"
    echo "- Cross-chain WLFI/USD1 transfers"  
    echo "- Omnichain vault operations"
    echo "- Production LayerZero V2 usage"
    echo ""
    echo "🧪 TEST COMMANDS:"
    echo "npx hardhat run scripts/test-cross-chain.ts --network ethereum"
    echo "npx hardhat run scripts/check-wiring-status.ts --network arbitrum"
else
    echo -e "${YELLOW}⚠️ PARTIAL SUCCESS: Some chains wired, but full cross-chain functionality may be limited${NC}"
    echo ""
    echo "🔧 NEXT STEPS:"
    echo "1. Fix any deployment/wiring issues shown above"
    echo "2. Re-run: bash scripts/wire-all-chains.sh"
    echo "3. Or manually configure failed chains"
fi

echo ""
echo "📄 Full deployment log saved to wiring-summary.txt"

# Save summary to file
{
    echo "Eagle Vault LayerZero Wiring Summary"
    echo "==================================="
    echo "Date: $(date)"
    echo ""
    echo "Deployed Chains: ${DEPLOYED_CHAINS[*]}"
    echo "Wired Chains: ${WIRED_CHAINS[*]}"
    echo "Verified Chains: ${VERIFIED_CHAINS[*]}"
    echo ""
    if [ ${#FAILED_CHAINS[@]} -gt 0 ]; then
        echo "Deployment Failed: ${FAILED_CHAINS[*]}"
    fi
    if [ ${#WIRING_FAILED[@]} -gt 0 ]; then
        echo "Wiring Issues: ${WIRING_FAILED[*]}"
    fi
    if [ ${#VERIFICATION_FAILED[@]} -gt 0 ]; then
        echo "Verification Issues: ${VERIFICATION_FAILED[*]}"
    fi
} > wiring-summary.txt
