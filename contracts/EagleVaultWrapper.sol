// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMintableBurnableOFT {
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}

/**
 * @title EagleVaultWrapper
 * @notice Wraps Vault EAGLE shares into OFT EAGLE tokens on hub chain
 * 
 * @dev ARCHITECTURE:
 *      On Ethereum (hub), there are TWO EAGLE tokens:
 *      1. EagleOVault (0xVAULT...) - Vault shares (from deposits)
 *      2. EagleShareOFT (0xEEEE...) - OFT token (SAME address as all chains!)
 * 
 *      This bridge converts between them 1:1
 * 
 * @dev USER FLOWS:
 *      - Deposit → Get vault shares → Wrap to OFT → Trade/Bridge
 *      - Receive OFT → Unwrap to vault shares → Withdraw
 * 
 * @dev MECHANISM:
 *      - wrap(): Lock vault shares, mint OFT (1:1)
 *      - unwrap(): Burn OFT, release vault shares (1:1)
 *      - Maintains perfect 1:1 peg
 *      - No fees on wrapping/unwrapping
 */
contract EagleVaultWrapper is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // =================================
    // STATE VARIABLES
    // =================================
    
    /// @notice Vault EAGLE (ERC20 shares from EagleOVault)
    IERC20 public immutable VAULT_EAGLE;
    
    /// @notice OFT EAGLE (cross-chain compatible token)
    IMintableBurnableOFT public immutable OFT_EAGLE;
    
    /// @notice Tracking
    uint256 public totalLocked;    // Vault shares locked
    uint256 public totalMinted;    // OFT tokens minted
    
    /// @notice Fee configuration
    uint256 public depositFee = 100;   // 1% (100 basis points)
    uint256 public withdrawFee = 200;  // 2% (200 basis points)
    uint256 public constant MAX_FEE = 1000; // 10% maximum
    uint256 public constant BASIS_POINTS = 10000;
    
    /// @notice Fee recipients
    address public feeRecipient;
    
    /// @notice Presale whitelist (no fees)
    mapping(address => bool) public isWhitelisted;
    
    /// @notice Fee statistics
    uint256 public totalDepositFees;
    uint256 public totalWithdrawFees;
    
    // =================================
    // EVENTS
    // =================================
    
    event Wrapped(address indexed user, uint256 amount, uint256 fee);
    event Unwrapped(address indexed user, uint256 amount, uint256 fee);
    event FeeCollected(address indexed user, uint256 amount, string feeType);
    event WhitelistUpdated(address indexed user, bool isWhitelisted);
    event FeesUpdated(uint256 depositFee, uint256 withdrawFee);
    event FeeRecipientUpdated(address indexed newRecipient);
    
    // =================================
    // ERRORS
    // =================================
    
    error ZeroAmount();
    error InsufficientLockedShares();
    error BridgeImbalance();
    error FeeExceedsLimit();
    error ZeroFeeRecipient();
    
    // =================================
    // CONSTRUCTOR
    // =================================
    
    /**
     * @param _vaultEagle EagleOVault address (vault shares)
     * @param _oftEagle EagleShareOFT address (OFT token)
     * @param _owner Bridge owner
     */
    constructor(
        address _vaultEagle,
        address _oftEagle,
        address _feeRecipient,
        address _owner
    ) Ownable(_owner) {
        require(_vaultEagle != address(0) && _oftEagle != address(0), "Zero address");
        require(_feeRecipient != address(0), "Zero fee recipient");
        
        VAULT_EAGLE = IERC20(_vaultEagle);
        OFT_EAGLE = IMintableBurnableOFT(_oftEagle);
        feeRecipient = _feeRecipient;
        
        // Owner is whitelisted by default (no fees)
        isWhitelisted[_owner] = true;
        
        // Vault beneficiary whitelisted (for fee injection cycle - no double tax)
        // This allows vault fees to be re-injected without additional fees
        // Fee collection → vaultBeneficiary → deposit to vault → wrap → no fee ✅
        isWhitelisted[_feeRecipient] = true;
    }
    
    // =================================
    // WRAPPING FUNCTIONS
    // =================================
    
    /**
     * @notice Wrap vault shares → OFT tokens
     * @dev Locks vault shares, mints OFT tokens with 1% deposit fee (unless whitelisted)
     * @param amount Amount of vault shares to wrap
     */
    function wrap(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        
        // Calculate fee (1% deposit fee, unless whitelisted)
        uint256 fee = 0;
        uint256 amountAfterFee = amount;
        
        if (!isWhitelisted[msg.sender]) {
            fee = (amount * depositFee) / BASIS_POINTS;
            amountAfterFee = amount - fee;
            
            if (fee > 0) {
                totalDepositFees += fee;
                emit FeeCollected(msg.sender, fee, "deposit");
            }
        }
        
        // Lock vault shares (including fee)
        VAULT_EAGLE.safeTransferFrom(msg.sender, address(this), amount);
        totalLocked += amount;
        
        // Send fee to recipient if applicable
        if (fee > 0) {
            VAULT_EAGLE.safeTransfer(feeRecipient, fee);
            totalLocked -= fee;  // Fee not locked, sent to recipient
        }
        
        // Mint OFT tokens (amount minus fee)
        OFT_EAGLE.mint(msg.sender, amountAfterFee);
        totalMinted += amountAfterFee;
        
        emit Wrapped(msg.sender, amountAfterFee, fee);
    }
    
    /**
     * @notice Unwrap OFT tokens → vault shares
     * @dev Burns OFT tokens, releases vault shares with 2% withdraw fee (unless whitelisted)
     * @param amount Amount of OFT tokens to unwrap
     */
    function unwrap(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        
        // Calculate fee (2% withdraw fee, unless whitelisted)
        uint256 fee = 0;
        uint256 amountAfterFee = amount;
        
        if (!isWhitelisted[msg.sender]) {
            fee = (amount * withdrawFee) / BASIS_POINTS;
            amountAfterFee = amount - fee;
            
            if (fee > 0) {
                totalWithdrawFees += fee;
                emit FeeCollected(msg.sender, fee, "withdraw");
            }
        }
        
        if (totalLocked < amountAfterFee) revert InsufficientLockedShares();
        
        // Burn OFT tokens (full amount including fee)
        OFT_EAGLE.burn(msg.sender, amount);
        totalMinted -= amount;
        
        // Release vault shares (amount minus fee)
        VAULT_EAGLE.safeTransfer(msg.sender, amountAfterFee);
        totalLocked -= amountAfterFee;
        
        // Fee stays locked (becomes treasury/protocol owned)
        // Or send to fee recipient
        if (fee > 0) {
            VAULT_EAGLE.safeTransfer(feeRecipient, fee);
            totalLocked -= fee;
        }
        
        emit Unwrapped(msg.sender, amountAfterFee, fee);
    }
    
    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    /**
     * @notice Check if bridge is balanced (should always be true)
     * @return True if locked vault shares == minted OFT tokens
     */
    function isBalanced() external view returns (bool) {
        return totalLocked == totalMinted;
    }
    
    /**
     * @notice Get bridge reserves
     * @return locked Vault shares locked in bridge
     * @return minted OFT tokens minted by bridge
     */
    function getReserves() external view returns (uint256 locked, uint256 minted) {
        return (totalLocked, totalMinted);
    }
    
    /**
     * @notice Get vault EAGLE address
     */
    function vaultToken() external view returns (address) {
        return address(VAULT_EAGLE);
    }
    
    /**
     * @notice Get OFT EAGLE address
     */
    function oftToken() external view returns (address) {
        return address(OFT_EAGLE);
    }
    
    /**
     * @notice Emergency check - verify balances match accounting
     */
    function verify() external view returns (bool) {
        uint256 actualLocked = VAULT_EAGLE.balanceOf(address(this));
        return actualLocked == totalLocked && totalLocked == totalMinted;
    }
    
    // =================================
    // FEE MANAGEMENT (OWNER ONLY)
    // =================================
    
    /**
     * @notice Update wrap/unwrap fees
     * @param _depositFee Deposit fee in basis points (max 10%)
     * @param _withdrawFee Withdraw fee in basis points (max 10%)
     */
    function setFees(uint256 _depositFee, uint256 _withdrawFee) external onlyOwner {
        if (_depositFee > MAX_FEE || _withdrawFee > MAX_FEE) revert FeeExceedsLimit();
        
        depositFee = _depositFee;
        withdrawFee = _withdrawFee;
        
        emit FeesUpdated(_depositFee, _withdrawFee);
    }
    
    /**
     * @notice Update fee recipient
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert ZeroFeeRecipient();
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }
    
    /**
     * @notice Add address to presale whitelist (no fees)
     * @param user Address to whitelist
     * @param whitelisted True to whitelist, false to remove
     */
    function setWhitelist(address user, bool whitelisted) external onlyOwner {
        isWhitelisted[user] = whitelisted;
        emit WhitelistUpdated(user, whitelisted);
    }
    
    /**
     * @notice Batch whitelist multiple presale participants
     * @param users Array of addresses to whitelist
     */
    function batchWhitelist(address[] calldata users) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            isWhitelisted[users[i]] = true;
            emit WhitelistUpdated(users[i], true);
        }
    }
    
    /**
     * @notice Check if user is whitelisted
     */
    function checkWhitelist(address user) external view returns (bool) {
        return isWhitelisted[user];
    }
    
    /**
     * @notice Get current fees
     */
    function getFees() external view returns (uint256 deposit, uint256 withdraw) {
        return (depositFee, withdrawFee);
    }
    
    /**
     * @notice Get fee statistics
     */
    function getFeeStats() external view returns (uint256 totalDeposit, uint256 totalWithdraw) {
        return (totalDepositFees, totalWithdrawFees);
    }
}

