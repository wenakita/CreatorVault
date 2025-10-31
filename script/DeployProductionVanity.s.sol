// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleOVault.sol";
import "../contracts/strategies/CharmStrategyUSD1.sol";
import "../contracts/EagleVaultWrapper.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";

/**
 * @title DeployProductionVanity
 * @notice Production deployment with vanity addresses (0x47...ea91e)
 * 
 * CRITICAL: This script uses CREATE2 for deterministic addresses
 * Run simulation first: npx hardhat run scripts/simulate-production-deployment.ts
 * 
 * Usage:
 *   forge script script/DeployProductionVanity.s.sol:DeployProductionVanity \
 *     --rpc-url $ETHEREUM_RPC_URL \
 *     --broadcast \
 *     --verify \
 *     --slow
 */
contract DeployProductionVanity is Script {
    // NOTE: Using native CREATE2 (deploys from msg.sender, not external factory)
    
    // Mainnet token addresses
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant USD1_PRICE_FEED = 0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d;
    address constant WLFI_USD1_POOL = 0x4637Ea6eCf7E16C99E67E941ab4d7d52eAc7c73d;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant CHARM_VAULT = 0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71;
    address constant EAGLE_REGISTRY = 0x47c2e78bCCCdF3E4Ad835c1c2df3Fb760b0EA91E;
    
    // ✅ VANITY SALTS V8 - MIXED PATTERN (2025-10-31)
    // OFT: Full pattern 0x47...ea91e (premium vanity)
    // Others: Partial pattern 0x47... (good enough for backend)
    // Source: vanity-addresses-all-contracts.json + eagleshareof-vanity.json
    // NOTE: Uses Forge bytecode + native CREATE2 + deployer as initial owner
    bytes32 constant VAULT_SALT = 0x000000000000000000000000000000000000000000000000000000000000007c;
    bytes32 constant STRATEGY_SALT = 0x00000000000000000000000000000000000000000000000000000000000001ab;
    bytes32 constant WRAPPER_SALT = 0x0000000000000000000000000000000000000000000000000000000000000186;
    bytes32 constant OFT_SALT = 0x000000000000000000000000000000000000000000000000400000000bcf70b7;
    
    // ✅ Expected vanity addresses V8 - MIXED PATTERN
    address constant EXPECTED_VAULT = 0x47b12BFd18dfe769687a5A72AdA7C281A86BE8D6;
    address constant EXPECTED_STRATEGY = 0x4732CE204d399e0f02D9BB6FE439f2e4d243C2Db;
    address constant EXPECTED_WRAPPER = 0x475bEB9BAC7BD0eA9F0458AD0D50Ea7f8f4e94b3;
    address constant EXPECTED_OFT = 0x47E593E960334B5ac4Ab8EA2495141a30c0eA91E;
    
    function run() external {
        console.log("===============================================");
        console.log("PRODUCTION DEPLOYMENT WITH VANITY ADDRESSES");
        console.log("Pattern: 0x47...ea91e");
        console.log("===============================================");
        console.log("");
        
        // Get private key and derive deployer address
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");
        
        // SAFETY CHECK: Only run on mainnet
        require(block.chainid == 1, "SAFETY: This script is for MAINNET ONLY");
        
        console.log("WARNING: You are about to deploy to MAINNET");
        console.log("Press Ctrl+C within 10 seconds to cancel...");
        console.log("");
        
        console.log("Owner (deployer initially):", deployer);
        console.log("NOTE: Transfer ownership to multisig after deployment");
        console.log("");
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        // ============================================
        // PHASE 1: DEPLOY VAULT
        // ============================================
        console.log("=== PHASE 1: Deploying EagleOVault ===");
        address vault = _deployVault(deployer);
        console.log("Vault deployed:", vault);
        console.log("Expected:      ", EXPECTED_VAULT);
        if (vault != EXPECTED_VAULT) {
            console.log("WARNING: Address mismatch! Continuing anyway...");
        }
        _verifyVanityAddress(vault, "Vault");
        console.log("");
        
        // Pause: Allow time to verify on Etherscan before proceeding
        console.log("CHECKPOINT: Verify vault on Etherscan before continuing");
        console.log("  - Check bytecode matches compilation");
        console.log("  - Test read functions");
        console.log("  - Verify constructor args");
        console.log("");
        
        // ============================================
        // PHASE 2: DEPLOY OFT
        // ============================================
        console.log("=== PHASE 2: Deploying EagleShareOFT ===");
        address oft = _deployOFT(deployer);
        console.log("OFT deployed:", oft);
        console.log("Expected:    ", EXPECTED_OFT);
        if (oft != EXPECTED_OFT) {
            console.log("WARNING: Address mismatch! Continuing anyway...");
        }
        _verifyVanityAddress(oft, "OFT");
        console.log("");
        
        // ============================================
        // PHASE 3: DEPLOY WRAPPER
        // ============================================
        console.log("=== PHASE 3: Deploying EagleVaultWrapper ===");
        address wrapper = _deployWrapper(vault, oft, deployer, deployer);
        console.log("Wrapper deployed:", wrapper);
        console.log("Expected:        ", EXPECTED_WRAPPER);
        if (wrapper != EXPECTED_WRAPPER) {
            console.log("WARNING: Address mismatch! Continuing anyway...");
        }
        _verifyVanityAddress(wrapper, "Wrapper");
        console.log("");
        
        // ============================================
        // PHASE 4: DEPLOY STRATEGY
        // ============================================
        console.log("=== PHASE 4: Deploying CharmStrategyUSD1 ===");
        address strategy = _deployStrategy(vault, deployer);
        console.log("Strategy deployed:", strategy);
        console.log("Expected:         ", EXPECTED_STRATEGY);
        if (strategy != EXPECTED_STRATEGY) {
            console.log("WARNING: Address mismatch! Continuing anyway...");
        }
        _verifyVanityAddress(strategy, "Strategy");
        console.log("");
        
        vm.stopBroadcast();
        
        // ============================================
        // DEPLOYMENT SUMMARY
        // ============================================
        console.log("===============================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("===============================================");
        console.log("");
        console.log("Deployed Contracts:");
        console.log("  EagleOVault:        ", vault);
        console.log("  CharmStrategyUSD1:  ", strategy);
        console.log("  EagleShareOFT:      ", oft);
        console.log("  EagleVaultWrapper:  ", wrapper);
        console.log("");
        console.log("Vanity Address Check:");
        _verifyVanityAddress(vault, "Vault");
        _verifyVanityAddress(strategy, "Strategy");
        _verifyVanityAddress(oft, "OFT");
        _verifyVanityAddress(wrapper, "Wrapper");
        console.log("");
        console.log("CRITICAL NEXT STEPS:");
        console.log("1. Verify ALL contracts on Etherscan");
        console.log("2. Test with small deposits (100 WLFI max)");
        console.log("3. Configure roles and limits");
        console.log("4. Follow PRODUCTION_DEPLOYMENT_GUIDE.md Phase 2");
        console.log("");
        console.log("DO NOT skip the gradual activation phase!");
        console.log("");
    }
    
    /**
     * @notice Deploy EagleOVault via native CREATE2
     */
    function _deployVault(address owner) internal returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(EagleOVault).creationCode,
            abi.encode(WLFI, USD1, USD1_PRICE_FEED, WLFI_USD1_POOL, UNISWAP_ROUTER, owner)
        );
        
        address deployed;
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), VAULT_SALT)
            if iszero(deployed) {
                revert(0, 0)
            }
        }
        
        require(deployed != address(0), "Vault CREATE2 deployment failed");
        return deployed;
    }
    
    /**
     * @notice Deploy CharmStrategyUSD1 via native CREATE2
     */
    function _deployStrategy(address vault, address owner) internal returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(CharmStrategyUSD1).creationCode,
            abi.encode(vault, CHARM_VAULT, WLFI, USD1, UNISWAP_ROUTER, owner)
        );
        
        address deployed;
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), STRATEGY_SALT)
            if iszero(deployed) {
                revert(0, 0)
            }
        }
        
        require(deployed != address(0), "Strategy CREATE2 deployment failed");
        return deployed;
    }
    
    /**
     * @notice Deploy EagleShareOFT via native CREATE2
     */
    function _deployOFT(address owner) internal returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(EagleShareOFT).creationCode,
            abi.encode("Eagle", "EAGLE", EAGLE_REGISTRY, owner)
        );
        
        address deployed;
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), OFT_SALT)
            if iszero(deployed) {
                revert(0, 0)
            }
        }
        
        require(deployed != address(0), "OFT CREATE2 deployment failed");
        return deployed;
    }
    
    /**
     * @notice Deploy EagleVaultWrapper via native CREATE2
     */
    function _deployWrapper(address vault, address oft, address feeRecipient, address owner) internal returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(EagleVaultWrapper).creationCode,
            abi.encode(vault, oft, feeRecipient, owner)
        );
        
        address deployed;
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), WRAPPER_SALT)
            if iszero(deployed) {
                revert(0, 0)
            }
        }
        
        require(deployed != address(0), "Wrapper CREATE2 deployment failed");
        return deployed;
    }
    
    /**
     * @notice Verify address matches vanity pattern
     */
    function _verifyVanityAddress(address addr, string memory name) internal view {
        bytes memory addrBytes = abi.encodePacked(addr);
        
        // Check prefix (0x47)
        bool prefixMatch = addrBytes[0] == 0x47;
        
        // Check suffix (ea91e) - only for OFT
        bool suffixMatch = 
            addrBytes[17] == 0x0e &&
            addrBytes[18] == 0xa9 &&
            addrBytes[19] == 0x1e;
        
        if (prefixMatch && suffixMatch) {
            console.log("  ", name, "matches FULL vanity pattern (0x47...ea91e) [PREMIUM]");
        } else if (prefixMatch) {
            console.log("  ", name, "matches PARTIAL vanity pattern (0x47...) [OK]");
        } else {
            console.log("  WARNING:", name, "does NOT match vanity pattern!");
            console.log("    Expected: 0x47...");
            console.log("    Got:     ", addr);
        }
    }
}

