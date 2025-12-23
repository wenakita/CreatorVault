// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PayoutRouter
 * @author 0xakita.eth (CreatorVault)
 * @notice Routes Zora payoutRecipient fees to CreatorOVault → wsToken → burn
 * 
 * @dev DEPLOYMENT ORDER (CRITICAL FOR SECURITY):
 *      1. Creator deploys vault via CreatorOVaultFactory (while they are payoutRecipient)
 *      2. Creator deploys this PayoutRouter (pointing to their vault)
 *      3. Creator changes Zora token's payoutRecipient to this contract
 *      
 *      This order ensures the creator controls the vault before redirecting fees.
 * 
 * @dev FEE FLOW:
 *      ZORA → receives ZORA/ETH fees → converts → CreatorCoin
 *             → deposit → sAKITA → wrap → wsAKITA → queue for burn
 * 
 * @dev WEEKLY BURN SCHEDULE:
 *      - Fees accumulate in `pendingBurn`
 *      - Once per week, `startBurnWeek()` moves pending → active burn
 *      - Anyone can call `drip()` to burn portion based on time elapsed
 *      - Linear release: day 1 = 1/7, day 2 = 2/7, etc.
 * 
 * @dev WHY WEEKLY DRIP:
 *      - Smooths out price impact from large burns
 *      - Creates consistent deflationary pressure
 *      - Allows creator to pause/emergency withdraw if needed
 * 
 * @dev SECURITY:
 *      - Owner (creator) can pause burns
 *      - Owner can emergency withdraw before burn starts
 *      - Cannot change vault/wrapper after deployment (immutable)
 */
contract PayoutRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // =================================
    // INTERFACES
    // =================================
    
    interface ICreatorOVault {
        function deposit(uint256 assets, address receiver) external returns (uint256);
        function asset() external view returns (address);
    }
    
    interface ICreatorOVaultWrapper {
        function depositAndWrap(uint256 creatorCoinAmount) external returns (uint256 wsTokenOut);
        function vault() external view returns (address);
        function shareOFT() external view returns (address);
    }
    
    interface IBurnable {
        function burn(uint256 amount) external;
        function burn(address from, uint256 amount) external;
    }
    
    // =================================
    // STATE
    // =================================
    
    /// @notice The CreatorOVaultWrapper (immutable)
    ICreatorOVaultWrapper public immutable wrapper;
    
    /// @notice The vault (cached from wrapper)
    ICreatorOVault public immutable vault;
    
    /// @notice The underlying Creator Coin
    IERC20 public immutable creatorCoin;
    
    /// @notice The wsToken (ShareOFT)
    address public immutable wsToken;
    
    /// @notice wsTokens waiting to be burned (not yet scheduled)
    uint256 public pendingBurn;
    
    /// @notice wsTokens currently being burned this week
    uint256 public activeBurnAmount;
    
    /// @notice Timestamp when active burn week started
    uint256 public burnWeekStart;
    
    /// @notice Amount already burned from active week
    uint256 public burnedThisWeek;
    
    /// @notice Duration of burn period (default 7 days)
    uint256 public constant BURN_PERIOD = 7 days;
    
    /// @notice Whether burns are paused
    bool public burnsPaused;
    
    /// @notice Total wsTokens burned all time
    uint256 public totalBurned;
    
    // =================================
    // EVENTS
    // =================================
    
    event FeesReceived(address indexed token, uint256 amount);
    event ConvertedToWsToken(uint256 creatorCoinIn, uint256 wsTokenOut);
    event BurnWeekStarted(uint256 amount, uint256 timestamp);
    event Dripped(uint256 burnAmount, uint256 totalBurnedThisWeek, uint256 remaining);
    event BurnsPausedSet(bool paused);
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed to);
    
    // =================================
    // ERRORS
    // =================================
    
    error ZeroAddress();
    error BurnsPaused();
    error NoPendingBurn();
    error BurnWeekActive();
    error NoBurnActive();
    error NothingToDrip();
    
    // =================================
    // CONSTRUCTOR
    // =================================
    
    /**
     * @notice Deploy PayoutRouter
     * @param _wrapper The CreatorOVaultWrapper address
     * @param _owner The creator (will own this contract)
     * 
     * @dev IMPORTANT: Deploy this AFTER deploying your vault via the factory
     */
    constructor(address _wrapper, address _owner) Ownable(_owner) {
        if (_wrapper == address(0) || _owner == address(0)) revert ZeroAddress();
        
        wrapper = ICreatorOVaultWrapper(_wrapper);
        vault = ICreatorOVault(wrapper.vault());
        creatorCoin = IERC20(vault.asset());
        wsToken = wrapper.shareOFT();
        
        // Pre-approve for deposits
        creatorCoin.safeApprove(address(wrapper), type(uint256).max);
    }
    
    // =================================
    // RECEIVE FEES
    // =================================
    
    /**
     * @notice Receive ETH fees and convert to wsToken
     * @dev Called when Zora sends ETH fees to payoutRecipient
     *      Requires a DEX swap path: ETH → CreatorCoin
     */
    receive() external payable {
        emit FeesReceived(address(0), msg.value);
        // TODO: Swap ETH → CreatorCoin via DEX
        // For now, just hold ETH for manual handling
    }
    
    /**
     * @notice Receive ERC20 fees and convert to wsToken
     * @param token The token received (usually WETH or stablecoin)
     * @param amount The amount received
     * @dev Called manually after receiving ERC20 fees
     */
    function receiveFees(address token, uint256 amount) external nonReentrant {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit FeesReceived(token, amount);
        
        // If it's already the CreatorCoin, convert directly
        if (token == address(creatorCoin)) {
            _convertToWsToken(amount);
        }
        // TODO: Otherwise swap to CreatorCoin first
    }
    
    /**
     * @notice Convert CreatorCoin balance to wsToken and queue for burn
     * @dev Can be called by anyone to process pending CreatorCoin
     */
    function convertAndQueue() external nonReentrant {
        uint256 balance = creatorCoin.balanceOf(address(this));
        if (balance > 0) {
            _convertToWsToken(balance);
        }
    }
    
    /**
     * @dev Internal: deposit CreatorCoin → sAKITA → wsToken
     */
    function _convertToWsToken(uint256 creatorCoinAmount) internal {
        // Use wrapper's depositAndWrap for single transaction
        uint256 wsTokenOut = wrapper.depositAndWrap(creatorCoinAmount);
        
        pendingBurn += wsTokenOut;
        
        emit ConvertedToWsToken(creatorCoinAmount, wsTokenOut);
    }
    
    // =================================
    // WEEKLY BURN MECHANISM
    // =================================
    
    /**
     * @notice Start a new burn week, moving pending → active
     * @dev Can only be called if no active burn week or current week finished
     */
    function startBurnWeek() external nonReentrant {
        if (burnsPaused) revert BurnsPaused();
        if (pendingBurn == 0) revert NoPendingBurn();
        
        // Check if previous week is complete
        if (burnWeekStart > 0 && block.timestamp < burnWeekStart + BURN_PERIOD) {
            revert BurnWeekActive();
        }
        
        // Move pending to active
        activeBurnAmount = pendingBurn;
        pendingBurn = 0;
        burnWeekStart = block.timestamp;
        burnedThisWeek = 0;
        
        emit BurnWeekStarted(activeBurnAmount, block.timestamp);
    }
    
    /**
     * @notice Drip (burn) tokens based on time elapsed in current week
     * @dev Anyone can call this - no special permissions needed
     *      Linear release: after 3.5 days, 50% can be burned
     */
    function drip() external nonReentrant {
        if (burnsPaused) revert BurnsPaused();
        if (burnWeekStart == 0 || activeBurnAmount == 0) revert NoBurnActive();
        
        uint256 elapsed = block.timestamp - burnWeekStart;
        if (elapsed > BURN_PERIOD) {
            elapsed = BURN_PERIOD;
        }
        
        // Calculate how much should be burned by now (linear)
        uint256 shouldBeBurned = (activeBurnAmount * elapsed) / BURN_PERIOD;
        
        // How much more can we burn right now?
        uint256 canBurnNow = shouldBeBurned - burnedThisWeek;
        
        if (canBurnNow == 0) revert NothingToDrip();
        
        // Burn the tokens
        IBurnable(wsToken).burn(canBurnNow);
        
        burnedThisWeek += canBurnNow;
        totalBurned += canBurnNow;
        
        emit Dripped(canBurnNow, burnedThisWeek, activeBurnAmount - burnedThisWeek);
    }
    
    /**
     * @notice Get current drip status
     * @return canBurn Amount that can be burned right now
     * @return burned Amount burned this week so far
     * @return remaining Amount remaining to burn this week
     * @return weekEnds Timestamp when current burn week ends
     */
    function getDripStatus() external view returns (
        uint256 canBurn,
        uint256 burned,
        uint256 remaining,
        uint256 weekEnds
    ) {
        if (burnWeekStart == 0 || activeBurnAmount == 0) {
            return (0, 0, 0, 0);
        }
        
        uint256 elapsed = block.timestamp - burnWeekStart;
        if (elapsed > BURN_PERIOD) {
            elapsed = BURN_PERIOD;
        }
        
        uint256 shouldBeBurned = (activeBurnAmount * elapsed) / BURN_PERIOD;
        
        burned = burnedThisWeek;
        canBurn = shouldBeBurned > burned ? shouldBeBurned - burned : 0;
        remaining = activeBurnAmount - burned;
        weekEnds = burnWeekStart + BURN_PERIOD;
    }
    
    // =================================
    // ADMIN FUNCTIONS
    // =================================
    
    /**
     * @notice Pause/unpause burns
     * @dev Does not affect pending balance, just prevents burning
     */
    function setBurnsPaused(bool _paused) external onlyOwner {
        burnsPaused = _paused;
        emit BurnsPausedSet(_paused);
    }
    
    /**
     * @notice Emergency withdraw tokens (only pending, not active burn)
     * @param token The token to withdraw
     * @param amount Amount to withdraw
     * @param to Recipient address
     * @dev Cannot withdraw tokens in active burn cycle
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        
        // If withdrawing wsToken, reduce pending (can't touch active)
        if (token == wsToken) {
            require(amount <= pendingBurn, "Cannot withdraw active burn");
            pendingBurn -= amount;
        }
        
        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
        
        emit EmergencyWithdraw(token, amount, to);
    }
}

