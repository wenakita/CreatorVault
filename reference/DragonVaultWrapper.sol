// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMintableBurnableOFT {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

/**
 * @title DragonVaultWrapper
 * @author 0xakita.eth
 * @notice Wraps DragonVaultV2 shares into DragonShareOFT tokens
 * 
 * @dev DEPLOYABLE WITH SAME ADDRESS ON ALL CHAINS
 *      Constructor only takes: _vault, _owner
 *      Chain-specific shareOFT is set via setShareOFT() after deployment
 * 
 * @dev MECHANISM:
 *      - wrap(): Lock vault shares, mint chainDRAGON (1:1 minus fee)
 *      - unwrap(): Burn chainDRAGON, release vault shares (1:1 minus fee)
 */
contract DragonVaultWrapper is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ================================
    // STATE
    // ================================
    
    /// @notice Vault shares (dragonVAULT from DragonVaultV2)
    IERC20 public immutable vaultShares;
    
    /// @notice OFT token (baseDRAGON/arbDRAGON/etc) - set after deploy
    IMintableBurnableOFT public shareOFT;
    
    /// @notice Tracking
    uint256 public totalLocked;
    uint256 public totalMinted;
    
    /// @notice Fees (basis points)
    uint256 public wrapFee;
    uint256 public unwrapFee;
    uint256 public constant MAX_FEE = 1000; // 10%
    uint256 public constant BASIS_POINTS = 10000;
    
    /// @notice Fee recipient
    address public feeRecipient;
    
    /// @notice Whitelist (no fees)
    mapping(address => bool) public isWhitelisted;
    
    /// @notice Fee stats
    uint256 public totalWrapFees;
    uint256 public totalUnwrapFees;
    
    // ================================
    // EVENTS
    // ================================
    
    event ShareOFTSet(address indexed shareOFT);
    event Wrapped(address indexed user, uint256 amountIn, uint256 amountOut, uint256 fee);
    event Unwrapped(address indexed user, uint256 amountIn, uint256 amountOut, uint256 fee);
    event WhitelistUpdated(address indexed user, bool status);
    event FeesUpdated(uint256 wrapFee, uint256 unwrapFee);
    event FeeRecipientUpdated(address indexed recipient);
    
    // ================================
    // ERRORS
    // ================================
    
    error ZeroAmount();
    error ShareOFTNotSet();
    error InsufficientLocked();
    error FeeExceedsLimit();
    error ZeroAddress();
    
    // ================================
    // CONSTRUCTOR
    // ================================
    
    /**
     * @notice Deploy with same address on all chains
     * @param _vault DragonVaultV2 address (same on all chains)
     * @param _owner Owner address
     */
    constructor(
        address _vault,
        address _owner
    ) Ownable(_owner) {
        require(_vault != address(0), "Zero vault");
        vaultShares = IERC20(_vault);
        feeRecipient = _owner;
        isWhitelisted[_owner] = true;
    }
    
    // ================================
    // ADMIN - POST-DEPLOY CONFIG
    // ================================
    
    /**
     * @notice Set the chain-specific shareOFT (called after deploy)
     * @param _shareOFT baseDRAGON/arbDRAGON/etc address
     */
    function setShareOFT(address _shareOFT) external onlyOwner {
        if (_shareOFT == address(0)) revert ZeroAddress();
        shareOFT = IMintableBurnableOFT(_shareOFT);
        emit ShareOFTSet(_shareOFT);
    }
    
    function setFees(uint256 _wrapFee, uint256 _unwrapFee) external onlyOwner {
        if (_wrapFee > MAX_FEE || _unwrapFee > MAX_FEE) revert FeeExceedsLimit();
        wrapFee = _wrapFee;
        unwrapFee = _unwrapFee;
        emit FeesUpdated(_wrapFee, _unwrapFee);
    }
    
    function setFeeRecipient(address _recipient) external onlyOwner {
        if (_recipient == address(0)) revert ZeroAddress();
        feeRecipient = _recipient;
        emit FeeRecipientUpdated(_recipient);
    }
    
    function setWhitelist(address user, bool status) external onlyOwner {
        isWhitelisted[user] = status;
        emit WhitelistUpdated(user, status);
    }
    
    function batchWhitelist(address[] calldata users, bool status) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            isWhitelisted[users[i]] = status;
            emit WhitelistUpdated(users[i], status);
        }
    }
    
    // ================================
    // WRAPPING
    // ================================
    
    /**
     * @notice Wrap vault shares → chainDRAGON
     */
    function wrap(uint256 amount) external nonReentrant returns (uint256 amountOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();
        
        uint256 fee = 0;
        amountOut = amount;
        
        if (!isWhitelisted[msg.sender] && wrapFee > 0) {
            fee = (amount * wrapFee) / BASIS_POINTS;
            amountOut = amount - fee;
            totalWrapFees += fee;
        }
        
        // Lock vault shares
        vaultShares.safeTransferFrom(msg.sender, address(this), amount);
        totalLocked += amount;
        
        // Send fee
        if (fee > 0) {
            vaultShares.safeTransfer(feeRecipient, fee);
            totalLocked -= fee;
        }
        
        // Mint chainDRAGON
        shareOFT.mint(msg.sender, amountOut);
        totalMinted += amountOut;
        
        emit Wrapped(msg.sender, amount, amountOut, fee);
    }
    
    /**
     * @notice Unwrap chainDRAGON → vault shares
     */
    function unwrap(uint256 amount) external nonReentrant returns (uint256 amountOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();
        
        uint256 fee = 0;
        amountOut = amount;
        
        if (!isWhitelisted[msg.sender] && unwrapFee > 0) {
            fee = (amount * unwrapFee) / BASIS_POINTS;
            amountOut = amount - fee;
            totalUnwrapFees += fee;
        }
        
        if (totalLocked < amountOut) revert InsufficientLocked();
        
        // Burn chainDRAGON
        shareOFT.burn(msg.sender, amount);
        totalMinted -= amount;
        
        // Release vault shares
        vaultShares.safeTransfer(msg.sender, amountOut);
        totalLocked -= amountOut;
        
        // Send fee
        if (fee > 0) {
            vaultShares.safeTransfer(feeRecipient, fee);
            totalLocked -= fee;
        }
        
        emit Unwrapped(msg.sender, amount, amountOut, fee);
    }
    
    // ================================
    // VIEW
    // ================================
    
    function isBalanced() external view returns (bool) {
        return totalLocked == totalMinted;
    }
    
    function previewWrap(uint256 amount, address user) external view returns (uint256) {
        if (isWhitelisted[user] || wrapFee == 0) return amount;
        return amount - (amount * wrapFee) / BASIS_POINTS;
    }
    
    function previewUnwrap(uint256 amount, address user) external view returns (uint256) {
        if (isWhitelisted[user] || unwrapFee == 0) return amount;
        return amount - (amount * unwrapFee) / BASIS_POINTS;
    }
}

