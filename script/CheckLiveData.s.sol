// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

interface IStrategy {
    function getTotalAmounts() external view returns (uint256, uint256);
    function vault() external view returns (address);
}

interface IVault {
    function strategyWeights(address strategy) external view returns (uint256);
}

contract CheckLiveData is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant USD1_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    address constant WETH_STRATEGY = 0x997feaa69a60c536F8449F0D5Adf997fD83aDf39;

    function run() external view {
        console.log("====================================================");
        console.log("CHECKING LIVE ON-CHAIN DATA");
        console.log("====================================================");
        console.log("");

        // Check USD1 Strategy
        console.log("[USD1 STRATEGY]");
        console.log("Address:", USD1_STRATEGY);
        try IVault(VAULT).strategyWeights(USD1_STRATEGY) returns (uint256 weight) {
            console.log("Weight:", weight);
            console.log("Percentage:", weight / 100);
        } catch {
            console.log("Weight: NOT ACTIVE");
        }
        
        try IStrategy(USD1_STRATEGY).getTotalAmounts() returns (uint256 wlfi, uint256 usd1) {
            console.log("WLFI:", wlfi / 1e18);
            console.log("USD1:", usd1 / 1e18);
        } catch {
            console.log("ERROR: Cannot call getTotalAmounts()");
        }
        console.log("");

        // Check WETH Strategy
        console.log("[WETH STRATEGY]");
        console.log("Address:", WETH_STRATEGY);
        try IVault(VAULT).strategyWeights(WETH_STRATEGY) returns (uint256 weight) {
            console.log("Weight:", weight);
            console.log("Percentage:", weight / 100);
        } catch {
            console.log("Weight: NOT ACTIVE");
        }
        
        try IStrategy(WETH_STRATEGY).getTotalAmounts() returns (uint256 weth, uint256 wlfi) {
            console.log("WETH:", weth / 1e18);
            console.log("WLFI:", wlfi / 1e18);
        } catch {
            console.log("ERROR: Cannot call getTotalAmounts()");
        }
        console.log("");

        console.log("====================================================");
    }
}

