// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/EagleVaultWrapper.sol";

contract DeployNewWrapper is Script {
    // Current vault (V3 with fixed strategy)
    address constant CURRENT_VAULT = 0x8A6755b9B40368e35aCEBc00feec08cFF0177F2E;
    
    // Existing OFT token
    address constant OFT_EAGLE = 0x477d42841dC5A7cCBc2f72f4448f5eF6B61eA91E;
    
    // Owner
    address constant OWNER = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;
    
    // Fee configuration (optional - can be changed later)
    address constant FEE_RECIPIENT = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;
    address constant VAULT_BENEFICIARY = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("===========================================================");
        console.log("  DEPLOYING NEW WRAPPER FOR CURRENT VAULT");
        console.log("===========================================================");
        console.log("");
        
        console.log("Configuration:");
        console.log("  Vault (vEAGLE):  ", CURRENT_VAULT);
        console.log("  OFT (EAGLE):     ", OFT_EAGLE);
        console.log("  Owner:           ", OWNER);
        console.log("  Fee Recipient:   ", FEE_RECIPIENT);
        console.log("");

        // Deploy the wrapper
        EagleVaultWrapper wrapper = new EagleVaultWrapper(
            CURRENT_VAULT,      // vEAGLE (vault shares)
            OFT_EAGLE,          // EAGLE (OFT token)
            FEE_RECIPIENT,      // Fee recipient
            OWNER               // Owner
        );

        console.log("SUCCESS: Wrapper deployed at:", address(wrapper));
        console.log("");
        
        console.log("===========================================================");
        console.log("  WRAPPER INFO");
        console.log("===========================================================");
        console.log("");
        console.log("Deposit fee:  ", wrapper.depositFee(), "bps (1% default)");
        console.log("Withdraw fee: ", wrapper.withdrawFee(), "bps (2% default)");
        console.log("");
        
        console.log("===========================================================");
        console.log("  NEXT STEPS");
        console.log("===========================================================");
        console.log("");
        console.log("1. Approve wrapper to spend your vEAGLE shares");
        console.log("2. Call wrap(amount) to convert vEAGLE -> EAGLE");
        console.log("3. You'll receive EAGLE tokens (minus 1% fee)");
        console.log("");
        console.log("To wrap your 51.93 vEAGLE shares:");
        console.log("  cast send", CURRENT_VAULT);
        console.log("    'approve(address,uint256)'");
        console.log("    ", address(wrapper));
        console.log("    51926854244154205451");
        console.log("");
        console.log("  cast send", address(wrapper));
        console.log("    'wrap(uint256)'");
        console.log("    51926854244154205451");
        console.log("");
        console.log("===========================================================");

        vm.stopBroadcast();
    }
}

