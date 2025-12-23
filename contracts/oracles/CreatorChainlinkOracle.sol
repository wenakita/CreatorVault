// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OApp, Origin, MessagingFee, MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {ICreatorRegistry} from "../interfaces/core/ICreatorRegistry.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

/**
 * @title CreatorChainlinkOracle
 * @author 0xakita.eth (CreatorVault)
 * @notice Omnichain oracle for Creator Coin price distribution
 * @dev Deployed to same address on all chains via CREATE2
 * 
 * @dev ARCHITECTURE:
 *      Base (Hub):
 *      - Reads V4 pool TWAP (wsAKITA/ETH)
 *      - Gets ETH/USD from Chainlink
 *      - Calculates wsAKITA/USD
 *      - Broadcasts to all chains via LayerZero
 *      
 *      Remote Chains:
 *      - Receive and store Base's authoritative price
 *      - Use for lottery, gauge calculations, etc.
 *      - No local liquidity needed!
 * 
 * @dev MANIPULATION RESISTANCE:
 *      - Tick capping limits price movement per observation
 *      - Auto-tuning adjusts cap based on frequency
 *      - TWAP smooths out flash loan attacks
 *      - Chainlink provides trusted ETH/USD baseline
 * 
 * @dev USE CASES:
 *      - GaugeController: Swap slippage protection
 *      - Lottery: Fair USD value for prizes
 *      - Vault: Price impact calculations
 *      - Cross-chain: Consistent pricing everywhere
 */
contract CreatorChainlinkOracle is OApp {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    
    // ================================
    // CONSTANTS
    // ================================
    
    /// @notice Base chain ID (source of truth)
    uint256 public constant BASE_CHAIN_ID = 8453;
    
    /// @notice Staleness threshold for prices
    uint256 public constant MAX_STALENESS = 7200; // 2 hours
    
    /// @notice Default TWAP duration
    uint32 public constant DEFAULT_TWAP_DURATION = 1800; // 30 minutes
    
    /// @notice Maximum observations to store
    uint16 public constant MAX_CARDINALITY = 1024;
    
    // ================================
    // STATE - PRICE DATA
    // ================================
    
    /// @notice Creator token USD price (broadcast from Base)
    int256 public creatorPriceUSD; // 1e18 format
    uint256 public creatorPriceTimestamp;
    
    /// @notice Creator token symbol (for identification)
    string public creatorSymbol;
    
    /// @notice Chainlink ETH/USD feed address
    address public chainlinkFeed;
    
    // ================================
    // STATE - V4 POOL
    // ================================
    
    /// @notice Uniswap V4 PoolManager
    IPoolManager public poolManager;
    
    /// @notice V4 pool key for wsAKITA/ETH
    PoolKey public creatorPoolKey;
    
    /// @notice Whether V4 pool is configured
    bool public v4PoolConfigured;
    
    /// @notice Whether creator token is token0 in the pool
    bool public creatorIsToken0;
    
    // ================================
    // STATE - TWAP OBSERVATIONS
    // ================================
    
    /// @notice Observation data point
    struct Observation {
        uint32 blockTimestamp;
        int56 tickCumulative;
        int56 tickCumulativeTruncated;
        uint160 secondsPerLiquidityCumulativeX128;
        int24 prevTruncatedTick;
        bool initialized;
    }
    
    /// @notice Ring buffer of observations
    Observation[65535] public observations;
    
    /// @notice Current observation state
    struct ObservationState {
        uint16 index;
        uint16 cardinality;
        uint16 cardinalityNext;
    }
    ObservationState public observationState;
    
    /// @notice Last observation timestamp
    uint32 public lastObservationTimestamp;
    
    // ================================
    // STATE - TICK CAPPING
    // ================================
    
    /// @notice Maximum tick movement per observation (manipulation resistance)
    int24 public maxTicksPerObservation = 100; // ~1% per observation
    
    /// @notice Tick cap auto-tuning state
    struct TickCapState {
        uint64 capFrequency;
        uint48 lastCapUpdate;
        bool autoTunePaused;
    }
    TickCapState public tickCapState;
    
    /// @notice Tick cap policy
    struct TickCapPolicy {
        int24 minCap;
        int24 maxCap;
        uint32 stepBps;
        uint32 budgetPpm;
        uint32 decayWindowSec;
        uint32 updateIntervalSec;
    }
    TickCapPolicy public tickCapPolicy;
    
    // ================================
    // STATE - ACCESS CONTROL
    // ================================
    
    /// @notice Authorized swap recorders
    mapping(address => bool) public isSwapRecorder;
    
    /// @notice Authorized price updaters
    mapping(address => bool) public isPriceUpdater;
    
    /// @notice Price update cooldown (gas optimization)
    uint32 public priceUpdateCooldown = 30;
    
    /// @notice Use truncated (manipulation-resistant) tick
    bool public useTruncatedTick = true;
    
    // ================================
    // CONSTANTS - INTERNAL
    // ================================
    
    uint32 private constant PPM = 1_000_000;
    uint64 private constant ONE_DAY_PPM = 86_400 * 1_000_000;
    
    // ================================
    // EVENTS
    // ================================
    
    event CreatorPriceUpdated(string symbol, int256 price, uint256 timestamp, address indexed updater);
    event CreatorPriceBroadcast(uint32[] dstEids, int256 price, uint256 timestamp);
    event CreatorPriceReceived(uint32 srcEid, int256 price, uint256 timestamp);
    event V4PoolConfigured(PoolId indexed poolId, address poolManager, bool creatorIsToken0);
    event ObservationRecorded(uint16 index, int24 tick, int24 truncatedTick, uint32 timestamp);
    event SwapRecorderSet(address indexed recorder, bool authorized);
    event PriceUpdaterSet(address indexed updater, bool authorized);
    event MaxTicksUpdated(int24 oldMaxTicks, int24 newMaxTicks, bool autoTuned);
    event TickWasCapped(int24 rawTick, int24 truncatedTick, int24 movement);
    event ChainlinkFeedSet(address indexed feed);
    
    // ================================
    // ERRORS
    // ================================
    
    error ZeroAddress();
    error InvalidPrice();
    error Unauthorized();
    error V4NotConfigured();
    error NeedMoreObservations();
    error StalePrice();
    error InvalidDuration();
    
    // ================================
    // CONSTRUCTOR
    // ================================
    
    /**
     * @notice Deploy oracle for a Creator Coin
     * @param _registry CreatorRegistry address (same on all chains for deterministic addresses)
     * @param _chainlinkFeed Chainlink ETH/USD feed address
     * @param _creatorSymbol Creator token symbol (e.g., "wsAKITA")
     * @param _owner Owner address
     * 
     * @dev DETERMINISTIC DEPLOYMENT:
     *      Registry address is same on all chains via CREATE2.
     *      LayerZero endpoint is looked up from registry at construction.
     *      This allows same constructor args → same CREATE2 address on all chains.
     */
    constructor(
        address _registry,
        address _chainlinkFeed,
        string memory _creatorSymbol,
        address _owner
    ) OApp(ICreatorRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid)), _owner) Ownable(_owner) {
        if (_registry == address(0)) revert ZeroAddress();
        
        chainlinkFeed = _chainlinkFeed;
        creatorSymbol = _creatorSymbol;
        
        // Initialize tick cap policy with sensible defaults
        tickCapPolicy = TickCapPolicy({
            minCap: 10,           // ~0.1% movement
            maxCap: 500,          // ~5% movement
            stepBps: 500,         // 5% adjustment per step
            budgetPpm: 10000,     // Target 1% of observations hit cap
            decayWindowSec: 3600, // 1 hour decay
            updateIntervalSec: 60 // Min 1 minute between adjustments
        });
    }
    
    // ================================
    // ADMIN - CONFIGURATION
    // ================================
    
    /**
     * @notice Set Chainlink ETH/USD feed
     * @param _feed Chainlink feed address
     */
    function setChainlinkFeed(address _feed) external onlyOwner {
        chainlinkFeed = _feed;
        emit ChainlinkFeedSet(_feed);
    }
    
    /**
     * @notice Configure V4 pool for TWAP observations
     * @param _poolManager Uniswap V4 PoolManager
     * @param _poolKey Pool key for wsAKITA/ETH
     * @param _creatorIsToken0 Whether creator token is currency0
     */
    function setV4Pool(
        address _poolManager,
        PoolKey calldata _poolKey,
        bool _creatorIsToken0
    ) external onlyOwner {
        if (_poolManager == address(0)) revert ZeroAddress();
        
        poolManager = IPoolManager(_poolManager);
        creatorPoolKey = _poolKey;
        creatorIsToken0 = _creatorIsToken0;
        v4PoolConfigured = true;
        
        // Get initial tick
        PoolId poolId = _poolKey.toId();
        (, int24 tick, ,) = poolManager.getSlot0(poolId);
        
        // Initialize first observation
        observations[0] = Observation({
            blockTimestamp: uint32(block.timestamp),
            tickCumulative: 0,
            tickCumulativeTruncated: 0,
            secondsPerLiquidityCumulativeX128: 0,
            prevTruncatedTick: tick,
            initialized: true
        });
        
        observationState = ObservationState({
            index: 0,
            cardinality: 1,
            cardinalityNext: 1
        });
        
        lastObservationTimestamp = uint32(block.timestamp);
        tickCapState.lastCapUpdate = uint48(block.timestamp);
        
        emit V4PoolConfigured(poolId, _poolManager, _creatorIsToken0);
    }
    
    /**
     * @notice Set authorized swap recorder
     * @param recorder Address that can record observations
     * @param authorized Whether to authorize
     */
    function setSwapRecorder(address recorder, bool authorized) external onlyOwner {
        if (recorder == address(0)) revert ZeroAddress();
        isSwapRecorder[recorder] = authorized;
        emit SwapRecorderSet(recorder, authorized);
    }
    
    /**
     * @notice Set authorized price updater
     * @param updater Address that can update price
     * @param authorized Whether to authorize
     */
    function setPriceUpdater(address updater, bool authorized) external onlyOwner {
        if (updater == address(0)) revert ZeroAddress();
        isPriceUpdater[updater] = authorized;
        emit PriceUpdaterSet(updater, authorized);
    }
    
    /**
     * @notice Set maximum tick movement per observation
     * @param _maxTicks Maximum allowed tick movement
     */
    function setMaxTicksPerObservation(int24 _maxTicks) external onlyOwner {
        require(_maxTicks >= 0 && _maxTicks <= 1000, "Invalid range");
        int24 oldMax = maxTicksPerObservation;
        maxTicksPerObservation = _maxTicks;
        emit MaxTicksUpdated(oldMax, _maxTicks, false);
    }
    
    /**
     * @notice Set tick cap policy
     */
    function setTickCapPolicy(
        int24 _minCap,
        int24 _maxCap,
        uint32 _stepBps,
        uint32 _budgetPpm
    ) external onlyOwner {
        require(_minCap > 0 && _maxCap > _minCap, "Invalid range");
        require(_stepBps > 0 && _stepBps <= 10000, "Invalid step");
        require(_budgetPpm > 0 && _budgetPpm <= PPM, "Invalid budget");
        
        tickCapPolicy.minCap = _minCap;
        tickCapPolicy.maxCap = _maxCap;
        tickCapPolicy.stepBps = _stepBps;
        tickCapPolicy.budgetPpm = _budgetPpm;
    }
    
    /**
     * @notice Pause/unpause auto-tuning
     */
    function setAutoTunePaused(bool paused) external onlyOwner {
        tickCapState.autoTunePaused = paused;
    }
    
    /**
     * @notice Set price update cooldown
     */
    function setPriceUpdateCooldown(uint32 cooldown) external onlyOwner {
        require(cooldown <= 300, "Max 5 minutes");
        priceUpdateCooldown = cooldown;
    }
    
    /**
     * @notice Set whether to use truncated tick
     */
    function setUseTruncatedTick(bool _use) external onlyOwner {
        useTruncatedTick = _use;
    }
    
    // ================================
    // PRICE READING
    // ================================
    
    /**
     * @notice Get ETH/USD price from Chainlink
     * @return price Price in 1e18 format
     * @return timestamp Last update timestamp
     */
    function getEthPrice() external view returns (int256 price, uint256 timestamp) {
        if (chainlinkFeed == address(0)) return (0, 0);
        
        (
            ,
            int256 answer,
            ,
            uint256 updatedAt,
        ) = IChainlinkFeed(chainlinkFeed).latestRoundData();
        
        if (answer <= 0) return (0, 0);
        if (block.timestamp - updatedAt > MAX_STALENESS) return (0, 0);
        
        // Chainlink 8 decimals → 18 decimals
        price = answer * 1e10;
        timestamp = updatedAt;
    }
    
    /**
     * @notice Get Creator token USD price
     * @return price Price in 1e18 format
     * @return timestamp Last update timestamp
     */
    function getCreatorPrice() external view returns (int256 price, uint256 timestamp) {
        if (creatorPriceUSD > 0 && creatorPriceTimestamp > 0) {
            if (block.timestamp - creatorPriceTimestamp < MAX_STALENESS) {
                return (creatorPriceUSD, creatorPriceTimestamp);
            }
        }
        return (0, 0);
    }
    
    /**
     * @notice Update creator price (authorized callers only)
     * @param _price Price in 1e18 format
     */
    function updateCreatorPrice(int256 _price) external {
        if (!isPriceUpdater[msg.sender] && msg.sender != owner()) {
            revert Unauthorized();
        }
        if (_price <= 0) revert InvalidPrice();
        
        creatorPriceUSD = _price;
        creatorPriceTimestamp = block.timestamp;
        
        emit CreatorPriceUpdated(creatorSymbol, _price, block.timestamp, msg.sender);
    }
    
    // ================================
    // TWAP - OBSERVATION RECORDING
    // ================================
    
    /**
     * @notice Record observation on swap
     * @dev Called by authorized recorders during swaps
     */
    function recordSwapObservation() external {
        if (!isSwapRecorder[msg.sender]) revert Unauthorized();
        if (!v4PoolConfigured) revert V4NotConfigured();
        
        bool tickWasCapped = _recordObservation();
        
        // Update cap frequency and auto-tune
        if (!tickCapState.autoTunePaused) {
            _updateCapFrequency(tickWasCapped);
        }
        
        // Only calculate price on Base
        if (block.chainid == BASE_CHAIN_ID && observationState.cardinality >= 2) {
            try this._updatePriceFromTWAPExternal() {} catch {}
        }
    }
    
    /**
     * @notice External wrapper for try/catch
     */
    function _updatePriceFromTWAPExternal() external {
        require(msg.sender == address(this), "Only self");
        _updatePriceFromTWAP();
    }
    
    /**
     * @notice Internal observation recording
     */
    function _recordObservation() internal returns (bool tickWasCapped) {
        if (!v4PoolConfigured) return false;
        
        PoolId poolId = creatorPoolKey.toId();
        (, int24 tick, ,) = poolManager.getSlot0(poolId);
        uint128 liquidity = poolManager.getLiquidity(poolId);
        
        // Get previous observation
        Observation storage prevObs = observations[observationState.index];
        int24 prevTick = prevObs.prevTruncatedTick;
        
        // Calculate tick movement
        int24 movement = tick - prevTick;
        int24 truncatedTick = tick;
        
        // Apply tick capping
        if (maxTicksPerObservation > 0) {
            if (movement > maxTicksPerObservation) {
                truncatedTick = prevTick + maxTicksPerObservation;
                tickWasCapped = true;
            } else if (movement < -maxTicksPerObservation) {
                truncatedTick = prevTick - maxTicksPerObservation;
                tickWasCapped = true;
            }
        }
        
        if (tickWasCapped) {
            emit TickWasCapped(tick, truncatedTick, movement);
        }
        
        // Calculate time delta
        uint32 delta = uint32(block.timestamp) - prevObs.blockTimestamp;
        if (delta == 0) return tickWasCapped; // Same block, skip
        
        // Calculate new cumulatives
        int56 newTickCumulative = prevObs.tickCumulative + int56(tick) * int56(int32(delta));
        int56 newTickCumulativeTruncated = prevObs.tickCumulativeTruncated + int56(truncatedTick) * int56(int32(delta));
        
        uint160 newSecondsPerLiquidity = prevObs.secondsPerLiquidityCumulativeX128;
        if (liquidity > 0) {
            newSecondsPerLiquidity += uint160(delta) << 128 / liquidity;
        }
        
        // Grow cardinality if needed
        uint16 newIndex = (observationState.index + 1) % observationState.cardinalityNext;
        if (observationState.cardinalityNext < MAX_CARDINALITY) {
            observationState.cardinalityNext++;
        }
        
        // Write new observation
        observations[newIndex] = Observation({
            blockTimestamp: uint32(block.timestamp),
            tickCumulative: newTickCumulative,
            tickCumulativeTruncated: newTickCumulativeTruncated,
            secondsPerLiquidityCumulativeX128: newSecondsPerLiquidity,
            prevTruncatedTick: truncatedTick,
            initialized: true
        });
        
        observationState.index = newIndex;
        if (observationState.cardinality < observationState.cardinalityNext) {
            observationState.cardinality++;
        }
        lastObservationTimestamp = uint32(block.timestamp);
        
        emit ObservationRecorded(newIndex, tick, truncatedTick, uint32(block.timestamp));
    }
    
    /**
     * @notice Update cap frequency and auto-tune
     */
    function _updateCapFrequency(bool capOccurred) internal {
        uint32 nowTs = uint32(block.timestamp);
        uint32 lastTs = uint32(tickCapState.lastCapUpdate);
        uint32 elapsed = nowTs - lastTs;
        
        if (!capOccurred && elapsed == 0) return;
        
        tickCapState.lastCapUpdate = uint48(nowTs);
        uint64 currentFreq = tickCapState.capFrequency;
        
        // Add cap contribution
        if (capOccurred) {
            unchecked { currentFreq += ONE_DAY_PPM; }
            if (currentFreq < ONE_DAY_PPM) {
                currentFreq = type(uint64).max - ONE_DAY_PPM + 1;
            }
        }
        
        // Apply decay
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
        
        // Auto-tune
        if (elapsed >= tickCapPolicy.updateIntervalSec) {
            _autoTuneTickCap(currentFreq);
        }
    }
    
    /**
     * @notice Auto-tune tick cap
     */
    function _autoTuneTickCap(uint64 currentFreq) internal {
        uint64 targetFreq = uint64(tickCapPolicy.budgetPpm) * uint64(tickCapPolicy.decayWindowSec);
        
        int24 currentCap = maxTicksPerObservation;
        uint256 capAbs = currentCap >= 0 ? uint256(uint24(currentCap)) : uint256(uint24(-currentCap));
        int24 change = int24(int256(capAbs * uint256(tickCapPolicy.stepBps) / 10000));
        if (change == 0) change = 1;
        
        int24 newCap;
        if (currentFreq > targetFreq) {
            // Too many caps → loosen
            newCap = currentCap + change;
            if (newCap > tickCapPolicy.maxCap) newCap = tickCapPolicy.maxCap;
        } else {
            // Too few caps → tighten
            newCap = currentCap - change;
            if (newCap < tickCapPolicy.minCap) newCap = tickCapPolicy.minCap;
        }
        
        if (newCap != currentCap) {
            maxTicksPerObservation = newCap;
            emit MaxTicksUpdated(currentCap, newCap, true);
        }
    }
    
    // ================================
    // TWAP - PRICE CALCULATION
    // ================================
    
    /**
     * @notice Get current tick from V4 pool
     */
    function getCurrentTick() external view returns (int24 tick) {
        if (!v4PoolConfigured) revert V4NotConfigured();
        PoolId poolId = creatorPoolKey.toId();
        (, tick, ,) = poolManager.getSlot0(poolId);
    }
    
    /**
     * @notice Calculate TWAP tick
     * @param duration Lookback duration in seconds
     */
    function getTWAPTick(uint32 duration) public view returns (int24 twapTick) {
        if (observationState.cardinality < 2) revert NeedMoreObservations();
        if (duration == 0) revert InvalidDuration();
        
        uint16 currentIndex = observationState.index;
        Observation storage currentObs = observations[currentIndex];
        
        // Find oldest observation within duration
        uint32 targetTime = uint32(block.timestamp) - duration;
        uint16 oldIndex = _findObservationBefore(targetTime);
        
        Observation storage oldObs = observations[oldIndex];
        
        uint32 timeDelta = currentObs.blockTimestamp - oldObs.blockTimestamp;
        if (timeDelta == 0) revert NeedMoreObservations();
        
        int56 tickCumulativeDelta = useTruncatedTick 
            ? currentObs.tickCumulativeTruncated - oldObs.tickCumulativeTruncated
            : currentObs.tickCumulative - oldObs.tickCumulative;
        
        twapTick = int24(tickCumulativeDelta / int56(int32(timeDelta)));
    }
    
    /**
     * @notice Find observation before target time
     */
    function _findObservationBefore(uint32 targetTime) internal view returns (uint16) {
        uint16 currentIndex = observationState.index;
        uint16 cardinality = observationState.cardinality;
        
        // Binary search through observations
        for (uint16 i = 0; i < cardinality; i++) {
            uint16 checkIndex = (currentIndex + cardinality - i) % cardinality;
            if (observations[checkIndex].blockTimestamp <= targetTime) {
                return checkIndex;
            }
        }
        
        // Return oldest if none found
        return (currentIndex + 1) % cardinality;
    }
    
    /**
     * @notice Convert tick to price
     * @param tick The tick value
     * @return price Price in 1e18 format
     */
    function tickToPrice(int24 tick) public view returns (uint256 price) {
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(tick);
        uint256 sqrtPrice = uint256(sqrtPriceX96);
        
        // price = (sqrtPrice / 2^96)^2 in 1e18
        price = (sqrtPrice * sqrtPrice * 1e18) >> 192;
        
        // Invert if creator is token0
        if (creatorIsToken0 && price > 0) {
            price = (1e18 * 1e18) / price;
        }
    }
    
    /**
     * @notice Get Creator/ETH TWAP price
     * @param duration TWAP duration in seconds
     * @return price Creator per ETH in 1e18
     */
    function getCreatorEthTWAP(uint32 duration) public view returns (uint256 price) {
        int24 twapTick = getTWAPTick(duration);
        price = tickToPrice(twapTick);
    }
    
    /**
     * @notice Internal: Update price from TWAP
     */
    function _updatePriceFromTWAP() internal {
        // Rate limit
        if (block.timestamp - creatorPriceTimestamp < priceUpdateCooldown) return;
        if (observationState.cardinality < 2) return;
        
        // Calculate effective duration
        uint16 prevIndex = observationState.index == 0 
            ? observationState.cardinality - 1 
            : observationState.index - 1;
        uint32 oldestTs = observations[prevIndex].blockTimestamp;
        if (oldestTs == 0) return;
        
        uint32 effectiveDuration = uint32(block.timestamp) - oldestTs;
        if (effectiveDuration > DEFAULT_TWAP_DURATION) {
            effectiveDuration = DEFAULT_TWAP_DURATION;
        }
        if (effectiveDuration < 60) {
            effectiveDuration = 60;
        }
        
        // Get Creator/ETH TWAP
        uint256 creatorPerEth;
        try this.getCreatorEthTWAP(effectiveDuration) returns (uint256 price) {
            creatorPerEth = price;
        } catch {
            return;
        }
        
        if (creatorPerEth == 0) return;
        
        // Get ETH/USD from Chainlink
        if (chainlinkFeed == address(0)) return;
        
        try IChainlinkFeed(chainlinkFeed).latestRoundData() returns (
            uint80,
            int256 ethUSD,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            if (ethUSD <= 0) return;
            if (block.timestamp - updatedAt > MAX_STALENESS) return;
            
            // Convert Chainlink 8 decimals to 18
            uint256 ethUSD18 = uint256(ethUSD) * 1e10;
            
            // Creator/USD = Creator/ETH * ETH/USD
            int256 creatorUSD = int256((creatorPerEth * ethUSD18) / 1e18);
            
            creatorPriceUSD = creatorUSD;
            creatorPriceTimestamp = block.timestamp;
            
            emit CreatorPriceUpdated(creatorSymbol, creatorUSD, block.timestamp, address(this));
        } catch {
            // Chainlink failed, skip
        }
    }
    
    /**
     * @notice Manually update price from TWAP
     * @param twapDuration TWAP duration in seconds
     */
    function updateCreatorPriceFromTWAP(uint32 twapDuration) external {
        if (block.chainid != BASE_CHAIN_ID && msg.sender != owner()) {
            revert Unauthorized();
        }
        if (!v4PoolConfigured) revert V4NotConfigured();
        if (observationState.cardinality < 2) revert NeedMoreObservations();
        
        uint256 creatorPerEth = getCreatorEthTWAP(twapDuration);
        if (creatorPerEth == 0) revert InvalidPrice();
        
        if (chainlinkFeed == address(0)) revert ZeroAddress();
        
        (
            ,
            int256 ethUSD,
            ,
            uint256 updatedAt,
        ) = IChainlinkFeed(chainlinkFeed).latestRoundData();
        
        if (ethUSD <= 0) revert InvalidPrice();
        if (block.timestamp - updatedAt > MAX_STALENESS) revert StalePrice();
        
        uint256 ethUSD18 = uint256(ethUSD) * 1e10;
        int256 creatorUSD = int256((creatorPerEth * ethUSD18) / 1e18);
        
        creatorPriceUSD = creatorUSD;
        creatorPriceTimestamp = block.timestamp;
        
        emit CreatorPriceUpdated(creatorSymbol, creatorUSD, block.timestamp, msg.sender);
    }
    
    // ================================
    // LAYERZERO - CROSS-CHAIN
    // ================================
    
    /**
     * @notice Broadcast price to other chains
     * @param dstEids Destination chain EIDs
     * @param options LayerZero options
     */
    function broadcastCreatorPrice(
        uint32[] calldata dstEids,
        bytes calldata options
    ) external payable returns (MessagingReceipt[] memory receipts) {
        if (creatorPriceUSD <= 0) revert InvalidPrice();
        if (!isPriceUpdater[msg.sender] && msg.sender != owner()) revert Unauthorized();
        
        receipts = new MessagingReceipt[](dstEids.length);
        bytes memory payload = abi.encode(creatorPriceUSD, creatorPriceTimestamp, creatorSymbol);
        
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
        
        emit CreatorPriceBroadcast(dstEids, creatorPriceUSD, creatorPriceTimestamp);
    }
    
    /**
     * @notice Receive price from Base
     */
    function _lzReceive(
        Origin calldata origin,
        bytes32,
        bytes calldata payload,
        address,
        bytes calldata
    ) internal override {
        (int256 price, uint256 timestamp, string memory symbol) = abi.decode(
            payload, 
            (int256, uint256, string)
        );
        
        if (price <= 0) revert InvalidPrice();
        
        creatorPriceUSD = price;
        creatorPriceTimestamp = timestamp;
        
        // Update symbol if different (for multi-creator support)
        if (bytes(symbol).length > 0) {
            creatorSymbol = symbol;
        }
        
        emit CreatorPriceReceived(origin.srcEid, price, timestamp);
    }
    
    // ================================
    // VIEW FUNCTIONS
    // ================================
    
    /**
     * @notice Get observation state
     */
    function getObservationState() external view returns (
        uint16 index,
        uint16 cardinality,
        uint16 cardinalityNext,
        uint32 lastTimestamp
    ) {
        return (
            observationState.index,
            observationState.cardinality,
            observationState.cardinalityNext,
            lastObservationTimestamp
        );
    }
    
    /**
     * @notice Get tick cap state
     */
    function getTickCapState() external view returns (
        int24 currentCap,
        uint64 capFrequency,
        bool autoTunePaused
    ) {
        return (
            maxTicksPerObservation,
            tickCapState.capFrequency,
            tickCapState.autoTunePaused
        );
    }
    
    /**
     * @notice Check if price is fresh
     */
    function isPriceFresh() external view returns (bool) {
        return creatorPriceUSD > 0 && 
               block.timestamp - creatorPriceTimestamp < MAX_STALENESS;
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


