#!/bin/bash
# Quick Deploy - One Contract at a Time
# Usage: ./QUICK_DEPLOY.sh [1|2|3|4]

set -e

cd /home/akitav2/.cursor/worktrees/eagle-ovault-clean__WSL__ubuntu-24.04_/8fkjs
source .env

case "$1" in
  1)
    echo "🚀 Deploying 1/4: EagleOVault"
    forge script script/Deploy1_Vault.s.sol:Deploy1_Vault \
      --rpc-url $ETHEREUM_RPC_URL \
      --broadcast \
      --verify \
      --slow \
      -vvv
    ;;
  2)
    echo "🚀 Deploying 2/4: EagleShareOFT [PREMIUM]"
    forge script script/Deploy2_OFT.s.sol:Deploy2_OFT \
      --rpc-url $ETHEREUM_RPC_URL \
      --broadcast \
      --verify \
      --slow \
      -vvv
    ;;
  3)
    echo "🚀 Deploying 3/4: EagleVaultWrapper"
    forge script script/Deploy3_Wrapper.s.sol:Deploy3_Wrapper \
      --rpc-url $ETHEREUM_RPC_URL \
      --broadcast \
      --verify \
      --slow \
      -vvv
    ;;
  4)
    echo "🚀 Deploying 4/4: CharmStrategyUSD1"
    forge script script/Deploy4_Strategy.s.sol:Deploy4_Strategy \
      --rpc-url $ETHEREUM_RPC_URL \
      --broadcast \
      --verify \
      --slow \
      -vvv
    ;;
  *)
    echo "Usage: ./QUICK_DEPLOY.sh [1|2|3|4]"
    echo ""
    echo "Deploy contracts one at a time:"
    echo "  1 - EagleOVault"
    echo "  2 - EagleShareOFT [PREMIUM VANITY]"
    echo "  3 - EagleVaultWrapper"
    echo "  4 - CharmStrategyUSD1"
    echo ""
    echo "Example: ./QUICK_DEPLOY.sh 1"
    exit 1
    ;;
esac

