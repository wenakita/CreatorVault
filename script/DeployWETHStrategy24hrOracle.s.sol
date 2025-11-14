// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {CharmStrategyWETH} from "../contracts/strategies/CharmStrategyWETH.sol";

contract DeployWETHStrategy24hrOracle is Script {
    // Addresses from .env
    address constant EAGLE_VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant CHARM_VAULT_WETH = 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF;
    address constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("=====================================================");
        console.log("DEPLOYING WETH STRATEGY WITH 24HR ORACLE SUPPORT");
        console.log("=====================================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("");

        vm.startBroadcast(pk);

        // Deploy the strategy with 24hr oracle support
        CharmStrategyWETH strategyWETH = new CharmStrategyWETH(
            EAGLE_VAULT,      // vault address
            CHARM_VAULT_WETH, // Charm vault
            WLFI,             // WLFI token
            WETH,             // WETH token
            USD1,             // USD1 token
            UNISWAP_V3_ROUTER, // Uniswap router
            deployer          // owner
        );

        console.log("New WETH Strategy deployed at:", address(strategyWETH));
        console.log("");

        // Initialize approvals
        console.log("Initializing approvals...");
        strategyWETH.initializeApprovals();
        console.log("Approvals initialized");
        console.log("");

        // Set maxOracleAge to 24 hours (86400 seconds)
        console.log("Setting maxOracleAge to 24 hours...");
        uint256 maxSlippage = strategyWETH.maxSlippage(); // Keep current: 500 (5%)
        uint256 twapPeriod = strategyWETH.twapPeriod();   // Keep current: 1800 (30 min)
        uint256 maxOracleAge = 86400; // 24 hours
        
        strategyWETH.updateParameters(maxSlippage, twapPeriod, maxOracleAge);
        console.log("maxOracleAge set to", maxOracleAge, "seconds (24 hours)");
        console.log("");

        console.log("=====================================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("=====================================================");
        console.log("New Strategy:", address(strategyWETH));
        console.log("Owner:", strategyWETH.owner());
        console.log("Emergency Mode:", strategyWETH.emergencyMode());
        console.log("Max Oracle Age:", strategyWETH.maxOracleAge(), "seconds");
        console.log("Max Oracle Age:", strategyWETH.maxOracleAge() / 3600, "hours");
        console.log("");
        console.log("This strategy uses REAL-TIME Chainlink oracles!");
        console.log("No emergency mode needed - supports 24hr stale USD1 oracle.");
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Replace old strategy in vault");
        console.log("2. Deploy funds to new strategy");
        console.log("=====================================================");

        vm.stopBroadcast();
    }
}

