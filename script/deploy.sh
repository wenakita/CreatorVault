#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
#                    CreatorVault Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# Usage:
#   ./script/deploy.sh infrastructure    - Deploy all core contracts
#   ./script/deploy.sh vault <TOKEN>     - Deploy vault for a creator coin
#   ./script/deploy.sh aa <TOKEN>        - Deploy via ERC-4337 (gasless)
#
# Environment:
#   PRIVATE_KEY         - Deployer private key
#   RPC_URL             - Base RPC URL (default: https://mainnet.base.org)
#   ETHERSCAN_API_KEY   - For contract verification
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default RPC
RPC_URL=${RPC_URL:-"https://mainnet.base.org"}

# Print banner
print_banner() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}║     ██████╗██████╗ ███████╗ █████╗ ████████╗ ██████╗ ██████╗   ║${NC}"
    echo -e "${BLUE}║    ██╔════╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗  ║${NC}"
    echo -e "${BLUE}║    ██║     ██████╔╝█████╗  ███████║   ██║   ██║   ██║██████╔╝  ║${NC}"
    echo -e "${BLUE}║    ██║     ██╔══██╗██╔══╝  ██╔══██║   ██║   ██║   ██║██╔══██╗  ║${NC}"
    echo -e "${BLUE}║    ╚██████╗██║  ██║███████╗██║  ██║   ██║   ╚██████╔╝██║  ██║  ║${NC}"
    echo -e "${BLUE}║     ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝  ║${NC}"
    echo -e "${BLUE}║                         VAULT                                  ║${NC}"
    echo -e "${BLUE}║                                                                ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

# Print usage
print_usage() {
    echo -e "${YELLOW}Usage:${NC}"
    echo "  ./script/deploy.sh infrastructure         Deploy all core contracts"
    echo "  ./script/deploy.sh vault <TOKEN_ADDRESS>  Deploy vault for creator coin"
    echo "  ./script/deploy.sh aa <TOKEN> [--gasless] Deploy via ERC-4337"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  ./script/deploy.sh infrastructure"
    echo "  ./script/deploy.sh vault 0x5b674196812451b7cec024fe9d22d2c0b172fa75"
    echo "  ./script/deploy.sh aa 0x5b674196812451b7cec024fe9d22d2c0b172fa75 --gasless"
    echo ""
    echo -e "${YELLOW}Environment Variables:${NC}"
    echo "  PRIVATE_KEY         - Your deployer private key"
    echo "  RPC_URL             - Base RPC URL (default: mainnet.base.org)"
    echo "  ETHERSCAN_API_KEY   - For contract verification"
    echo "  CREATOR_FACTORY     - Factory address (for vault deployment)"
    echo ""
}

# Check prerequisites
check_prereqs() {
    if [ -z "$PRIVATE_KEY" ]; then
        echo -e "${RED}Error: PRIVATE_KEY environment variable not set${NC}"
        exit 1
    fi
    
    if ! command -v forge &> /dev/null; then
        echo -e "${RED}Error: Foundry not installed. Install from https://getfoundry.sh${NC}"
        exit 1
    fi
}

# Deploy infrastructure
deploy_infrastructure() {
    echo -e "${GREEN}Deploying CreatorVault Infrastructure...${NC}"
    echo ""
    
    forge script script/DeployInfrastructure.s.sol:DeployInfrastructure \
        --rpc-url "$RPC_URL" \
        --broadcast \
        --verify \
        -vvvv
    
    echo ""
    echo -e "${GREEN}✓ Infrastructure deployed successfully!${NC}"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "1. Copy contract addresses to .env file"
    echo "2. Add contracts to Coinbase Paymaster allowlist"
    echo "3. Deploy creator vaults"
}

# Deploy vault for creator coin
deploy_vault() {
    local token=$1
    
    if [ -z "$token" ]; then
        echo -e "${RED}Error: Token address required${NC}"
        echo "Usage: ./script/deploy.sh vault <TOKEN_ADDRESS>"
        exit 1
    fi
    
    if [ -z "$CREATOR_FACTORY" ]; then
        echo -e "${RED}Error: CREATOR_FACTORY environment variable not set${NC}"
        echo "Deploy infrastructure first, then set CREATOR_FACTORY=<address>"
        exit 1
    fi
    
    echo -e "${GREEN}Deploying Creator Vault for $token...${NC}"
    echo ""
    
    CREATOR_COIN_ADDRESS=$token forge script script/DeployInfrastructure.s.sol:DeployCreatorVault \
        --rpc-url "$RPC_URL" \
        --broadcast \
        -vvvv
    
    echo ""
    echo -e "${GREEN}✓ Creator Vault deployed successfully!${NC}"
}

# Deploy via ERC-4337
deploy_aa() {
    local token=$1
    local gasless_flag=""
    
    if [ -z "$token" ]; then
        echo -e "${RED}Error: Token address required${NC}"
        echo "Usage: ./script/deploy.sh aa <TOKEN_ADDRESS> [--gasless]"
        exit 1
    fi
    
    # Check for --gasless flag
    if [[ "$*" == *"--gasless"* ]]; then
        gasless_flag="--gasless"
        echo -e "${GREEN}Using Coinbase Paymaster (gasless)${NC}"
    fi
    
    if [ -z "$SMART_ACCOUNT" ]; then
        echo -e "${RED}Error: SMART_ACCOUNT environment variable not set${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Deploying via ERC-4337 for $token...${NC}"
    echo ""
    
    npx ts-node script/deploy-with-aa.ts "$token" $gasless_flag
    
    echo ""
    echo -e "${GREEN}✓ Deployment submitted via ERC-4337!${NC}"
}

# Main
main() {
    print_banner
    
    local command=$1
    shift
    
    case $command in
        "infrastructure"|"infra")
            check_prereqs
            deploy_infrastructure
            ;;
        "vault")
            check_prereqs
            deploy_vault "$@"
            ;;
        "aa"|"4337")
            deploy_aa "$@"
            ;;
        "help"|"-h"|"--help"|"")
            print_usage
            ;;
        *)
            echo -e "${RED}Unknown command: $command${NC}"
            print_usage
            exit 1
            ;;
    esac
}

main "$@"

