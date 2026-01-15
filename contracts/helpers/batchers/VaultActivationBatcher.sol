// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VaultActivationBatcher
 * @author 0xakita.eth
 * @notice Batches vault activation actions.
 * @dev Used by deployment flows to activate vaults in one call.
 */
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";

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

interface IOwnable {
    function owner() external view returns (address);
}

interface IOperatorAuthorizableVault {
    function isAuthorizedOperator(address exec, uint256 perm) external view returns (bool);
}

contract VaultActivationBatcher is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Bitmask permission (must match `CreatorOVault.OP_ACTIVATE`)
    uint256 private constant OP_ACTIVATE = 1 << 2;

    /// @notice Permit2 contract used for signature-based transfers
    address public immutable permit2;

    constructor(address _permit2) {
        if (_permit2 == address(0)) revert ZeroAddress();
        permit2 = _permit2;
    }

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

    event BatchActivationFor(
        address indexed operator,
        address indexed identity,
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
    error NotVaultOwner(address expectedOwner, address actualOwner);
    error NotAuthorizedOperator();
    error PermitTokenMismatch();
    error PermitAmountTooLow();

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

    /**
     * @notice Batch activate on behalf of a canonical identity wallet (identity-funded via Permit2).
     * @dev Caller must be `identity` or an authorized operator on the vault (OP_ACTIVATE).
     *      Remaining share tokens are always returned to `identity` (never `msg.sender`).
     */
    function batchActivateWithPermit2For(
        address identity,
        address creatorToken,
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint128 requiredRaise,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external nonReentrant returns (address auction) {
        // Validate inputs
        if (identity == address(0) || creatorToken == address(0) || vault == address(0) ||
            wrapper == address(0) || ccaStrategy == address(0)) revert ZeroAddress();
        if (depositAmount == 0) revert ZeroAmount();
        if (auctionPercent > 100) revert InvalidPercent();

        address vaultOwner = IOwnable(vault).owner();
        if (vaultOwner != identity) revert NotVaultOwner(identity, vaultOwner);

        if (msg.sender != identity) {
            if (!IOperatorAuthorizableVault(vault).isAuthorizedOperator(msg.sender, OP_ACTIVATE)) revert NotAuthorizedOperator();
        }

        if (permit.permitted.token != creatorToken) revert PermitTokenMismatch();
        if (permit.permitted.amount < depositAmount) revert PermitAmountTooLow();

        // ============ STEP 1: Pull creator tokens from identity via Permit2 ============
        ISignatureTransfer.SignatureTransferDetails memory details =
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: depositAmount});
        ISignatureTransfer(permit2).permitTransferFrom(permit, details, identity, signature);

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

        // ============ STEP 5: Return remaining wsTokens to identity ============
        uint256 remainingWsTokens = wsTokens - auctionAmount;
        if (remainingWsTokens > 0) {
            IERC20(wsToken).safeTransfer(identity, remainingWsTokens);
        }

        emit BatchActivationFor(msg.sender, identity, vault, depositAmount, auctionAmount, auction);
    }

    /**
     * @notice Batch activate on behalf of a canonical identity wallet (operator-funded via Permit2).
     * @dev Caller must be `identity` or an authorized operator on the vault (OP_ACTIVATE).
     *      Remaining share tokens are always returned to `identity` (never `msg.sender`).
     */
    function batchActivateWithPermit2FromOperator(
        address identity,
        address creatorToken,
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint128 requiredRaise,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external nonReentrant returns (address auction) {
        // Validate inputs
        if (identity == address(0) || creatorToken == address(0) || vault == address(0) ||
            wrapper == address(0) || ccaStrategy == address(0)) revert ZeroAddress();
        if (depositAmount == 0) revert ZeroAmount();
        if (auctionPercent > 100) revert InvalidPercent();

        address vaultOwner = IOwnable(vault).owner();
        if (vaultOwner != identity) revert NotVaultOwner(identity, vaultOwner);

        if (msg.sender != identity) {
            if (!IOperatorAuthorizableVault(vault).isAuthorizedOperator(msg.sender, OP_ACTIVATE)) revert NotAuthorizedOperator();
        }

        if (permit.permitted.token != creatorToken) revert PermitTokenMismatch();
        if (permit.permitted.amount < depositAmount) revert PermitAmountTooLow();

        // ============ STEP 1: Pull creator tokens from operator via Permit2 ============
        ISignatureTransfer.SignatureTransferDetails memory details =
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: depositAmount});
        ISignatureTransfer(permit2).permitTransferFrom(permit, details, msg.sender, signature);

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

        // ============ STEP 5: Return remaining wsTokens to identity ============
        uint256 remainingWsTokens = wsTokens - auctionAmount;
        if (remainingWsTokens > 0) {
            IERC20(wsToken).safeTransfer(identity, remainingWsTokens);
        }

        emit BatchActivationFor(msg.sender, identity, vault, depositAmount, auctionAmount, auction);
    }
}
