// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

/**
 * @title ICreatorOracle
 * @author 0xakita.eth
 * @notice Interface for CreatorOracle price feeds and helpers.
 * @dev Used by vaults, gauges, and deployment tooling.
 */
interface ICreatorOracle {
    // ================================
    // CONFIGURATION
    // ================================

    function setV4Pool(address _poolManager, PoolKey calldata _poolKey, bool _creatorIsToken0) external;

    function setV3Pool(address _pool, address _creatorToken, address _usdToken, uint32 _twapDuration) external;

    // ================================
    // PRICE READING
    // ================================

    function getEthPrice() external view returns (int256 price, uint256 timestamp);

    function getCreatorPrice() external view returns (int256 price, uint256 timestamp);

    function getCreatorEthTWAP(uint32 duration) external view returns (uint256 price);

    function getTWAPTick(uint32 duration) external view returns (int24 twapTick);

    function tickToPrice(int24 tick) external view returns (uint256 price);

    function getCurrentTick() external view returns (int24 tick);

    function isPriceFresh() external view returns (bool);

    // ================================
    // AJNA BUCKET HELPERS
    // ================================

    /**
     * @notice Convert a Uniswap tick to an Ajna bucket index (approx)
     */
    function tickToAjnaBucket(int24 tick) external pure returns (uint256 bucketIndex);

    /**
     * @notice Suggested Ajna bucket from the configured CREATOR/USDC V3 TWAP tick
     */
    function getAjnaBucketFromV3TWAP(uint32 duration) external view returns (uint256 bucketIndex);

    // ================================
    // PRICE UPDATING
    // ================================

    function updateCreatorPrice(int256 _price) external;

    /**
     * @notice Chainlink-style update: V4 TWAP (Creator/ETH) × Chainlink (ETH/USD)
     */
    function updateCreatorPriceFromTWAP(uint32 twapDuration) external;

    /**
     * @notice Optional: direct stablecoin update (CREATOR/USDC V3 TWAP)
     */
    function updateCreatorPriceFromV3TWAP(uint32 twapDuration) external;

    function recordSwapObservation() external;

    // ================================
    // STATE HELPERS
    // ================================

    function getObservationState() external view returns (
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext,
        uint32 lastTimestamp
    );

    function getTickCapState() external view returns (
        int24 currentCap,
        uint64 capFrequency,
        bool autoTunePaused
    );

    function creatorSymbol() external view returns (string memory);

    function creatorPriceUSD() external view returns (int256);

    function creatorPriceTimestamp() external view returns (uint256);

    function v4PoolConfigured() external view returns (bool);

    function maxTicksPerObservation() external view returns (int24);
}
