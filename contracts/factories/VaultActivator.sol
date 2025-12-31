// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ICreatorOVault
 */
interface ICreatorOVault {
    function deposit(uint256 assets, address receiver) external returns (uint256);
    function asset() external view returns (address);
}

/**
 * @title ICreatorOVaultWrapper
 */
interface ICreatorOVaultWrapper {
    function wrap(uint256 amount) external returns (uint256);
    function shareOFT() external view returns (address);
}

/**
 * @title ICCALaunchStrategy
 */
interface ICCALaunchStrategy {
    function launchAuctionSimple(uint256 amount, uint128 requiredRaise) external returns (address);
}

/**
 * @title VaultActivator
 * @author 0xakita.eth
 * @notice ONE-CLICK activation after vault deployment
 * 
 * @dev After deploying via script, creator calls activate() to:
 *      1. Deposit their tokens to vault
 *      2. Wrap shares to wsTokens
 *      3. Start CCA auction
 *      4. Send remaining wsTokens to creator
 * 
 * @dev FLOW:
 *      Step 1: forge script DeployCreatorVault (deploys 6 contracts)
 *      Step 2: approve this contract for tokens
 *      Step 3: activate() - ONE CLICK to go live!
 */
contract VaultActivator is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // EVENTS
    // ================================
    
    event VaultActivated(
        address indexed creator,
        address indexed vault,
        uint256 deposited,
        uint256 auctioned,
        address auction
    );

    // ================================
    // ERRORS
    // ================================
    
    error ZeroAddress();
    error InsufficientAmount();
    error AuctionAmountTooHigh();
    error TransferFailed();

    // ================================
    // ONE-CLICK ACTIVATION
    // ================================
    
    /**
     * @notice Activate vault with deposit, wrap, and auction in ONE tx
     * @param vault CreatorOVault address
     * @param wrapper CreatorOVaultWrapper address
     * @param ccaStrategy CCALaunchStrategy address
     * @param depositAmount Amount of creator tokens to deposit
     * @param auctionPercent Percent to auction (0-80)
     * @param requiredRaise Minimum ETH to raise in auction
     * @return auction The CCA auction address
     * 
     * @dev PREREQUISITES:
     *      - Caller must have approved this contract for depositAmount
     *      - Vault infrastructure must be deployed
     */
    function activate(
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint128 requiredRaise
    ) external nonReentrant returns (address auction) {
        // Validations
        if (vault == address(0) || wrapper == address(0)) revert ZeroAddress();
        if (depositAmount < 50_000_000e18) revert InsufficientAmount();
        if (auctionPercent > 80) auctionPercent = 80;
        
        // Get token addresses
        address creatorCoin = ICreatorOVault(vault).asset();
        address shareOFT = ICreatorOVaultWrapper(wrapper).shareOFT();
        
        // ============ STEP 1: TRANSFER & DEPOSIT ============
        
        // Transfer tokens from creator
        IERC20(creatorCoin).safeTransferFrom(msg.sender, address(this), depositAmount);
        
        // Approve and deposit to vault
        IERC20(creatorCoin).forceApprove(vault, depositAmount);
        uint256 shares = ICreatorOVault(vault).deposit(depositAmount, address(this));
        
        // ============ STEP 2: WRAP SHARES ============
        
        // Approve and wrap to wsTokens
        IERC20(vault).forceApprove(wrapper, shares);
        uint256 wsTokens = ICreatorOVaultWrapper(wrapper).wrap(shares);
        
        // ============ STEP 3: START AUCTION ============
        
        uint256 auctionAmount = (wsTokens * auctionPercent) / 100;
        
        if (auctionAmount > 0 && ccaStrategy != address(0)) {
            // Approve CCA for auction
            IERC20(shareOFT).forceApprove(ccaStrategy, auctionAmount);
            
            // Start auction
            auction = ICCALaunchStrategy(ccaStrategy).launchAuctionSimple(
                auctionAmount,
                requiredRaise
            );
        }
        
        // ============ STEP 4: SEND REMAINING TO CREATOR ============
        
        uint256 remaining = IERC20(shareOFT).balanceOf(address(this));
        if (remaining > 0) {
            IERC20(shareOFT).safeTransfer(msg.sender, remaining);
        }
        
        emit VaultActivated(
            msg.sender,
            vault,
            depositAmount,
            auctionAmount,
            auction
        );
    }
    
    /**
     * @notice Simplified activation - just deposit and wrap, no auction
     */
    function activateSimple(
        address vault,
        address wrapper,
        uint256 depositAmount
    ) external nonReentrant returns (uint256 wsTokens) {
        if (vault == address(0) || wrapper == address(0)) revert ZeroAddress();
        if (depositAmount == 0) revert InsufficientAmount();
        
        address creatorCoin = ICreatorOVault(vault).asset();
        address shareOFT = ICreatorOVaultWrapper(wrapper).shareOFT();
        
        // Transfer, deposit, wrap
        IERC20(creatorCoin).safeTransferFrom(msg.sender, address(this), depositAmount);
        IERC20(creatorCoin).forceApprove(vault, depositAmount);
        uint256 shares = ICreatorOVault(vault).deposit(depositAmount, address(this));
        
        IERC20(vault).forceApprove(wrapper, shares);
        wsTokens = ICreatorOVaultWrapper(wrapper).wrap(shares);
        
        // Send all wsTokens to creator
        IERC20(shareOFT).safeTransfer(msg.sender, wsTokens);
        
        emit VaultActivated(msg.sender, vault, depositAmount, 0, address(0));
    }
    
    /**
     * @notice Rescue stuck tokens (for emergencies only)
     */
    function rescue(address token, address to, uint256 amount) external {
        // Anyone can rescue to the token holder (safety measure)
        IERC20(token).safeTransfer(to, amount);
    }
}


import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ICreatorOVault
 */
