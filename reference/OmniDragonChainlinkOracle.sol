// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { OApp, Origin, MessagingFee, MessagingReceipt } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IPoolManager } from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import { PoolId, PoolIdLibrary } from "@uniswap/v4-core/src/types/PoolId.sol";
import { PoolKey } from "@uniswap/v4-core/src/types/PoolKey.sol";
import { StateLibrary } from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import { TickMath } from "@uniswap/v4-core/src/libraries/TickMath.sol";
import { TruncatedOracle } from "../../libraries/TruncatedOracle.sol";

interface IOmniDragonRegistry {
    function getLayerZeroEndpoint(uint16 _chainId) external view returns (address);
    function getChainlinkNativeFeed(uint16 _chainId) external view returns (address);
}

/**
 * @title OmniDragonChainlinkOracle
 * @notice Omnichain oracle for DRAGON token price distribution
 * @dev Deployed to same address on all chains via CREATE2
 * 
 * Features:
 * 1. Reads local Chainlink native/USD feed from Registry (chain config)
 * 2. Stores DRAGON/USD price from Base (source of truth)
 * 3. Broadcasts DRAGON price to all chains via LayerZero
 * 4. All chains use Base's authoritative DRAGON price for lottery
 * 
 * Architecture:
 * - Registry: Stores Chainlink feed addresses per chain (ETH/USD, MON/USD, etc.)
 * - Base: Oracle reads V4 pool TWAP + Chainlink to calculate DRAGON/USD
 * - Base: Oracle broadcasts to all other chains
 * - Others: Receive and store Base's DRAGON price
 * - Others: Use for lottery calculations (no local liquidity needed!)
 */
contract OmniDragonChainlinkOracle is OApp {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using TruncatedOracle for TruncatedOracle.Observation[65535];
    
    // ================================
    // STATE
    // ================================
    
    /// @notice DRAGON/USD price (broadcast from Base)
    int256 public dragonPriceUSD; // 1e18 format
    uint256 public dragonPriceTimestamp;
    
    /// @notice Authorized token contract (can update DRAGON price)
    address public dragonToken;
    
    /// @notice Staleness threshold
    uint256 public constant MAX_STALENESS = 7200; // 2 hours
    
    /// @notice Base chain ID
    uint256 public constant BASE_CHAIN_ID = 8453;
    
    /// @notice Registry for LayerZero endpoint lookup
    IOmniDragonRegistry public immutable registry;
    
    // ================================
    // V4 POOL TWAP STATE (Enhanced with TruncatedOracle)
    // ================================
    
    /// @notice Uniswap V4 PoolManager
    IPoolManager public poolManager;
    
    /// @notice V4 pool key for DRAGON/native
    PoolKey public dragonPoolKey;
    
    /// @notice Whether V4 pool is configured
    bool public v4PoolConfigured;
    
    /// @notice Whether DRAGON is token0 in the pool
    bool public dragonIsToken0;
    
    /// @notice Ring buffer of observations for TWAP (65535 max, using 1024 practical)
    TruncatedOracle.Observation[65535] public observations;
    
    /// @notice Current observation state
    struct ObservationState {
        uint16 index;
        uint16 cardinality;
        uint16 cardinalityNext;
    }
    ObservationState public observationState;
    
    /// @notice Maximum observations to store (configurable, default 1024)
    uint16 public constant MAX_CARDINALITY_TARGET = 1024;
    
    /// @notice Last observation timestamp
    uint32 public lastObservationTimestamp;
    
    // ================================
    // TICK CAPPING (Manipulation Resistance)
    // ================================
    
    /// @notice Maximum tick movement per observation (manipulation resistance)
    /// @dev Default: 100 ticks ≈ 1% price move per observation
    int24 public maxTicksPerObservation = 100;
    
    /// @notice Auto-tune state for tick cap
    struct TickCapState {
        uint64 capFrequency;     // Saturating counter of cap events
        uint48 lastCapUpdate;    // Last cap frequency update timestamp
        bool autoTunePaused;     // Circuit breaker
    }
    TickCapState public tickCapState;
    
    /// @notice Policy parameters for auto-tuning
    struct TickCapPolicy {
        int24 minCap;            // Minimum allowed cap (default: 10)
        int24 maxCap;            // Maximum allowed cap (default: 500)
        uint32 stepBps;          // Step size in basis points (default: 500 = 5%)
        uint32 budgetPpm;        // Target cap frequency (default: 10000 = 1%)
        uint32 decayWindowSec;   // Decay window in seconds (default: 3600 = 1hr)
        uint32 updateIntervalSec; // Min time between updates (default: 60)
    }
    TickCapPolicy public tickCapPolicy;
    
    /// @notice Authorized swap recorders (token, lottery manager, etc.)
    mapping(address => bool) public isSwapRecorder;
    
    /// @notice Authorized price updaters (VRF integrator for cross-chain aggregated price)
    mapping(address => bool) public isPriceUpdater;
    
    /// @notice Parts per million constant
    uint32 private constant PPM = 1_000_000;
    
    /// @notice One day in ppm (for cap frequency calculation)
    uint64 private constant ONE_DAY_PPM = 86_400 * 1_000_000;
    
    // ================================
    // EVENTS
    // ================================
    
    event DragonTokenSet(address indexed token);
    event DragonPriceUpdated(int256 price, uint256 timestamp, address indexed updater);
    event DragonPriceBroadcast(uint32[] dstEids, int256 price, uint256 timestamp);
    event DragonPriceReceived(uint32 srcEid, int256 price, uint256 timestamp);
    event V4PoolConfigured(PoolId indexed poolId, address poolManager, bool dragonIsToken0);
    event ObservationRecorded(uint16 index, int24 tick, int24 truncatedTick, uint32 timestamp);
    event TWAPPriceCalculated(int256 dragonPerNative, int256 dragonUSD, uint32 twapDuration);
    event SwapRecorderSet(address indexed recorder, bool authorized);
    event PriceUpdaterSet(address indexed updater, bool authorized);
    event MaxTicksUpdated(int24 oldMaxTicks, int24 newMaxTicks, bool autoTuned);
    event CardinalityIncreased(uint16 oldCardinalityNext, uint16 newCardinalityNext);
    event TickCapPolicyUpdated(int24 minCap, int24 maxCap, uint32 stepBps, uint32 budgetPpm);
    event AutoTunePaused(bool paused);
    event TickWasCapped(int24 rawTick, int24 truncatedTick, int24 movement);
    
    // ================================
    // CONSTRUCTOR
    // ================================
    
    /**
     * @notice Constructor for CREATE2 deployment - SAME PARAMETERS ON ALL CHAINS!
     * @param _registry OmniDragonRegistry address (same on all chains)
     * @param _owner Owner address (same on all chains)
     * @dev Registry provides correct LayerZero endpoint and Chainlink feed per chain
     */
    constructor(address _registry, address _owner) OApp(_getEndpointFromRegistry(_registry), _owner) Ownable(_owner) {
        require(_registry != address(0), "Invalid registry");
        registry = IOmniDragonRegistry(_registry);
        
        // Initialize tick cap policy with sensible defaults
        tickCapPolicy = TickCapPolicy({
            minCap: 10,           // Minimum 10 ticks (~0.1% movement)
            maxCap: 500,          // Maximum 500 ticks (~5% movement)
            stepBps: 500,         // 5% adjustment per step
            budgetPpm: 10000,     // Target 1% of observations hit cap
            decayWindowSec: 3600, // 1 hour decay window
            updateIntervalSec: 60 // Min 1 minute between adjustments
        });
        
        // Note: dragonToken set post-deployment, chainlinkFeed read from registry
    }
    
    /// @dev Helper to get endpoint before OApp constructor
    function _getEndpointFromRegistry(address _registry) private view returns (address) {
        return IOmniDragonRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid));
    }
    
    // ================================
    // ADMIN FUNCTIONS
    // ================================
    
    /**
     * @notice Set DRAGON token address (can update prices)
     * @param _dragonToken The DRAGON token contract
     */
    function setDragonToken(address _dragonToken) external onlyOwner {
        require(_dragonToken != address(0), "Invalid token");
        dragonToken = _dragonToken;
        emit DragonTokenSet(_dragonToken);
    }
    
    /**
     * @notice Configure V4 pool for TWAP observations
     * @param _poolManager Uniswap V4 PoolManager address
     * @param _poolKey The pool key for DRAGON/native pair
     * @param _dragonIsToken0 Whether DRAGON is currency0 in the pool
     */
    function setV4Pool(
        address _poolManager,
        PoolKey calldata _poolKey,
        bool _dragonIsToken0
    ) external onlyOwner {
        require(_poolManager != address(0), "Invalid pool manager");
        
        poolManager = IPoolManager(_poolManager);
        dragonPoolKey = _poolKey;
        dragonIsToken0 = _dragonIsToken0;
        v4PoolConfigured = true;
        
        // Get initial tick
        PoolId poolId = _poolKey.toId();
        (, int24 tick, ,) = poolManager.getSlot0(poolId);
        
        // Initialize observation array using TruncatedOracle library
        (uint16 cardinality, uint16 cardinalityNext) = observations.initialize(
            uint32(block.timestamp),
            tick
        );
        
        observationState = ObservationState({
            index: 0,
            cardinality: cardinality,
            cardinalityNext: cardinalityNext
        });
        
        // Initialize tick cap state
        tickCapState.lastCapUpdate = uint48(block.timestamp);
        tickCapState.capFrequency = 0;
        
        lastObservationTimestamp = uint32(block.timestamp);
        
        emit V4PoolConfigured(poolId, _poolManager, _dragonIsToken0);
    }
    
    /**
     * @notice Set authorized swap recorder (can record observations on swaps)
     * @param recorder Address that can record observations (token, lottery, etc.)
     * @param authorized Whether to authorize or revoke
     */
    function setSwapRecorder(address recorder, bool authorized) external onlyOwner {
        require(recorder != address(0), "Invalid recorder");
        isSwapRecorder[recorder] = authorized;
        emit SwapRecorderSet(recorder, authorized);
    }
    
    /**
     * @notice Set price update cooldown (gas optimization)
     * @param cooldown Minimum seconds between price updates (0-300)
     * @dev Lower = fresher prices but more gas; Higher = staler prices but less gas
     */
    function setPriceUpdateCooldown(uint32 cooldown) external onlyOwner {
        require(cooldown <= 300, "Max 5 minutes");
        priceUpdateCooldown = cooldown;
    }
    
    /**
     * @notice Set authorized price updater (VRF integrator for cross-chain aggregated price)
     * @param updater Address that can update price (e.g., VRF integrator)
     * @param authorized Whether to authorize or revoke
     */
    function setPriceUpdater(address updater, bool authorized) external onlyOwner {
        require(updater != address(0), "Invalid updater");
        isPriceUpdater[updater] = authorized;
        emit PriceUpdaterSet(updater, authorized);
    }
    
    /**
     * @notice Set maximum tick movement per observation (manipulation resistance)
     * @param _maxTicks Maximum allowed tick movement (0 = no limit)
     */
    function setMaxTicksPerObservation(int24 _maxTicks) external onlyOwner {
        require(_maxTicks >= 0 && _maxTicks <= 1000, "Invalid max ticks");
        int24 oldMax = maxTicksPerObservation;
        maxTicksPerObservation = _maxTicks;
        emit MaxTicksUpdated(oldMax, _maxTicks, false);
    }
    
    /**
     * @notice Set tick cap policy for auto-tuning
     * @param _minCap Minimum tick cap
     * @param _maxCap Maximum tick cap
     * @param _stepBps Step size in basis points
     * @param _budgetPpm Target cap frequency in ppm
     */
    function setTickCapPolicy(
        int24 _minCap,
        int24 _maxCap,
        uint32 _stepBps,
        uint32 _budgetPpm
    ) external onlyOwner {
        require(_minCap > 0 && _maxCap > _minCap, "Invalid cap range");
        require(_stepBps > 0 && _stepBps <= 10000, "Invalid step");
        require(_budgetPpm > 0 && _budgetPpm <= PPM, "Invalid budget");
        
        tickCapPolicy.minCap = _minCap;
        tickCapPolicy.maxCap = _maxCap;
        tickCapPolicy.stepBps = _stepBps;
        tickCapPolicy.budgetPpm = _budgetPpm;
        
        emit TickCapPolicyUpdated(_minCap, _maxCap, _stepBps, _budgetPpm);
    }
    
    /**
     * @notice Pause/unpause auto-tuning of tick cap (circuit breaker)
     * @param paused Whether to pause auto-tuning
     */
    function setAutoTunePaused(bool paused) external onlyOwner {
        tickCapState.autoTunePaused = paused;
        emit AutoTunePaused(paused);
    }
    
    /**
     * @notice Increase oracle cardinality for longer TWAP windows
     * @param cardinalityNext Target cardinality
     */
    function increaseCardinality(uint16 cardinalityNext) external onlyOwner {
        require(cardinalityNext > observationState.cardinalityNext, "Must increase");
        require(cardinalityNext <= MAX_CARDINALITY_TARGET, "Exceeds max");
        
        uint16 oldCardinalityNext = observationState.cardinalityNext;
        observationState.cardinalityNext = observations.grow(
            observationState.cardinalityNext,
            cardinalityNext
        );
        
        emit CardinalityIncreased(oldCardinalityNext, observationState.cardinalityNext);
    }
    
    // ================================
    // NATIVE PRICE (Chainlink)
    // ================================
    
    /**
     * @notice Get native token USD price from Chainlink
     * @dev Feed address is read from registry (chain config)
     * @return price Price in 1e18 format
     * @return timestamp Last update timestamp
     */
    function getNativePrice() external view returns (int256 price, uint256 timestamp) {
        // Get feed from registry
        address feed = registry.getChainlinkNativeFeed(uint16(block.chainid));
        if (feed == address(0)) return (0, 0);
        
        // Call Chainlink feed
        (
            /* uint80 roundId */,
            int256 answer,
            /* uint256 startedAt */,
            uint256 updatedAt,
            /* uint80 answeredInRound */
        ) = IChainlinkFeed(feed).latestRoundData();
        
        // Validate price
        if (answer <= 0) return (0, 0);
        
        // Check staleness
        if (block.timestamp - updatedAt > MAX_STALENESS) return (0, 0);
        
        // Chainlink returns 8 decimals, convert to 18 decimals
        price = answer * 1e10; // 8 decimals → 18 decimals
        timestamp = updatedAt;
        
        return (price, timestamp);
    }
    
    // ================================
    // DRAGON PRICE (Cross-Chain)
    // ================================
    
    /**
     * @notice Get DRAGON/USD price (from Base or local if on Base)
     * @return price Price in 1e18 format (or 1e6 if specified)
     * @return timestamp Last update timestamp
     */
    function getDragonPrice() external view returns (int256 price, uint256 timestamp) {
        // Return stored price (broadcast from Base or updated locally on Base)
        if (dragonPriceUSD > 0 && dragonPriceTimestamp > 0) {
            // Check staleness
            if (block.timestamp - dragonPriceTimestamp < MAX_STALENESS) {
                return (dragonPriceUSD, dragonPriceTimestamp);
            }
        }
        
        return (0, 0);
    }
    
    /**
     * @notice Update DRAGON price (authorized callers only)
     * @param _price DRAGON/USD price in 1e18 format
     * @dev Authorized: dragonToken, owner, or isPriceUpdater (VRF integrator)
     * @dev On remote chains: VRF integrator calls with aggregated price from Base
     */
    function updateDragonPrice(int256 _price) external {
        require(
            msg.sender == dragonToken || 
            msg.sender == owner() || 
            isPriceUpdater[msg.sender],
            "Unauthorized"
        );
        require(_price > 0, "Invalid price");
        
        dragonPriceUSD = _price;
        dragonPriceTimestamp = block.timestamp;
        
        emit DragonPriceUpdated(_price, block.timestamp, msg.sender);
    }
    
    // ================================
    // V4 TWAP ORACLE FUNCTIONS
    // ================================
    
    /**
     * @notice Record observation on swap (like Uniswap V3)
     * @dev Called by authorized recorders (token, lottery manager) during swaps
     * @dev Uses TruncatedOracle library with manipulation-resistant tick capping
     * @dev Only calculates price on Base (hub) - remote chains receive price via LayerZero
     */
    function recordSwapObservation() external {
        require(isSwapRecorder[msg.sender], "Not authorized");
        require(v4PoolConfigured, "V4 pool not configured");
        
        bool tickWasCapped = _recordObservation();
        
        // Update cap frequency and auto-tune if needed
        if (!tickCapState.autoTunePaused) {
            _updateCapFrequency(tickWasCapped);
        }
        
        // Only calculate price on Base (hub chain)
        // Remote chains receive aggregated price via LayerZero broadcast
        // Wrapped in try/catch to prevent TWAP errors from blocking swaps
        if (block.chainid == BASE_CHAIN_ID && observationState.cardinality >= 2) {
            try this._updatePriceFromTWAPExternal() {} catch {}
        }
    }

    /**
     * @notice External wrapper for _updatePriceFromTWAP (for try/catch)
     * @dev Only callable by this contract
     */
    function _updatePriceFromTWAPExternal() external {
        require(msg.sender == address(this), "Only self");
        _updatePriceFromTWAP();
    }
    
    /**
     * @notice Record observation (owner/admin fallback)
     * @dev For initial setup or manual updates if needed
     */
    function recordObservation() external {
        require(
            msg.sender == owner() || msg.sender == dragonToken,
            "Not authorized"
        );
        require(v4PoolConfigured, "V4 pool not configured");
        _recordObservation();
    }
    
    /**
     * @notice Internal function to record observation using TruncatedOracle library
     * @dev Records current tick with timestamp, applies tick capping
     * @return tickWasCapped Whether the tick movement was capped
     */
    function _recordObservation() internal returns (bool tickWasCapped) {
        if (!v4PoolConfigured) return false;
        
        // Get current tick and liquidity from V4 pool
        PoolId poolId = dragonPoolKey.toId();
        (, int24 tick, ,) = poolManager.getSlot0(poolId);
        uint128 liquidity = poolManager.getLiquidity(poolId);
        
        // Get previous tick to check if capped
        int24 prevTruncatedTick;
        if (observationState.cardinality > 0) {
            prevTruncatedTick = observations[observationState.index].prevTruncatedTick;
        }
        
        // Auto-grow cardinality until reaching target
        if (observationState.cardinalityNext < MAX_CARDINALITY_TARGET) {
            uint16 targetCardinality = observationState.cardinalityNext + 1;
            if (targetCardinality > MAX_CARDINALITY_TARGET) {
                targetCardinality = MAX_CARDINALITY_TARGET;
            }
            observationState.cardinalityNext = observations.grow(
                observationState.cardinalityNext,
                targetCardinality
            );
        }
        
        // Write observation using library (with tick capping)
        (uint16 newIndex, uint16 newCardinality) = observations.write(
            observationState.index,
            uint32(block.timestamp),
            tick,
            liquidity,
            observationState.cardinality,
            observationState.cardinalityNext,
            maxTicksPerObservation
        );
        
        // Check if tick was capped
        int24 movement = tick - prevTruncatedTick;
        tickWasCapped = TruncatedOracle.abs(movement) > uint24(maxTicksPerObservation) && maxTicksPerObservation > 0;
        
        // Get the truncated tick that was actually recorded
        int24 truncatedTick = observations[newIndex].prevTruncatedTick;
        
        if (tickWasCapped) {
            emit TickWasCapped(tick, truncatedTick, movement);
        }
        
        // Update state
        observationState.index = newIndex;
        observationState.cardinality = newCardinality;
        lastObservationTimestamp = uint32(block.timestamp);
        
        emit ObservationRecorded(newIndex, tick, truncatedTick, uint32(block.timestamp));
    }
    
    /**
     * @notice Update cap frequency counter and auto-tune tick cap
     * @dev Based on AEGIS DFM's adaptive tick cap algorithm
     * @param capOccurred Whether a cap event occurred
     */
    function _updateCapFrequency(bool capOccurred) internal {
        uint32 nowTs = uint32(block.timestamp);
        uint32 lastTs = uint32(tickCapState.lastCapUpdate);
        uint32 elapsed = nowTs - lastTs;
        
        // Fast path: no cap and same second
        if (!capOccurred && elapsed == 0) return;
        
        tickCapState.lastCapUpdate = uint48(nowTs);
        
        uint64 currentFreq = tickCapState.capFrequency;
        
        // Add cap contribution first (before decay)
        if (capOccurred) {
            unchecked {
                currentFreq += ONE_DAY_PPM;
            }
            // Saturate at max
            if (currentFreq < ONE_DAY_PPM) {
                currentFreq = type(uint64).max - ONE_DAY_PPM + 1;
            }
        }
        
        // Apply linear decay when no cap
        if (!capOccurred && elapsed > 0 && currentFreq > 0) {
            uint32 decayWindow = tickCapPolicy.decayWindowSec;
            if (elapsed >= decayWindow) {
                currentFreq = 0;
            } else {
                uint64 decayFactor = PPM - (uint64(elapsed) * PPM / decayWindow);
                currentFreq = uint64(uint128(currentFreq) * decayFactor / PPM);
            }
        }
        
        tickCapState.capFrequency = currentFreq;
        
        // Auto-tune if enough time has passed
        if (elapsed >= tickCapPolicy.updateIntervalSec) {
            _autoTuneTickCap(currentFreq);
        }
    }
    
    /**
     * @notice Auto-tune the tick cap based on cap frequency
     * @param currentFreq Current cap frequency
     */
    function _autoTuneTickCap(uint64 currentFreq) internal {
        uint64 targetFreq = uint64(tickCapPolicy.budgetPpm) * uint64(tickCapPolicy.decayWindowSec);
        
        int24 currentCap = maxTicksPerObservation;
        // Calculate change: currentCap * stepBps / 10000
        // Need to handle int24 to uint256 conversion carefully
        uint256 capAbs = currentCap >= 0 ? uint256(uint24(currentCap)) : uint256(uint24(-currentCap));
        int24 change = int24(int256(capAbs * uint256(tickCapPolicy.stepBps) / 10000));
        if (change == 0) change = 1;
        
        int24 newCap;
        if (currentFreq > targetFreq) {
            // Too many caps -> increase cap (loosen)
            newCap = currentCap + change;
            if (newCap > tickCapPolicy.maxCap) newCap = tickCapPolicy.maxCap;
        } else {
            // Too few caps -> decrease cap (tighten)
            newCap = currentCap - change;
            if (newCap < tickCapPolicy.minCap) newCap = tickCapPolicy.minCap;
        }
        
        if (newCap != currentCap) {
            maxTicksPerObservation = newCap;
            emit MaxTicksUpdated(currentCap, newCap, true);
        }
    }
    
    /**
     * @notice Get the current tick from V4 pool
     * @return tick The current tick
     */
    function getCurrentTick() external view returns (int24 tick) {
        require(v4PoolConfigured, "V4 pool not configured");
        PoolId poolId = dragonPoolKey.toId();
        (, tick, ,) = poolManager.getSlot0(poolId);
    }
    
    /**
     * @notice V3-compatible observe function for multiple lookback times
     * @param secondsAgos Array of lookback times in seconds
     * @return tickCumulatives Raw tick cumulatives
     * @return tickCumulativesTruncated Manipulation-resistant tick cumulatives
     * @return secondsPerLiquidityCumulativeX128s Seconds per liquidity values
     */
    function observe(uint32[] calldata secondsAgos) 
        external 
        view 
        returns (
            int56[] memory tickCumulatives,
            int56[] memory tickCumulativesTruncated,
            uint160[] memory secondsPerLiquidityCumulativeX128s
        ) 
    {
        require(v4PoolConfigured, "V4 pool not configured");
        require(observationState.cardinality > 0, "Oracle not initialized");
        
        PoolId poolId = dragonPoolKey.toId();
        (, int24 tick, ,) = poolManager.getSlot0(poolId);
        uint128 liquidity = poolManager.getLiquidity(poolId);
        
        return observations.observe(
            uint32(block.timestamp),
            secondsAgos,
            tick,
            observationState.index,
            liquidity,
            observationState.cardinality,
            maxTicksPerObservation
        );
    }
    
    /**
     * @notice V3-compatible consult function for TWAP calculation
     * @param secondsAgo Lookback duration in seconds
     * @return arithmeticMeanTick Time-weighted average tick
     * @return arithmeticMeanTickTruncated Manipulation-resistant TWAP tick
     * @return harmonicMeanLiquidity Harmonic mean liquidity
     */
    function consult(uint32 secondsAgo) 
        external 
        view 
        returns (
            int24 arithmeticMeanTick,
            int24 arithmeticMeanTickTruncated,
            uint128 harmonicMeanLiquidity
        ) 
    {
        require(secondsAgo > 0, "Seconds ago must be > 0");
        require(v4PoolConfigured, "V4 pool not configured");
        require(observationState.cardinality >= 2, "Need more observations");
        
        PoolId poolId = dragonPoolKey.toId();
        (, int24 tick, ,) = poolManager.getSlot0(poolId);
        uint128 liquidity = poolManager.getLiquidity(poolId);
        
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = secondsAgo;
        secondsAgos[1] = 0;
        
        (
            int56[] memory tickCumulatives,
            int56[] memory tickCumulativesTruncated,
            uint160[] memory secondsPerLiquidityCumulativeX128s
        ) = observations.observe(
            uint32(block.timestamp),
            secondsAgos,
            tick,
            observationState.index,
            liquidity,
            observationState.cardinality,
            maxTicksPerObservation
        );
        
        // Calculate mean ticks
        arithmeticMeanTick = TruncatedOracle.calculateMeanTick(
            tickCumulatives[0],
            tickCumulatives[1],
            secondsAgo
        );
        
        arithmeticMeanTickTruncated = TruncatedOracle.calculateMeanTick(
            tickCumulativesTruncated[0],
            tickCumulativesTruncated[1],
            secondsAgo
        );
        
        // Calculate harmonic mean liquidity
        harmonicMeanLiquidity = TruncatedOracle.calculateMeanLiquidity(
            secondsPerLiquidityCumulativeX128s[0],
            secondsPerLiquidityCumulativeX128s[1],
            secondsAgo
        );
    }
    
    /**
     * @notice Calculate TWAP tick over a time period (legacy compatible)
     * @param duration Lookback duration in seconds
     * @return twapTick Time-weighted average tick
     */
    function getTWAPTick(uint32 duration) public view returns (int24 twapTick) {
        require(observationState.cardinality >= 2, "Need more observations");
        
        PoolId poolId = dragonPoolKey.toId();
        (, int24 tick, ,) = poolManager.getSlot0(poolId);
        uint128 liquidity = poolManager.getLiquidity(poolId);
        
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = duration;
        secondsAgos[1] = 0;
        
        (
            int56[] memory tickCumulatives,
            ,
        ) = observations.observe(
            uint32(block.timestamp),
            secondsAgos,
            tick,
            observationState.index,
            liquidity,
            observationState.cardinality,
            maxTicksPerObservation
        );
        
        twapTick = TruncatedOracle.calculateMeanTick(
            tickCumulatives[0],
            tickCumulatives[1],
            duration
        );
    }
    
    /**
     * @notice Calculate manipulation-resistant TWAP tick
     * @param duration Lookback duration in seconds
     * @return twapTick Truncated (capped) time-weighted average tick
     */
    function getTWAPTickTruncated(uint32 duration) public view returns (int24 twapTick) {
        require(observationState.cardinality >= 2, "Need more observations");
        
        PoolId poolId = dragonPoolKey.toId();
        (, int24 tick, ,) = poolManager.getSlot0(poolId);
        uint128 liquidity = poolManager.getLiquidity(poolId);
        
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = duration;
        secondsAgos[1] = 0;
        
        (
            ,
            int56[] memory tickCumulativesTruncated,
        ) = observations.observe(
            uint32(block.timestamp),
            secondsAgos,
            tick,
            observationState.index,
            liquidity,
            observationState.cardinality,
            maxTicksPerObservation
        );
        
        twapTick = TruncatedOracle.calculateMeanTick(
            tickCumulativesTruncated[0],
            tickCumulativesTruncated[1],
            duration
        );
    }
    
    /**
     * @notice Convert tick to price (DRAGON per native or native per DRAGON)
     * @param tick The tick value
     * @return price Price in 1e18 format
     */
    function tickToPrice(int24 tick) public view returns (uint256 price) {
        // sqrtPriceX96 = sqrt(1.0001^tick) * 2^96
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(tick);
        
        // price = (sqrtPriceX96 / 2^96)^2 = sqrtPriceX96^2 / 2^192
        // In 1e18 format: price = sqrtPriceX96^2 * 1e18 / 2^192
        uint256 sqrtPrice = uint256(sqrtPriceX96);
        
        // This gives price of token1 in terms of token0
        // price = (sqrtPrice * sqrtPrice * 1e18) >> 192
        price = (sqrtPrice * sqrtPrice * 1e18) >> 192;
        
        // If DRAGON is token0, we need to invert to get DRAGON/native
        if (dragonIsToken0 && price > 0) {
            price = (1e18 * 1e18) / price;
        }
    }
    
    /**
     * @notice Get DRAGON/native TWAP price (raw, not manipulation-resistant)
     * @param duration TWAP lookback duration in seconds
     * @return price DRAGON per native token in 1e18 format
     */
    function getDragonNativeTWAP(uint32 duration) public view returns (uint256 price) {
        int24 twapTick = getTWAPTick(duration);
        price = tickToPrice(twapTick);
    }
    
    /**
     * @notice Get DRAGON/native TWAP price (manipulation-resistant)
     * @param duration TWAP lookback duration in seconds
     * @return price DRAGON per native token in 1e18 format
     */
    function getDragonNativeTWAPTruncated(uint32 duration) public view returns (uint256 price) {
        int24 twapTick = getTWAPTickTruncated(duration);
        price = tickToPrice(twapTick);
    }
    
    /// @notice Default TWAP duration for auto-updates (30 minutes)
    uint32 public constant DEFAULT_TWAP_DURATION = 1800;
    
    /// @notice Minimum time between price updates (gas optimization)
    uint32 public priceUpdateCooldown = 30; // 30 seconds default
    
    /// @notice Whether to use truncated (manipulation-resistant) tick for price
    bool public useTruncatedTick = true;
    
    /**
     * @notice Set whether to use truncated tick for price calculation
     * @param _useTruncated True to use manipulation-resistant truncated tick
     */
    function setUseTruncatedTick(bool _useTruncated) external onlyOwner {
        useTruncatedTick = _useTruncated;
    }
    
    /**
     * @notice Internal: Auto-update DRAGON/USD price from TWAP
     * @dev Non-reverting - failures are silently ignored to not block swaps
     * @dev Rate-limited by priceUpdateCooldown to save gas on rapid swaps
     * @dev Uses truncated tick for manipulation resistance by default
     */
    function _updatePriceFromTWAP() internal {
        // Rate limit: skip if recently updated (saves ~15-25k gas)
        if (block.timestamp - dragonPriceTimestamp < priceUpdateCooldown) return;
        
        // Calculate effective TWAP duration based on available observations
        uint16 prevIndex = observationState.index == 0 
            ? observationState.cardinality - 1 
            : observationState.index - 1;
        uint32 oldestTimestamp = observations[prevIndex].blockTimestamp;
        
        if (oldestTimestamp == 0) return;
        
        uint32 effectiveDuration = uint32(block.timestamp) - oldestTimestamp;
        if (effectiveDuration > DEFAULT_TWAP_DURATION) {
            effectiveDuration = DEFAULT_TWAP_DURATION;
        }
        if (effectiveDuration < 60) {
            effectiveDuration = 60; // Minimum 1 minute
        }
        
        // Get DRAGON/native TWAP (manipulation-resistant or raw)
        uint256 dragonPerNative;
        if (useTruncatedTick) {
            try this.getDragonNativeTWAPTruncated(effectiveDuration) returns (uint256 price) {
                dragonPerNative = price;
            } catch {
                return; // TWAP calculation failed, skip price update
            }
        } else {
            try this.getDragonNativeTWAP(effectiveDuration) returns (uint256 price) {
                dragonPerNative = price;
            } catch {
                return; // TWAP calculation failed, skip price update
            }
        }
        
        if (dragonPerNative == 0) return;
        
        // Get native/USD from Chainlink
        address feed = registry.getChainlinkNativeFeed(uint16(block.chainid));
        if (feed == address(0)) return;
        
        try IChainlinkFeed(feed).latestRoundData() returns (
            uint80,
            int256 nativeUSD,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (nativeUSD <= 0) return;
            if (block.timestamp - updatedAt > MAX_STALENESS) return;
            
            // Convert Chainlink 8 decimals to 18
            uint256 nativeUSD18 = uint256(nativeUSD) * 1e10;
            
            // DRAGON/USD = DRAGON/native * native/USD
            int256 dragonUSD = int256((dragonPerNative * nativeUSD18) / 1e18);
            
            // Update price
            dragonPriceUSD = dragonUSD;
            dragonPriceTimestamp = block.timestamp;
            
            emit DragonPriceUpdated(dragonUSD, block.timestamp, address(this));
        } catch {
            // Chainlink call failed, skip price update
        }
    }
    
    /**
     * @notice Calculate and update DRAGON/USD price using V4 TWAP + Chainlink
     * @param twapDuration TWAP lookback duration in seconds
     * @dev Only callable on Base (or by owner for testing)
     */
    function updateDragonPriceFromTWAP(uint32 twapDuration) external {
        require(
            block.chainid == BASE_CHAIN_ID || msg.sender == owner(),
            "Only on Base"
        );
        require(v4PoolConfigured, "V4 pool not configured");
        require(observationState.cardinality >= 2, "Need swap observations first");
        
        // Get DRAGON/native TWAP
        uint256 dragonPerNative = getDragonNativeTWAP(twapDuration);
        require(dragonPerNative > 0, "Invalid TWAP");
        
        // Get native/USD from Chainlink
        address feed = registry.getChainlinkNativeFeed(uint16(block.chainid));
        require(feed != address(0), "No Chainlink feed");
        
        (
            ,
            int256 nativeUSD,
            ,
            uint256 updatedAt,
        ) = IChainlinkFeed(feed).latestRoundData();
        
        require(nativeUSD > 0, "Invalid Chainlink price");
        require(block.timestamp - updatedAt < MAX_STALENESS, "Stale Chainlink");
        
        // Convert Chainlink 8 decimals to 18
        uint256 nativeUSD18 = uint256(nativeUSD) * 1e10;
        
        // DRAGON/USD = DRAGON/native * native/USD
        // Both in 1e18, so divide by 1e18
        int256 dragonUSD = int256((dragonPerNative * nativeUSD18) / 1e18);
        
        // Update price
        dragonPriceUSD = dragonUSD;
        dragonPriceTimestamp = block.timestamp;
        
        emit DragonPriceUpdated(dragonUSD, block.timestamp, msg.sender);
        emit TWAPPriceCalculated(int256(dragonPerNative), dragonUSD, twapDuration);
    }
    
    /**
     * @notice Broadcast DRAGON price to other chains
     * @param dstEids Destination chain EIDs
     * @param options LayerZero messaging options
     * @dev Only call from Base (source of truth)
     */
    function broadcastDragonPrice(
        uint32[] calldata dstEids,
        bytes calldata options
    ) external payable returns (MessagingReceipt[] memory receipts) {
        require(dragonPriceUSD > 0, "No price to broadcast");
        require(msg.sender == dragonToken || msg.sender == owner(), "Unauthorized");
        
        receipts = new MessagingReceipt[](dstEids.length);
        bytes memory payload = abi.encode(dragonPriceUSD, dragonPriceTimestamp);
        
        uint256 feePerChain = msg.value / dstEids.length;
        
        for (uint i = 0; i < dstEids.length; i++) {
            receipts[i] = _lzSend(
                dstEids[i],
                payload,
                options,
                MessagingFee(feePerChain, 0),
                payable(msg.sender)
            );
        }
        
        emit DragonPriceBroadcast(dstEids, dragonPriceUSD, dragonPriceTimestamp);
        
        return receipts;
    }
    
    /**
     * @notice Receive DRAGON price from Base via LayerZero
     */
    function _lzReceive(
        Origin calldata origin,
        bytes32 /*guid*/,
        bytes calldata payload,
        address /*executor*/,
        bytes calldata /*extraData*/
    ) internal override {
        // Decode price from Base
        (int256 price, uint256 timestamp) = abi.decode(payload, (int256, uint256));
        
        require(price > 0, "Invalid price");
        
        // Store Base's authoritative price
        dragonPriceUSD = price;
        dragonPriceTimestamp = timestamp;
        
        emit DragonPriceReceived(origin.srcEid, price, timestamp);
    }
}

/**
 * @notice Chainlink feed interface
 */
interface IChainlinkFeed {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}
