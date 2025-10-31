// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../../contracts/layerzero/oft/WLFIAssetOFT.sol";

/**
 * @title DeployWLFI
 * @notice Deploy WLFIAssetOFT to multiple chains
 * 
 * IMPORTANT: NO fees on WLFI! This is a base asset.
 * Fees are ONLY on EagleShareOFT (vault shares).
 * 
 * @dev Usage:
 *      forge script script/multi-chain/DeployWLFI.s.sol:DeployWLFI \
 *        --rpc-url $ARBITRUM_RPC_URL \
 *        --broadcast \
 *        --verify
 */
contract DeployWLFI is Script {
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
        console.log("DEPLOYING WLFIAssetOFT");
        console.log("==============================================");
        console.log("");
        console.log("Network:", network);
        console.log("Deployer:", deployer);
        console.log("LayerZero Endpoint:", lzEndpoint);
        console.log("");
        console.log("IMPORTANT: NO FEES ON WLFI!");
        console.log("This is a base asset for free trading.");
        console.log("");
        
        // Deploy WLFIAssetOFT
        WLFIAssetOFT wlfi = new WLFIAssetOFT(
            "WLFI Asset",
            "WLFI",
            lzEndpoint,
            deployer // delegate
        );
        
        console.log("WLFIAssetOFT deployed at:", address(wlfi));
        console.log("");
        
        // Mint initial supply for testing (ONLY on testnet!)
        if (block.chainid != 1 && block.chainid != 56) { // Not mainnet or BSC
            uint256 testSupply = 1_000_000 ether;
            wlfi.mint(deployer, testSupply);
            console.log("Minted test supply:", testSupply);
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
        console.log("");
        console.log("Save this address:");
        console.log("  export WLFI_", vm.toUppercase(network), "=", address(wlfi));
        console.log("");
        
        vm.stopBroadcast();
        
        // Save deployment info
        _saveDeployment(network, address(wlfi));
    }
    
    function _saveDeployment(string memory network, address wlfiAddress) internal {
        string memory json = "deployment";
        
        json = vm.serializeString(json, "network", network);
        json = vm.serializeAddress(json, "wlfi", wlfiAddress);
        json = vm.serializeUint(json, "timestamp", block.timestamp);
        json = vm.serializeUint(json, "chainId", block.chainid);
        
        string memory filename = string.concat(
            "./deployments/wlfi_",
            network,
            ".json"
        );
        
        vm.writeJson(json, filename);
        console.log("Deployment saved to:", filename);
    }
}

