// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleRegistry.sol";

/**
 * @title DeployRegistryCreate2
 * @notice Deploy EagleRegistry using CREATE2 for same address across chains
 * 
 * @dev DETERMINISTIC DEPLOYMENT:
 *      Using CREATE2, this contract will deploy to the SAME address on:
 *      - Ethereum Mainnet
 *      - Arbitrum
 *      - Base
 *      - Any other EVM chain
 * 
 * @dev REQUIREMENTS:
 *      1. Same CREATE2 factory on all chains
 *      2. Same salt value
 *      3. Same bytecode (constructor args must be identical)
 *      4. Same compiler version & optimization settings
 * 
 * @dev USAGE (Ethereum):
 *      forge script script/DeployRegistryCreate2.s.sol:DeployRegistryCreate2 \
 *        --rpc-url $ETHEREUM_RPC_URL \
 *        --broadcast \
 *        --verify \
 *        -vvvv
 * 
 * @dev USAGE (Arbitrum):
 *      forge script script/DeployRegistryCreate2.s.sol:DeployRegistryCreate2 \
 *        --rpc-url $ARBITRUM_RPC_URL \
 *        --broadcast \
 *        --verify \
 *        -vvvv
 */

// Canonical CREATE2 Factory (same address on all chains)
interface ICREATE2Factory {
    function deploy(bytes memory bytecode, bytes32 salt) external returns (address);
    function computeAddress(bytes32 salt, bytes32 bytecodeHash) external view returns (address);
}

contract DeployRegistryCreate2 is Script {
    // Salt for deterministic address (change this to get different address)
    bytes32 constant SALT = 0x0000000000000000000000000000000000000000000000000000000000004747; // "47" in hex
    
    // Owner address (MUST be same on all chains for same address!)
    address constant INITIAL_OWNER = 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3; // Multisig
    
    function run() external {
        console.log("=============================================");
        console.log("DEPLOY: EagleRegistry (CREATE2)");
        console.log("=============================================");
        console.log("");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("Chain Name:", getChainName(block.chainid));
        console.log("");
        
        // Prepare bytecode with constructor arguments
        bytes memory bytecode = abi.encodePacked(
            type(EagleRegistry).creationCode,
            abi.encode(INITIAL_OWNER)
        );
        
        bytes32 bytecodeHash = keccak256(bytecode);
        
        // Compute predicted address
        address predictedAddress = computeCreate2Address(
            CREATE2_FACTORY,
            SALT,
            bytecodeHash
        );
        
        console.log("CREATE2 Configuration:");
        console.log("  Factory:           ", CREATE2_FACTORY);
        console.log("  Salt:              ", vm.toString(SALT));
        console.log("  Bytecode Hash:     ", vm.toString(bytecodeHash));
        console.log("  Predicted Address: ", predictedAddress);
        console.log("");
        
        console.log("Constructor Args:");
        console.log("  Initial Owner:     ", INITIAL_OWNER);
        console.log("");
        
        // Check if address already deployed
        uint256 existingCodeSize;
        assembly {
            existingCodeSize := extcodesize(predictedAddress)
        }
        
        if (existingCodeSize > 0) {
            console.log("[WARNING] Address already has code!");
            console.log("  Address:", predictedAddress);
            console.log("");
            console.log("Registry already deployed on this chain.");
            console.log("No action needed.");
            return;
        }
        
        console.log("[OK] Target address available");
        console.log("");
        
        // Verify CREATE2 factory exists
        uint256 factoryCodeSize;
        assembly {
            factoryCodeSize := extcodesize(CREATE2_FACTORY)
        }
        require(factoryCodeSize > 0, "CREATE2 Factory not deployed on this chain!");
        console.log("[OK] CREATE2 Factory verified");
        console.log("");
        
        console.log("Deploying in 3 seconds...");
        vm.sleep(3000);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy via CREATE2 Factory
        address deployed = ICREATE2Factory(CREATE2_FACTORY).deploy(bytecode, SALT);
        EagleRegistry registry = EagleRegistry(deployed);
        
        console.log("[OK] Registry deployed at:", address(registry));
        console.log("");
        
        // Verify address matches prediction
        require(address(registry) == predictedAddress, "Address mismatch!");
        console.log("[OK] Address matches prediction!");
        console.log("");
        
        // Verify current chain ID is correct
        uint16 currentChainId = registry.getCurrentChainId();
        console.log("[OK] Current Chain ID:", currentChainId);
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("=============================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("=============================================");
        console.log("");
        console.log("Registry Address:    ", address(registry));
        console.log("Current Chain ID:    ", currentChainId);
        console.log("Owner:               ", INITIAL_OWNER);
        console.log("");
        console.log("This address will be the SAME on all chains!");
        console.log("");
        console.log("Next Steps:");
        console.log("1. Deploy on other chains using same script");
        console.log("2. Register chains: registry.registerChain(...)");
        console.log("3. Set LayerZero endpoints: registry.setLayerZeroEndpoint(...)");
        console.log("4. Set EID mappings: registry.setChainIdToEid(...)");
        console.log("");
        
        console.log("Verification Command:");
        console.log("forge verify-contract", address(registry));
        console.log("  contracts/EagleRegistry.sol:EagleRegistry");
        console.log("  --chain-id", vm.toString(block.chainid));
        console.log("  --constructor-args $(cast abi-encode");
        console.log("    \"constructor(address)\"");
        console.log("    ", INITIAL_OWNER, ")");
        console.log("");
    }
    
    /**
     * @notice Compute CREATE2 address
     * @param factory CREATE2 factory address
     * @param salt Deployment salt
     * @param bytecodeHash Hash of bytecode
     * @return predicted Predicted contract address
     */
    function computeCreate2Address(
        address factory,
        bytes32 salt,
        bytes32 bytecodeHash
    ) internal pure returns (address predicted) {
        predicted = address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            factory,
            salt,
            bytecodeHash
        )))));
    }
    
    /**
     * @notice Get human-readable chain name
     * @param chainId Chain ID
     * @return Chain name
     */
    function getChainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 1) return "Ethereum";
        if (chainId == 42161) return "Arbitrum";
        if (chainId == 8453) return "Base";
        if (chainId == 10) return "Optimism";
        if (chainId == 137) return "Polygon";
        if (chainId == 56) return "BSC";
        if (chainId == 43114) return "Avalanche";
        if (chainId == 250) return "Fantom";
        if (chainId == 146) return "Sonic";
        return "Unknown";
    }
}

