// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ================================
// INTERFACES
// ================================

interface IVault {
        function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    }

    interface IWrapper {
        function wrap(uint256 amount) external returns (uint256 wsTokens);
        function shareOFT() external view returns (address);
    }

interface ICCAStrategy {
    function launchAuctionSimple(uint256 amount, uint128 requiredRaise) external returns (address auction);
}

/**
 * @title VaultActivationBatcher
 * @notice Helper contract to batch all vault activation steps into 1 transaction
 * @dev For users without smart wallets (ERC-4337 alternative)
 * 
 * Flow:
 * 1. User approves this contract to spend their creator tokens
 * 2. User calls batchActivate()
 * 3. This contract:
 *    - Pulls creator tokens from user
 *    - Deposits to vault
 *    - Wraps shares to wsTokens
 *    - Approves CCA strategy
 *    - Launches auction
 *    - Returns remaining wsTokens to user
 */
contract VaultActivationBatcher is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // EVENTS
    // ================================

    event BatchActivation(
        address indexed user,
        address indexed vault,
        uint256 depositAmount,
        uint256 auctionAmount,
        address auction
    );

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error ZeroAmount();
    error InvalidPercent();

    // ================================
    // MAIN FUNCTION
    // ================================

    /**
     * @notice Batch activate vault and launch auction in one transaction
     * @param creatorToken The creator token to deposit
     * @param vault The vault contract
     * @param wrapper The wrapper contract
     * @param ccaStrategy The CCA strategy contract
     * @param depositAmount Amount of creator tokens to deposit
     * @param auctionPercent Percent of wsTokens to auction (0-100)
     * @param requiredRaise Minimum ETH to raise in auction
     * @return auction The auction contract address
     * 
     * @dev User must approve this contract to spend depositAmount of creatorToken first
     */
    function batchActivate(
        address creatorToken,
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint128 requiredRaise
    ) external nonReentrant returns (address auction) {
        // Validate inputs
        if (creatorToken == address(0) || vault == address(0) || 
            wrapper == address(0) || ccaStrategy == address(0)) revert ZeroAddress();
        if (depositAmount == 0) revert ZeroAmount();
        if (auctionPercent > 100) revert InvalidPercent();

        // ============ STEP 1: Pull creator tokens ============
        IERC20(creatorToken).safeTransferFrom(msg.sender, address(this), depositAmount);

        // ============ STEP 2: Deposit to vault ============
        IERC20(creatorToken).forceApprove(vault, depositAmount);
        uint256 shares = IVault(vault).deposit(depositAmount, address(this));

        // ============ STEP 3: Wrap shares to wsTokens ============
        address vaultTokenAddress = vault; // Vault token = vault address
        IERC20(vaultTokenAddress).forceApprove(wrapper, shares);
        uint256 wsTokens = IWrapper(wrapper).wrap(shares);

        // Get wsToken address from wrapper
        address wsToken = IWrapper(wrapper).shareOFT();
        
        // ============ STEP 4: Launch auction ============
        uint256 auctionAmount = 0;
        if (auctionPercent > 0) {
            auctionAmount = (wsTokens * auctionPercent) / 100;
            
            IERC20(wsToken).forceApprove(ccaStrategy, auctionAmount);
            auction = ICCAStrategy(ccaStrategy).launchAuctionSimple(auctionAmount, requiredRaise);
        }

        // ============ STEP 5: Return remaining wsTokens to user ============
        uint256 remainingWsTokens = wsTokens - auctionAmount;
        if (remainingWsTokens > 0) {
            IERC20(wsToken).safeTransfer(msg.sender, remainingWsTokens);
        }

        emit BatchActivation(msg.sender, vault, depositAmount, auctionAmount, auction);
    }
}

