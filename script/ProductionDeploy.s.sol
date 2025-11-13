// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/strategies/CharmStrategyWETH.sol";
import {EagleOVault} from "../contracts/EagleOVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ProductionDeploy is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant CHARM_VAULT = 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant OWNER = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;
    
    // Old strategies to remove
    address constant USD1_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    address constant OLD_WETH_1 = 0x8c44F63543F7aF3481450907b6c87579eAC9eB88;
    address constant OLD_WETH_2 = 0xD5F80702F23Ea35141D4f47A0E107Fff008E9830;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        console.log("====================================================");
        console.log("PRODUCTION DEPLOYMENT - CharmStrategyWETH");
        console.log("====================================================");
        console.log("");
        console.log("Network: Ethereum Mainnet");
        console.log("Deployer:", vm.addr(pk));
        console.log("");
        
        EagleOVault vault = EagleOVault(payable(VAULT));
        require(vm.addr(pk) == vault.management(), "Not vault management!");
        
        vm.startBroadcast(pk);
        
        // STEP 1: Deploy new strategy
        console.log("[1/6] Deploying CharmStrategyWETH...");
        CharmStrategyWETH strategy = new CharmStrategyWETH(
            VAULT,
            CHARM_VAULT,
            WLFI,
            WETH,
            USD1,
            ROUTER,
            OWNER
        );
        console.log("      Address:", address(strategy));
        console.log("      [OK]");
        console.log("");
        
        // STEP 2: Initialize approvals
        console.log("[2/6] Initializing approvals...");
        strategy.initializeApprovals();
        console.log("      [OK]");
        console.log("");
        
        // STEP 3: Transfer ownership
        console.log("[3/6] Transferring ownership...");
        strategy.transferOwnership(OWNER);
        console.log("      Owner:", strategy.owner());
        console.log("      [OK]");
        console.log("");
        
        // STEP 4: Remove old strategies
        console.log("[4/6] Removing old strategies...");
        
        uint256 usd1Weight = vault.strategyWeights(USD1_STRATEGY);
        if (usd1Weight > 0) {
            console.log("      Removing USD1 strategy...");
            vault.removeStrategy(USD1_STRATEGY);
            console.log("      [OK]");
        }
        
        uint256 oldWeth1Weight = vault.strategyWeights(OLD_WETH_1);
        if (oldWeth1Weight > 0) {
            console.log("      Removing old WETH strategy 1...");
            vault.removeStrategy(OLD_WETH_1);
            console.log("      [OK]");
        }
        
        uint256 oldWeth2Weight = vault.strategyWeights(OLD_WETH_2);
        if (oldWeth2Weight > 0) {
            console.log("      Removing old WETH strategy 2...");
            vault.removeStrategy(OLD_WETH_2);
            console.log("      [OK]");
        }
        console.log("");
        
        // STEP 5: Add new strategy at 100%
        console.log("[5/6] Adding new strategy at 100%...");
        vault.addStrategy(address(strategy), 10000);
        console.log("      Weight:", vault.strategyWeights(address(strategy)));
        console.log("      Total:", vault.totalStrategyWeight());
        console.log("      [OK]");
        console.log("");
        
        // STEP 6: Deploy all funds
        console.log("[6/6] Deploying funds...");
        uint256 balanceBefore = IERC20(WLFI).balanceOf(VAULT);
        console.log("      Idle WLFI before:", balanceBefore / 1e18);
        
        vault.forceDeployToStrategies();
        
        uint256 balanceAfter = IERC20(WLFI).balanceOf(VAULT);
        uint256 deployed = balanceBefore - balanceAfter;
        
        console.log("      Idle WLFI after:", balanceAfter / 1e18);
        console.log("      Deployed:", deployed / 1e18, "WLFI");
        console.log("      [OK]");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("====================================================");
        console.log("DEPLOYMENT SUCCESSFUL!");
        console.log("====================================================");
        console.log("");
        console.log("Strategy Address:", address(strategy));
        console.log("Funds Deployed:", deployed / 1e18, "WLFI");
        console.log("Status: LIVE AND EARNING YIELD");
        console.log("");
        console.log("View on Etherscan:");
        console.log("https://etherscan.io/address/", address(strategy));
        console.log("");
        console.log("====================================================");
    }
}

