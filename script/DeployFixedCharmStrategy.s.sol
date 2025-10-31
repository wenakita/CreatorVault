// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/strategies/CharmStrategyUSD1.sol";

contract DeployFixedCharmStrategy is Script {
    // Constructor parameters
    address constant EAGLE_VAULT = 0x2610683EbACFC18f3E04daAba2e5480aE7508626;
    address constant CHARM_VAULT = 0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant OWNER = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("===========================================================");
        console.log("  DEPLOYING FIXED CHARM STRATEGY");
        console.log("===========================================================");
        console.log("");
        
        console.log("Constructor Parameters:");
        console.log("  Eagle Vault:     ", EAGLE_VAULT);
        console.log("  Charm Vault:     ", CHARM_VAULT);
        console.log("  WLFI:            ", WLFI);
        console.log("  USD1:            ", USD1);
        console.log("  Uniswap Router:  ", UNISWAP_ROUTER);
        console.log("  Owner:           ", OWNER);
        console.log("");

        // Deploy the fixed strategy
        CharmStrategyUSD1 strategy = new CharmStrategyUSD1(
            EAGLE_VAULT,
            CHARM_VAULT,
            WLFI,
            USD1,
            UNISWAP_ROUTER,
            OWNER
        );

        console.log("SUCCESS: CharmStrategyUSD1 deployed at:", address(strategy));
        console.log("");
        console.log("===========================================================");
        console.log("");
        console.log("NEXT STEPS:");
        console.log("  1. Verify contract on Etherscan");
        console.log("  2. Call initializeApprovals() on strategy");
        console.log("  3. Remove old strategy from vault (if any)");
        console.log("  4. Add new strategy to vault");
        console.log("  5. Test with small deposit");
        console.log("");
        console.log("===========================================================");

        vm.stopBroadcast();
    }
}

