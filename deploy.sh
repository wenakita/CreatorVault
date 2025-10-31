#!/bin/bash

# Eagle OVault Deployment Script
# This script helps automate the deployment process

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_env_file() {
    if [ ! -f .env ]; then
        print_error ".env file not found!"
        print_info "Creating .env from .env.example..."
        cp .env.example .env
        print_warning "Please edit .env file with your private key and RPC URLs"
        exit 1
    fi
    print_success ".env file found"
}

check_private_key() {
    source .env
    if [ -z "$PRIVATE_KEY" ] || [ "$PRIVATE_KEY" = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" ]; then
        print_error "PRIVATE_KEY not set in .env file!"
        print_warning "Please set your actual private key in .env"
        exit 1
    fi
    print_success "Private key configured"
}

check_rpc_urls() {
    source .env
    if [ -z "$ETHEREUM_RPC_URL" ]; then
        print_warning "ETHEREUM_RPC_URL not set, using default"
    else
        print_success "Ethereum RPC URL configured"
    fi
}

check_dependencies() {
    print_header "Checking Dependencies"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        print_success "Node.js installed: $(node --version)"
    else
        print_error "Node.js not installed!"
        exit 1
    fi
    
    # Check pnpm
    if command -v pnpm &> /dev/null; then
        print_success "pnpm installed: $(pnpm --version)"
    else
        print_warning "pnpm not installed, using npm"
    fi
    
    # Check Foundry
    if command -v forge &> /dev/null; then
        print_success "Foundry installed: $(forge --version | head -n 1)"
    else
        print_error "Foundry not installed!"
        print_info "Install from: https://getfoundry.sh"
        exit 1
    fi
}

install_dependencies() {
    print_header "Installing Dependencies"
    
    if command -v pnpm &> /dev/null; then
        pnpm install
    else
        npm install
    fi
    
    forge install
    
    print_success "Dependencies installed"
}

compile_contracts() {
    print_header "Compiling Contracts"
    
    forge build
    
    print_success "Contracts compiled"
    
    # Show contract sizes
    print_info "Contract sizes:"
    forge build --sizes | grep -E "EagleOVault|EagleVaultWrapper|EagleShareOFT|CharmStrategy"
}

run_tests() {
    print_header "Running Tests"
    
    forge test -vv
    
    print_success "All tests passed"
}

deploy_ethereum() {
    print_header "Deploying to Ethereum Mainnet"
    
    print_warning "This will deploy contracts to Ethereum Mainnet!"
    print_warning "Estimated cost: ~3.6 ETH"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        print_info "Deployment cancelled"
        exit 0
    fi
    
    print_info "Deploying EagleOVault, CharmStrategy, and EagleVaultWrapper..."
    forge script script/DeployVanityVault.s.sol:DeployVanityVault \
        --rpc-url $ETHEREUM_RPC_URL \
        --broadcast \
        --verify \
        --slow
    
    print_success "Ethereum deployment complete!"
    print_info "Please save the deployed contract addresses"
}

deploy_spoke_chain() {
    local chain=$1
    local script=$2
    local rpc_var=$3
    
    print_header "Deploying to $chain"
    
    source .env
    local rpc_url="${!rpc_var}"
    
    if [ -z "$rpc_url" ]; then
        print_error "$rpc_var not set in .env"
        return 1
    fi
    
    print_info "Deploying EagleShareOFT to $chain..."
    forge script $script \
        --rpc-url $rpc_url \
        --broadcast \
        --verify
    
    print_success "$chain deployment complete!"
}

configure_layerzero() {
    print_header "Configuring LayerZero Connections"
    
    print_info "Setting up cross-chain peers..."
    pnpm configure:all
    
    print_info "Configuring DVN..."
    pnpm configure-dvn:bsc
    pnpm configure-dvn:arbitrum
    pnpm configure-dvn:base
    pnpm configure-dvn:avalanche
    
    print_info "Verifying connections..."
    pnpm verify:bsc
    pnpm verify:arbitrum
    pnpm verify:base
    pnpm verify:avalanche
    
    print_success "LayerZero configuration complete!"
}

verify_deployment() {
    print_header "Verifying Deployment"
    
    print_info "Checking vault state..."
    npx hardhat run scripts/check-current-vault-state.ts --network ethereum
    
    print_info "Checking strategy approvals..."
    npx hardhat run scripts/check-strategy-approvals.ts --network ethereum
    
    print_success "Deployment verification complete!"
}

deploy_frontend() {
    print_header "Deploying Frontend"
    
    cd frontend
    
    # Check if .env.production exists
    if [ ! -f .env.production ]; then
        print_warning ".env.production not found"
        print_info "Creating from .env.example..."
        cp .env.example .env.production
        print_warning "Please update contract addresses in frontend/.env.production"
        cd ..
        return 1
    fi
    
    print_info "Installing frontend dependencies..."
    npm install
    
    print_info "Building frontend..."
    npm run build
    
    print_success "Frontend build complete!"
    print_info "Deploy the 'dist' folder to your hosting service (Vercel, Netlify, etc.)"
    
    cd ..
}

show_menu() {
    print_header "Eagle OVault Deployment Menu"
    
    echo "1. Check Environment & Dependencies"
    echo "2. Install Dependencies"
    echo "3. Compile Contracts"
    echo "4. Run Tests"
    echo "5. Deploy to Ethereum Mainnet (Hub)"
    echo "6. Deploy to BSC (Spoke)"
    echo "7. Deploy to Arbitrum (Spoke)"
    echo "8. Deploy to Base (Spoke)"
    echo "9. Deploy to Avalanche (Spoke)"
    echo "10. Configure LayerZero Connections"
    echo "11. Verify Deployment"
    echo "12. Deploy Frontend"
    echo "13. Full Deployment (All Steps)"
    echo "0. Exit"
    echo ""
    read -p "Select an option: " option
    
    case $option in
        1)
            check_env_file
            check_private_key
            check_rpc_urls
            check_dependencies
            ;;
        2)
            install_dependencies
            ;;
        3)
            compile_contracts
            ;;
        4)
            run_tests
            ;;
        5)
            check_env_file
            check_private_key
            deploy_ethereum
            ;;
        6)
            check_env_file
            check_private_key
            deploy_spoke_chain "BSC" "script/multi-chain/DeployBSC.s.sol" "BSC_RPC_URL"
            ;;
        7)
            check_env_file
            check_private_key
            deploy_spoke_chain "Arbitrum" "script/DeployArbitrum.s.sol" "ARBITRUM_RPC_URL"
            ;;
        8)
            check_env_file
            check_private_key
            deploy_spoke_chain "Base" "script/multi-chain/DeployBase.s.sol" "BASE_RPC_URL"
            ;;
        9)
            check_env_file
            check_private_key
            deploy_spoke_chain "Avalanche" "script/multi-chain/DeployAvalanche.s.sol" "AVALANCHE_RPC_URL"
            ;;
        10)
            configure_layerzero
            ;;
        11)
            verify_deployment
            ;;
        12)
            deploy_frontend
            ;;
        13)
            print_header "Full Deployment Process"
            print_warning "This will run all deployment steps!"
            read -p "Are you sure? (yes/no): " confirm
            if [ "$confirm" = "yes" ]; then
                check_env_file
                check_private_key
                check_rpc_urls
                check_dependencies
                install_dependencies
                compile_contracts
                run_tests
                deploy_ethereum
                deploy_spoke_chain "BSC" "script/multi-chain/DeployBSC.s.sol" "BSC_RPC_URL"
                deploy_spoke_chain "Arbitrum" "script/DeployArbitrum.s.sol" "ARBITRUM_RPC_URL"
                deploy_spoke_chain "Base" "script/multi-chain/DeployBase.s.sol" "BASE_RPC_URL"
                deploy_spoke_chain "Avalanche" "script/multi-chain/DeployAvalanche.s.sol" "AVALANCHE_RPC_URL"
                configure_layerzero
                verify_deployment
                print_success "Full deployment complete! 🎉"
            fi
            ;;
        0)
            print_info "Exiting..."
            exit 0
            ;;
        *)
            print_error "Invalid option"
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
    show_menu
}

# Main script
clear
print_header "🦅 Eagle OVault Deployment Script"
print_info "Welcome to the Eagle OVault deployment assistant"

# If arguments provided, run specific command
if [ $# -gt 0 ]; then
    case $1 in
        check)
            check_env_file
            check_private_key
            check_rpc_urls
            check_dependencies
            ;;
        install)
            install_dependencies
            ;;
        compile)
            compile_contracts
            ;;
        test)
            run_tests
            ;;
        deploy-ethereum)
            check_env_file
            check_private_key
            deploy_ethereum
            ;;
        deploy-all)
            check_env_file
            check_private_key
            deploy_ethereum
            deploy_spoke_chain "BSC" "script/multi-chain/DeployBSC.s.sol" "BSC_RPC_URL"
            deploy_spoke_chain "Arbitrum" "script/DeployArbitrum.s.sol" "ARBITRUM_RPC_URL"
            deploy_spoke_chain "Base" "script/multi-chain/DeployBase.s.sol" "BASE_RPC_URL"
            deploy_spoke_chain "Avalanche" "script/multi-chain/DeployAvalanche.s.sol" "AVALANCHE_RPC_URL"
            configure_layerzero
            ;;
        configure)
            configure_layerzero
            ;;
        verify)
            verify_deployment
            ;;
        frontend)
            deploy_frontend
            ;;
        *)
            print_error "Unknown command: $1"
            print_info "Available commands: check, install, compile, test, deploy-ethereum, deploy-all, configure, verify, frontend"
            exit 1
            ;;
    esac
else
    # Show interactive menu
    show_menu
fi

