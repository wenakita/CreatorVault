// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICreatorChainlinkOracle
 * @notice Interface for CreatorChainlinkOracle
 */
interface ICreatorChainlinkOracle {
    
    // ================================
    // PRICE READING
    // ================================
    
    /**
     * @notice Get ETH/USD price from Chainlink
     * @return price Price in 1e18 format
     * @return timestamp Last update timestamp
     */
    function getEthPrice() external view returns (int256 price, uint256 timestamp);
    
    /**
     * @notice Get Creator token USD price
     * @return price Price in 1e18 format
     * @return timestamp Last update timestamp
     */
    function getCreatorPrice() external view returns (int256 price, uint256 timestamp);
    
    /**
     * @notice Get Creator/ETH TWAP price
     * @param duration TWAP duration in seconds
     * @return price Creator per ETH in 1e18
     */
    function getCreatorEthTWAP(uint32 duration) external view returns (uint256 price);
    
    /**
     * @notice Get TWAP tick
     * @param duration Lookback duration in seconds
     * @return twapTick Time-weighted average tick
     */
    function getTWAPTick(uint32 duration) external view returns (int24 twapTick);
    
    /**
     * @notice Convert tick to price
     * @param tick The tick value
     * @return price Price in 1e18 format
     */
    function tickToPrice(int24 tick) external view returns (uint256 price);
    
    /**
     * @notice Get current tick from V4 pool
     * @return tick Current tick
     */
    function getCurrentTick() external view returns (int24 tick);
    
    /**
     * @notice Check if price is fresh
     * @return True if price is not stale
     */
    function isPriceFresh() external view returns (bool);
    
    // ================================
    // PRICE UPDATING
    // ================================
    
    /**
     * @notice Update creator price (authorized callers only)
     * @param _price Price in 1e18 format
     */
    function updateCreatorPrice(int256 _price) external;
    
    /**
     * @notice Manually update price from TWAP
     * @param twapDuration TWAP duration in seconds
     */
    function updateCreatorPriceFromTWAP(uint32 twapDuration) external;
    
    /**
     * @notice Record observation on swap
     */
    function recordSwapObservation() external;
    
    // ================================
    // STATE
    // ================================
    
    /**
     * @notice Get observation state
     */
    function getObservationState() external view returns (
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext,
        uint32 lastTimestamp
    );
    
    /**
     * @notice Get tick cap state
     */
    function getTickCapState() external view returns (
        int24 currentCap,
        uint64 capFrequency,
        bool autoTunePaused
    );
    
    // ================================
    // CONSTANTS
    // ================================
    
    function creatorSymbol() external view returns (string memory);
    function creatorPriceUSD() external view returns (int256);
    function creatorPriceTimestamp() external view returns (uint256);
    function v4PoolConfigured() external view returns (bool);
    function maxTicksPerObservation() external view returns (int24);
}


