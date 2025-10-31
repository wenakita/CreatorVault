// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../../contracts/layerzero/adapters/WLFIAdapter.sol";

/**
 * @title DeployWLFIAdapter
 * @notice Deploy WLFI Adapter on hub chains (Ethereum, BNB)
 * 
 * CRITICAL: Only deploy on chains where native WLFI exists!
 * 
 * @dev Usage:
 *      # Set native WLFI address and EagleRegistry
 *      export WLFI_TOKEN=0x... # Address of existing WLFI ERC20
 *      export EAGLE_REGISTRY=0x... # Address of EagleRegistry
 *      
 *      # Deploy on Ethereum
 *      forge script script/adapters/DeployWLFIAdapter.s.sol:DeployWLFIAdapter \
 *        --rpc-url $ETHEREUM_RPC_URL \
 *        --broadcast \
 *        --verify
 *      
 *      # Deploy on BNB
 *      forge script script/adapters/DeployWLFIAdapter.s.sol:DeployWLFIAdapter \
 *        --rpc-url $BNB_RPC_URL \
 *        --broadcast \
 *        --verify
 */
contract DeployWLFIAdapter is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get native WLFI token address (MUST be set!)
        address wlfiToken = vm.envAddress("WLFI_TOKEN");
        require(wlfiToken != address(0), "WLFI_TOKEN not set!");
        
        // Get EagleRegistry address (MUST be set!)
        address registry = vm.envAddress("EAGLE_REGISTRY");
        require(registry != address(0), "EAGLE_REGISTRY not set!");
        
        // Determine network name
        string memory network;
        if (block.chainid == 1) {
            network = "Ethereum Mainnet";
        } else if (block.chainid == 56) {
            network = "BNB Chain";
        } else {
            revert("Unsupported chain");
        }
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("DEPLOYING WLFI ADAPTER (HUB CHAIN)");
        console.log("==============================================");
        console.log("");
        console.log("Network:", network);
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("");
        console.log("CRITICAL: This is a HUB chain!");
        console.log("Native WLFI token:", wlfiToken);
        console.log("EagleRegistry:", registry);
        console.log("");
        
        // Verify native token exists
        console.log("Verifying native WLFI token...");
        try IERC20(wlfiToken).totalSupply() returns (uint256 supply) {
            console.log("  Total Supply:", supply);
            console.log("  Token verified");
        } catch {
            revert("WLFI_TOKEN address is not a valid ERC20!");
        }
        
        try IERC20(wlfiToken).name() returns (string memory name) {
            console.log("  Token Name:", name);
        } catch {
            console.log("  Token Name: (not available)");
        }
        
        try IERC20(wlfiToken).symbol() returns (string memory symbol) {
            console.log("  Token Symbol:", symbol);
        } catch {
            console.log("  Token Symbol: (not available)");
        }
        console.log("");
        
        // Deploy WLFI Adapter
        console.log("Deploying WLFIAdapter with EagleRegistry...");
        WLFIAdapter adapter = new WLFIAdapter(
            wlfiToken,   // Native WLFI token
            registry,    // EagleRegistry (reads endpoint)
            deployer     // Delegate/owner
        );
        
        console.log("  WLFIAdapter deployed at:", address(adapter));
        console.log("");
        
        // Verify deployment
        console.log("Verifying deployment...");
        console.log("  Wrapped Token:", address(adapter.token()));
        console.log("  EagleRegistry:", address(adapter.registry()));
        console.log("  LayerZero Endpoint:", adapter.getEndpoint());
        console.log("  Adapter Name:", adapter.adapterName());
        console.log("  Adapter Version:", adapter.adapterVersion());
        console.log("");
        
        require(address(adapter.token()) == wlfiToken, "Token mismatch!");
        require(address(adapter.registry()) == registry, "Registry mismatch!");
        console.log("  Deployment verified");
        console.log("");
        
        console.log("==============================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("==============================================");
        console.log("");
        console.log("ADAPTER ADDRESS:", address(adapter));
        console.log("");
        console.log("Hub Chain Configuration:");
        console.log("  - Native WLFI:", wlfiToken);
        console.log("  - WLFIAdapter:", address(adapter));
        console.log("  - EagleRegistry:", registry);
        console.log("  - LayerZero Endpoint:", adapter.getEndpoint());
        console.log("  - Network:", network);
        console.log("");
        console.log("Registry Benefits:");
        console.log("   Centralized endpoint management");
        console.log("   No hardcoded addresses");
        console.log("   Easy updates via registry");
        console.log("   Consistent across all contracts");
        console.log("");
        console.log("Next Steps:");
        console.log("1. Deploy WLFIAssetOFT on spoke chains (Arbitrum, Base, etc.)");
        console.log("2. Configure LayerZero peers:");
        console.log("   - setPeer() on this adapter");
        console.log("   - setPeer() on spoke OFTs");
        console.log("3. Test bridging in both directions");
        console.log("4. Verify 1:1 backing");
        console.log("");
        console.log("Save this address:");
        console.log("  export WLFI_ADAPTER_", vm.toUppercase(network), "=", address(adapter));
        console.log("");
        
        vm.stopBroadcast();
        
        // Save deployment info
        _saveDeployment(network, wlfiToken, address(adapter));
    }
    
    function _saveDeployment(
        string memory network,
        address wlfiToken,
        address adapterAddress
    ) internal {
        string memory json = "deployment";
        
        json = vm.serializeString(json, "network", network);
        json = vm.serializeUint(json, "chainId", block.chainid);
        json = vm.serializeAddress(json, "nativeToken", wlfiToken);
        json = vm.serializeAddress(json, "adapter", adapterAddress);
        json = vm.serializeUint(json, "timestamp", block.timestamp);
        json = vm.serializeString(json, "type", "hub");
        
        string memory filename = string.concat(
            "./deployments/wlfi_adapter_",
            vm.toString(block.chainid),
            ".json"
        );
        
        vm.writeJson(json, filename);
        console.log("Deployment saved to:", filename);
    }
}

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
}

