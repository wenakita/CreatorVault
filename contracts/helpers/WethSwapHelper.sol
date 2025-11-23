// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

/**
 * @title WethSwapHelper
 * @notice Temporary helper to swap WETH → WLFI
 * @dev Implements IStrategy interface to be added as temporary strategy
 */
contract WethSwapHelper {
    using SafeERC20 for IERC20;
    
    address public immutable vault;
    IERC20 public immutable WETH;
    IERC20 public immutable WLFI;
    ISwapRouter public immutable uniswapRouter;
    
    uint24 public constant POOL_FEE = 10000; // 1% fee tier
    
    event WethSwapped(uint256 wethIn, uint256 wlfiOut);
    
    constructor(
        address _vault,
        address _weth,
        address _wlfi,
        address _uniswapRouter
    ) {
        vault = _vault;
        WETH = IERC20(_weth);
        WLFI = IERC20(_wlfi);
        uniswapRouter = ISwapRouter(_uniswapRouter);
        
        // Approve router for WETH
        WETH.forceApprove(_uniswapRouter, type(uint256).max);
    }
    
    /**
     * @notice "Deposit" - actually swaps WETH to WLFI and returns to vault
     */
    function deposit(uint256 wlfiAmount, uint256 usd1Amount) external returns (uint256) {
        require(msg.sender == vault, "Only vault");
        
        // Get WETH balance
        uint256 wethBalance = WETH.balanceOf(address(this));
        
        if (wethBalance == 0) {
            return 0;
        }
        
        // Swap WETH → WLFI
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(WETH),
            tokenOut: address(WLFI),
            fee: POOL_FEE,
            recipient: address(this),
            deadline: block.timestamp,
            amountIn: wethBalance,
            amountOutMinimum: 0, // Emergency recovery, accept any amount
            sqrtPriceLimitX96: 0
        });
        
        uint256 wlfiReceived = uniswapRouter.exactInputSingle(params);
        
        // Send all WLFI back to vault
        WLFI.safeTransfer(vault, wlfiReceived);
        
        emit WethSwapped(wethBalance, wlfiReceived);
        
        return 0; // Return 0 shares since we're not holding anything
    }
    
    /**
     * @notice Withdraw - returns any stuck tokens
     */
    function withdraw(uint256) external returns (uint256 wlfiAmount, uint256 usd1Amount) {
        require(msg.sender == vault, "Only vault");
        
        // Return any remaining WLFI
        wlfiAmount = WLFI.balanceOf(address(this));
        if (wlfiAmount > 0) {
            WLFI.safeTransfer(vault, wlfiAmount);
        }
        
        // Return any remaining WETH (shouldn't have any)
        uint256 wethAmount = WETH.balanceOf(address(this));
        if (wethAmount > 0) {
            WETH.safeTransfer(vault, wethAmount);
        }
        
        usd1Amount = 0;
        return (wlfiAmount, usd1Amount);
    }
    
    /**
     * @notice Get total amounts (should always be 0 after deposit)
     */
    function getTotalAmounts() external view returns (uint256 wlfiAmount, uint256 usd1Amount) {
        wlfiAmount = WLFI.balanceOf(address(this));
        usd1Amount = 0;
    }
    
    /**
     * @notice Check if initialized
     */
    function isInitialized() external view returns (bool) {
        return true;
    }
    
    /**
     * @notice Rebalance (no-op)
     */
    function rebalance() external {
        // No-op
    }
}

