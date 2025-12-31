// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/v3/IUniswapV3Pool.sol";
import { TickMathCompat as TickMath } from "../libraries/TickMathCompat.sol";
import "./CharmAlphaVault.sol";

/**
 * @title CharmAlphaStrategy
 * @notice Rebalancing strategy for Charm Alpha Vault
 * @dev Adapted from Charm Finance for Solidity 0.8.20
 * 
 * Maintains two range orders:
 * 1. Base order: X - B to X + B + TS
 * 2. Limit order: Sells excess token (bid or ask)
 * 
 * Where:
 * - X = current tick (rounded to tick spacing)
 * - TS = tick spacing
 * - B = base threshold
 * - L = limit threshold
 */
contract CharmAlphaStrategy {
    CharmAlphaVault public immutable vault;
    IUniswapV3Pool public immutable pool;
    int24 public immutable tickSpacing;

    int24 public baseThreshold;
    int24 public limitThreshold;
    int24 public maxTwapDeviation;
    uint32 public twapDuration;
    address public keeper;

    uint256 public lastRebalance;
    int24 public lastTick;

    event Rebalanced(int24 tick, uint256 timestamp);

    /**
     * @param _vault Underlying Alpha Vault
     * @param _baseThreshold Used to determine base order range
     * @param _limitThreshold Used to determine limit order range
     * @param _maxTwapDeviation Max deviation from TWAP during rebalance
     * @param _twapDuration TWAP duration in seconds for rebalance check
     * @param _keeper Account that can call `rebalance()`
     */
    constructor(
        address _vault,
        int24 _baseThreshold,
        int24 _limitThreshold,
        int24 _maxTwapDeviation,
        uint32 _twapDuration,
        address _keeper
    ) {
        IUniswapV3Pool _pool = CharmAlphaVault(_vault).pool();
        int24 _tickSpacing = _pool.tickSpacing();

        vault = CharmAlphaVault(_vault);
        pool = _pool;
        tickSpacing = _tickSpacing;

        baseThreshold = _baseThreshold;
        limitThreshold = _limitThreshold;
        maxTwapDeviation = _maxTwapDeviation;
        twapDuration = _twapDuration;
        keeper = _keeper;

        _checkThreshold(_baseThreshold, _tickSpacing);
        _checkThreshold(_limitThreshold, _tickSpacing);
        require(_maxTwapDeviation > 0, "maxTwapDeviation");
        require(_twapDuration > 0, "twapDuration");

        (, lastTick, , , , , ) = _pool.slot0();
    }

    /**
     * @notice Calculates new ranges and rebalances vault
     * @dev Can only be called by keeper
     */
    function rebalance() external {
        require(msg.sender == keeper, "keeper");

        int24 _baseThreshold = baseThreshold;
        int24 _limitThreshold = limitThreshold;

        // Check price is not too extreme
        int24 tick = getTick();
        int24 maxThreshold = _baseThreshold > _limitThreshold ? _baseThreshold : _limitThreshold;
        require(tick > TickMath.MIN_TICK + maxThreshold + tickSpacing, "tick too low");
        require(tick < TickMath.MAX_TICK - maxThreshold - tickSpacing, "tick too high");

        // Check price hasn't moved too much (anti-manipulation)
        int24 twap = getTwap();
        int24 deviation = tick > twap ? tick - twap : twap - tick;
        require(deviation <= maxTwapDeviation, "maxTwapDeviation");

        int24 tickFloor = _floor(tick);
        int24 tickCeil = tickFloor + tickSpacing;

        vault.rebalance(
            0,
            0,
            tickFloor - _baseThreshold,
            tickCeil + _baseThreshold,
            tickFloor - _limitThreshold,
            tickFloor,
            tickCeil,
            tickCeil + _limitThreshold
        );

        lastRebalance = block.timestamp;
        lastTick = tick;

        emit Rebalanced(tick, block.timestamp);
    }

    /// @dev Fetches current price in ticks from Uniswap pool
    function getTick() public view returns (int24 tick) {
        (, tick, , , , , ) = pool.slot0();
    }

    /// @dev Fetches time-weighted average price in ticks
    function getTwap() public view returns (int24) {
        uint32 _twapDuration = twapDuration;
        uint32[] memory secondsAgo = new uint32[](2);
        secondsAgo[0] = _twapDuration;
        secondsAgo[1] = 0;

        (int56[] memory tickCumulatives, ) = pool.observe(secondsAgo);
        return int24((tickCumulatives[1] - tickCumulatives[0]) / int56(uint56(_twapDuration)));
    }

    /// @dev Rounds tick down to multiple of tickSpacing
    function _floor(int24 tick) internal view returns (int24) {
        int24 compressed = tick / tickSpacing;
        if (tick < 0 && tick % tickSpacing != 0) compressed--;
        return compressed * tickSpacing;
    }

    function _checkThreshold(int24 threshold, int24 _tickSpacing) internal pure {
        require(threshold > 0, "threshold > 0");
        require(threshold <= TickMath.MAX_TICK, "threshold too high");
        require(threshold % _tickSpacing == 0, "threshold % tickSpacing");
    }

    function setKeeper(address _keeper) external onlyGovernance {
        keeper = _keeper;
    }

    function setBaseThreshold(int24 _baseThreshold) external onlyGovernance {
        _checkThreshold(_baseThreshold, tickSpacing);
        baseThreshold = _baseThreshold;
    }

    function setLimitThreshold(int24 _limitThreshold) external onlyGovernance {
        _checkThreshold(_limitThreshold, tickSpacing);
        limitThreshold = _limitThreshold;
    }

    function setMaxTwapDeviation(int24 _maxTwapDeviation) external onlyGovernance {
        require(_maxTwapDeviation > 0, "maxTwapDeviation");
        maxTwapDeviation = _maxTwapDeviation;
    }

    function setTwapDuration(uint32 _twapDuration) external onlyGovernance {
        require(_twapDuration > 0, "twapDuration");
        twapDuration = _twapDuration;
    }

    /// @dev Uses same governance as underlying vault
    modifier onlyGovernance() {
        // Allow the vault itself to perform one-time initialization flows
        // (e.g., CharmAlphaVaultSimple.initializeAndTransfer calls setKeeper()).
        require(msg.sender == vault.governance() || msg.sender == address(vault), "governance");
        _;
    }
}
