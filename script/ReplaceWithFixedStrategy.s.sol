// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

interface IEagleOVault {
    function removeStrategy(address strategy) external;
    function addStrategy(address strategy, uint256 weight) external;
    function strategyWeights(address strategy) external view returns (uint256);
}

contract ReplaceWithFixedStrategy is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant OLD_STRATEGY = 0x997feaa69a60c536F8449F0D5Adf997fD83aDf39;
    address constant NEW_STRATEGY = 0xF73f57525d46C5f6064a1aAc0F09D3183Cd3A6eB;
    address constant USD1_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        IEagleOVault vault = IEagleOVault(VAULT);

        console.log("=====================================================");
        console.log("REPLACING WETH STRATEGY IN VAULT");
        console.log("=====================================================");
        console.log("");
        console.log("Vault:", VAULT);
        console.log("Old Strategy:", OLD_STRATEGY);
        console.log("New Strategy:", NEW_STRATEGY);
        console.log("");

        // Check current weights
        uint256 oldWeight = vault.strategyWeights(OLD_STRATEGY);
        uint256 usd1Weight = vault.strategyWeights(USD1_STRATEGY);
        
        console.log("[CURRENT WEIGHTS]");
        console.log("Old WETH Strategy:", oldWeight / 100, "%");
        console.log("USD1 Strategy:", usd1Weight / 100, "%");
        console.log("");

        // Remove old WETH strategy
        if (oldWeight > 0) {
            console.log("Removing old WETH strategy...");
            vault.removeStrategy(OLD_STRATEGY);
            console.log("Old strategy removed");
        } else {
            console.log("Old strategy already inactive");
        }
        console.log("");

        // Add new WETH strategy at 50%
        console.log("Adding new WETH strategy at 50%...");
        vault.addStrategy(NEW_STRATEGY, 5000); // 50%
        console.log("New strategy added");
        console.log("");

        // Verify new weights
        uint256 newWeight = vault.strategyWeights(NEW_STRATEGY);
        uint256 usd1WeightAfter = vault.strategyWeights(USD1_STRATEGY);
        
        console.log("[NEW WEIGHTS]");
        console.log("New WETH Strategy:", newWeight / 100, "%");
        console.log("USD1 Strategy:", usd1WeightAfter / 100, "%");
        console.log("Total:", (newWeight + usd1WeightAfter) / 100, "%");
        console.log("");

        console.log("=====================================================");
        console.log("SUCCESS: Strategy replaced!");
        console.log("");
        console.log("NEXT STEP:");
        console.log("Run: forge script script/ForceDeployIdle.s.sol --rpc-url $ETHEREUM_RPC_URL --broadcast");
        console.log("=====================================================");

        vm.stopBroadcast();
    }
}

