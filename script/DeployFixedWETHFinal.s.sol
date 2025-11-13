// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/strategies/CharmStrategyWETH.sol";
import {EagleOVault} from "../contracts/EagleOVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployFixedWETHFinal
 * @notice Deploy WETH strategy with stale oracle protection
 */
contract DeployFixedWETHFinal is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant CHARM_VAULT_WETH = 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant MULTISIG = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;
    address constant OLD_WETH = 0x8c44F63543F7aF3481450907b6c87579eAC9eB88;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        console.log("=================================================");
        console.log("DEPLOY FINAL WETH STRATEGY (STALE ORACLE FIX)");
        console.log("=================================================");
        console.log("");
        
        vm.startBroadcast(pk);
        
        console.log("Deploying with stale oracle protection...");
        CharmStrategyWETH newStrategy = new CharmStrategyWETH(
            VAULT,
            CHARM_VAULT_WETH,
            WLFI,
            WETH,
            USD1,
            UNISWAP_ROUTER,
            MULTISIG
        );
        console.log("[OK] Deployed:", address(newStrategy));
        console.log("");
        
        console.log("Initializing approvals...");
        newStrategy.initializeApprovals();
        console.log("[OK] Approvals set");
        console.log("");
        
        console.log("Transferring ownership...");
        newStrategy.transferOwnership(MULTISIG);
        console.log("[OK] Owner:", MULTISIG);
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=================================================");
        console.log("SUCCESS!");
        console.log("=================================================");
        console.log("");
        console.log("New Strategy:", address(newStrategy));
        console.log("Old Strategy:", OLD_WETH);
        console.log("");
        console.log("KEY FIX:");
        console.log("  - Swaps enabled (fixes 'cross' error)");
        console.log("  - Stale oracle protection (fixes 'StalePrice')");
        console.log("");
        console.log("Next: Run DeployAllFunds to replace and deploy");
        console.log("=================================================");
    }
}

