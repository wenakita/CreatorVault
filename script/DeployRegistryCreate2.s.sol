// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleRegistry.sol";

/**
 * @title DeployRegistryCreate2
 * @notice Deploy EagleRegistry to same address on all chains using CREATE2
 * 
 * CRITICAL: This deploys the registry to a DETERMINISTIC address
 * 
 * Benefits:
 * - Same registry address on ALL chains
 * - Adapters can use same address everywhere
 * - Simplifies configuration dramatically
 * - No need to track different addresses per chain
 * 
 * @dev Usage:
 *      # Deploy on Ethereum
 *      forge script script/DeployRegistryCreate2.s.sol:DeployRegistryCreate2 \
 *        --rpc-url $ETHEREUM_RPC_URL \
 *        --broadcast \
 *        --verify
 *      
 *      # Deploy on BNB (will be SAME address!)
 *      forge script script/DeployRegistryCreate2.s.sol:DeployRegistryCreate2 \
 *        --rpc-url $BNB_RPC_URL \
 *        --broadcast \
 *        --verify
 *      
 *      # Deploy on Arbitrum (will be SAME address!)
 *      forge script script/DeployRegistryCreate2.s.sol:DeployRegistryCreate2 \
 *        --rpc-url $ARBITRUM_RPC_URL \
 *        --broadcast \
 *        --verify
 */
contract DeployRegistryCreate2 is Script {
    // Salt for deterministic deployment
    // IMPORTANT: Change this if you want a different address
    bytes32 constant SALT = keccak256("EagleRegistry.v1");
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Determine network
        string memory network = _getNetworkName();
        
        console.log("==============================================");
        console.log("DEPLOYING EAGLEREGISTRY WITH CREATE2");
        console.log("==============================================");
        console.log("");
        console.log("Network:", network);
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("CREATE2 Factory:", CREATE2_FACTORY);
        console.log("");
        
        // Predict address BEFORE deployment
        address predictedAddress = _predictAddress(deployer);
        console.log("Predicted Address:", predictedAddress);
        console.log("");
        console.log("CRITICAL: This will be the SAME address on ALL chains!");
        console.log("");
        
        // Check if already deployed
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(predictedAddress)
        }
        
        if (codeSize > 0) {
            console.log("WARNING: Registry already deployed at this address!");
            console.log("  Address:", predictedAddress);
            console.log("");
            console.log("If you want to redeploy:");
            console.log("  1. Change SALT in this script");
            console.log("  2. Or use a different owner address");
            console.log("");
            return;
        }
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy via CREATE2
        console.log("Deploying EagleRegistry...");
        address registry = _deployCreate2(deployer);
        
        console.log("  Registry deployed at:", registry);
        console.log("");
        
        // Verify address matches prediction
        require(registry == predictedAddress, "Address mismatch!");
        console.log("  Address verified ");
        console.log("");
        
        // Initialize registry with LayerZero endpoint for this chain
        console.log("Configuring registry...");
        _configureRegistry(registry);
        console.log("  Configuration complete ");
        console.log("");
        
        console.log("==============================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("==============================================");
        console.log("");
        console.log("REGISTRY ADDRESS:", registry);
        console.log("");
        console.log("This address will be SAME on all chains! ");
        console.log("");
        console.log("Save this address:");
        console.log("  export EAGLE_REGISTRY=", registry);
        console.log("");
        console.log("Next Steps:");
        console.log("1. Deploy registry to other chains (same address)");
        console.log("2. Configure LayerZero endpoints on each chain");
        console.log("3. Deploy adapters with this registry address");
        console.log("4. Deploy OFTs with this registry address");
        console.log("");
        
        vm.stopBroadcast();
        
        // Save deployment info
        _saveDeployment(network, registry);
    }
    
    /**
     * @notice Deploy EagleRegistry using CREATE2
     * @param owner Owner address for the registry
     * @return Deployed registry address
     */
    function _deployCreate2(address owner) internal returns (address) {
        // Get bytecode with constructor args
        bytes memory bytecode = abi.encodePacked(
            type(EagleRegistry).creationCode,
            abi.encode(owner)
        );
        
        // Deploy via CREATE2 factory (Arachnid's implementation)
        (bool success, ) = CREATE2_FACTORY.call(
            abi.encodePacked(SALT, bytecode)
        );
        
        require(success, "CREATE2 deployment failed");
        
        // Calculate the deployed address
        address deployed = _predictAddress(owner);
        
        // Verify deployment
        uint256 size;
        assembly {
            size := extcodesize(deployed)
        }
        require(size > 0, "Deployment failed - no code at address");
        
        return deployed;
    }
    
    /**
     * @notice Predict deployment address
     * @param owner Owner address
     * @return Predicted address
     */
    function _predictAddress(address owner) internal view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(EagleRegistry).creationCode,
            abi.encode(owner)
        );
        
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                CREATE2_FACTORY,
                SALT,
                keccak256(bytecode)
            )
        );
        
        return address(uint160(uint256(hash)));
    }
    
    /**
     * @notice Configure registry with LayerZero endpoint for current chain
     * @param registry Registry address
     */
    function _configureRegistry(address registry) internal {
        EagleRegistry reg = EagleRegistry(registry);
        
        // Get LayerZero endpoint for this chain
        address endpoint = _getLayerZeroEndpoint();
        uint16 chainId = _getChainId();
        
        if (endpoint != address(0)) {
            // Register current chain
            _registerCurrentChain(reg);
            
            // Set LayerZero endpoint
            reg.setLayerZeroEndpoint(chainId, endpoint);
            
            console.log("  Registered chain:", chainId);
            console.log("  Set endpoint:", endpoint);
        } else {
            console.log("  WARNING: No endpoint configured for chain", block.chainid);
            console.log("  You'll need to set it manually via:");
            console.log("    registry.setLayerZeroEndpoint(chainId, endpoint)");
        }
    }
    
    /**
     * @notice Register current chain in registry
     */
    function _registerCurrentChain(EagleRegistry registry) internal {
        uint16 chainId = _getChainId();
        string memory chainName = _getNetworkName();
        address weth = _getWETH();
        string memory wethSymbol = _getWETHSymbol();
        
        if (weth != address(0)) {
            registry.registerChain(
                chainId,
                chainName,
                weth,
                wethSymbol,
                true // isActive
            );
        }
    }
    
    /**
     * @notice Get LayerZero V2 endpoint for current chain
     */
    function _getLayerZeroEndpoint() internal view returns (address) {
        if (block.chainid == 1) return 0x1a44076050125825900e736c501f859c50fE728c;      // Ethereum
        if (block.chainid == 56) return 0x1a44076050125825900e736c501f859c50fE728c;     // BNB
        if (block.chainid == 137) return 0x1a44076050125825900e736c501f859c50fE728c;    // Polygon
        if (block.chainid == 42161) return 0x1a44076050125825900e736c501f859c50fE728c;  // Arbitrum
        if (block.chainid == 8453) return 0x1a44076050125825900e736c501f859c50fE728c;   // Base
        if (block.chainid == 10) return 0x1a44076050125825900e736c501f859c50fE728c;     // Optimism
        if (block.chainid == 43114) return 0x1a44076050125825900e736c501f859c50fE728c;  // Avalanche
        return address(0);
    }
    
    /**
     * @notice Get chain ID as uint16
     */
    function _getChainId() internal view returns (uint16) {
        if (block.chainid == 1) return 1;
        if (block.chainid == 56) return 56;
        if (block.chainid == 137) return 137;
        if (block.chainid == 42161) return 42161;
        if (block.chainid == 8453) return 8453;
        if (block.chainid == 10) return 10;
        if (block.chainid == 43114) return 43114;
        return uint16(block.chainid);
    }
    
    /**
     * @notice Get WETH address for current chain
     */
    function _getWETH() internal view returns (address) {
        if (block.chainid == 1) return 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;      // Ethereum WETH
        if (block.chainid == 56) return 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;     // BNB WBNB
        if (block.chainid == 137) return 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;    // Polygon WMATIC
        if (block.chainid == 42161) return 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;  // Arbitrum WETH
        if (block.chainid == 8453) return 0x4200000000000000000000000000000000000006;   // Base WETH
        if (block.chainid == 10) return 0x4200000000000000000000000000000000000006;     // Optimism WETH
        if (block.chainid == 43114) return 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;  // Avalanche WAVAX
        return address(0);
    }
    
    /**
     * @notice Get WETH symbol for current chain
     */
    function _getWETHSymbol() internal view returns (string memory) {
        if (block.chainid == 1) return "WETH";
        if (block.chainid == 56) return "WBNB";
        if (block.chainid == 137) return "WMATIC";
        if (block.chainid == 42161) return "WETH";
        if (block.chainid == 8453) return "WETH";
        if (block.chainid == 10) return "WETH";
        if (block.chainid == 43114) return "WAVAX";
        return "WETH";
    }
    
    /**
     * @notice Get network name
     */
    function _getNetworkName() internal view returns (string memory) {
        if (block.chainid == 1) return "Ethereum";
        if (block.chainid == 56) return "BNB Chain";
        if (block.chainid == 137) return "Polygon";
        if (block.chainid == 42161) return "Arbitrum";
        if (block.chainid == 8453) return "Base";
        if (block.chainid == 10) return "Optimism";
        if (block.chainid == 43114) return "Avalanche";
        return "Unknown";
    }
    
    /**
     * @notice Save deployment info
     */
    function _saveDeployment(string memory network, address registry) internal {
        string memory json = "deployment";
        
        json = vm.serializeString(json, "network", network);
        json = vm.serializeUint(json, "chainId", block.chainid);
        json = vm.serializeAddress(json, "registry", registry);
        json = vm.serializeUint(json, "timestamp", block.timestamp);
        json = vm.serializeBytes32(json, "salt", SALT);
        json = vm.serializeAddress(json, "create2Factory", CREATE2_FACTORY);
        
        string memory filename = string.concat(
            "./deployments/registry_",
            vm.toString(block.chainid),
            ".json"
        );
        
        vm.writeJson(json, filename);
        console.log("Deployment saved to:", filename);
    }
}

