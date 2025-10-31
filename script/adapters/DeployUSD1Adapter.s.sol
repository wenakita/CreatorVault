// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../../contracts/layerzero/adapters/USD1Adapter.sol";

/**
 * @title DeployUSD1Adapter
 * @notice Deploy USD1 Adapter on hub chains (Ethereum, BNB)
 * 
 * CRITICAL: Only deploy on chains where native USD1 exists!
 * 
 * @dev Usage:
 *      # Set native USD1 address
 *      export USD1_TOKEN=0x... # Address of existing USD1 ERC20
 *      
 *      # Deploy on Ethereum
 *      forge script script/adapters/DeployUSD1Adapter.s.sol:DeployUSD1Adapter \
 *        --rpc-url $ETHEREUM_RPC_URL \
 *        --broadcast \
 *        --verify
 *      
 *      # Deploy on BNB
 *      forge script script/adapters/DeployUSD1Adapter.s.sol:DeployUSD1Adapter \
 *        --rpc-url $BNB_RPC_URL \
 *        --broadcast \
 *        --verify
 */
contract DeployUSD1Adapter is Script {
    // LayerZero V2 Endpoints
    mapping(uint256 => address) public lzEndpoints;
    
    function setUp() public {
        // LayerZero V2 Endpoints by chain ID
        lzEndpoints[1] = 0x1a44076050125825900e736c501f859c50fE728c;     // Ethereum
        lzEndpoints[56] = 0x1a44076050125825900e736c501f859c50fE728c;    // BNB Chain
    }
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get native USD1 token address (MUST be set!)
        address usd1Token = vm.envAddress("USD1_TOKEN");
        require(usd1Token != address(0), "USD1_TOKEN not set!");
        
        // Get LayerZero endpoint for this chain
        address lzEndpoint = lzEndpoints[block.chainid];
        require(lzEndpoint != address(0), "Unsupported chain");
        
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
        console.log("DEPLOYING USD1 ADAPTER (HUB CHAIN)");
        console.log("==============================================");
        console.log("");
        console.log("Network:", network);
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("");
        console.log("CRITICAL: This is a HUB chain!");
        console.log("Native USD1 token:", usd1Token);
        console.log("LayerZero Endpoint:", lzEndpoint);
        console.log("");
        
        // Verify native token exists
        console.log("Verifying native USD1 token...");
        try IERC20(usd1Token).totalSupply() returns (uint256 supply) {
            console.log("  Total Supply:", supply);
            console.log("  Token verified [OK]");
        } catch {
            revert("USD1_TOKEN address is not a valid ERC20!");
        }
        
        try IERC20(usd1Token).name() returns (string memory name) {
            console.log("  Token Name:", name);
        } catch {
            console.log("  Token Name: (not available)");
        }
        
        try IERC20(usd1Token).symbol() returns (string memory symbol) {
            console.log("  Token Symbol:", symbol);
        } catch {
            console.log("  Token Symbol: (not available)");
        }
        console.log("");
        
        // Deploy USD1 Adapter
        console.log("Deploying USD1Adapter...");
        USD1Adapter adapter = new USD1Adapter(
            usd1Token,   // Native USD1 token
            lzEndpoint,  // LayerZero endpoint
            deployer     // Delegate/owner
        );
        
        console.log("  USD1Adapter deployed at:", address(adapter));
        console.log("");
        
        // Verify deployment
        console.log("Verifying deployment...");
        console.log("  Wrapped Token:", address(adapter.token()));
        console.log("  Adapter Name:", adapter.adapterName());
        console.log("  Adapter Version:", adapter.adapterVersion());
        console.log("");
        
        require(address(adapter.token()) == usd1Token, "Token mismatch!");
        console.log("  Deployment verified [OK]");
        console.log("");
        
        console.log("==============================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("==============================================");
        console.log("");
        console.log("ADAPTER ADDRESS:", address(adapter));
        console.log("");
        console.log("Hub Chain Configuration:");
        console.log("  - Native USD1:", usd1Token);
        console.log("  - USD1Adapter:", address(adapter));
        console.log("  - Network:", network);
        console.log("");
        console.log("USD1 is a STABLECOIN:");
        console.log("  - Pegged to $1 USD");
        console.log("  - Fee-free transfers");
        console.log("  - Medium of exchange");
        console.log("");
        console.log("Next Steps:");
        console.log("1. Deploy USD1AssetOFT on spoke chains (Arbitrum, Base, etc.)");
        console.log("2. Configure LayerZero peers:");
        console.log("   - setPeer() on this adapter");
        console.log("   - setPeer() on spoke OFTs");
        console.log("3. Test bridging in both directions");
        console.log("4. Verify 1:1 backing and $1 peg");
        console.log("");
        console.log("Save this address:");
        console.log("  export USD1_ADAPTER_", vm.toUppercase(network), "=", address(adapter));
        console.log("");
        
        vm.stopBroadcast();
        
        // Save deployment info
        _saveDeployment(network, usd1Token, address(adapter));
    }
    
    function _saveDeployment(
        string memory network,
        address usd1Token,
        address adapterAddress
    ) internal {
        string memory json = "deployment";
        
        json = vm.serializeString(json, "network", network);
        json = vm.serializeUint(json, "chainId", block.chainid);
        json = vm.serializeAddress(json, "nativeToken", usd1Token);
        json = vm.serializeAddress(json, "adapter", adapterAddress);
        json = vm.serializeUint(json, "timestamp", block.timestamp);
        json = vm.serializeString(json, "type", "hub");
        
        string memory filename = string.concat(
            "./deployments/usd1_adapter_",
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

