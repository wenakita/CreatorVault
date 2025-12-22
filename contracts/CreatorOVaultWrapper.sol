// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMintableBurnableOFT {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

/**
 * @title CreatorOVaultWrapper
 * @author 0xakita.eth - Think FriendTech, but for CreatorCoins, in ERC-4626 Omnichain Vaults
 * @notice All-in-one wrapper that handles Creator Coin → ShareOFT in one transaction
 * 
 * @dev COMBINES WRAPPER + COMPOSER FUNCTIONALITY:
 *      
 *      USER-FACING (Simple):
 *      - deposit(akita) → stkmaakita  (one tx!)
 *      - withdraw(stkmaakita) → akita (one tx!)
 *      
 *      INTERNAL (Advanced, for integrations):
 *      - wrap(akitaOV) → stkmaakita
 *      - unwrap(stkmaakita) → akitaOV
 *      
 * @dev WHAT USERS SEE:
 *      "I deposit akita, I get stkmaakita"
 *      "I withdraw stkmaakita, I get akita"
 *      
 *      They never see vault shares (akitaOV), wrapping, or complexity.
 * 
 * @dev CROSS-CHAIN COMPATIBLE:
 *      Constructor only takes immutables
 *      Chain-specific shareOFT set via setShareOFT() after deployment
 */
contract CreatorOVaultWrapper is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ================================
    // IMMUTABLES
    // ================================
    
    /// @notice Creator Coin token (e.g., akita) - the underlying asset
    IERC20 public immutable creatorCoin;
    
    /// @notice CreatOVault (ERC-4626) - converts Creator Coin to vault shares
    IERC4626 public immutable vault;
    
    // ================================
    // MUTABLE STATE
    // ================================
    
    /// @notice ShareOFT token (e.g., stkmaakita) - set post-deploy
    IMintableBurnableOFT public shareOFT;
    
    /// @notice Tracking for wrap/unwrap accounting
    uint256 public totalLocked;      // Vault shares locked
    uint256 public totalMinted;      // ShareOFT minted
    
    /// @notice Fees (basis points) - 0 by default for simplicity
    uint256 public wrapFee;
    uint256 public unwrapFee;
    uint256 public constant MAX_FEE = 1000; // 10% max
    uint256 public constant BASIS_POINTS = 10000;
    
    /// @notice Fee recipient (defaults to owner)
    address public feeRecipient;
    
    /// @notice Whitelist (no fees)
    mapping(address => bool) public isWhitelisted;
    
    /// @notice Fee statistics
    uint256 public totalWrapFees;
    uint256 public totalUnwrapFees;
    
    // ================================
    // EVENTS
    // ================================
    
    // User-facing events
    event Deposited(address indexed user, uint256 creatorCoinIn, uint256 shareOFTOut);
    event Withdrawn(address indexed user, uint256 shareOFTIn, uint256 creatorCoinOut);
    
    // Internal wrap/unwrap events
    event Wrapped(address indexed user, uint256 vaultSharesIn, uint256 shareOFTOut, uint256 fee);
    event Unwrapped(address indexed user, uint256 shareOFTIn, uint256 vaultSharesOut, uint256 fee);
    
    // Admin events
    event ShareOFTSet(address indexed shareOFT);
    event WhitelistUpdated(address indexed user, bool status);
    event FeesUpdated(uint256 wrapFee, uint256 unwrapFee);
    event FeeRecipientUpdated(address indexed recipient);
    
    // ================================
    // ERRORS
    // ================================
    
    error ZeroAmount();
    error ZeroAddress();
    error ShareOFTNotSet();
    error InsufficientLocked();
    error FeeExceedsLimit();
    error SlippageExceeded();
    
    // ================================
    // CONSTRUCTOR
    // ================================
    
    /**
     * @notice Deploy wrapper (same address possible on all chains)
     * @param _creatorCoin Creator Coin address (e.g., akita)
     * @param _vault CreatOVault address (ERC-4626)
     * @param _owner Owner address
     */
    constructor(
        address _creatorCoin,
        address _vault,
        address _owner
    ) Ownable(_owner) {
        require(_creatorCoin != address(0), "Zero creatorCoin");
        require(_vault != address(0), "Zero vault");
        
        creatorCoin = IERC20(_creatorCoin);
        vault = IERC4626(_vault);
        feeRecipient = _owner;
        isWhitelisted[_owner] = true;
        
        // Infinite approval for vault deposits
        IERC20(_creatorCoin).approve(_vault, type(uint256).max);
    }
    
    // ================================
    // ADMIN - POST-DEPLOY CONFIG
    // ================================
    
    /**
     * @notice Set the chain-specific ShareOFT (called after deploy)
     * @param _shareOFT CreatorShareOFT address (e.g., stkmaakita)
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
    // USER-FACING: DEPOSIT & WITHDRAW
    // ================================
    
    /**
     * @notice Deposit Creator Coin and receive ShareOFT in ONE transaction
     * 
     * @dev USER SEES: akita → stkmaakita
     * 
     * @dev INTERNAL FLOW:
     *      1. Take Creator Coin from user
     *      2. Deposit to vault → get vault shares
     *      3. Lock vault shares, mint ShareOFT
     *      4. Send ShareOFT to user
     * 
     * @param amount Amount of Creator Coin to deposit
     * @param minOut Minimum ShareOFT to receive (slippage protection)
     * @return shareOFTOut Amount of ShareOFT received
     */
    function deposit(
        uint256 amount,
        uint256 minOut
    ) external nonReentrant returns (uint256 shareOFTOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();
        
        // 1. Take Creator Coin from user
        creatorCoin.safeTransferFrom(msg.sender, address(this), amount);
        
        // 2. Deposit to vault → get vault shares
        uint256 vaultShares = vault.deposit(amount, address(this));
        
        // 3. Wrap vault shares → ShareOFT (internal, no extra transfer)
        shareOFTOut = _wrapInternal(vaultShares, msg.sender);
        
        // 4. Check slippage
        if (shareOFTOut < minOut) revert SlippageExceeded();
        
        emit Deposited(msg.sender, amount, shareOFTOut);
    }
    
    /**
     * @notice Deposit with zero slippage protection (convenience)
     */
    function deposit(uint256 amount) external nonReentrant returns (uint256 shareOFTOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();
        
        creatorCoin.safeTransferFrom(msg.sender, address(this), amount);
        uint256 vaultShares = vault.deposit(amount, address(this));
        shareOFTOut = _wrapInternal(vaultShares, msg.sender);
        
        emit Deposited(msg.sender, amount, shareOFTOut);
    }
    
    /**
     * @notice Withdraw ShareOFT and receive Creator Coin in ONE transaction
     * 
     * @dev USER SEES: stkmaakita → akita
     * 
     * @dev INTERNAL FLOW:
     *      1. Burn ShareOFT from user
     *      2. Release vault shares
     *      3. Redeem vault shares → Creator Coin
     *      4. Send Creator Coin to user
     * 
     * @param amount Amount of ShareOFT to withdraw
     * @param minOut Minimum Creator Coin to receive (slippage protection)
     * @return creatorCoinOut Amount of Creator Coin received
     */
    function withdraw(
        uint256 amount,
        uint256 minOut
    ) external nonReentrant returns (uint256 creatorCoinOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();
        
        // 1-2. Unwrap: burn ShareOFT, get vault shares (internal)
        uint256 vaultShares = _unwrapInternal(amount, msg.sender);
        
        // 3. Redeem vault shares → Creator Coin (sent directly to user)
        creatorCoinOut = vault.redeem(vaultShares, msg.sender, address(this));
        
        // 4. Check slippage
        if (creatorCoinOut < minOut) revert SlippageExceeded();
        
        emit Withdrawn(msg.sender, amount, creatorCoinOut);
    }
    
    /**
     * @notice Withdraw with zero slippage protection (convenience)
     */
    function withdraw(uint256 amount) external nonReentrant returns (uint256 creatorCoinOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();
        
        uint256 vaultShares = _unwrapInternal(amount, msg.sender);
        creatorCoinOut = vault.redeem(vaultShares, msg.sender, address(this));
        
        emit Withdrawn(msg.sender, amount, creatorCoinOut);
    }
    
    // ================================
    // ADVANCED: WRAP & UNWRAP
    // (For integrations that already have vault shares)
    // ================================
    
    /**
     * @notice Wrap vault shares → ShareOFT tokens
     * @dev For advanced users who already have vault shares (akitaOV)
     * @param amount Amount of vault shares to wrap
     * @return amountOut Amount of ShareOFT tokens minted
     */
    function wrap(uint256 amount) external nonReentrant returns (uint256 amountOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();
        
        // Take vault shares from user
        IERC20(address(vault)).safeTransferFrom(msg.sender, address(this), amount);
        
        // Wrap internally
        amountOut = _wrapInternal(amount, msg.sender);
    }
    
    /**
     * @notice Unwrap ShareOFT tokens → vault shares
     * @dev For advanced users who want vault shares (akitaOV) directly
     * @param amount Amount of ShareOFT tokens to unwrap
     * @return amountOut Amount of vault shares released
     */
    function unwrap(uint256 amount) external nonReentrant returns (uint256 amountOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(shareOFT) == address(0)) revert ShareOFTNotSet();
        
        // Unwrap internally (burns from user)
        amountOut = _unwrapInternal(amount, msg.sender);
        
        // Transfer vault shares to user
        IERC20(address(vault)).safeTransfer(msg.sender, amountOut);
    }
    
    // ================================
    // INTERNAL WRAP/UNWRAP
    // ================================
    
    /**
     * @dev Internal wrap: locks vault shares, mints ShareOFT
     * @param amount Vault shares to lock (already in this contract)
     * @param user User to mint ShareOFT to and check whitelist
     */
    function _wrapInternal(uint256 amount, address user) internal returns (uint256 amountOut) {
        uint256 fee = 0;
        amountOut = amount;
        
        if (!isWhitelisted[user] && wrapFee > 0) {
            fee = (amount * wrapFee) / BASIS_POINTS;
            amountOut = amount - fee;
            totalWrapFees += fee;
            
            // Send fee (in vault shares)
            if (fee > 0) {
                IERC20(address(vault)).safeTransfer(feeRecipient, fee);
            }
        }
        
        // Track locked shares (minus fee)
        totalLocked += amountOut;
        
        // Mint ShareOFT to user
        shareOFT.mint(user, amountOut);
        totalMinted += amountOut;
        
        emit Wrapped(user, amount, amountOut, fee);
    }
    
    /**
     * @dev Internal unwrap: burns ShareOFT, releases vault shares
     * @param amount ShareOFT to burn
     * @param user User to burn from and check whitelist
     */
    function _unwrapInternal(uint256 amount, address user) internal returns (uint256 amountOut) {
        uint256 fee = 0;
        amountOut = amount;
        
        if (!isWhitelisted[user] && unwrapFee > 0) {
            fee = (amount * unwrapFee) / BASIS_POINTS;
            amountOut = amount - fee;
            totalUnwrapFees += fee;
        }
        
        if (totalLocked < amountOut) revert InsufficientLocked();
        
        // Burn ShareOFT from user
        shareOFT.burn(user, amount);
        totalMinted -= amount;
        
        // Release vault shares
        totalLocked -= amountOut;
        
        // Send fee (in vault shares)
        if (fee > 0) {
            IERC20(address(vault)).safeTransfer(feeRecipient, fee);
            totalLocked -= fee;
        }
        
        emit Unwrapped(user, amount, amountOut, fee);
    }
    
    // ================================
    // VIEW FUNCTIONS
    // ================================
    
    /**
     * @notice Preview how much ShareOFT you'll get for depositing Creator Coin
     */
    function previewDeposit(uint256 creatorCoinAmount) external view returns (uint256) {
        uint256 vaultShares = vault.previewDeposit(creatorCoinAmount);
        return _previewWrap(vaultShares, msg.sender);
    }
    
    /**
     * @notice Preview how much Creator Coin you'll get for withdrawing ShareOFT
     */
    function previewWithdraw(uint256 shareOFTAmount) external view returns (uint256) {
        uint256 vaultShares = _previewUnwrap(shareOFTAmount, msg.sender);
        return vault.previewRedeem(vaultShares);
    }
    
    /**
     * @notice Preview wrap output (vault shares → ShareOFT)
     */
    function previewWrap(uint256 amount, address user) external view returns (uint256) {
        return _previewWrap(amount, user);
    }
    
    /**
     * @notice Preview unwrap output (ShareOFT → vault shares)
     */
    function previewUnwrap(uint256 amount, address user) external view returns (uint256) {
        return _previewUnwrap(amount, user);
    }
    
    function _previewWrap(uint256 amount, address user) internal view returns (uint256) {
        if (isWhitelisted[user] || wrapFee == 0) return amount;
        return amount - (amount * wrapFee) / BASIS_POINTS;
    }
    
    function _previewUnwrap(uint256 amount, address user) internal view returns (uint256) {
        if (isWhitelisted[user] || unwrapFee == 0) return amount;
        return amount - (amount * unwrapFee) / BASIS_POINTS;
    }
    
    /**
     * @notice Get the current price per share (1e18 scale)
     */
    function pricePerShare() external view returns (uint256) {
        uint256 totalAssets = vault.totalAssets();
        uint256 totalSupply = vault.totalSupply();
        if (totalSupply == 0) return 1e18;
        return (totalAssets * 1e18) / totalSupply;
    }
    
    /**
     * @notice Check if wrapper is ready
     */
    function isReady() external view returns (bool) {
        return address(shareOFT) != address(0);
    }
    
    /**
     * @notice Check if wrapper is balanced (locked == minted)
     */
    function isBalanced() external view returns (bool) {
        return totalLocked == totalMinted;
    }
    
    /**
     * @notice Get wrapper reserves
     */
    function getReserves() external view returns (uint256 locked, uint256 minted) {
        return (totalLocked, totalMinted);
    }
    
    /**
     * @notice Get fee statistics
     */
    function getFeeStats() external view returns (uint256 wrapFeesCollected, uint256 unwrapFeesCollected) {
        return (totalWrapFees, totalUnwrapFees);
    }
    
    /**
     * @notice Get vault statistics
     */
    function getVaultStats() external view returns (
        uint256 totalAssets,
        uint256 totalSupply,
        uint256 _pricePerShare
    ) {
        totalAssets = vault.totalAssets();
        totalSupply = vault.totalSupply();
        _pricePerShare = totalSupply > 0 ? (totalAssets * 1e18) / totalSupply : 1e18;
    }
    
    /**
     * @notice Get all contract addresses
     */
    function getContracts() external view returns (
        address _creatorCoin,
        address _vault,
        address _shareOFT
    ) {
        return (
            address(creatorCoin),
            address(vault),
            address(shareOFT)
        );
    }
    
    /**
     * @notice Vault shares token address
     */
    function vaultToken() external view returns (address) {
        return address(vault);
    }
    
    /**
     * @notice ShareOFT token address  
     */
    function oftToken() external view returns (address) {
        return address(shareOFT);
    }
    
    /**
     * @notice Emergency verify - check balances match accounting
     */
    function verify() external view returns (bool) {
        uint256 actualLocked = IERC20(address(vault)).balanceOf(address(this));
        return actualLocked == totalLocked && totalLocked == totalMinted;
    }
    
    // ================================
    // EMERGENCY
    // ================================
    
    /**
     * @notice Emergency withdraw stuck tokens
     */
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }
    
    /**
     * @notice Refresh vault approval if needed
     */
    function refreshApproval() external onlyOwner {
        creatorCoin.approve(address(vault), type(uint256).max);
    }
}
