// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {CCALaunchStrategy} from "../contracts/strategies/CCALaunchStrategy.sol";

contract RedeployCCA is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Existing contract addresses
        address shareOFT = 0x4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57;
        address vault = 0xA015954E2606d08967Aee3787456bB3A86a46A42;
        address oracle = 0x8C044aeF10d05bcC53912869db89f6e1f37bC6fC;
        
        // V4 config
        address V4_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
        address TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;
        
        console.log("Deployer:", deployer);
        console.log("ShareOFT:", shareOFT);
        console.log("Vault:", vault);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy new CCA with oracle auto-config
        CCALaunchStrategy cca = new CCALaunchStrategy(
            shareOFT,           // auctionToken (wsAKITA)
            address(0),         // currency (ETH)
            vault,              // fundsRecipient
            vault,              // tokensRecipient
            deployer            // owner
        );
        
        console.log("CCA deployed:", address(cca));
        
        // Configure oracle settings for auto V4 pool setup on graduation
        cca.setOracleConfig(oracle, V4_POOL_MANAGER, TAX_HOOK);
        console.log("CCA configured with oracle, poolManager, taxHook");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== NEW CCA STRATEGY ===");
        console.log("Address:", address(cca));
        console.log("");
        console.log("Update AKITA_CCA_STRATEGY in .env to:", address(cca));
    }
}

