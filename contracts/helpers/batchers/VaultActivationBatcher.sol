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

    /// @notice Emitted when a portion of wsTokens is reserved for creator/team (e.g. vesting escrow).
    event CreatorReserveAllocated(
        address indexed identity,
        address indexed recipient,
        address indexed wsToken,
        uint256 amount,
        uint8 reserveBps
    );

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error ZeroAmount();
    error InvalidPercent();
    error InvalidReserve();
    error NotVaultOwner(address expectedOwner, address actualOwner);
    error NotAuthorizedOperator();
    error PermitTokenMismatch();
    error PermitAmountTooLow();

    // ================================
    // INTERNAL SHARED LOGIC
    // ================================

    function _executeActivateAndLaunch(
        address identity,
        address creatorToken,
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint8 creatorReserveBps,
        address creatorReserveRecipient,
        uint128 requiredRaise
    ) internal returns (address auction, uint256 auctionAmount, uint256 reserveAmount, address wsToken) {
        if (depositAmount == 0) revert ZeroAmount();
        if (auctionPercent > 100) revert InvalidPercent();
        if (creatorReserveBps > 100) revert InvalidReserve();
        if (uint256(auctionPercent) + uint256(creatorReserveBps) > 100) revert InvalidReserve();
        if (creatorReserveBps > 0 && creatorReserveRecipient == address(0)) revert ZeroAddress();

        // ============ STEP 2: Deposit to vault ============
        IERC20(creatorToken).forceApprove(vault, depositAmount);
        uint256 shares = IVault(vault).deposit(depositAmount, address(this));

        // ============ STEP 3: Wrap shares to wsTokens ============
        address vaultTokenAddress = vault; // Vault token = vault address
        IERC20(vaultTokenAddress).forceApprove(wrapper, shares);
        uint256 wsTokens = IWrapper(wrapper).wrap(shares);

        // Get wsToken address from wrapper
        wsToken = IWrapper(wrapper).shareOFT();

        // ============ STEP 4: Launch auction ============
        auctionAmount = 0;
        if (auctionPercent > 0) {
            auctionAmount = (wsTokens * auctionPercent) / 100;
            IERC20(wsToken).forceApprove(ccaStrategy, auctionAmount);
            auction = ICCAStrategy(ccaStrategy).launchAuctionSimple(auctionAmount, requiredRaise);
        }

        // Reserve portion (creator/team allocation, e.g. vesting escrow)
        reserveAmount = 0;
        if (creatorReserveBps > 0) {
            reserveAmount = (wsTokens * creatorReserveBps) / 100;
            if (reserveAmount > 0) {
                IERC20(wsToken).safeTransfer(creatorReserveRecipient, reserveAmount);
                emit CreatorReserveAllocated(identity, creatorReserveRecipient, wsToken, reserveAmount, creatorReserveBps);
            }
        }

        // Remaining goes back to identity by default
        uint256 remainingWsTokens = wsTokens - auctionAmount - reserveAmount;
        if (remainingWsTokens > 0) {
            IERC20(wsToken).safeTransfer(identity, remainingWsTokens);
        }
    }

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
     * @param auctionPercent Percent of ■TOKEN to auction (0-100)
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
        if (creatorToken == address(0) || vault == address(0) || wrapper == address(0) || ccaStrategy == address(0)) {
            revert ZeroAddress();
        }

        // ============ STEP 1: Pull creator tokens ============
        IERC20(creatorToken).safeTransferFrom(msg.sender, address(this), depositAmount);

        // Default behavior: no creator reserve; leftover goes back to msg.sender
        uint256 auctionAmount;
        uint256 reserveAmount;
        address wsToken;
        (auction, auctionAmount, reserveAmount, wsToken) = _executeActivateAndLaunch(
            msg.sender,
            creatorToken,
            vault,
            wrapper,
            ccaStrategy,
            depositAmount,
            auctionPercent,
            0,
            address(0),
            requiredRaise
        );

        emit BatchActivation(msg.sender, vault, depositAmount, auctionAmount, auction);
        reserveAmount; // silence unused warning (reserved is always 0 in this entrypoint)
        wsToken; // silence unused warning
    }

    /**
     * @notice Batch activate with an explicit creator/team reserve allocation.
     * @dev `auctionPercent + creatorReserveBps` must be <= 100.
     *      The remainder (if any) is returned to `msg.sender`.
     */
    function batchActivateWithReserve(
        address creatorToken,
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint8 creatorReserveBps,
        address creatorReserveRecipient,
        uint128 requiredRaise
    ) external nonReentrant returns (address auction) {
        if (creatorToken == address(0) || vault == address(0) || wrapper == address(0) || ccaStrategy == address(0)) {
            revert ZeroAddress();
        }

        IERC20(creatorToken).safeTransferFrom(msg.sender, address(this), depositAmount);

        uint256 auctionAmount;
        uint256 reserveAmount;
        address wsToken;
        (auction, auctionAmount, reserveAmount, wsToken) = _executeActivateAndLaunch(
            msg.sender,
            creatorToken,
            vault,
            wrapper,
            ccaStrategy,
            depositAmount,
            auctionPercent,
            creatorReserveBps,
            creatorReserveRecipient,
            requiredRaise
        );

        emit BatchActivation(msg.sender, vault, depositAmount, auctionAmount, auction);
        reserveAmount; // emitted via CreatorReserveAllocated
        wsToken; // emitted via CreatorReserveAllocated
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

        // Default behavior: no creator reserve; leftover goes back to identity
        uint256 auctionAmount;
        uint256 reserveAmount;
        address wsToken;
        (auction, auctionAmount, reserveAmount, wsToken) = _executeActivateAndLaunch(
            identity,
            creatorToken,
            vault,
            wrapper,
            ccaStrategy,
            depositAmount,
            auctionPercent,
            0,
            address(0),
            requiredRaise
        );

        emit BatchActivationFor(msg.sender, identity, vault, depositAmount, auctionAmount, auction);
        reserveAmount; // silence unused warning
        wsToken; // silence unused warning
    }

    /**
     * @notice Permit2 (identity-funded) activate with creator/team reserve allocation.
     * @dev Remaining wsTokens are returned to `identity` (never msg.sender).
     */
    function batchActivateWithPermit2ForWithReserve(
        address identity,
        address creatorToken,
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint8 creatorReserveBps,
        address creatorReserveRecipient,
        uint128 requiredRaise,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external nonReentrant returns (address auction) {
        if (identity == address(0) || creatorToken == address(0) || vault == address(0) || wrapper == address(0) || ccaStrategy == address(0)) {
            revert ZeroAddress();
        }
        if (depositAmount == 0) revert ZeroAmount();
        if (auctionPercent > 100) revert InvalidPercent();

        address vaultOwner = IOwnable(vault).owner();
        if (vaultOwner != identity) revert NotVaultOwner(identity, vaultOwner);
        if (msg.sender != identity) {
            if (!IOperatorAuthorizableVault(vault).isAuthorizedOperator(msg.sender, OP_ACTIVATE)) revert NotAuthorizedOperator();
        }
        if (permit.permitted.token != creatorToken) revert PermitTokenMismatch();
        if (permit.permitted.amount < depositAmount) revert PermitAmountTooLow();

        ISignatureTransfer.SignatureTransferDetails memory details =
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: depositAmount});
        ISignatureTransfer(permit2).permitTransferFrom(permit, details, identity, signature);

        uint256 auctionAmount;
        uint256 reserveAmount;
        address wsToken;
        (auction, auctionAmount, reserveAmount, wsToken) = _executeActivateAndLaunch(
            identity,
            creatorToken,
            vault,
            wrapper,
            ccaStrategy,
            depositAmount,
            auctionPercent,
            creatorReserveBps,
            creatorReserveRecipient,
            requiredRaise
        );

        emit BatchActivationFor(msg.sender, identity, vault, depositAmount, auctionAmount, auction);
        reserveAmount;
        wsToken;
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

        // Default behavior: no creator reserve; leftover goes back to identity
        uint256 auctionAmount;
        uint256 reserveAmount;
        address wsToken;
        (auction, auctionAmount, reserveAmount, wsToken) = _executeActivateAndLaunch(
            identity,
            creatorToken,
            vault,
            wrapper,
            ccaStrategy,
            depositAmount,
            auctionPercent,
            0,
            address(0),
            requiredRaise
        );

        emit BatchActivationFor(msg.sender, identity, vault, depositAmount, auctionAmount, auction);
        reserveAmount; // silence unused warning
        wsToken; // silence unused warning
    }

    /**
     * @notice Permit2 (operator-funded) activate with creator/team reserve allocation.
     * @dev Remaining wsTokens are returned to `identity` (never msg.sender).
     */
    function batchActivateWithPermit2FromOperatorWithReserve(
        address identity,
        address creatorToken,
        address vault,
        address wrapper,
        address ccaStrategy,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint8 creatorReserveBps,
        address creatorReserveRecipient,
        uint128 requiredRaise,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external nonReentrant returns (address auction) {
        if (identity == address(0) || creatorToken == address(0) || vault == address(0) || wrapper == address(0) || ccaStrategy == address(0)) {
            revert ZeroAddress();
        }
        if (depositAmount == 0) revert ZeroAmount();
        if (auctionPercent > 100) revert InvalidPercent();

        address vaultOwner = IOwnable(vault).owner();
        if (vaultOwner != identity) revert NotVaultOwner(identity, vaultOwner);
        if (msg.sender != identity) {
            if (!IOperatorAuthorizableVault(vault).isAuthorizedOperator(msg.sender, OP_ACTIVATE)) revert NotAuthorizedOperator();
        }
        if (permit.permitted.token != creatorToken) revert PermitTokenMismatch();
        if (permit.permitted.amount < depositAmount) revert PermitAmountTooLow();

        ISignatureTransfer.SignatureTransferDetails memory details =
            ISignatureTransfer.SignatureTransferDetails({to: address(this), requestedAmount: depositAmount});
        ISignatureTransfer(permit2).permitTransferFrom(permit, details, msg.sender, signature);

        uint256 auctionAmount;
        uint256 reserveAmount;
        address wsToken;
        (auction, auctionAmount, reserveAmount, wsToken) = _executeActivateAndLaunch(
            identity,
            creatorToken,
            vault,
            wrapper,
            ccaStrategy,
            depositAmount,
            auctionPercent,
            creatorReserveBps,
            creatorReserveRecipient,
            requiredRaise
        );

        emit BatchActivationFor(msg.sender, identity, vault, depositAmount, auctionAmount, auction);
        reserveAmount;
        wsToken;
    }
}
