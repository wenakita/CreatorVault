// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ARCHIVED (legacy):
 * This was an early "post-deploy activator" flow. The app has moved to:
 * - `VaultActivationBatcher` (shared activation, AA-friendly)
 * - phased `CreatorVaultDeployer` + `/deploy`
 */

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
 */
contract VaultActivator is ReentrancyGuard {
    using SafeERC20 for IERC20;

    event VaultActivated(
        address indexed creator,
        address indexed vault,
        uint256 deposited,
        uint256 auctioned,
        address auction
    );

    error ZeroAddress();
    error InsufficientAmount();
    error AuctionAmountTooHigh();
    error TransferFailed();

    function activate(
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint128 requiredRaise
    ) external nonReentrant returns (address auction) {
        if (vault == address(0) || wrapper == address(0)) revert ZeroAddress();
        if (depositAmount < 50_000_000e18) revert InsufficientAmount();
        if (auctionPercent > 80) auctionPercent = 80;

        address creatorCoin = ICreatorOVault(vault).asset();
        address shareOFT = ICreatorOVaultWrapper(wrapper).shareOFT();

        IERC20(creatorCoin).safeTransferFrom(msg.sender, address(this), depositAmount);

        IERC20(creatorCoin).forceApprove(vault, depositAmount);
        uint256 shares = ICreatorOVault(vault).deposit(depositAmount, address(this));

        IERC20(vault).forceApprove(wrapper, shares);
        uint256 wsTokens = ICreatorOVaultWrapper(wrapper).wrap(shares);

        uint256 auctionAmount = (wsTokens * auctionPercent) / 100;
        if (auctionAmount > 0 && ccaStrategy != address(0)) {
            IERC20(shareOFT).forceApprove(ccaStrategy, auctionAmount);
            auction = ICCALaunchStrategy(ccaStrategy).launchAuctionSimple(auctionAmount, requiredRaise);
        }

        uint256 remaining = IERC20(shareOFT).balanceOf(address(this));
        if (remaining > 0) {
            IERC20(shareOFT).safeTransfer(msg.sender, remaining);
        }

        emit VaultActivated(msg.sender, vault, depositAmount, auctionAmount, auction);
    }

    function activateSimple(
        address vault,
        address wrapper,
        uint256 depositAmount
    ) external nonReentrant returns (uint256 wsTokens) {
        if (vault == address(0) || wrapper == address(0)) revert ZeroAddress();
        if (depositAmount == 0) revert InsufficientAmount();

        address creatorCoin = ICreatorOVault(vault).asset();
        address shareOFT = ICreatorOVaultWrapper(wrapper).shareOFT();

        IERC20(creatorCoin).safeTransferFrom(msg.sender, address(this), depositAmount);
        IERC20(creatorCoin).forceApprove(vault, depositAmount);
        uint256 shares = ICreatorOVault(vault).deposit(depositAmount, address(this));

        IERC20(vault).forceApprove(wrapper, shares);
        wsTokens = ICreatorOVaultWrapper(wrapper).wrap(shares);

        IERC20(shareOFT).safeTransfer(msg.sender, wsTokens);

        emit VaultActivated(msg.sender, vault, depositAmount, 0, address(0));
    }

    function rescue(address token, address to, uint256 amount) external {
        IERC20(token).safeTransfer(to, amount);
    }
}

