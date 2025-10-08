// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SimpleCharmStrategy
 * @notice Simplified strategy that deposits into existing Charm vault (MEAGLE)
 * @dev Connects EagleOVault to an existing Charm Alpha Vault
 * 
 * ARCHITECTURE:
 *   EagleOVault → SimpleCharmStrategy → Charm Alpha Vault (MEAGLE) → Uniswap V3
 * 
 * KEY POINTS:
 *   - Uses EXISTING Charm vault (doesn't create new one)
 *   - Receives WLFI + USD1 from EagleOVault
 *   - Deposits into Charm, receives MEAGLE shares
 *   - Strategy holds MEAGLE, users hold EAGLE
 */
interface ICharmVault {
    function deposit(
        uint256 amount0Desired,
        uint256 amount1Desired,
        uint256 amount0Min,
        uint256 amount1Min,
        address recipient
    ) external returns (uint256 shares, uint256 amount0Used, uint256 amount1Used);
    
    function withdraw(
        uint256 shares,
        uint256 amount0Min,
        uint256 amount1Min,
        address recipient
    ) external returns (uint256 amount0, uint256 amount1);
    
    function balanceOf(address account) external view returns (uint256);
    function getTotalAmounts() external view returns (uint256 total0, uint256 total1);
    function totalSupply() external view returns (uint256);
}

contract SimpleCharmStrategy is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // =================================
    // IMMUTABLES
    // =================================
    
    address public immutable EAGLE_VAULT;
    ICharmVault public immutable CHARM_VAULT; // MEAGLE contract
    IERC20 public immutable WLFI;
    IERC20 public immutable USD1;
    
    // =================================
    // STATE
    // =================================
    
    bool public active = true;
    uint256 public maxSlippage = 500; // 5%
    
    // =================================
    // EVENTS
    // =================================
    
    event StrategyDeposit(uint256 wlfiAmount, uint256 usd1Amount, uint256 meagleShares);
    event StrategyWithdraw(uint256 meagleShares, uint256 wlfiAmount, uint256 usd1Amount);
    
    // =================================
    // CONSTRUCTOR
    // =================================
    
    /**
     * @param _vaultAddress EagleOVault address
     * @param _charmVault Existing Charm Alpha Vault address (MEAGLE)
     * @param _wlfi WLFI token address
     * @param _usd1 USD1 token address
     */
    constructor(
        address _vaultAddress,
        address _charmVault,
        address _wlfi,
        address _usd1
    ) {
        require(_vaultAddress != address(0), "Zero vault");
        require(_charmVault != address(0), "Zero charm");
        
        EAGLE_VAULT = _vaultAddress;
        CHARM_VAULT = ICharmVault(_charmVault);
        WLFI = IERC20(_wlfi);
        USD1 = IERC20(_usd1);
    }
    
    // =================================
    // STRATEGY FUNCTIONS (IStrategy interface)
    // =================================
    
    /**
     * @notice Deposit WLFI + USD1 into Charm vault
     * @dev Only callable by EagleOVault
     * @param wlfiAmount Amount of WLFI to deposit
     * @param usd1Amount Amount of USD1 to deposit
     * @return shares MEAGLE shares received (for tracking)
     */
    function deposit(uint256 wlfiAmount, uint256 usd1Amount) 
        external 
        nonReentrant
        returns (uint256 shares) 
    {
        require(msg.sender == EAGLE_VAULT, "Only vault");
        require(active, "Strategy paused");
        
        if (wlfiAmount == 0 && usd1Amount == 0) return 0;
        
        // Transfer tokens from EagleOVault to this strategy
        if (wlfiAmount > 0) {
            WLFI.safeTransferFrom(EAGLE_VAULT, address(this), wlfiAmount);
        }
        if (usd1Amount > 0) {
            USD1.safeTransferFrom(EAGLE_VAULT, address(this), usd1Amount);
        }
        
        // Approve Charm vault to spend our tokens
        if (wlfiAmount > 0) {
            WLFI.safeIncreaseAllowance(address(CHARM_VAULT), wlfiAmount);
        }
        if (usd1Amount > 0) {
            USD1.safeIncreaseAllowance(address(CHARM_VAULT), usd1Amount);
        }
        
        // Calculate minimum amounts (slippage protection)
        // NOTE: Setting to 0 for flexibility since Charm vault might not use all tokens
        // In production, you may want to check Charm's current ratio first
        uint256 amount0Min = 0;  // Accept any amount used
        uint256 amount1Min = 0;  // Accept any amount used
        
        // Deposit into Charm Alpha Vault (MEAGLE)
        // This gives us MEAGLE shares representing our LP position
        (shares, , ) = CHARM_VAULT.deposit(
            wlfiAmount,
            usd1Amount,
            amount0Min,
            amount1Min,
            address(this)  // Strategy receives MEAGLE shares
        );
        
        emit StrategyDeposit(wlfiAmount, usd1Amount, shares);
    }
    
    /**
     * @notice Withdraw from Charm vault
     * @param value Approximate value to withdraw (used to calculate MEAGLE shares)
     * @return wlfiAmount WLFI withdrawn
     * @return usd1Amount USD1 withdrawn
     */
    function withdraw(uint256 value) 
        external 
        nonReentrant 
        returns (uint256 wlfiAmount, uint256 usd1Amount) 
    {
        require(msg.sender == EAGLE_VAULT, "Only vault");
        
        if (value == 0) return (0, 0);
        
        // Get our MEAGLE balance
        uint256 ourMeagleShares = CHARM_VAULT.balanceOf(address(this));
        if (ourMeagleShares == 0) return (0, 0);
        
        // Calculate how many MEAGLE shares to withdraw
        (uint256 totalWlfi, uint256 totalUsd1) = getTotalAmounts();
        uint256 totalValue = totalWlfi + totalUsd1;
        
        uint256 sharesToWithdraw;
        if (value >= totalValue) {
            sharesToWithdraw = ourMeagleShares; // Withdraw all
        } else {
            sharesToWithdraw = (ourMeagleShares * value) / totalValue;
        }
        
        // Withdraw from Charm
        (wlfiAmount, usd1Amount) = CHARM_VAULT.withdraw(
            sharesToWithdraw,
            0,  // Accept any amount (could add slippage protection)
            0,
            EAGLE_VAULT  // Send tokens directly back to vault
        );
        
        emit StrategyWithdraw(sharesToWithdraw, wlfiAmount, usd1Amount);
    }
    
    /**
     * @notice Get strategy's total holdings
     * @return wlfiAmount Total WLFI managed
     * @return usd1Amount Total USD1 managed
     */
    function getTotalAmounts() public view returns (uint256 wlfiAmount, uint256 usd1Amount) {
        uint256 ourShares = CHARM_VAULT.balanceOf(address(this));
        if (ourShares == 0) return (0, 0);
        
        // Get Charm vault's total holdings
        (uint256 total0, uint256 total1) = CHARM_VAULT.getTotalAmounts();
        uint256 totalShares = CHARM_VAULT.totalSupply();
        
        // Calculate our proportional share
        wlfiAmount = (total0 * ourShares) / totalShares;
        usd1Amount = (total1 * ourShares) / totalShares;
    }
    
    /**
     * @notice Check if strategy is ready
     */
    function isInitialized() external view returns (bool) {
        return active;
    }
    
    /**
     * @notice Rebalance (Charm handles this internally)
     */
    function rebalance() external {
        require(msg.sender == EAGLE_VAULT, "Only vault");
        // Charm auto-rebalances, nothing to do
    }
    
    /**
     * @notice Get our MEAGLE share balance
     */
    function getMeagleBalance() external view returns (uint256) {
        return CHARM_VAULT.balanceOf(address(this));
    }
}

