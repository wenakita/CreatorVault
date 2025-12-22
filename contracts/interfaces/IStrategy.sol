// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStrategy
 * @notice Interface for yield-generating strategies used by CreatOVault
 * @dev Single-token strategy interface for Creator Coin vaults
 * 
 * @dev REQUIRED FUNCTIONS:
 *      - isActive() - Check if strategy is operational
 *      - asset() - Get the underlying token address
 *      - getTotalAssets() - Get total assets managed
 *      - deposit(amount) - Deposit tokens into strategy
 *      - withdraw(amount) - Withdraw tokens from strategy
 *      - emergencyWithdraw() - Emergency exit
 */
interface IStrategy {
    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    /**
     * @notice Check if strategy is active and ready for operations
     * @return True if strategy is active and accepting deposits
     */
    function isActive() external view returns (bool);
    
    /**
     * @notice Get the underlying asset token address
     * @return Address of the token this strategy accepts
     */
    function asset() external view returns (address);
    
    /**
     * @notice Get strategy's total value in underlying tokens
     * @return Total amount of underlying tokens managed by strategy
     */
    function getTotalAssets() external view returns (uint256);
    
    // =================================
    // STRATEGY OPERATIONS
    // =================================
    
    /**
     * @notice Deposit tokens into the strategy
     * @param amount Amount of underlying tokens to deposit
     * @return deposited Actual amount deposited (may differ due to fees/slippage)
     */
    function deposit(uint256 amount) external returns (uint256 deposited);
    
    /**
     * @notice Withdraw tokens from the strategy
     * @param amount Amount of underlying tokens to withdraw
     * @return withdrawn Actual amount withdrawn
     */
    function withdraw(uint256 amount) external returns (uint256 withdrawn);
    
    /**
     * @notice Emergency withdrawal - pull all funds immediately
     * @dev Should bypass normal withdrawal logic for emergency situations
     * @return withdrawn Total amount withdrawn
     */
    function emergencyWithdraw() external returns (uint256 withdrawn);
    
    /**
     * @notice Harvest any accumulated yields
     * @return profit Amount of profit harvested
     */
    function harvest() external returns (uint256 profit);
    
    /**
     * @notice Rebalance the strategy position if needed
     */
    function rebalance() external;
    
    // =================================
    // EVENTS
    // =================================
    
    event StrategyDeposit(address indexed from, uint256 amount, uint256 deposited);
    event StrategyWithdraw(address indexed to, uint256 amount, uint256 withdrawn);
    event StrategyHarvest(uint256 profit);
    event StrategyRebalanced(uint256 newTotalAssets);
    event EmergencyWithdraw(address indexed to, uint256 amount);
}

/**
 * @title IStrategyDual
 * @notice Interface for dual-token strategies (legacy - WLFI + USD1)
 * @dev Kept for backward compatibility with existing Eagle strategies
 */
interface IStrategyDual {
    function getTotalAmounts() external view returns (uint256 wlfiAmount, uint256 usd1Amount);
    function isInitialized() external view returns (bool);
    function deposit(uint256 wlfiAmount, uint256 usd1Amount) external returns (uint256 shares);
    function withdraw(uint256 shares) external returns (uint256 wlfiAmount, uint256 usd1Amount);
    function rebalance() external;
}
