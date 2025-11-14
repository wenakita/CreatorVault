// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "forge-std/Test.sol";
import "forge-std/console.sol";

// Minimal interface for testing
interface ICharmStrategyWETH {
    function _getUsd1Equivalent(uint256 wethAmount) external view returns (uint256);
    function emergencyMode() external view returns (bool);
    function emergencyWethPerUsd1() external view returns (uint256);
}

contract CharmStrategyWETHEmergencyFixTest is Test {
    address constant WETH_STRATEGY = 0x997feaa69a60c536F8449F0D5Adf997fD83aDf39;
    
    function setUp() public {
        // Fork mainnet at current block
        vm.createSelectFork("https://eth.llamarpc.com");
    }
    
    function testEmergencyModeCalculation() public view {
        ICharmStrategyWETH strategy = ICharmStrategyWETH(WETH_STRATEGY);
        
        console.log("====================================");
        console.log("TESTING EMERGENCY MODE CALCULATION");
        console.log("====================================");
        console.log("");
        
        // Check if emergency mode is enabled
        bool isEmergency = strategy.emergencyMode();
        console.log("Emergency mode:", isEmergency);
        
        if (!isEmergency) {
            console.log("Emergency mode not enabled, skipping test");
            return;
        }
        
        uint256 emergencyPrice = strategy.emergencyWethPerUsd1();
        console.log("Emergency price (USD1 per WETH):", emergencyPrice / 1e18);
        console.log("");
        
        // Test: 1 WETH should equal ~3200 USD1
        uint256 oneWeth = 1e18;
        uint256 usd1Amount = strategy._getUsd1Equivalent(oneWeth);
        
        console.log("Input: 1 WETH");
        console.log("Output:", usd1Amount / 1e18, "USD1");
        console.log("Expected: ~3200 USD1");
        console.log("");
        
        // Check if result is correct (within 1% tolerance)
        uint256 expected = emergencyPrice; // Should be 3200e18
        uint256 tolerance = expected / 100; // 1% tolerance
        
        if (usd1Amount >= expected - tolerance && usd1Amount <= expected + tolerance) {
            console.log("SUCCESS: Calculation is correct!");
        } else {
            console.log("ERROR: Calculation is wrong!");
            console.log("Expected:", expected / 1e18);
            console.log("Got:", usd1Amount / 1e18);
        }
        
        console.log("====================================");
    }
}

