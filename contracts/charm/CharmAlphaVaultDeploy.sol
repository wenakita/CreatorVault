// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CharmAlphaVault.sol";
import "../interfaces/v3/IUniswapV3Pool.sol";
import { TickMathCompat as TickMath } from "../libraries/TickMathCompat.sol";

/**
 * @title CharmAlphaVaultDeploy
 * @notice Deployment-oriented Charm Alpha Vault variant for 1-click AA setups.
 * @dev Inherits the FULL `CharmAlphaVault` implementation but embeds the rebalance logic (tick selection),
 *      so we do not deploy a separate rebalancer contract.
 *
 *      Naming intent:
 *      - This is the Charm vault we deploy as part of CreatorVault’s automated deployment flow.
 */
contract CharmAlphaVaultDeploy is CharmAlphaVault {
    bool private _initialized;

    // Embedded rebalance parameters (previously in CharmAlphaStrategy)
    int24 public baseThreshold;
    int24 public limitThreshold;
    int24 public maxTwapDeviation;
    uint32 public twapDuration;
    address public keeper;

    uint256 public lastRebalance;
    int24 public lastTick;

    event Rebalanced(int24 tick, uint256 timestamp);

    constructor(
        address _pool,
        uint256 _protocolFee,
        uint256 _maxTotalSupply,
        string memory _name,
        string memory _symbol
    ) CharmAlphaVault(_pool, _protocolFee, _maxTotalSupply, _name, _symbol) {}

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

        // Lock down CharmAlphaVault.rebalance(...) to the embedded logic only.
        strategy = address(this);

        _checkThreshold(_baseThreshold, tickSpacing);
        _checkThreshold(_limitThreshold, tickSpacing);
        require(_maxTwapDeviation > 0, "maxTwapDeviation");
        require(_twapDuration > 0, "twapDuration");

        baseThreshold = _baseThreshold;
        limitThreshold = _limitThreshold;
        maxTwapDeviation = _maxTwapDeviation;
        twapDuration = _twapDuration;

        // Temporary keeper = governance to run the initial rebalance.
        keeper = msg.sender;
        _rebalanceInternal();

        keeper = _newKeeper;

        // Single-step governance transfer (no acceptGovernance needed).
        governance = _newGovernance;
        pendingGovernance = address(0);
    }

    function rebalance() external {
        require(msg.sender == keeper, "keeper");
        _rebalanceInternal();
    }

    function getTick() public view returns (int24 tick) {
        (, tick, , , , , ) = pool.slot0();
    }

    function getTwap() public view returns (int24) {
        uint32 _twapDuration = twapDuration;
        uint32[] memory secondsAgo = new uint32[](2);
        secondsAgo[0] = _twapDuration;
        secondsAgo[1] = 0;

        // Freshly created V3 pools have no historical observations yet; `observe()` will revert
        // until at least one block has passed. During 1-click deployments we often create + initialize
        // the pool and then immediately run the first rebalance in the same transaction.
        //
        // In that case, fall back to the current tick so deviation == 0 for the initial rebalance.
        try pool.observe(secondsAgo) returns (int56[] memory tickCumulatives, uint160[] memory) {
            return int24((tickCumulatives[1] - tickCumulatives[0]) / int56(uint56(_twapDuration)));
        } catch {
            return getTick();
        }
    }

    function _rebalanceInternal() internal {
        int24 _baseThreshold = baseThreshold;
        int24 _limitThreshold = limitThreshold;

        int24 tick = getTick();
        int24 maxThreshold = _baseThreshold > _limitThreshold ? _baseThreshold : _limitThreshold;
        require(tick > TickMath.MIN_TICK + maxThreshold + tickSpacing, "tick too low");
        require(tick < TickMath.MAX_TICK - maxThreshold - tickSpacing, "tick too high");

        int24 twap = getTwap();
        int24 deviation = tick > twap ? tick - twap : twap - tick;
        require(deviation <= maxTwapDeviation, "maxTwapDeviation");

        int24 tickFloor = _floor(tick);
        int24 tickCeil = tickFloor + tickSpacing;

        // External self-call so `msg.sender == strategy` holds.
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



