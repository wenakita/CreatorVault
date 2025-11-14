// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

interface ICharmStrategyWETH {
    function setEmergencyPrice(uint256 _wethPerUsd1) external;
    function emergencyMode() external view returns (bool);
    function emergencyWethPerUsd1() external view returns (uint256);
}

contract FixEmergencyPrice is Script {
    address constant WETH_STRATEGY = 0x997feaa69a60c536F8449F0D5Adf997fD83aDf39;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        ICharmStrategyWETH strategy = ICharmStrategyWETH(WETH_STRATEGY);

        console.log("=====================================================");
        console.log("FIXING EMERGENCY PRICE (was inverted!)");
        console.log("=====================================================");
        console.log("");

        // CORRECT calculation:
        // If 1 WETH = $3,200 and 1 USD1 = $1
        // Then: 1 USD1 = (1/3200) WETH = 0.0003125 WETH
        // In wei: 0.0003125 * 1e18 = 312,500,000,000,000 wei
        
        // Or using math: wethPerUsd1 = 1e18 / 3200 = 312500000000000
        uint256 wethPerUsd1 = 1e18 / 3200; // 312,500,000,000,000 wei = 0.0003125 WETH

        console.log("Current (WRONG) price:", strategy.emergencyWethPerUsd1());
        console.log("Setting CORRECT price:", wethPerUsd1);
        console.log("This means: 1 USD1 = 0.0003125 WETH");
        console.log("Or: 1 WETH = 3200 USD1");
        console.log("");

        strategy.setEmergencyPrice(wethPerUsd1);

        console.log("SUCCESS: Emergency price corrected");
        console.log("New emergencyWethPerUsd1:", strategy.emergencyWethPerUsd1());
        console.log("=====================================================");

        vm.stopBroadcast();
    }
}

