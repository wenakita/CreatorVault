// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title veAKITABoostManager
 * @author 0xakita.eth (CreatorVault)
 * @notice Calculates lottery boost based on veAKITA holdings
 * 
 * @dev BOOST MECHANISM:
 *      Users who lock wrapped shares into veAKITA get increased lottery win chances.
 *      The boost scales linearly based on:
 *      1. Lock duration (longer = more boost)
 *      2. Relative veAKITA balance vs total supply
 * 
 * @dev BOOST FORMULA:
 *      boostMultiplier = 10000 + (userShare × (maxBoost - 10000))
 *      Where userShare = userVotingPower / totalVotingPower
 * 
 * @dev BOOST TIERS:
 *      - No lock:     1.0x (10000 bps)
 *      - Minimum:     1.0x 
 *      - Maximum:     2.5x (25000 bps) for veAKITA lockers
 * 
 * @dev FLASH LOAN PROTECTION:
 *      Users must hold tokens for MIN_HOLDING_BLOCKS before getting boost
 */

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IveAKITA {
    function getVotingPower(address user) external view returns (uint256);
    function getTotalVotingPower() external view returns (uint256);
    function hasActiveLock(address user) external view returns (bool);
    function getRemainingLockTime(address user) external view returns (uint256);
}

interface ICreatorGaugeController {
    function getJackpotReserve(address vault) external view returns (uint256);
}

contract veAKITABoostManager is Ownable, ReentrancyGuard {
    // ================================
    // CONSTANTS
    // ================================

    /// @notice Precision for boost calculations (10000 = 100%)
    uint256 public constant BOOST_PRECISION = 10000;

    /// @notice Maximum boost for veAKITA lockers (2.5x)
    uint256 public constant MAX_VE_BOOST = 25000;

    /// @notice Minimum holding blocks for flash loan protection
    uint256 public constant MIN_HOLDING_BLOCKS = 10;

    // ================================
    // STATE
    // ================================

    /// @notice veAKITA token
    IveAKITA public immutable veAKITA;

    /// @notice GaugeController (optional, for probability boost)
    ICreatorGaugeController public gaugeController;

    /// @notice Base boost (1.0x = 10000 bps)
    uint256 public baseBoost = 10000;

    /// @notice Max boost (2.5x = 25000 bps)
    uint256 public maxBoost = 25000;

    /// @notice Minimum veAKITA to participate
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

    constructor(address _veAKITA, address _owner) Ownable(_owner) {
        if (_veAKITA == address(0)) revert ZeroAddress();
        veAKITA = IveAKITA(_veAKITA);
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

        // Get user's veAKITA voting power
        uint256 userPower = veAKITA.getVotingPower(user);
        uint256 totalPower = veAKITA.getTotalVotingPower();

        // No veAKITA = base boost only
        if (userPower == 0 || totalPower == 0) {
            return baseBoost;
        }

        // Below minimum = base boost
        if (userPower < minVotingPower) {
            return baseBoost;
        }

        // Calculate normalized boost
        // boostMultiplier = baseBoost + (userShare × (maxBoost - baseBoost))
        uint256 userShareBps = (userPower * BOOST_PRECISION) / totalPower;
        
        // Normalize: if user has 1% of total supply, they get ~1% of the boost range
        // Scale up for reasonable distribution (multiply by 100 so 1% → 100% of boost range)
        uint256 scaledShare = userShareBps * 100;
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
        // veAKITA lockers get probability boost based on their lock
        if (!veAKITA.hasActiveLock(user)) {
            return 0;
        }

        // Get remaining lock time as a proportion of max
        uint256 remainingTime = veAKITA.getRemainingLockTime(user);
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
        hasLock = veAKITA.hasActiveLock(user);
        lockTimeRemaining = veAKITA.getRemainingLockTime(user);
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
        userVotingPower = veAKITA.getVotingPower(user);
        totalVotingPower = veAKITA.getTotalVotingPower();
        
        if (totalVotingPower > 0) {
            userShareBps = (userVotingPower * BOOST_PRECISION) / totalVotingPower;
        }
        
        isProtected = block.number < lastBalanceUpdateBlock[user] + MIN_HOLDING_BLOCKS;
    }

    // ================================
    // FLASH LOAN PROTECTION
    // ================================

    /**
     * @notice Update balance tracking (called by veAKITA on lock/unlock)
     * @param user User whose balance changed
     */
    function updateBalanceTracking(address user) external {
        require(msg.sender == address(veAKITA), "Only veAKITA");
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

