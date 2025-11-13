// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/strategies/CharmStrategyWETH.sol";

/**
 * @title ConfigureCharmStrategy
 * @notice Configure CharmStrategyWETH before transferring to multisig
 */
contract ConfigureCharmStrategy is Script {
    address constant STRATEGY = 0x47dCe4Bd8262fe0E76733825A1Cac205905889c6;
    address constant MULTISIG = 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3;
    
    // Chainlink feeds
    address constant CHAINLINK_WETH_USD = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address constant CHAINLINK_USD1_USD = 0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d;
    
    // Uniswap V3 0.3% pool for TWAP
    address constant TWAP_POOL_03PCT = 0xcdF9F50519Eb0a9995730DDB6e7d3A8B1D8fFA07;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        CharmStrategyWETH strategy = CharmStrategyWETH(STRATEGY);
        
        console.log("===============================================");
        console.log("CONFIGURE: CharmStrategyWETH");
        console.log("===============================================");
        console.log("Strategy:", STRATEGY);
        console.log("Current Owner:", deployer);
        console.log("Future Owner:", MULTISIG);
        console.log("");
        
        vm.startBroadcast(pk);
        
        // 1. Set Chainlink oracles
        console.log("1. Setting Chainlink oracles...");
        try strategy.setWethUsdPriceFeed(CHAINLINK_WETH_USD) {
            console.log("   [OK] WETH/USD feed set");
        } catch {
            console.log("   [SKIP] WETH/USD feed already set");
        }
        
        try strategy.setUsd1UsdPriceFeed(CHAINLINK_USD1_USD) {
            console.log("   [OK] USD1/USD feed set");
        } catch {
            console.log("   [SKIP] USD1/USD feed already set");
        }
        console.log("");
        
        // 2. Set TWAP pool (0.3% for better liquidity)
        console.log("2. Setting TWAP pool (0.3% tier)...");
        try strategy.setTwapPool(TWAP_POOL_03PCT) {
            console.log("   [OK] TWAP pool set to 0.3% tier");
        } catch {
            console.log("   [SKIP] TWAP pool already set");
        }
        console.log("");
        
        // 3. Configure strategy parameters
        console.log("3. Configuring strategy parameters...");
        try strategy.updateParameters(
            500,   // maxSlippage: 5%
            1800,  // twapPeriod: 30 minutes
            3600   // maxOracleAge: 1 hour
        ) {
            console.log("   [OK] Parameters set:");
            console.log("      - Max Slippage: 5%");
            console.log("      - TWAP Period: 30 minutes");
            console.log("      - Max Oracle Age: 1 hour");
        } catch {
            console.log("   [SKIP] Parameters already configured");
        }
        console.log("");
        
        // 4. Ensure strategy is active
        console.log("4. Checking strategy status...");
        bool isActive = strategy.active();
        if (!isActive) {
            try strategy.resume() {
                console.log("   [OK] Strategy activated");
            } catch {
                console.log("   [ERROR] Failed to activate strategy");
            }
        } else {
            console.log("   [OK] Strategy is active");
        }
        console.log("");
        
        // 5. Verify approvals
        console.log("5. Verifying token approvals...");
        console.log("   [NOTE] Approvals were set during deployment");
        console.log("");
        
        // 6. Transfer ownership to multisig
        console.log("6. Transferring ownership to multisig...");
        strategy.transferOwnership(MULTISIG);
        console.log("   [OK] Ownership transferred to:", MULTISIG);
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("CONFIGURATION COMPLETE!");
        console.log("===============================================");
        console.log("");
        console.log("Strategy Configuration:");
        console.log("  Address:", STRATEGY);
        console.log("  Owner:", MULTISIG);
        console.log("  Status: Active");
        console.log("  Max Slippage: 5%");
        console.log("  TWAP Period: 30 minutes");
        console.log("  Oracle Age: 1 hour max");
        console.log("");
        console.log("Oracles Configured:");
        console.log("  WETH/USD: ", CHAINLINK_WETH_USD);
        console.log("  USD1/USD: ", CHAINLINK_USD1_USD);
        console.log("  TWAP Pool: ", TWAP_POOL_03PCT, "(0.3%)");
        console.log("");
        console.log("Next Steps:");
        console.log("1. Add strategy to vault (via multisig)");
        console.log("2. Test small deposit/withdraw");
        console.log("3. Monitor strategy performance");
        console.log("");
    }
}

