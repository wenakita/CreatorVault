// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../../contracts/layerzero/oft/USD1AssetOFT.sol";

/**
 * @title DeployUSD1
 * @notice Deploy USD1AssetOFT to multiple chains
 * 
 * IMPORTANT: NO fees on USD1! This is a stablecoin base asset.
 * Fees are ONLY on EagleShareOFT (vault shares).
 * 
 * @dev Usage:
 *      forge script script/multi-chain/DeployUSD1.s.sol:DeployUSD1 \
 *        --rpc-url $BASE_RPC_URL \
 *        --broadcast \
 *        --verify
 */
contract DeployUSD1 is Script {
    // LayerZero Endpoints by chain
    mapping(string => address) public lzEndpoints;
    
    function setUp() public {
        // LayerZero V2 Endpoints
        lzEndpoints["arbitrum"] = 0x1a44076050125825900e736c501f859c50fE728c;
        lzEndpoints["base"] = 0x1a44076050125825900e736c501f859c50fE728c;
        lzEndpoints["optimism"] = 0x1a44076050125825900e736c501f859c50fE728c;
        lzEndpoints["polygon"] = 0x1a44076050125825900e736c501f859c50fE728c;
        lzEndpoints["avalanche"] = 0x1a44076050125825900e736c501f859c50fE728c;
    }
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get current chain from RPC
        string memory network = vm.envOr("NETWORK", string("arbitrum"));
        address lzEndpoint = lzEndpoints[network];
        
        require(lzEndpoint != address(0), "Unsupported network");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("DEPLOYING USD1AssetOFT");
        console.log("==============================================");
        console.log("");
        console.log("Network:", network);
        console.log("Deployer:", deployer);
        console.log("LayerZero Endpoint:", lzEndpoint);
        console.log("");
        console.log("IMPORTANT: NO FEES ON USD1!");
        console.log("This is a stablecoin for free trading.");
        console.log("");
        
        // Deploy USD1AssetOFT
        USD1AssetOFT usd1 = new USD1AssetOFT(
            "USD1 Stablecoin",
            "USD1",
            lzEndpoint,
            deployer // delegate
        );
        
        console.log("USD1AssetOFT deployed at:", address(usd1));
        console.log("");
        
        // Mint initial supply for testing (ONLY on testnet!)
        if (block.chainid != 1 && block.chainid != 56) { // Not mainnet or BSC
            uint256 testSupply = 10_000_000 ether; // 10M USD1 for testing
            usd1.mint(deployer, testSupply);
            console.log("Minted test supply:", testSupply, "USD1");
            console.log("WARNING: Remove mint() in production!");
            console.log("");
        }
        
        console.log("==============================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("==============================================");
        console.log("");
        console.log("Next Steps:");
        console.log("1. Deploy to other chains");
        console.log("2. Configure LayerZero peers");
        console.log("3. Test cross-chain bridging");
        console.log("4. Verify USD1 maintains $1 peg");
        console.log("");
        console.log("Save this address:");
        console.log("  export USD1_", vm.toUppercase(network), "=", address(usd1));
        console.log("");
        
        vm.stopBroadcast();
        
        // Save deployment info
        _saveDeployment(network, address(usd1));
    }
    
    function _saveDeployment(string memory network, address usd1Address) internal {
        string memory json = "deployment";
        
        json = vm.serializeString(json, "network", network);
        json = vm.serializeAddress(json, "usd1", usd1Address);
        json = vm.serializeUint(json, "timestamp", block.timestamp);
        json = vm.serializeUint(json, "chainId", block.chainid);
        
        string memory filename = string.concat(
            "./deployments/usd1_",
            network,
            ".json"
        );
        
        vm.writeJson(json, filename);
        console.log("Deployment saved to:", filename);
    }
}

