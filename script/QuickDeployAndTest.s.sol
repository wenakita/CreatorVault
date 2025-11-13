// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/strategies/CharmStrategyWETH.sol";
import {EagleOVault} from "../contracts/EagleOVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract QuickDeployAndTest is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant OLD_WETH = 0x8c44F63543F7aF3481450907b6c87579eAC9eB88;
    address constant USD1_STRAT = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    address constant OLD_WETH_2 = 0xD5F80702F23Ea35141D4f47A0E107Fff008E9830;
    
    address constant CHARM_VAULT = 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant OWNER = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        EagleOVault vault = EagleOVault(payable(VAULT));
        
        console.log("====================================");
        console.log("FINAL DEPLOYMENT & TEST");
        console.log("====================================");
        console.log("");
        
        vm.startBroadcast(pk);
        
        // 1. Deploy new strategy
        console.log("1. Deploying strategy...");
        CharmStrategyWETH strategy = new CharmStrategyWETH(
            VAULT, CHARM_VAULT, WLFI, WETH, USD1, ROUTER, OWNER
        );
        console.log("   New:", address(strategy));
        
        strategy.initializeApprovals();
        strategy.transferOwnership(OWNER);
        console.log("   [OK]");
        console.log("");
        
        // 2. Clean up old strategies
        console.log("2. Removing old strategies...");
        try vault.removeStrategy(USD1_STRAT) {} catch {}
        try vault.removeStrategy(OLD_WETH) {} catch {}
        try vault.removeStrategy(OLD_WETH_2) {} catch {}
        console.log("   [OK]");
        console.log("");
        
        // 3. Add new at 100%
        console.log("3. Adding new strategy...");
        vault.addStrategy(address(strategy), 10000);
        console.log("   [OK]");
        console.log("");
        
        // 4. Deploy!
        console.log("4. Deploying funds...");
        uint256 balanceBefore = IERC20(WLFI).balanceOf(VAULT);
        
        vault.forceDeployToStrategies();
        
        uint256 balanceAfter = IERC20(WLFI).balanceOf(VAULT);
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("====================================");
        console.log("SUCCESS!");
        console.log("====================================");
        console.log("Deployed:", (balanceBefore - balanceAfter) / 1e18, "WLFI");
        console.log("Remaining:", balanceAfter / 1e18, "WLFI");
        console.log("");
        console.log("Strategy:", address(strategy));
        console.log("====================================");
    }
}

