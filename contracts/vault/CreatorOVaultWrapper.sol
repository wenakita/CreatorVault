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
 *      - deposit(akita) → ■AKITA  (one tx!)
 *      - withdraw(■AKITA) → akita (one tx!)
 *      
 *      INTERNAL (Advanced, for integrations):
 *      - wrap(▢AKITA) → ■AKITA
 *      - unwrap(■AKITA) → ▢AKITA
 *      
 * @dev WHAT USERS SEE:
 *      "I deposit 1 akita, I get 1 ■AKITA"
 *      "I withdraw 1 ■AKITA, I get 1 akita"
 *      
 *      They never see vault shares (▢AKITA), wrapping, or the 10^3 offset.
 * 
 * @dev NORMALIZATION:
 *      The vault uses a 10^3 offset for inflation attack protection:
 *      - Deposit 1 AKITA → ~1000 ▢AKITA (vault shares)
 *      
 *      This wrapper normalizes the amounts:
 *      - Wrap 1000 ▢AKITA → 1 ■AKITA (÷1000)
 *      - Unwrap 1 ■AKITA → 1000 ▢AKITA (×1000)
 *      
 *      Result: 1 AKITA ≈ 1 ■AKITA (clean UX!)
 * 
 * @dev CROSS-CHAIN COMPATIBLE:
 *      Constructor only takes immutables
 *      Chain-specific shareOFT set via setShareOFT() after deployment
 */
contract CreatorOVaultWrapper is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ================================
    // CONSTANTS
    // ================================
    
    /**
     * @notice Normalization factor to offset the vault's 10^3 decimals offset
     * @dev The vault uses _decimalsOffset() = 3, meaning:
     *      - 1 AKITA deposited → ~1000 ▢AKITA shares
     *      
     *      We normalize this in wrap/unwrap:
     *      - Wrap: ■AKITA = ▢AKITA / 1000
     *      - Unwrap: ▢AKITA = ■AKITA * 1000
     *      
     *      Result: 1 AKITA ≈ 1 ■AKITA (clean UX!)
     */
    uint256 public constant NORMALIZATION_FACTOR = 1000; // 10^3
    
    // ================================
    // IMMUTABLES
    // ================================
    
    /// @notice Creator Coin token (e.g., akita) - the underlying asset
    IERC20 public immutable creatorCoin;
    
    /// @notice CreatorOVault (ERC-4626) - converts Creator Coin to vault shares
    IERC4626 public immutable vault;
    
    // ================================
    // MUTABLE STATE
    // ================================
    
    /// @notice ShareOFT token (e.g., ■AKITA) - set post-deploy
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
    error AmountTooSmallToNormalize(); // Less than NORMALIZATION_FACTOR
    
    // ================================
    // CONSTRUCTOR
    // ================================
    
    /**
     * @notice Deploy wrapper (same address possible on all chains)
     * @param _creatorCoin Creator Coin address (e.g., akita)
     * @param _vault CreatorOVault address (ERC-4626)
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
     * @param _shareOFT CreatorShareOFT address (e.g., ■AKITA)
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
     * @dev USER SEES: akita → ■AKITA
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
     * @dev USER SEES: ■AKITA → akita
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
     * @dev For advanced users who already have vault shares (▢AKITA)
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
     * @dev For advanced users who want vault shares (▢AKITA) directly
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
     * @dev Internal wrap: locks vault shares, mints NORMALIZED ShareOFT
     * @param vaultSharesIn Vault shares to lock (already in this contract)
     * @param user User to mint ShareOFT to and check whitelist
     * @return shareOFTOut Normalized share token amount (■AKITA = vaultShares / 1000)
     * 
     * @dev NORMALIZATION:
     *      1000 ▢AKITA → 1 ■AKITA
     *      This makes: 1 AKITA ≈ 1 ■AKITA (clean UX!)
     */
    function _wrapInternal(uint256 vaultSharesIn, address user) internal returns (uint256 shareOFTOut) {
        // Must have at least NORMALIZATION_FACTOR shares to wrap
        if (vaultSharesIn < NORMALIZATION_FACTOR) revert AmountTooSmallToNormalize();
        
        uint256 fee = 0;
        uint256 vaultSharesAfterFee = vaultSharesIn;
        
        if (!isWhitelisted[user] && wrapFee > 0) {
            fee = (vaultSharesIn * wrapFee) / BASIS_POINTS;
            vaultSharesAfterFee = vaultSharesIn - fee;
            totalWrapFees += fee;
            
            // Send fee (in vault shares)
            if (fee > 0) {
                IERC20(address(vault)).safeTransfer(feeRecipient, fee);
            }
        }
        
        // Track locked shares (minus fee)
        totalLocked += vaultSharesAfterFee;
        
        // NORMALIZE: Divide by 1000 to get share token amount
        // 1000 ▢AKITA → 1 ■AKITA
        shareOFTOut = vaultSharesAfterFee / NORMALIZATION_FACTOR;
        
        // Mint normalized share token to user
        shareOFT.mint(user, shareOFTOut);
        totalMinted += shareOFTOut;
        
        emit Wrapped(user, vaultSharesIn, shareOFTOut, fee);
    }
    
    /**
     * @dev Internal unwrap: burns ShareOFT, releases DENORMALIZED vault shares
     * @param shareOFTIn Normalized share token amount (■AKITA) to burn
     * @param user User to burn from and check whitelist
     * @return vaultSharesOut Denormalized vault shares (▢AKITA = ■AKITA * 1000)
     * 
     * @dev DENORMALIZATION:
     *      1 ■AKITA → 1000 ▢AKITA
     *      This makes: 1 ■AKITA ≈ 1 AKITA (clean UX!)
     */
    function _unwrapInternal(uint256 shareOFTIn, address user) internal returns (uint256 vaultSharesOut) {
        // DENORMALIZE: Multiply by 1000 to get vault shares
        // 1 ■AKITA → 1000 ▢AKITA
        uint256 vaultSharesBeforeFee = shareOFTIn * NORMALIZATION_FACTOR;
        
        uint256 fee = 0;
        vaultSharesOut = vaultSharesBeforeFee;
        
        if (!isWhitelisted[user] && unwrapFee > 0) {
            fee = (vaultSharesBeforeFee * unwrapFee) / BASIS_POINTS;
            vaultSharesOut = vaultSharesBeforeFee - fee;
            totalUnwrapFees += fee;
        }
        
        if (totalLocked < vaultSharesBeforeFee) revert InsufficientLocked();
        
        // Burn normalized share token from user
        shareOFT.burn(user, shareOFTIn);
        totalMinted -= shareOFTIn;
        
        // Release vault shares (denormalized)
        totalLocked -= vaultSharesBeforeFee;
        
        // Send fee (in vault shares)
        if (fee > 0) {
            IERC20(address(vault)).safeTransfer(feeRecipient, fee);
        }
        
        emit Unwrapped(user, shareOFTIn, vaultSharesOut, fee);
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
     * @notice Preview wrap output (vaultShares → ShareOFT)
     */
    function previewWrap(uint256 amount, address user) external view returns (uint256) {
        return _previewWrap(amount, user);
    }
    
    /**
     * @notice Preview unwrap output (ShareOFT → vaultShares)
     */
    function previewUnwrap(uint256 amount, address user) external view returns (uint256) {
        return _previewUnwrap(amount, user);
    }
    
    /**
     * @dev Preview wrap with normalization: vaultShares → share token (■AKITA)
     */
    function _previewWrap(uint256 vaultShares, address user) internal view returns (uint256 shareOFTAmount) {
        uint256 afterFee = vaultShares;
        if (!isWhitelisted[user] && wrapFee > 0) {
            afterFee = vaultShares - (vaultShares * wrapFee) / BASIS_POINTS;
        }
        // NORMALIZE: ÷1000
        shareOFTAmount = afterFee / NORMALIZATION_FACTOR;
    }
    
    /**
     * @dev Preview unwrap with denormalization: share token (■AKITA) → vaultShares
     */
    function _previewUnwrap(uint256 shareOFTAmount, address user) internal view returns (uint256 vaultShares) {
        // DENORMALIZE: ×1000
        uint256 vaultSharesBeforeFee = shareOFTAmount * NORMALIZATION_FACTOR;
        
        if (isWhitelisted[user] || unwrapFee == 0) return vaultSharesBeforeFee;
        return vaultSharesBeforeFee - (vaultSharesBeforeFee * unwrapFee) / BASIS_POINTS;
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
     * @notice Check if wrapper is balanced (locked vault shares == minted share tokens * 1000)
     * @dev Due to normalization: totalLocked (▢AKITA) == totalMinted (■AKITA) * 1000
     */
    function isBalanced() external view returns (bool) {
        return totalLocked == totalMinted * NORMALIZATION_FACTOR;
    }
    
    /**
     * @notice Get wrapper reserves
     * @return locked Vault shares locked (▢AKITA, NOT normalized)
     * @return minted ShareOFT minted (■AKITA, normalized)
     * @dev Note: locked = minted * 1000 when balanced
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
     * @dev With normalization: actualLocked == totalLocked == totalMinted * 1000
     */
    function verify() external view returns (bool) {
        uint256 actualLocked = IERC20(address(vault)).balanceOf(address(this));
        return actualLocked == totalLocked && totalLocked == totalMinted * NORMALIZATION_FACTOR;
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
