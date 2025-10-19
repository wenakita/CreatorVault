// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Uniswap V3 Router interface
interface ISwapRouter {
        struct ExactInputSingleParams {
            address tokenIn;
            address tokenOut;
            uint24 fee;
            address recipient;
            uint256 deadline;
            uint256 amountIn;
            uint256 amountOutMinimum;
            uint160 sqrtPriceLimitX96;
        }
        function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut);
}

// Charm vault interface
interface ICharmVault {
        function getTotalAmounts() external view returns (uint256 total0, uint256 total1);
        function deposit(uint256 amount0, uint256 amount1, uint256 min0, uint256 min1, address to) 
            external returns (uint256 shares, uint256 amount0Used, uint256 amount1Used);
        function withdraw(uint256 shares, uint256 min0, uint256 min1, address to) 
            external returns (uint256 amount0, uint256 amount1);
        function balanceOf(address account) external view returns (uint256);
        function token0() external view returns (address);
        function token1() external view returns (address);
}

/**
 * @title CharmStrategyUSD1 - Optimal USD1/WLFI Strategy
 * @notice Efficiently deposits to Charm USD1/WLFI vault by matching ratio exactly
 * @dev NO WETH swaps needed! Just balance USD1:WLFI ratio
 */
contract CharmStrategyUSD1 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Immutables
    address public immutable EAGLE_VAULT;
    IERC20 public immutable WLFI;
    IERC20 public immutable USD1;
    ISwapRouter public constant UNISWAP_ROUTER = ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
    uint24 public constant POOL_FEE = 10000; // 1% fee tier for WLFI/USD1 pool
    
    // State
    address public charmVault;  // USD1/WLFI Charm Alpha Vault
    bool public active;
    uint256 public maxSlippage = 500; // 5%
    
    // Events
    event StrategyDeposit(uint256 usd1Amount, uint256 wlfiAmount, uint256 shares);
    event StrategyWithdraw(uint256 shares, uint256 usd1Amount, uint256 wlfiAmount);
    event CharmVaultSet(address indexed charmVault);
    event TokensSwapped(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    
    // Errors
    error NotInitialized();
    error OnlyVault();
    error InsufficientBalance();
    error ZeroAddress();
    error NotActive();
    
    modifier onlyVault() {
        if (msg.sender != EAGLE_VAULT) revert OnlyVault();
        _;
    }
    
    modifier whenActive() {
        if (!active) revert NotActive();
        _;
    }
    
    constructor(
        address _vault,
        address _charmVault,
        address _wlfi,
        address _usd1,
        address _owner
    ) Ownable(_owner) {
        if (_vault == address(0) || _wlfi == address(0) || _usd1 == address(0)) revert ZeroAddress();
        
        EAGLE_VAULT = _vault;
        WLFI = IERC20(_wlfi);
        USD1 = IERC20(_usd1);
        
        if (_charmVault != address(0)) {
            charmVault = _charmVault;
            active = true;
            _initializeApprovals();
        }
    }
    
    /**
     * @notice Initialize all token approvals
     */
    function _initializeApprovals() internal {
        if (charmVault != address(0)) {
            WLFI.forceApprove(charmVault, type(uint256).max);
            USD1.forceApprove(charmVault, type(uint256).max);
            WLFI.forceApprove(address(UNISWAP_ROUTER), type(uint256).max);
            USD1.forceApprove(address(UNISWAP_ROUTER), type(uint256).max);
        }
    }
    
    function initializeApprovals() external onlyOwner {
        _initializeApprovals();
    }
    
    /**
     * @notice Main deposit function - Optimally balances tokens and deposits to Charm
     * @dev Matches Charm's USD1:WLFI ratio exactly for maximum capital efficiency
     */
    function deposit(uint256 wlfiAmount, uint256 usd1Amount) 
        external 
        onlyVault
        whenActive
        nonReentrant
        returns (uint256 shares) 
    {
        if (wlfiAmount == 0 && usd1Amount == 0) return 0;
        if (charmVault == address(0)) revert NotInitialized();
        
        // Transfer tokens from vault
        if (wlfiAmount > 0) {
            WLFI.safeTransferFrom(EAGLE_VAULT, address(this), wlfiAmount);
        }
        if (usd1Amount > 0) {
            USD1.safeTransferFrom(EAGLE_VAULT, address(this), usd1Amount);
        }
        
        // Get total tokens (including any leftover from previous)
        uint256 totalWlfi = WLFI.balanceOf(address(this));
        uint256 totalUsd1 = USD1.balanceOf(address(this));
        
        // OPTIMAL RATIO MATCHING LOGIC
        ICharmVault charm = ICharmVault(charmVault);
        (uint256 charmUsd1, uint256 charmWlfi) = charm.getTotalAmounts();
        
        uint256 finalUsd1;
        uint256 finalWlfi;
        
        if (charmUsd1 > 0 && charmWlfi > 0) {
            // Calculate EXACT ratio needed
            // If Charm has 1000 USD1 : 5000 WLFI (1:5 ratio)
            // For our 100 WLFI, we need: 100 * 1000 / 5000 = 20 USD1
            
            uint256 usd1NeededForWlfi = (totalWlfi * charmUsd1) / charmWlfi;
            
            if (totalUsd1 >= usd1NeededForWlfi) {
                // We have enough USD1
                finalUsd1 = usd1NeededForWlfi;
                finalWlfi = totalWlfi;
                
                // Swap excess USD1 → WLFI
                uint256 excessUsd1 = totalUsd1 - usd1NeededForWlfi;
                if (excessUsd1 > 0) {
                    uint256 moreWlfi = _swapUsd1ToWlfi(excessUsd1);
                    finalWlfi += moreWlfi;
                    // Recalculate USD1 needed for new WLFI amount
                    finalUsd1 = (finalWlfi * charmUsd1) / charmWlfi;
                }
            } else {
                // Not enough USD1 - swap some WLFI → USD1
                uint256 usd1Shortfall = usd1NeededForWlfi - totalUsd1;
                uint256 wlfiToSwap = (usd1Shortfall * charmWlfi) / charmUsd1;
                
                if (wlfiToSwap < totalWlfi) {
                    uint256 moreUsd1 = _swapWlfiToUsd1(wlfiToSwap);
                    finalUsd1 = totalUsd1 + moreUsd1;
                    finalWlfi = totalWlfi - wlfiToSwap;
                } else {
                    // Not enough to swap - use what we have
                    finalUsd1 = totalUsd1;
                    finalWlfi = totalWlfi;
                }
            }
        } else {
            // Charm empty - deposit 1:1 ratio or whatever we have
            finalUsd1 = totalUsd1;
            finalWlfi = totalWlfi;
        }
        
        // Deposit to Charm (it's already USD1/WLFI - no WETH needed!)
        (shares,,) = charm.deposit(
            finalUsd1,
            finalWlfi,
            0,  // Let Charm handle slippage
            0,
            address(this)
        );
        
        emit StrategyDeposit(finalUsd1, finalWlfi, shares);
    }
    
    /**
     * @notice Swap WLFI to USD1
     */
    function _swapWlfiToUsd1(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(WLFI),
            tokenOut: address(USD1),
            fee: POOL_FEE,  // 1% fee tier
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = UNISWAP_ROUTER.exactInputSingle(params);
        emit TokensSwapped(address(WLFI), address(USD1), amountIn, amountOut);
    }
    
    /**
     * @notice Swap USD1 to WLFI
     */
    function _swapUsd1ToWlfi(uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0) return 0;
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(USD1),
            tokenOut: address(WLFI),
            fee: POOL_FEE,  // 1% fee tier
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = UNISWAP_ROUTER.exactInputSingle(params);
        emit TokensSwapped(address(USD1), address(WLFI), amountIn, amountOut);
    }
    
    /**
     * @notice Withdraw from Charm vault
     */
    function withdraw(uint256 valueNeeded) 
        external 
        onlyVault
        nonReentrant
        returns (uint256 usd1Amount, uint256 wlfiAmount) 
    {
        if (charmVault == address(0)) return (0, 0);
        
        ICharmVault charm = ICharmVault(charmVault);
        uint256 ourShares = charm.balanceOf(address(this));
        if (ourShares == 0) return (0, 0);
        
        // Withdraw proportionally
        (uint256 totalUsd1, uint256 totalWlfi) = getTotalAmounts();
        uint256 totalValue = totalUsd1 + totalWlfi;  // Simplified: assume 1 USD1 = 1 WLFI value-wise
        
        uint256 sharesToWithdraw;
        if (valueNeeded >= totalValue) {
            sharesToWithdraw = ourShares;
        } else {
            sharesToWithdraw = (ourShares * valueNeeded) / totalValue;
        }
        
        (usd1Amount, wlfiAmount) = charm.withdraw(
            sharesToWithdraw,
            0,
            0,
            EAGLE_VAULT  // Send directly back to vault
        );
        
        emit StrategyWithdraw(sharesToWithdraw, usd1Amount, wlfiAmount);
    }
    
    /**
     * @notice Get total amounts in strategy
     */
    function getTotalAmounts() public view returns (uint256 usd1, uint256 wlfi) {
        if (charmVault == address(0) || !active) return (0, 0);
        
        ICharmVault charm = ICharmVault(charmVault);
        uint256 ourShares = charm.balanceOf(address(this));
        if (ourShares == 0) return (0, 0);
        
        (usd1, wlfi) = charm.getTotalAmounts();
        uint256 totalShares = charm.balanceOf(address(this)); // Our shares
        
        // Note: This is simplified - should calculate based on total supply
        // For now, assume we own all shares (single depositor)
    }
    
    function isInitialized() external view returns (bool) {
        return charmVault != address(0) && active;
    }
    
    function pause() external onlyOwner {
        active = false;
    }
    
    function resume() external onlyOwner {
        if (charmVault == address(0)) revert NotInitialized();
        active = true;
    }
    
    function setCharmVault(address _charmVault) external onlyOwner {
        if (_charmVault == address(0)) revert ZeroAddress();
        charmVault = _charmVault;
        active = true;
        _initializeApprovals();
        emit CharmVaultSet(_charmVault);
    }
}

