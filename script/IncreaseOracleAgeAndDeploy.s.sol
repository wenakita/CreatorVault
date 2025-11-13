// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import {EagleOVault} from "../contracts/EagleOVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICharmStrategyWETH {
    function setMaxOracleAge(uint256 _maxAge) external;
    function maxOracleAge() external view returns (uint256);
    function owner() external view returns (address);
}

/**
 * @title IncreaseOracleAgeAndDeploy
 * @notice Temporarily increase oracle age tolerance and deploy funds
 */
contract IncreaseOracleAgeAndDeploy is Script {
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    address constant WETH_STRATEGY = 0x8c44F63543F7aF3481450907b6c87579eAC9eB88;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        EagleOVault vault = EagleOVault(VAULT);
        ICharmStrategyWETH strategy = ICharmStrategyWETH(WETH_STRATEGY);
        
        console.log("===============================================");
        console.log("INCREASE ORACLE AGE & DEPLOY FUNDS");
        console.log("===============================================");
        console.log("Deployer:", deployer);
        console.log("Strategy owner:", strategy.owner());
        console.log("");
        
        require(deployer == strategy.owner(), "Not strategy owner!");
        require(deployer == vault.management(), "Not vault management!");
        
        // Check current settings
        uint256 currentMaxAge = strategy.maxOracleAge();
        console.log("Current maxOracleAge:", currentMaxAge, "seconds");
        console.log("That's", currentMaxAge / 60, "minutes");
        console.log("");
        
        // Check idle funds
        uint256 wlfiBalance = IERC20(WLFI).balanceOf(VAULT);
        console.log("Idle WLFI:", wlfiBalance / 1e18);
        console.log("");
        
        vm.startBroadcast(pk);
        
        // Temporarily increase to 2 hours
        uint256 newMaxAge = 7200; // 2 hours
        console.log("Step 1: Increasing maxOracleAge to", newMaxAge / 60, "minutes...");
        strategy.setMaxOracleAge(newMaxAge);
        console.log("[OK] Oracle age increased");
        console.log("");
        
        // Deploy funds
        console.log("Step 2: Deploying funds with swaps enabled...");
        try vault.forceDeployToStrategies() {
            console.log("[SUCCESS!] Funds deployed!");
            
            uint256 wlfiAfter = IERC20(WLFI).balanceOf(VAULT);
            console.log("");
            console.log("Results:");
            console.log("  Deployed:", (wlfiBalance - wlfiAfter) / 1e18, "WLFI");
            console.log("  Remaining:", wlfiAfter / 1e18, "WLFI");
            
        } catch Error(string memory reason) {
            console.log("[FAILED]", reason);
        }
        
        // Reset to 1 hour
        console.log("");
        console.log("Step 3: Resetting maxOracleAge to 1 hour...");
        strategy.setMaxOracleAge(3600);
        console.log("[OK] Reset to normal");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("===============================================");
        console.log("COMPLETE");
        console.log("===============================================");
    }
}

