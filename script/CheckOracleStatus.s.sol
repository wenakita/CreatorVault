// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

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
    function decimals() external view returns (uint8);
    function description() external view returns (string memory);
}

interface ICharmStrategyWETH {
    function maxOracleAge() external view returns (uint256);
}

contract CheckOracleStatus is Script {
    address constant WETH_STRATEGY = 0x997feaa69a60c536F8449F0D5Adf997fD83aDf39;
    
    // Chainlink oracles
    address constant CHAINLINK_WETH_USD = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address constant CHAINLINK_USD1_USD = 0xF0d9bb015Cd7BfAb877B7156146dc09Bf461370d;

    function run() external view {
        console.log("=====================================================");
        console.log("CHAINLINK ORACLE STATUS CHECK");
        console.log("=====================================================");
        console.log("");
        console.log("Current time:", block.timestamp);
        console.log("");
        
        // Check WETH/USD Oracle
        console.log("[WETH/USD Oracle]");
        console.log("Address:", CHAINLINK_WETH_USD);
        AggregatorV3Interface wethFeed = AggregatorV3Interface(CHAINLINK_WETH_USD);
        
        try wethFeed.description() returns (string memory desc) {
            console.log("Description:", desc);
        } catch {
            console.log("Description: N/A");
        }
        
        (
            uint80 wethRoundId,
            int256 wethPrice,
            ,
            uint256 wethUpdatedAt,
        ) = wethFeed.latestRoundData();
        
        uint256 wethAge = block.timestamp - wethUpdatedAt;
        uint8 wethDecimals = wethFeed.decimals();
        
        console.log("Round ID:", wethRoundId);
        console.log("Price:", uint256(wethPrice));
        console.log("Decimals:", wethDecimals);
        console.log("Last Updated:", wethUpdatedAt);
        console.log("Age:", wethAge, "seconds");
        console.log("Age:", wethAge / 60, "minutes");
        console.log("Age:", wethAge / 3600, "hours");
        console.log("");
        
        // Check USD1/USD Oracle
        console.log("[USD1/USD Oracle]");
        console.log("Address:", CHAINLINK_USD1_USD);
        AggregatorV3Interface usd1Feed = AggregatorV3Interface(CHAINLINK_USD1_USD);
        
        try usd1Feed.description() returns (string memory desc) {
            console.log("Description:", desc);
        } catch {
            console.log("Description: N/A");
        }
        
        (
            uint80 usd1RoundId,
            int256 usd1Price,
            ,
            uint256 usd1UpdatedAt,
        ) = usd1Feed.latestRoundData();
        
        uint256 usd1Age = block.timestamp - usd1UpdatedAt;
        uint8 usd1Decimals = usd1Feed.decimals();
        
        console.log("Round ID:", usd1RoundId);
        console.log("Price:", uint256(usd1Price));
        console.log("Decimals:", usd1Decimals);
        console.log("Last Updated:", usd1UpdatedAt);
        console.log("Age:", usd1Age, "seconds");
        console.log("Age:", usd1Age / 60, "minutes");
        console.log("Age:", usd1Age / 3600, "hours");
        console.log("");
        
        // Check strategy maxOracleAge
        ICharmStrategyWETH strategy = ICharmStrategyWETH(WETH_STRATEGY);
        uint256 maxOracleAge = strategy.maxOracleAge();
        
        console.log("[Strategy Settings]");
        console.log("Address:", WETH_STRATEGY);
        console.log("maxOracleAge:", maxOracleAge, "seconds");
        console.log("maxOracleAge:", maxOracleAge / 60, "minutes");
        console.log("maxOracleAge:", maxOracleAge / 3600, "hours");
        console.log("");
        
        // Analysis
        console.log("[ANALYSIS]");
        if (wethAge > maxOracleAge) {
            console.log("WETH/USD Oracle: STALE (age > maxOracleAge)");
        } else {
            console.log("WETH/USD Oracle: FRESH");
        }
        
        if (usd1Age > maxOracleAge) {
            console.log("USD1/USD Oracle: STALE (age > maxOracleAge)");
        } else {
            console.log("USD1/USD Oracle: FRESH");
        }
        
        uint256 maxAge = wethAge > usd1Age ? wethAge : usd1Age;
        console.log("");
        console.log("Oldest oracle:", maxAge, "seconds old");
        
        if (maxAge > maxOracleAge) {
            console.log("");
            console.log("RECOMMENDATION:");
            console.log("Run: forge script script/IncreaseMaxOracleAge.s.sol --rpc-url $ETHEREUM_RPC_URL --broadcast");
            console.log("This will increase maxOracleAge to 2 hours (7200 seconds)");
        } else {
            console.log("");
            console.log("STATUS: All oracles are fresh! No action needed.");
        }
        
        console.log("=====================================================");
    }
}

