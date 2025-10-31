// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/EagleVaultWrapper.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";

contract DeployWrapperSystem is Script {
    // Current vault (V3 with fixed strategy)
    address constant CURRENT_VAULT = 0x8A6755b9B40368e35aCEBc00feec08cFF0177F2E;
    
    // LayerZero endpoint on Ethereum mainnet
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    
    // Owner/Deployer
    address constant OWNER = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;
    
    // Fee configuration
    address constant FEE_RECIPIENT = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("===========================================================");
        console.log("  DEPLOYING COMPLETE WRAPPER SYSTEM");
        console.log("===========================================================");
        console.log("");
        
        console.log("Configuration:");
        console.log("  Vault (vEAGLE):  ", CURRENT_VAULT);
        console.log("  LZ Endpoint:     ", LZ_ENDPOINT);
        console.log("  Owner:           ", OWNER);
        console.log("");

        // Step 1: Deploy new OFT with minting support
        console.log("Step 1: Deploying new EagleShareOFT...");
        EagleShareOFT oft = new EagleShareOFT(
            "Eagle Vault Shares",
            "EAGLE",
            LZ_ENDPOINT,
            OWNER
        );
        console.log("  OFT deployed at:", address(oft));
        console.log("");

        // Step 2: Deploy wrapper
        console.log("Step 2: Deploying EagleVaultWrapper...");
        EagleVaultWrapper wrapper = new EagleVaultWrapper(
            CURRENT_VAULT,      // vEAGLE (vault shares)
            address(oft),       // EAGLE (OFT token)
            FEE_RECIPIENT,      // Fee recipient
            OWNER               // Owner
        );
        console.log("  Wrapper deployed at:", address(wrapper));
        console.log("");

        // Step 3: Grant minter role to wrapper
        console.log("Step 3: Granting minter role to wrapper...");
        oft.setMinter(address(wrapper), true);
        console.log("  Minter role granted!");
        console.log("");
        
        console.log("===========================================================");
        console.log("  DEPLOYMENT COMPLETE");
        console.log("===========================================================");
        console.log("");
        console.log("New OFT:     ", address(oft));
        console.log("New Wrapper: ", address(wrapper));
        console.log("");
        console.log("Deposit fee:  ", wrapper.depositFee(), "bps (1%)");
        console.log("Withdraw fee: ", wrapper.withdrawFee(), "bps (2%)");
        console.log("");
        
        console.log("===========================================================");
        console.log("  NEXT STEPS");
        console.log("===========================================================");
        console.log("");
        console.log("To wrap your 51.93 vEAGLE shares:");
        console.log("");
        console.log("1. Approve wrapper:");
        console.log("   cast send", CURRENT_VAULT);
        console.log("     'approve(address,uint256)'");
        console.log("     ", address(wrapper));
        console.log("     51926854244154205451");
        console.log("");
        console.log("2. Wrap shares:");
        console.log("   cast send", address(wrapper));
        console.log("     'wrap(uint256)'");
        console.log("     51926854244154205451");
        console.log("");
        console.log("===========================================================");

        vm.stopBroadcast();
    }
}

