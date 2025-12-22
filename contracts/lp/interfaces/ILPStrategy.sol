// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILPStrategy
 * @notice Interface for LP strategies used by CreatorLPManager
 * @dev All LP strategies must implement this interface
 */
interface ILPStrategy {
    // =================================
    // TYPES
    // =================================
    
    enum StrategyType {
        FullRange,
        LimitOrder,
        Concentrated
    }
    
    // =================================
    // MAIN OPERATIONS
    // =================================
    
    /**
     * @notice Deposit tokens and create/add to LP position
     * @param creatorCoinAmount Amount of creator coin to deposit
     * @param pairedAmount Amount of paired token (WETH) to deposit
     * @return liquidity Amount of liquidity minted/added
     */
    function deposit(
        uint256 creatorCoinAmount,
        uint256 pairedAmount
    ) external returns (uint256 liquidity);
    
    /**
     * @notice Withdraw liquidity from position
     * @param liquidity Amount of liquidity to withdraw
     * @return creatorCoinAmount Amount of creator coin returned
     * @return pairedAmount Amount of paired token returned
     */
    function withdraw(
        uint256 liquidity
    ) external returns (uint256 creatorCoinAmount, uint256 pairedAmount);
    
    /**
     * @notice Withdraw all liquidity from position
     * @return creatorCoinAmount Total creator coin withdrawn
     * @return pairedAmount Total paired token withdrawn
     */
    function withdrawAll() external returns (uint256 creatorCoinAmount, uint256 pairedAmount);
    
    /**
     * @notice Rebalance the LP position
     * @dev For full range: collect fees
     * @dev For limit order: reposition to maintain tick offset
     * @dev For concentrated: adjust tick range based on price
     */
    function rebalance() external;
    
    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    /**
     * @notice Get total value held in the strategy
     * @return creatorCoinValue Value in creator coin terms
     * @return pairedValue Value in paired token terms
     */
    function getTotalValue() external view returns (uint256 creatorCoinValue, uint256 pairedValue);
    
    /**
     * @notice Get current liquidity in position
     * @return Current liquidity amount
     */
    function getLiquidity() external view returns (uint256);
    
    /**
     * @notice Check if strategy is active
     * @return True if strategy is accepting deposits
     */
    function isActive() external view returns (bool);
    
    /**
     * @notice Get strategy type
     * @return The type of this strategy
     */
    function strategyType() external pure returns (StrategyType);
}

/**
 * @title ILPStrategyExtended
 * @notice Extended interface with additional view functions
 */
interface ILPStrategyExtended is ILPStrategy {
    /**
     * @notice Get the tick range for this position
     * @return lower Lower tick bound
     * @return upper Upper tick bound
     */
    function getTickRange() external view returns (int24 lower, int24 upper);
    
    /**
     * @notice Check if rebalance is needed
     * @return True if rebalance should be called
     */
    function needsRebalance() external view returns (bool);
    
    /**
     * @notice Get accumulated fees
     * @return fees0 Fees in token0
     * @return fees1 Fees in token1
     */
    function getAccumulatedFees() external view returns (uint256 fees0, uint256 fees1);
}


