// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title veERC4626BoostManager
 * @author 0xakita.eth
 * @notice Calculates lottery boost based on veERC4626 holdings.
 * @dev Users who lock ■4626 into veERC4626 receive higher win probability.
 */

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

interface IveERC4626 {
    function getVotingPower(address user) external view returns (uint256);
    function getTotalVotingPower() external view returns (uint256);
    function hasActiveLock(address user) external view returns (bool);
    function getRemainingLockTime(address user) external view returns (uint256);
}

interface ICreatorGaugeController {
    function getJackpotReserve(address vault) external view returns (uint256);
}

contract veERC4626BoostManager is Ownable, ReentrancyGuard {
    // ================================
    // CONSTANTS
    // ================================

    /// @notice Precision for boost calculations (10000 = 100%)
    uint256 public constant BOOST_PRECISION = 10000;

    /// @notice Maximum boost for veERC4626 lockers (2.5x)
    uint256 public constant MAX_VE_BOOST = 25000;

    /// @notice Minimum holding blocks for flash loan protection
    uint256 public constant MIN_HOLDING_BLOCKS = 10;

    // ================================
    // STATE
    // ================================

    /// @notice veERC4626 token
    IveERC4626 public immutable veERC4626;

    /// @notice GaugeController (optional, for probability boost)
    ICreatorGaugeController public gaugeController;

    /// @notice Base boost (1.0x = 10000 bps)
    uint256 public baseBoost = 10000;

    /// @notice Max boost (2.5x = 25000 bps)
    uint256 public maxBoost = 25000;

    /// @notice Minimum veERC4626 to participate
    uint256 public minVotingPower = 0.1 ether;

    /// @notice Flash loan protection: last balance update block
    mapping(address => uint256) public lastBalanceUpdateBlock;

    /// @notice Boost parameters locked after first set
    bool public boostParametersLocked;

    // ================================
    // EVENTS
    // ================================

    event BoostCalculated(address indexed user, uint256 boostMultiplier);
    event BoostParametersUpdated(uint256 baseBoost, uint256 maxBoost);
    event GaugeControllerUpdated(address indexed controller);
    event MinVotingPowerUpdated(uint256 minPower);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error InvalidBoostParameters();
    error BoostParametersAreLocked();

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(address _veERC4626, address _owner) Ownable(_owner) {
        if (_veERC4626 == address(0)) revert ZeroAddress();
        veERC4626 = IveERC4626(_veERC4626);
    }

    // ================================
    // BOOST CALCULATION
    // ================================

    /**
     * @notice Calculate boost multiplier for a user
     * @param user User address
     * @return boostMultiplier Boost in basis points (10000 = 1.0x, 25000 = 2.5x)
     */
    function calculateBoost(address user) public view returns (uint256 boostMultiplier) {
        return calculateBoostWithProtection(user);
    }

    /**
     * @notice Calculate boost with flash loan protection
     * @param user User address
     * @return boostMultiplier Protected boost multiplier
     */
    function calculateBoostWithProtection(address user) public view returns (uint256 boostMultiplier) {
        // Flash loan protection
        if (block.number < lastBalanceUpdateBlock[user] + MIN_HOLDING_BLOCKS) {
            return baseBoost;
        }

        // Get user's veERC4626 voting power
        uint256 userPower = veERC4626.getVotingPower(user);
        uint256 totalPower = veERC4626.getTotalVotingPower();

        // No veERC4626 = base boost only
        if (userPower == 0 || totalPower == 0) {
            return baseBoost;
        }

        // Below minimum = base boost
        if (userPower < minVotingPower) {
            return baseBoost;
        }

        // Calculate normalized boost
        // boostMultiplier = baseBoost + (userShare × (maxBoost - baseBoost))
        // Normalize: if user has 1% of total supply, they get ~1% of the boost range.
        // Scale up for reasonable distribution (multiply by 100 so 1% → 100% of boost range).
        uint256 scaledShare = Math.mulDiv(userPower, BOOST_PRECISION * 100, totalPower);
        if (scaledShare > BOOST_PRECISION) scaledShare = BOOST_PRECISION;

        uint256 boostRange = maxBoost - baseBoost;
        boostMultiplier = baseBoost + ((boostRange * scaledShare) / BOOST_PRECISION);

        // Cap at max
        if (boostMultiplier > maxBoost) {
            boostMultiplier = maxBoost;
        }

        return boostMultiplier;
    }

    /**
     * @notice Calculate boost and emit event
     * @param user User address
     * @return boostMultiplier Boost multiplier
     */
    function getBoostWithEvent(address user) external returns (uint256 boostMultiplier) {
        boostMultiplier = calculateBoost(user);
        emit BoostCalculated(user, boostMultiplier);
    }

    /**
     * @notice Get total probability boost for lottery
     * @param user User address
     * @return totalBoostBps Total probability boost in basis points
     * @dev This is used by CreatorLotteryManager for win chance calculation
     */
    function getTotalProbabilityBoost(address user) external view returns (uint256 totalBoostBps) {
        // veERC4626 lockers get probability boost based on their lock
        if (!veERC4626.hasActiveLock(user)) {
            return 0;
        }

        // Get remaining lock time as a proportion of max
        uint256 remainingTime = veERC4626.getRemainingLockTime(user);
        uint256 maxLockTime = 4 * 365 days;

        // Max probability boost: 690 bps (6.9%) at 4 year lock
        uint256 maxProbBoost = 690;

        // Linear scaling based on lock time
        totalBoostBps = (maxProbBoost * remainingTime) / maxLockTime;

        return totalBoostBps;
    }

    /**
     * @notice Preview boost for a user (convenience function)
     * @param user User address
     * @return multiplier Boost multiplier (10000 = 1x)
     * @return hasLock Whether user has active lock
     * @return lockTimeRemaining Remaining lock time in seconds
     */
    function previewBoost(address user) external view returns (
        uint256 multiplier,
        bool hasLock,
        uint256 lockTimeRemaining
    ) {
        multiplier = calculateBoost(user);
        hasLock = veERC4626.hasActiveLock(user);
        lockTimeRemaining = veERC4626.getRemainingLockTime(user);
    }

    /**
     * @notice Get boost info for display
     * @param user User address
     */
    function getBoostInfo(address user) external view returns (
        uint256 boostMultiplier,
        uint256 userVotingPower,
        uint256 totalVotingPower,
        uint256 userShareBps,
        bool isProtected
    ) {
        boostMultiplier = calculateBoost(user);
        userVotingPower = veERC4626.getVotingPower(user);
        totalVotingPower = veERC4626.getTotalVotingPower();
        
        if (totalVotingPower > 0) {
            userShareBps = (userVotingPower * BOOST_PRECISION) / totalVotingPower;
        }
        
        isProtected = block.number < lastBalanceUpdateBlock[user] + MIN_HOLDING_BLOCKS;
    }

    // ================================
    // FLASH LOAN PROTECTION
    // ================================

    /**
     * @notice Update balance tracking (called by veERC4626 on lock/unlock)
     * @param user User whose balance changed
     */
    function updateBalanceTracking(address user) external {
        require(msg.sender == address(veERC4626), "Only veERC4626");
        lastBalanceUpdateBlock[user] = block.number;
    }

    // ================================
    // ADMIN
    // ================================

    /**
     * @notice Set boost parameters (can only be set once, then locked)
     * @param _baseBoost Base boost (10000 = 1x)
     * @param _maxBoost Max boost (25000 = 2.5x)
     */
    function setBoostParameters(uint256 _baseBoost, uint256 _maxBoost) external onlyOwner {
        if (boostParametersLocked) revert BoostParametersAreLocked();
        if (_baseBoost == 0 || _maxBoost <= _baseBoost) revert InvalidBoostParameters();
        if (_maxBoost > MAX_VE_BOOST) revert InvalidBoostParameters();

        baseBoost = _baseBoost;
        maxBoost = _maxBoost;
        boostParametersLocked = true;

        emit BoostParametersUpdated(_baseBoost, _maxBoost);
    }

    function setGaugeController(address _controller) external onlyOwner {
        gaugeController = ICreatorGaugeController(_controller);
        emit GaugeControllerUpdated(_controller);
    }

    function setMinVotingPower(uint256 _minPower) external onlyOwner {
        minVotingPower = _minPower;
        emit MinVotingPowerUpdated(_minPower);
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    /**
     * @notice Check if user has any boost
     */
    function hasBoost(address user) external view returns (bool) {
        return calculateBoost(user) > baseBoost;
    }

    /**
     * @notice Get effective boost as a percentage (e.g., 250 for 2.5x)
     */
    function getBoostPercentage(address user) external view returns (uint256) {
        return (calculateBoost(user) * 100) / BOOST_PRECISION;
    }

    /**
     * @notice Get the max possible boost
     */
    function getMaxBoost() external view returns (uint256) {
        return maxBoost;
    }
}

