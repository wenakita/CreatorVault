// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

interface ICharmStrategyWETH {
    function enableEmergencyMode() external;
    function setEmergencyPrice(uint256 _wethPerUsd1) external;
    function emergencyMode() external view returns (bool);
    function emergencyWethPerUsd1() external view returns (uint256);
}

contract EnableEmergencyMode is Script {
    address constant WETH_STRATEGY = 0x997feaa69a60c536F8449F0D5Adf997fD83aDf39;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        ICharmStrategyWETH strategy = ICharmStrategyWETH(WETH_STRATEGY);

        console.log("=====================================================");
        console.log("ENABLING EMERGENCY MODE");
        console.log("=====================================================");
        console.log("");

        // Current WETH price: ~$3,200
        // Current USD1 price: ~$1.00
        // Therefore: 1 USD1 = 1/3200 WETH = 0.0003125 WETH
        // In 18 decimals: 0.0003125 * 1e18 = 312500000000000 wei
        // Simplified: 1 WETH = 3200 USD1, so wethPerUsd1 = 3200e18 / 1e18 = 3200e18
        
        uint256 wethPerUsd1 = 3200e18; // 1 WETH = 3200 USD1

        console.log("Step 1: Setting emergency WETH/USD1 ratio:");
        console.log("1 WETH =", wethPerUsd1 / 1e18, "USD1");
        strategy.setEmergencyPrice(wethPerUsd1);
        console.log("Price set successfully");
        console.log("");

        console.log("Step 2: Enabling emergency mode...");
        strategy.enableEmergencyMode();
        console.log("");

        console.log("SUCCESS: Emergency mode enabled");
        console.log("Emergency mode:", strategy.emergencyMode());
        console.log("Emergency WETH per USD1:", strategy.emergencyWethPerUsd1() / 1e18);
        console.log("");
        console.log("This bypasses stale oracle checks!");
        console.log("=====================================================");

        vm.stopBroadcast();
    }
}

