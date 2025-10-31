// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";

/**
 * @title CreatePoolsDirect
 * @notice Create Balancer V2 pools directly via factory contracts
 */
contract CreatePoolsDirect is Script {
    
    // Balancer V2 Vault (same on all chains)
    address constant VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    
    // Balancer Weighted Pool Factory V4 (Arbitrum)
    address constant WEIGHTED_POOL_FACTORY = 0x5Dd94Da3644DDD055fcf6B3E1aa310Bb7801EB8b;
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        address wlfi = vm.envAddress("WLFI_ARBITRUM");
        address usd1 = vm.envAddress("USD1_ARBITRUM");
        address eagle = vm.envAddress("EAGLE_ARBITRUM");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("CREATING BALANCER POOLS");
        console.log("==============================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("WLFI:", wlfi);
        console.log("USD1:", usd1);
        console.log("EAGLE:", eagle);
        console.log("");
        
        // Create Base Pool (WLFI/USD1 50/50)
        console.log("Creating Base Pool (WLFI/USD1)...");
        
        address[] memory tokens = new address[](2);
        if (wlfi < usd1) {
            tokens[0] = wlfi;
            tokens[1] = usd1;
        } else {
            tokens[0] = usd1;
            tokens[1] = wlfi;
        }
        
        uint256[] memory weights = new uint256[](2);
        weights[0] = 0.5e18; // 50%
        weights[1] = 0.5e18; // 50%
        
        address[] memory rateProviders = new address[](2);
        rateProviders[0] = address(0);
        rateProviders[1] = address(0);
        
        // Asset managers (not used)
        address[] memory assetManagers = new address[](2);
        assetManagers[0] = address(0);
        assetManagers[1] = address(0);
        
        uint256 swapFeePercentage = 3e15; // 0.3%
        
        bytes memory poolData = abi.encodeWithSignature(
            "create(string,string,address[],uint256[],address[],uint256,address,bytes32)",
            "Eagle Base Pool",
            "BPT-BASE",
            tokens,
            weights,
            rateProviders,
            swapFeePercentage,
            deployer,
            bytes32(uint256(0x0000000000000000000000000000000000000000000000000000000000000000))
        );
        
        (bool success, bytes memory returnData) = WEIGHTED_POOL_FACTORY.call(poolData);
        
        if (success) {
            address basePool = abi.decode(returnData, (address));
            console.log("Base Pool created at:", basePool);
            console.log("");
            console.log("SAVE THIS ADDRESS:");
            console.log("BPT1_ARBITRUM=", basePool);
        } else {
            console.log("Base Pool creation failed");
            console.log("You may need to create pools manually via Balancer UI");
        }
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("==============================================");
        console.log("NEXT STEPS");
        console.log("==============================================");
        console.log("");
        console.log("If pool creation succeeded:");
        console.log("1. Add the BPT1 address to your .env");
        console.log("2. Add liquidity to the pool");
        console.log("3. Create the Vault Pool (BPT1/EAGLE)");
        console.log("");
        console.log("If pool creation failed:");
        console.log("Use the Balancer UI:");
        console.log("https://app.balancer.fi/#/arbitrum/pool/create");
        console.log("");
    }
}

