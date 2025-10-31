#!/bin/bash

# EagleShareOFT Test Runner
# This script runs the EagleShareOFT test suite with proper configuration

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}==============================================
${NC}"
echo -e "${GREEN}EagleShareOFT Test Suite Runner${NC}"
echo -e "${YELLOW}==============================================
${NC}"

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo -e "\n${YELLOW}Project Directory:${NC} $PROJECT_ROOT"

# Check for required tools
if ! command -v forge &> /dev/null; then
    echo -e "${RED}Error: forge (Foundry) not found${NC}"
    echo "Please install Foundry: https://book.getfoundry.sh/getting-started/installation"
    exit 1
fi

echo -e "\n${GREEN}✓ Foundry detected${NC}"

# Temporary fix for OpenZeppelin v5 / Uniswap v3-periphery incompatibility
echo -e "\n${YELLOW}Checking for dependency issues...${NC}"

OZ_ERC721_DIR="$PROJECT_ROOT/node_modules/@openzeppelin/contracts/token/ERC721"
OZ_TOKEN_DIR="$PROJECT_ROOT/node_modules/@openzeppelin/contracts/token"

# Create temporary symlinks if needed
if [ ! -f "$OZ_ERC721_DIR/IERC721Metadata.sol" ]; then
    echo -e "${YELLOW}Creating temporary symlinks for OpenZeppelin compatibility...${NC}"
    ln -sf extensions/IERC721Metadata.sol "$OZ_ERC721_DIR/IERC721Metadata.sol" 2>/dev/null || true
fi

if [ ! -f "$OZ_ERC721_DIR/IERC721Enumerable.sol" ]; then
    ln -sf extensions/IERC721Enumerable.sol "$OZ_ERC721_DIR/IERC721Enumerable.sol" 2>/dev/null || true
fi

if [ ! -f "$OZ_TOKEN_DIR/IERC721.sol" ]; then
    ln -sf ERC721/IERC721.sol "$OZ_TOKEN_DIR/IERC721.sol" 2>/dev/null || true
fi

# Function to cleanup symlinks
cleanup() {
    echo -e "\n${YELLOW}Cleaning up temporary symlinks...${NC}"
    rm -f "$OZ_ERC721_DIR/IERC721Metadata.sol" 2>/dev/null || true
    rm -f "$OZ_ERC721_DIR/IERC721Enumerable.sol" 2>/dev/null || true
    rm -f "$OZ_TOKEN_DIR/IERC721.sol" 2>/dev/null || true
}

# Register cleanup function
trap cleanup EXIT

# Parse command line arguments
TEST_CONTRACT="${1:-EagleShareOFT}"
VERBOSITY="${2:--vv}"

echo -e "\n${YELLOW}Test Configuration:${NC}"
echo -e "  Contract Pattern: ${GREEN}$TEST_CONTRACT${NC}"
echo -e "  Verbosity: ${GREEN}$VERBOSITY${NC}"

echo -e "\n${YELLOW}==============================================
${NC}"
echo -e "${GREEN}Running Tests...${NC}"
echo -e "${YELLOW}==============================================
${NC}\n"

# Run the tests
if forge test --match-contract "$TEST_CONTRACT" "$VERBOSITY" --gas-report; then
    echo -e "\n${YELLOW}==============================================
${NC}"
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo -e "${YELLOW}==============================================
${NC}\n"
    exit 0
else
    echo -e "\n${YELLOW}==============================================
${NC}"
    echo -e "${RED}✗ Some tests failed${NC}"
    echo -e "${YELLOW}==============================================
${NC}\n"
    exit 1
fi

