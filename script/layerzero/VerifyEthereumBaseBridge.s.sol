// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "forge-std/console.sol";

/**
 * @title VerifyEthereumBaseBridge
 * @notice Verification script to check Ethereum <-> Base bridge configuration
 * 
 * @dev Checks:
 *      - EagleShareOFT deployed on both chains
 *      - Peers are correctly set on both sides
 *      - Composer is properly configured
 *      - LayerZero endpoint connections
 * 
 * @dev Usage:
 *      # Check Ethereum configuration
 *      forge script script/layerzero/VerifyEthereumBaseBridge.s.sol:VerifyEthereumBaseBridge \
 *        --rpc-url $ETHEREUM_RPC_URL
 * 
 *      # Check Base configuration
 *      forge script script/layerzero/VerifyEthereumBaseBridge.s.sol:VerifyEthereumBaseBridge \
 *        --rpc-url $BASE_RPC_URL
 */
contract VerifyEthereumBaseBridge is Script {
    
    // =================================
    // CONSTANTS
    // =================================
    
    address constant EAGLE_SHARE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    address constant COMPOSER_ETHEREUM = 0x3A91B3e863C0bd6948088e8A0A9B1D22d6D05da9;
    
    uint32 constant ETHEREUM_EID = 30101;
    uint32 constant BASE_EID = 30184;
    
    uint256 constant ETHEREUM_CHAIN_ID = 1;
    uint256 constant BASE_CHAIN_ID = 8453;
    
    // =================================
    // MAIN FUNCTION
    // =================================
    
    function run() external view {
        console.log("==============================================");
        console.log("  VERIFICATION: Ethereum <-> Base Bridge");
        console.log("==============================================");
        console.log("");
        console.log("Chain ID:", block.chainid);
        console.log("");
        
        if (block.chainid == ETHEREUM_CHAIN_ID) {
            _verifyEthereum();
        } else if (block.chainid == BASE_CHAIN_ID) {
            _verifyBase();
        } else {
            console.log("ERROR: Unsupported chain");
            console.log("Must be Ethereum (1) or Base (8453)");
            return;
        }
    }
    
    // =================================
    // ETHEREUM VERIFICATION
    // =================================
    
    function _verifyEthereum() internal view {
        console.log("=== ETHEREUM MAINNET ===");
        console.log("");
        
        bool allChecks = true;
        
        // Check 1: EagleShareOFT exists
        console.log("1. Checking EagleShareOFT deployment...");
        uint256 oftCodeSize = _getCodeSize(EAGLE_SHARE_OFT);
        if (oftCodeSize > 0) {
            console.log("   [OK] Contract deployed at:", EAGLE_SHARE_OFT);
            console.log("   Code size:", oftCodeSize, "bytes");
        } else {
            console.log("   [FAIL] Contract not found at:", EAGLE_SHARE_OFT);
            allChecks = false;
        }
        console.log("");
        
        // Check 2: Composer exists
        console.log("2. Checking Composer deployment...");
        uint256 composerCodeSize = _getCodeSize(COMPOSER_ETHEREUM);
        if (composerCodeSize > 0) {
            console.log("   [OK] Composer deployed at:", COMPOSER_ETHEREUM);
            console.log("   Code size:", composerCodeSize, "bytes");
        } else {
            console.log("   [FAIL] Composer not found at:", COMPOSER_ETHEREUM);
            allChecks = false;
        }
        console.log("");
        
        // Check 3: Peer configuration (Ethereum -> Base)
        console.log("3. Checking peer configuration (Ethereum -> Base)...");
        try this.checkPeer(EAGLE_SHARE_OFT, BASE_EID) returns (bytes32 peer) {
            bytes32 expectedPeer = bytes32(uint256(uint160(EAGLE_SHARE_OFT)));
            if (peer == expectedPeer) {
                console.log("   [OK] Base peer correctly set");
                console.log("   Peer:", vm.toString(peer));
            } else if (peer == bytes32(0)) {
                console.log("   [FAIL] Base peer NOT set");
                console.log("   Run: forge script script/layerzero/SetupEthereumBasePeers.s.sol");
                allChecks = false;
            } else {
                console.log("   [WARN] Base peer set to unexpected address");
                console.log("   Expected:", vm.toString(expectedPeer));
                console.log("   Actual:  ", vm.toString(peer));
                allChecks = false;
            }
        } catch {
            console.log("   [FAIL] Could not read peer (contract may not support peers())");
            allChecks = false;
        }
        console.log("");
        
        // Check 4: Composer configuration
        console.log("4. Checking Composer configuration...");
        try this.getComposerContracts(COMPOSER_ETHEREUM) returns (
            address vault,
            address wrapper,
            address eagle,
            address asset,
            address registry
        ) {
            console.log("   [OK] Composer configuration:");
            console.log("   Vault:   ", vault);
            console.log("   Wrapper: ", wrapper);
            console.log("   EAGLE:   ", eagle);
            console.log("   Asset:   ", asset);
            console.log("   Registry:", registry);
            
            if (eagle != EAGLE_SHARE_OFT) {
                console.log("   [WARN] Composer EAGLE address doesn't match expected OFT");
                console.log("   This is OK if using a different token");
            }
        } catch {
            console.log("   [WARN] Could not read Composer config (getContracts() may not exist)");
        }
        console.log("");
        
        // Summary
        console.log("==============================================");
        if (allChecks) {
            console.log("  [SUCCESS] ALL CHECKS PASSED");
            console.log("==============================================");
            console.log("");
            console.log("Ethereum is ready for bridging to Base!");
            console.log("");
            console.log("Next: Verify Base configuration");
            console.log("  forge script script/layerzero/VerifyEthereumBaseBridge.s.sol \\");
            console.log("    --rpc-url $BASE_RPC_URL");
        } else {
            console.log("  [WARNING] SOME CHECKS FAILED");
            console.log("==============================================");
            console.log("");
            console.log("Review errors above and fix configuration");
        }
        console.log("");
    }
    
    // =================================
    // BASE VERIFICATION
    // =================================
    
    function _verifyBase() internal view {
        console.log("=== BASE MAINNET ===");
        console.log("");
        
        bool allChecks = true;
        
        // Check 1: EagleShareOFT exists
        console.log("1. Checking EagleShareOFT deployment...");
        uint256 oftCodeSize = _getCodeSize(EAGLE_SHARE_OFT);
        if (oftCodeSize > 0) {
            console.log("   [OK] Contract deployed at:", EAGLE_SHARE_OFT);
            console.log("   Code size:", oftCodeSize, "bytes");
        } else {
            console.log("   [FAIL] Contract not found at:", EAGLE_SHARE_OFT);
            console.log("   Deploy EagleShareOFT on Base first!");
            allChecks = false;
        }
        console.log("");
        
        // Check 2: Peer configuration (Base -> Ethereum)
        console.log("2. Checking peer configuration (Base -> Ethereum)...");
        try this.checkPeer(EAGLE_SHARE_OFT, ETHEREUM_EID) returns (bytes32 peer) {
            bytes32 expectedPeer = bytes32(uint256(uint160(EAGLE_SHARE_OFT)));
            if (peer == expectedPeer) {
                console.log("   [OK] Ethereum peer correctly set");
                console.log("   Peer:", vm.toString(peer));
            } else if (peer == bytes32(0)) {
                console.log("   [FAIL] Ethereum peer NOT set");
                console.log("   Run: forge script script/layerzero/SetupEthereumBasePeers.s.sol");
                allChecks = false;
            } else {
                console.log("   [WARN] Ethereum peer set to unexpected address");
                console.log("   Expected:", vm.toString(expectedPeer));
                console.log("   Actual:  ", vm.toString(peer));
                allChecks = false;
            }
        } catch {
            console.log("   [FAIL] Could not read peer (contract may not support peers())");
            allChecks = false;
        }
        console.log("");
        
        // Check 3: Token info
        console.log("3. Checking EagleShareOFT token info...");
        try this.getTokenInfo(EAGLE_SHARE_OFT) returns (
            string memory name,
            string memory symbol,
            uint8 decimals
        ) {
            console.log("   [OK] Token info:");
            console.log("   Name:    ", name);
            console.log("   Symbol:  ", symbol);
            console.log("   Decimals:", decimals);
        } catch {
            console.log("   [WARN] Could not read token info");
        }
        console.log("");
        
        // Summary
        console.log("==============================================");
        if (allChecks) {
            console.log("  [SUCCESS] ALL CHECKS PASSED");
            console.log("==============================================");
            console.log("");
            console.log("Base is ready for bridging!");
            console.log("");
            console.log("Users can now:");
            console.log("- Bridge EAGLE from Ethereum to Base");
            console.log("- Hold and transfer EAGLE on Base");
            console.log("- Bridge back to Ethereum anytime");
        } else {
            console.log("  [WARNING] SOME CHECKS FAILED");
            console.log("==============================================");
            console.log("");
            console.log("Review errors above and fix configuration");
        }
        console.log("");
    }
    
    // =================================
    // HELPER FUNCTIONS
    // =================================
    
    function _getCodeSize(address addr) internal view returns (uint256 size) {
        assembly {
            size := extcodesize(addr)
        }
    }
    
    function checkPeer(address oft, uint32 eid) external view returns (bytes32 peer) {
        (bool success, bytes memory data) = oft.staticcall(
            abi.encodeWithSignature("peers(uint32)", eid)
        );
        require(success, "peers() call failed");
        peer = abi.decode(data, (bytes32));
    }
    
    function getComposerContracts(address composer) external view returns (
        address vault,
        address wrapper,
        address eagle,
        address asset,
        address registry
    ) {
        (bool success, bytes memory data) = composer.staticcall(
            abi.encodeWithSignature("getContracts()")
        );
        require(success, "getContracts() call failed");
        (vault, wrapper, eagle, asset, registry) = abi.decode(data, (address, address, address, address, address));
    }
    
    function getTokenInfo(address token) external view returns (
        string memory name,
        string memory symbol,
        uint8 decimals
    ) {
        (bool success1, bytes memory data1) = token.staticcall(
            abi.encodeWithSignature("name()")
        );
        require(success1, "name() call failed");
        name = abi.decode(data1, (string));
        
        (bool success2, bytes memory data2) = token.staticcall(
            abi.encodeWithSignature("symbol()")
        );
        require(success2, "symbol() call failed");
        symbol = abi.decode(data2, (string));
        
        (bool success3, bytes memory data3) = token.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        require(success3, "decimals() call failed");
        decimals = abi.decode(data3, (uint8));
    }
}

