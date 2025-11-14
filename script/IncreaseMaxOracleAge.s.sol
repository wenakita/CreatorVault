// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

interface ICharmStrategyWETH {
    function maxOracleAge() external view returns (uint256);
    function updateParameters(uint256 _maxSlippage, uint256 _twapPeriod, uint256 _maxOracleAge) external;
    function maxSlippage() external view returns (uint256);
    function twapPeriod() external view returns (uint256);
}

interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

contract IncreaseMaxOracleAge is Script {
    address constant WETH_STRATEGY = 0x997feaa69a60c536F8449F0D5Adf997fD83aDf39;
    
    // Chainlink oracles
    address constant CHAINLINK_WETH_USD = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address constant CHAINLINK_USD1_USD = 0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        console.log("=====================================================");
        console.log("CHECKING ORACLE STALENESS");
        console.log("=====================================================");
        console.log("");
        
        // Check oracle freshness
        console.log("[WETH/USD Oracle]");
        AggregatorV3Interface wethFeed = AggregatorV3Interface(CHAINLINK_WETH_USD);
        (, , , uint256 wethUpdatedAt, ) = wethFeed.latestRoundData();
        uint256 wethAge = block.timestamp - wethUpdatedAt;
        console.log("Last update:", wethUpdatedAt);
        console.log("Age (seconds):", wethAge);
        console.log("Age (hours):", wethAge / 3600);
        console.log("");
        
        console.log("[USD1/USD Oracle]");
        AggregatorV3Interface usd1Feed = AggregatorV3Interface(CHAINLINK_USD1_USD);
        (, , , uint256 usd1UpdatedAt, ) = usd1Feed.latestRoundData();
        uint256 usd1Age = block.timestamp - usd1UpdatedAt;
        console.log("Last update:", usd1UpdatedAt);
        console.log("Age (seconds):", usd1Age);
        console.log("Age (hours):", usd1Age / 3600);
        console.log("");
        
        // Check current maxOracleAge
        ICharmStrategyWETH strategy = ICharmStrategyWETH(WETH_STRATEGY);
        uint256 currentMaxAge = strategy.maxOracleAge();
        console.log("[Current Strategy Settings]");
        console.log("maxOracleAge:", currentMaxAge, "seconds");
        console.log("maxOracleAge:", currentMaxAge / 3600, "hours");
        console.log("");
        
        // Determine if we need to increase maxOracleAge
        uint256 maxAge = wethAge > usd1Age ? wethAge : usd1Age;
        console.log("[Analysis]");
        console.log("Oldest oracle age:", maxAge, "seconds");
        
        if (maxAge > currentMaxAge) {
            console.log("ISSUE: Oracle is STALE!");
            console.log("Suggested maxOracleAge:", (maxAge + 3600), "seconds"); // Add 1 hour buffer
            console.log("");
            
            // Increase maxOracleAge to 2 hours (7200 seconds) - contract maximum
            uint256 newMaxOracleAge = 7200; // 2 hours (contract maximum)
            
            vm.startBroadcast(pk);
            
            console.log("[UPDATING PARAMETERS]");
            console.log("New maxOracleAge: 7200 seconds (2 hours - contract maximum)");
            
            strategy.updateParameters(
                strategy.maxSlippage(),
                strategy.twapPeriod(),
                newMaxOracleAge
            );
            
            vm.stopBroadcast();
            
            console.log("SUCCESS: maxOracleAge increased to 2 hours (contract maximum)");
        } else {
            console.log("Oracle is FRESH. No update needed.");
        }
        
        console.log("=====================================================");
    }
}

