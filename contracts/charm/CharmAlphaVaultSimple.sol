// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CharmAlphaVault.sol";
import "../interfaces/v3/IUniswapV3Pool.sol";
import { TickMathCompat as TickMath } from "../libraries/TickMathCompat.sol";

/**
 * @title CharmAlphaVaultSimple
 * @notice Simplified version of CharmAlphaVault with single-step governance transfer
 * @dev IMPORTANT:
 *      - This is still the FULL Charm vault implementation because it **inherits `CharmAlphaVault`**.
 *      - The only behavioral difference is an optional one-time initializer to atomically set strategy + rebalance
 *        and hand governance/keeper to the final owner without a separate `acceptGovernance()` transaction.
 *
 *      If you want the canonical CharmAlphaVault bytecode deployed directly (and are OK with the extra
 *      `acceptGovernance()` step), use `StrategyDeploymentBatcher.batchDeployStrategiesFullCharmVault(...)`.
 * 
 * Changes from original:
 * - One-time initializer for atomic strategy setup + governance transfer
 * - Governance transferred in single step (no acceptance needed)
 * - Perfect for automated deployment flows
 */
contract CharmAlphaVaultSimple is CharmAlphaVault {
    
    bool private _initialized;

    // ─────────────────────────────────────────────────────────────────────────────
    // Embedded "CharmAlphaStrategy" logic (so Atomic deploy path doesn't need a
    // separate CharmAlphaStrategy deployment).
    // ─────────────────────────────────────────────────────────────────────────────
    int24 public baseThreshold;
    int24 public limitThreshold;
    int24 public maxTwapDeviation;
    uint32 public twapDuration;
    address public keeper;

    uint256 public lastRebalance;
    int24 public lastTick;

    event Rebalanced(int24 tick, uint256 timestamp);
    
    /**
     * @notice Deploy a CharmAlphaVault (governance = deployer initially)
     * @param _pool Underlying Uniswap V3 pool
     * @param _protocolFee Protocol fee (e.g., 10000 = 1%)
     * @param _maxTotalSupply Maximum supply cap
     * @param _name Token name (e.g., "CreatorVault: akita/USDC")
     * @param _symbol Token symbol (e.g., "CV-akita-USDC")
     */
    constructor(
        address _pool,
        uint256 _protocolFee,
        uint256 _maxTotalSupply,
        string memory _name,
        string memory _symbol
    ) CharmAlphaVault(_pool, _protocolFee, _maxTotalSupply, _name, _symbol) {
        // governance = msg.sender (batcher) from parent constructor
    }
    
    /**
     * @notice Initialize embedded strategy params, do an initial rebalance, and transfer governance/keeper atomically
     * @dev Can only be called once by the deployer (governance)
     * @param _newGovernance The final governance address (creator)
     * @param _newKeeper The keeper allowed to call `rebalance()` (usually same as _newGovernance)
     */
    function initializeAndTransfer(
        address _newGovernance,
        address _newKeeper,
        int24 _baseThreshold,
        int24 _limitThreshold,
        int24 _maxTwapDeviation,
        uint32 _twapDuration
    ) external onlyGovernance {
        require(!_initialized, "Already initialized");
        require(_newGovernance != address(0), "Invalid governance");
        require(_newKeeper != address(0), "Invalid keeper");
        
        _initialized = true;

        // Set this contract as the strategy (so only self-calls can hit `CharmAlphaVault.rebalance(...)`)
        strategy = address(this);

        // Configure embedded rebalance params
        _checkThreshold(_baseThreshold, tickSpacing);
        _checkThreshold(_limitThreshold, tickSpacing);
        require(_maxTwapDeviation > 0, "maxTwapDeviation");
        require(_twapDuration > 0, "twapDuration");

        baseThreshold = _baseThreshold;
        limitThreshold = _limitThreshold;
        maxTwapDeviation = _maxTwapDeviation;
        twapDuration = _twapDuration;

        // Set temporary keeper to governance for the initial rebalance
        keeper = msg.sender;
        _rebalanceInternal();

        // Transfer keeper to creator
        keeper = _newKeeper;
        
        // Transfer governance in single step (no acceptance needed)
        governance = _newGovernance;
        pendingGovernance = address(0); // Clear pending
    }

    /**
     * @notice Calculates new ranges and rebalances the vault
     * @dev Keeper-only
     */
    function rebalance() external {
        require(msg.sender == keeper, "keeper");
        _rebalanceInternal();
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

    function _rebalanceInternal() internal {
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

        // Call the underlying CharmAlphaVault.rebalance(...) via an external self-call
        // so that `msg.sender == strategy` holds (strategy == address(this)).
        this.rebalance(
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
}
