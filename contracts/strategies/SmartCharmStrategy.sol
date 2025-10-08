// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ISwapRouter } from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

/**
 * @title SmartCharmStrategy
 * @notice SMART strategy that auto-rebalances to match Charm vault's needs
 * @dev Key feature: Checks Charm's current ratio and swaps tokens to match BEFORE depositing!
 * 
 * FLOW:
 * 1. Receive WLFI + USD1 from EagleOVault
 * 2. Check Charm vault's current ratio (e.g., 92% WLFI / 8% USD1)
 * 3. Swap tokens to match that ratio using Uniswap
 * 4. Deposit matched amounts to Charm
 * 5. Receive MEAGLE shares
 */
interface ICharmVault {
    function deposit(uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address to) 
        external returns (uint256 shares, uint256 amount0Used, uint256 amount1Used);
    function withdraw(uint256 shares, uint256 amount0Min, uint256 amount1Min, address to) 
        external returns (uint256 amount0, uint256 amount1);
    function balanceOf(address account) external view returns (uint256);
    function getTotalAmounts() external view returns (uint256 total0, uint256 total1);
    function totalSupply() external view returns (uint256);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

contract SmartCharmStrategy is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // =================================
    // IMMUTABLES
    // =================================
    
    address public immutable EAGLE_VAULT;
    ICharmVault public immutable CHARM_VAULT;
    IERC20 public immutable WLFI;
    IERC20 public immutable USD1;
    ISwapRouter public immutable UNISWAP_ROUTER;
    
    // =================================
    // STATE
    // =================================
    
    bool public active = true;
    uint256 public maxSlippage = 500; // 5%
    uint24 public poolFee = 10000; // 1% pool fee
    
    // =================================
    // EVENTS
    // =================================
    
    event StrategyDeposit(uint256 wlfiAmount, uint256 usd1Amount, uint256 meagleShares);
    event TokensSwapped(address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event StrategyWithdraw(uint256 meagleShares, uint256 wlfiAmount, uint256 usd1Amount);
    
    // =================================
    // CONSTRUCTOR
    // =================================
    
    constructor(
        address _vaultAddress,
        address _charmVault,
        address _wlfi,
        address _usd1,
        address _uniswapRouter
    ) {
        require(_vaultAddress != address(0), "Zero vault");
        
        EAGLE_VAULT = _vaultAddress;
        CHARM_VAULT = ICharmVault(_charmVault);
        WLFI = IERC20(_wlfi);
        USD1 = IERC20(_usd1);
        UNISWAP_ROUTER = ISwapRouter(_uniswapRouter);
    }
    
    // =================================
    // SMART DEPOSIT WITH AUTO-REBALANCING
    // =================================
    
    /**
     * @notice Deposit with SMART rebalancing to match Charm's needs
     * @dev Automatically swaps tokens to match Charm vault's current ratio
     * @param wlfiAmount Amount of WLFI received from vault
     * @param usd1Amount Amount of USD1 received from vault
     * @return shares MEAGLE shares received
     */
    function deposit(uint256 wlfiAmount, uint256 usd1Amount) 
        external 
        nonReentrant
        returns (uint256 shares) 
    {
        require(msg.sender == EAGLE_VAULT, "Only vault");
        require(active, "Strategy paused");
        
        if (wlfiAmount == 0 && usd1Amount == 0) return 0;
        
        // Transfer tokens from vault
        if (wlfiAmount > 0) {
            WLFI.safeTransferFrom(EAGLE_VAULT, address(this), wlfiAmount);
        }
        if (usd1Amount > 0) {
            USD1.safeTransferFrom(EAGLE_VAULT, address(this), usd1Amount);
        }
        
        // ⭐ SMART FEATURE: Get Charm's current ratio
        (uint256 charmWlfi, uint256 charmUsd1) = CHARM_VAULT.getTotalAmounts();
        
        uint256 charmTotal = charmWlfi + charmUsd1;
        if (charmTotal > 0) {
            // Calculate Charm's current ratio
            uint256 charmWlfiRatio = (charmWlfi * 10000) / charmTotal; // e.g., 9200 = 92%
            
            // Calculate our total value
            uint256 ourTotal = wlfiAmount + usd1Amount;
            
            // Calculate target amounts to match Charm's ratio
            uint256 targetWlfi = (ourTotal * charmWlfiRatio) / 10000;
            uint256 targetUsd1 = ourTotal - targetWlfi;
            
            // Swap if needed to match Charm's ratio
            // IMPORTANT: Account for what we ALREADY have!
            if (wlfiAmount > targetWlfi) {
                // We have too much WLFI, swap excess to USD1
                uint256 excess = wlfiAmount - targetWlfi;
                uint256 usd1Received = _swapWlfiToUsd1(excess);
                
                wlfiAmount -= excess;  // Reduce by what we swapped
                usd1Amount += usd1Received;  // Add what we received
            } else if (wlfiAmount < targetWlfi) {
                // We have too little WLFI, need to swap USD1 → WLFI
                uint256 wlfiNeeded = targetWlfi - wlfiAmount;  // How much MORE we need
                
                // Only swap what we need, not all excess USD1!
                uint256 usd1ToSwap = wlfiNeeded;  // Approximate 1:1 (could use oracle for precision)
                
                // Safety check: don't swap more USD1 than we have
                if (usd1ToSwap > usd1Amount) {
                    usd1ToSwap = usd1Amount;
                }
                
                uint256 wlfiReceived = _swapUsd1ToWlfi(usd1ToSwap);
                
                wlfiAmount += wlfiReceived;  // Add received WLFI
                usd1Amount -= usd1ToSwap;  // Reduce USD1 by what we swapped
            }
        }
        
        // Now deposit the balanced amounts to Charm
        WLFI.safeIncreaseAllowance(address(CHARM_VAULT), wlfiAmount);
        USD1.safeIncreaseAllowance(address(CHARM_VAULT), usd1Amount);
        
        // Deposit to Charm and get how much was actually used
        uint256 amount0Used;
        uint256 amount1Used;
        (shares, amount0Used, amount1Used) = CHARM_VAULT.deposit(
            wlfiAmount,
            usd1Amount,
            0,  // Flexible
            0,  // Flexible
            address(this)
        );
        
        // Send any UNUSED tokens back to vault
        uint256 unusedWlfi = wlfiAmount - amount0Used;
        uint256 unusedUsd1 = usd1Amount - amount1Used;
        
        if (unusedWlfi > 0) {
            WLFI.safeTransfer(EAGLE_VAULT, unusedWlfi);
        }
        if (unusedUsd1 > 0) {
            USD1.safeTransfer(EAGLE_VAULT, unusedUsd1);
        }
        
        emit StrategyDeposit(amount0Used, amount1Used, shares);
    }
    
    /**
     * @notice Swap WLFI to USD1 using Uniswap
     */
    function _swapWlfiToUsd1(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        
        WLFI.safeIncreaseAllowance(address(UNISWAP_ROUTER), amountIn);
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(WLFI),
            tokenOut: address(USD1),
            fee: poolFee,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: (amountIn * (10000 - maxSlippage)) / 10000,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = UNISWAP_ROUTER.exactInputSingle(params);
        
        emit TokensSwapped(address(WLFI), address(USD1), amountIn, amountOut);
    }
    
    /**
     * @notice Swap USD1 to WLFI using Uniswap
     */
    function _swapUsd1ToWlfi(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        
        USD1.safeIncreaseAllowance(address(UNISWAP_ROUTER), amountIn);
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(USD1),
            tokenOut: address(WLFI),
            fee: poolFee,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: (amountIn * (10000 - maxSlippage)) / 10000,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = UNISWAP_ROUTER.exactInputSingle(params);
        
        emit TokensSwapped(address(USD1), address(WLFI), amountIn, amountOut);
    }
    
    // =================================
    // OTHER FUNCTIONS (same as before)
    // =================================
    
    function withdraw(uint256 value) external nonReentrant returns (uint256 wlfiAmount, uint256 usd1Amount) {
        require(msg.sender == EAGLE_VAULT, "Only vault");
        if (value == 0) return (0, 0);
        
        uint256 ourMeagleShares = CHARM_VAULT.balanceOf(address(this));
        if (ourMeagleShares == 0) return (0, 0);
        
        (uint256 totalWlfi, uint256 totalUsd1) = getTotalAmounts();
        uint256 totalValue = totalWlfi + totalUsd1;
        
        uint256 sharesToWithdraw = value >= totalValue 
            ? ourMeagleShares 
            : (ourMeagleShares * value) / totalValue;
        
        (wlfiAmount, usd1Amount) = CHARM_VAULT.withdraw(
            sharesToWithdraw,
            0,
            0,
            EAGLE_VAULT
        );
        
        emit StrategyWithdraw(sharesToWithdraw, wlfiAmount, usd1Amount);
    }
    
    function getTotalAmounts() public view returns (uint256 wlfiAmount, uint256 usd1Amount) {
        uint256 ourShares = CHARM_VAULT.balanceOf(address(this));
        if (ourShares == 0) return (0, 0);
        
        (uint256 total0, uint256 total1) = CHARM_VAULT.getTotalAmounts();
        uint256 totalShares = CHARM_VAULT.totalSupply();
        
        wlfiAmount = (total0 * ourShares) / totalShares;
        usd1Amount = (total1 * ourShares) / totalShares;
    }
    
    function isInitialized() external view returns (bool) {
        return active;
    }
    
    function rebalance() external view {
        require(msg.sender == EAGLE_VAULT, "Only vault");
    }
    
    function getMeagleBalance() external view returns (uint256) {
        return CHARM_VAULT.balanceOf(address(this));
    }
    
    /**
     * @notice Rescue any idle tokens sitting in strategy
     * @dev Sends all idle WLFI and USD1 back to vault (not the MEAGLE!)
     */
    function rescueIdleTokens() external {
        require(msg.sender == EAGLE_VAULT, "Only vault");
        
        // Get idle token balances (not in Charm)
        uint256 wlfiBalance = WLFI.balanceOf(address(this));
        uint256 usd1Balance = USD1.balanceOf(address(this));
        
        // Send back to vault
        if (wlfiBalance > 0) {
            WLFI.safeTransfer(EAGLE_VAULT, wlfiBalance);
        }
        if (usd1Balance > 0) {
            USD1.safeTransfer(EAGLE_VAULT, usd1Balance);
        }
    }
}

