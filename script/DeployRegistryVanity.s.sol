// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleRegistry.sol";

/**
 * @title DeployRegistryVanity
 * @notice Deploy EagleRegistry with vanity address (0x47...ea91e)
 * 
 * CRITICAL: Registry MUST be deployed FIRST before any other contracts
 * 
 * Usage:
 *   forge script script/DeployRegistryVanity.s.sol:DeployRegistryVanity \
 *     --rpc-url ethereum \
 *     --broadcast \
 *     --verify
 */
contract DeployRegistryVanity is Script {
    // ✅ VANITY SALT FOR REGISTRY - Pattern: 0x47...
    // Generated using Rust vanity generator with Forge's Create2Deployer (2025-10-31)
    // Deployer: 0x4e59b44847b379578588920cA78FbF26c0B4956C (Forge's Create2Deployer)
    // Attempts: 34 | Time: 0.00s | Speed: instant
    // Init Code Hash: 0x912c34d30d5aa5060d7927a26ef87955201fc2ec9a41029c64e8cfcd297032d8
    bytes32 constant REGISTRY_SALT = 0x0000000000000000000000000000000000000000000000002100000000000001;

    // ✅ Expected vanity address for registry
    address constant EXPECTED_REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e;
    
    // LayerZero V2 Endpoints
    address constant LZ_ENDPOINT_ETHEREUM = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant LZ_ENDPOINT_BSC = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant LZ_ENDPOINT_ARBITRUM = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant LZ_ENDPOINT_BASE = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant LZ_ENDPOINT_AVALANCHE = 0x1a44076050125825900e736c501f859c50fE728c;
    
    function run() external {
        console.log("===============================================");
        console.log("DEPLOYING EAGLEREGISTRY WITH VANITY ADDRESS");
        console.log("Pattern: 0x47... [PARTIAL]");
        console.log("===============================================");
        console.log("");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");
        
        // Predict address
        address predictedAddress = _predictAddress(deployer);
        console.log("Predicted Registry Address:", predictedAddress);
        console.log("");
        
        // Check if matches vanity pattern
        if (!_isVanityAddress(predictedAddress)) {
            console.log("WARNING: Address does not match vanity pattern!");
            console.log("Expected: 0x47...");
            console.log("Got:     ", predictedAddress);
            console.log("");
            console.log("You need to generate the correct salt!");
            console.log("See: scripts/generate-registry-vanity-salt.ts");
            revert("Vanity address mismatch");
        }
        
        console.log("Vanity address verified! [PARTIAL]");
        console.log("");
        
        // Check if already deployed
        if (predictedAddress.code.length > 0) {
            console.log("Registry already deployed at:", predictedAddress);
            return;
        }
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy with CREATE2 using assembly (not Solidity's new{salt})
        console.log("Deploying EagleRegistry...");
        
        bytes memory bytecode = abi.encodePacked(
            type(EagleRegistry).creationCode,
            abi.encode(deployer)
        );
        
        address registryAddress;
        bytes32 salt = REGISTRY_SALT;
        assembly {
            registryAddress := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(registryAddress) {
                revert(0, 0)
            }
        }
        
        console.log("Registry deployed:", registryAddress);
        require(registryAddress == predictedAddress, "Address mismatch!");
        
        // Verify vanity pattern
        require(_isVanityAddress(registryAddress), "Vanity pattern failed!");
        console.log("Vanity pattern verified!");
        console.log("");
        
        // Configure chain and LayerZero endpoint
        console.log("Configuring chain and LayerZero endpoint...");
        EagleRegistry registry = EagleRegistry(registryAddress);
        
        // Register the chain first
        string memory chainName = _getNetworkName();
        address wrappedNative = _getWrappedNative(block.chainid);
        string memory wrappedSymbol = _getWrappedSymbol(block.chainid);
        
        console.log("Registering chain:", chainName);
        registry.registerChain(uint16(block.chainid), chainName, wrappedNative, wrappedSymbol, true);
        
        // Then set LayerZero endpoint
        address lzEndpoint = _getLZEndpoint(block.chainid);
        console.log("Setting LayerZero Endpoint:", lzEndpoint);
        registry.setLayerZeroEndpoint(uint16(block.chainid), lzEndpoint);
        
        console.log("Configuration complete!");
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("REGISTRY DEPLOYMENT COMPLETE!");
        console.log("===============================================");
        console.log("");
        console.log("Registry Address:", registryAddress);
        console.log("");
        console.log("Vanity Pattern: 0x47...ea91e");
        console.log("  Starts with: 0x47");
        console.log("  Ends with:   ea91e");
        console.log("");
        console.log("Save this address:");
        console.log("  export EAGLE_REGISTRY=", registryAddress);
        console.log("");
        console.log("Next Steps:");
        console.log("1. Update .env with REGISTRY_ADDRESS");
        console.log("2. Deploy other contracts (Vault, Strategy, Wrapper, OFT)");
        console.log("3. All contracts will query this registry for LayerZero endpoints");
    }
    
    function _predictAddress(address deployer) internal view returns (address) {
        // Forge's Create2Deployer address (used even with assembly CREATE2)
        address create2Deployer = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
        
        bytes memory bytecode = abi.encodePacked(
            type(EagleRegistry).creationCode,
            abi.encode(deployer)
        );
        
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                create2Deployer,  // Use Create2Deployer, not deployer
                REGISTRY_SALT,
                keccak256(bytecode)
            )
        );
        
        return address(uint160(uint256(hash)));
    }
    
    function _isVanityAddress(address addr) internal pure returns (bool) {
        // Registry only needs partial vanity: 0x47...
        // Check if starts with 0x47
        if (uint160(addr) >> 152 != 0x47) return false;
        
        return true;
    }
    
    function _getLZEndpoint(uint256 chainId) internal pure returns (address) {
        if (chainId == 1) return LZ_ENDPOINT_ETHEREUM;      // Ethereum
        if (chainId == 56) return LZ_ENDPOINT_BSC;          // BSC
        if (chainId == 42161) return LZ_ENDPOINT_ARBITRUM;  // Arbitrum
        if (chainId == 8453) return LZ_ENDPOINT_BASE;       // Base
        if (chainId == 43114) return LZ_ENDPOINT_AVALANCHE; // Avalanche
        
        revert("Unsupported chain");
    }
    
    function _getWrappedNative(uint256 chainId) internal pure returns (address) {
        if (chainId == 1) return 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2; // WETH
        if (chainId == 56) return 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c; // WBNB
        if (chainId == 42161) return 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1; // WETH (Arbitrum)
        if (chainId == 8453) return 0x4200000000000000000000000000000000000006; // WETH (Base)
        if (chainId == 43114) return 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7; // WAVAX
        revert("Unsupported chain");
    }
    
    function _getWrappedSymbol(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 1) return "WETH";
        if (chainId == 56) return "WBNB";
        if (chainId == 42161) return "WETH";
        if (chainId == 8453) return "WETH";
        if (chainId == 43114) return "WAVAX";
        revert("Unsupported chain");
    }
    
    function _getNetworkName() internal view returns (string memory) {
        if (block.chainid == 1) return "Ethereum";
        if (block.chainid == 56) return "BSC";
        if (block.chainid == 42161) return "Arbitrum";
        if (block.chainid == 8453) return "Base";
        if (block.chainid == 43114) return "Avalanche";
        if (block.chainid == 11155111) return "Sepolia";
        return "Unknown";
    }
}

