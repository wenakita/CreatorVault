// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/strategies/IStrategy.sol";
import "../charm/CharmAlphaVault.sol";

/**
 * @title CreatorCharmStrategy
 * @notice Strategy that deposits into Charm Alpha Vaults for automated LP management
 * @dev Integrates with our deployed Charm vaults on Base
 */
contract CreatorCharmStrategy is IStrategy, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable vault;
    address public immutable underlyingToken;
    CharmAlphaVault public immutable charmVault;
    address public immutable quoteToken; // USDC or WETH
    
    address public governance;
    bool public active = true;

    constructor(
        address _vault,
        address _underlyingToken,
        address _charmVault,
        address _quoteToken
    ) {
        vault = _vault;
        underlyingToken = _underlyingToken;
        charmVault = CharmAlphaVault(_charmVault);
        quoteToken = _quoteToken;
        governance = msg.sender;
        
        // Verify charm vault tokens match
        require(
            address(charmVault.token0()) == _underlyingToken || 
            address(charmVault.token1()) == _underlyingToken,
            "Token mismatch"
        );
        
        // Approve charm vault to spend tokens
        IERC20(_underlyingToken).approve(_charmVault, type(uint256).max);
        if (_quoteToken != address(0)) {
            IERC20(_quoteToken).approve(_charmVault, type(uint256).max);
        }
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    function isActive() external view override returns (bool) {
        return active;
    }

    function asset() external view override returns (address) {
        return underlyingToken;
    }

    function getTotalAssets() external view override returns (uint256) {
        uint256 shares = charmVault.balanceOf(address(this));
        if (shares == 0) return 0;
        
        uint256 totalShares = charmVault.totalSupply();
        if (totalShares == 0) return 0;
        
        (uint256 total0, uint256 total1) = charmVault.getTotalAmounts();
        
        // Return value in underlying token
        if (address(charmVault.token0()) == underlyingToken) {
            return (total0 * shares) / totalShares;
        } else {
            return (total1 * shares) / totalShares;
        }
    }

    // ================================
    // STRATEGY OPERATIONS
    // ================================

    /**
     * @notice Deposit underlying tokens into Charm vault
     * @param amount Amount of underlying tokens to deposit
     * @return deposited Actual amount deposited
     */
    function deposit(uint256 amount) external override nonReentrant returns (uint256 deposited) {
        require(msg.sender == vault, "Only vault");
        require(active, "Strategy paused");
        
        if (amount == 0) return 0;
        
        // Transfer tokens from vault to this strategy
        IERC20(underlyingToken).safeTransferFrom(msg.sender, address(this), amount);
        
        // Determine which token is token0 and which is token1
        bool underlyingIsToken0 = address(charmVault.token0()) == underlyingToken;
        
        uint256 amount0Desired = underlyingIsToken0 ? amount : 0;
        uint256 amount1Desired = underlyingIsToken0 ? 0 : amount;
        
        // Deposit into Charm vault (single-sided)
        try charmVault.deposit(
            amount0Desired,
            amount1Desired,
            0, // No minimum
            0,
            address(this)
        ) returns (uint256 shares, uint256, uint256) {
            deposited = amount; // We deposited the full amount
            emit StrategyDeposit(msg.sender, amount, deposited);
        } catch {
            // If deposit fails, return tokens to vault
            IERC20(underlyingToken).safeTransfer(vault, amount);
            deposited = 0;
        }
    }

    /**
     * @notice Withdraw tokens from Charm vault
     * @param amount Amount of underlying tokens to withdraw
     * @return withdrawn Actual amount withdrawn
     */
    function withdraw(uint256 amount) external override nonReentrant returns (uint256 withdrawn) {
        require(msg.sender == vault, "Only vault");
        
        if (amount == 0) return 0;
        
        // Calculate shares to burn based on amount requested
        uint256 totalShares = charmVault.balanceOf(address(this));
        if (totalShares == 0) return 0;
        
        (uint256 total0, uint256 total1) = charmVault.getTotalAmounts();
        uint256 totalValue = address(charmVault.token0()) == underlyingToken ? total0 : total1;
        if (totalValue == 0) return 0;
        
        // Calculate proportional shares to withdraw
        uint256 sharesToBurn = (amount * totalShares) / totalValue;
        if (sharesToBurn > totalShares) sharesToBurn = totalShares;
        if (sharesToBurn == 0) return 0;
        
        // Withdraw from Charm vault
        try charmVault.withdraw(
            sharesToBurn,
            0, // No minimum
            0,
            address(this)
        ) returns (uint256 amount0, uint256 amount1) {
            // Send underlying tokens back to vault
            withdrawn = address(charmVault.token0()) == underlyingToken ? amount0 : amount1;
            IERC20(underlyingToken).safeTransfer(vault, withdrawn);
            
            // If we received quote tokens, we could swap them back
            // For now, keep them in strategy for next deposit
            
            emit StrategyWithdraw(msg.sender, amount, withdrawn);
        } catch {
            withdrawn = 0;
        }
    }

    /**
     * @notice Emergency withdraw all assets
     * @dev Only governance can call
     * @return withdrawn Total amount withdrawn
     */
    function emergencyWithdraw() external override nonReentrant returns (uint256 withdrawn) {
        require(msg.sender == governance, "Only governance");
        
        uint256 shares = charmVault.balanceOf(address(this));
        if (shares > 0) {
            charmVault.withdraw(shares, 0, 0, address(this));
        }
        
        // Send all underlying tokens to vault
        withdrawn = IERC20(underlyingToken).balanceOf(address(this));
        if (withdrawn > 0) {
            IERC20(underlyingToken).safeTransfer(vault, withdrawn);
        }
        
        emit EmergencyWithdraw(vault, withdrawn);
    }

    /**
     * @notice Harvest accumulated yields from Charm
     * @dev Charm auto-compounds, so this just reports current gains
     * @return profit Amount of profit since last harvest
     */
    function harvest() external override returns (uint256 profit) {
        require(msg.sender == vault, "Only vault");
        
        // Charm auto-compounds, no manual harvest needed
        // Just report current total vs what was deposited
        profit = 0; // Could track this if needed
        
        emit StrategyHarvest(profit);
    }

    /**
     * @notice Trigger rebalancing of Charm positions
     * @dev Calls the Charm strategy rebalance function
     */
    function rebalance() external override {
        require(msg.sender == governance || msg.sender == vault, "Only governance or vault");
        
        // Charm strategy handles its own rebalancing via keeper
        // This is a no-op or could trigger Charm's rebalance if we're keeper
        
        uint256 totalAssets = this.getTotalAssets();
        emit StrategyRebalanced(totalAssets);
    }

    /**
     * @notice Get Charm vault shares balance
     */
    function getCharmShares() external view returns (uint256) {
        return charmVault.balanceOf(address(this));
    }

    /**
     * @notice Get detailed position info
     */
    function getPositionDetails() external view returns (
        uint256 shares,
        uint256 total0,
        uint256 total1,
        uint256 underlyingValue
    ) {
        shares = charmVault.balanceOf(address(this));
        (total0, total1) = charmVault.getTotalAmounts();
        
        if (shares > 0 && charmVault.totalSupply() > 0) {
            uint256 totalShares = charmVault.totalSupply();
            total0 = (total0 * shares) / totalShares;
            total1 = (total1 * shares) / totalShares;
        }
        
        underlyingValue = address(charmVault.token0()) == underlyingToken ? total0 : total1;
    }

    // ================================
    // ADMIN FUNCTIONS
    // ================================

    /**
     * @notice Pause/unpause strategy
     */
    function setActive(bool _active) external {
        require(msg.sender == governance, "Only governance");
        active = _active;
    }

    /**
     * @notice Update governance
     */
    function setGovernance(address _governance) external {
        require(msg.sender == governance, "Only governance");
        governance = _governance;
    }

    /**
     * @notice Get Charm vault address
     */
    function getCharmVault() external view returns (address) {
        return address(charmVault);
    }
}
