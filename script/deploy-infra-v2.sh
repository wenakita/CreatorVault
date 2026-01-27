#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f ".env" ]; then
  # Load only KEY=VALUE lines from .env (ignore shell syntax).
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    case "$line" in
      ''|\#*) continue ;;
    esac
    if [[ "$line" == export\ * ]]; then
      line="${line#export }"
    fi
    if [[ "$line" != *=* ]]; then
      continue
    fi
    key="${line%%=*}"
    value="${line#*=}"
    key="${key#"${key%%[![:space:]]*}"}"
    key="${key%"${key##*[![:space:]]}"}"
    if [[ ! "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
      continue
    fi
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:-1}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:-1}"
    fi
    export "$key=$value"
  done < ".env"
fi

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Error: ${name} environment variable not set"
    exit 1
  fi
}

if ! command -v forge >/dev/null 2>&1; then
  echo "Error: Foundry (forge) not installed. Install from https://getfoundry.sh"
  exit 1
fi

require_env PRIVATE_KEY
require_env BASE_RPC_URL

if [ -z "${ETHERSCAN_API_KEY:-}" ] && [ -n "${BASESCAN_API_KEY:-}" ]; then
  export ETHERSCAN_API_KEY="$BASESCAN_API_KEY"
fi

if [ -z "${ETHERSCAN_API_KEY:-}" ]; then
  echo "Warning: ETHERSCAN_API_KEY (or BASESCAN_API_KEY) not set; --verify may fail."
fi

echo "Deploying v2 bytecode store + deployer on Base mainnet..."
forge script script/DeployBaseMainnetDeployer.s.sol:DeployBaseMainnetDeployer \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast \
  --verify

echo "Done."
