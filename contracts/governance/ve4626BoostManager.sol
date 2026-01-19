// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ve4626BoostManager
 * @author 0xakita.eth
 * @notice Calculates lottery boost based on ve4626 holdings.
 * @dev Users who lock ■4626 into ve4626 receive higher win probability.
 */

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

interface Ive4626 {
    function getVotingPower(address user) external view returns (uint256);
    function getTotalVotingPower() external view returns (uint256);
    function hasActiveLock(address user) external view returns (bool);
    function getRemainingLockTime(address user) external view returns (uint256);
}

interface ICreatorGaugeController {
    function getJackpotReserve(address vault) external view returns (uint256);
}

contract ve4626BoostManager is Ownable, ReentrancyGuard {
    // ================================
    // CONSTANTS
    // ================================

    /// @notice Precision for boost calculations (10000 = 100%)
    uint256 public constant BOOST_PRECISION = 10000;

    /// @notice Maximum boost for ve4626 lockers (2.5x)
    uint256 public constant MAX_VE_BOOST = 25000;

    /// @notice Minimum holding blocks for flash loan protection
    uint256 public constant MIN_HOLDING_BLOCKS = 10;

    // ================================
    // STATE
    // ================================

    /// @notice ve4626 token
    Ive4626 public immutable ve4626;

    /// @notice GaugeController (optional, for probability boost)
    ICreatorGaugeController public gaugeController;

    /// @notice Base boost (1.0x = 10000 bps)
    uint256 public baseBoost = 10000;

    /// @notice Max boost (2.5x = 25000 bps)
    uint256 public maxBoost = 25000;

    /// @notice Minimum ve4626 to participate
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

    constructor(address _ve4626, address _owner) Ownable(_owner) {
        if (_ve4626 == address(0)) revert ZeroAddress();
        ve4626 = Ive4626(_ve4626);
    }

    // ================================
    // BOOST CALCULATION
    // ================================

    function calculateBoost(address user) public view returns (uint256 boostMultiplier) {
        return calculateBoostWithProtection(user);
    }

    function calculateBoostWithProtection(address user) public view returns (uint256 boostMultiplier) {
        if (block.number < lastBalanceUpdateBlock[user] + MIN_HOLDING_BLOCKS) {
            return baseBoost;
        }

        uint256 userPower = ve4626.getVotingPower(user);
        uint256 totalPower = ve4626.getTotalVotingPower();

        if (userPower == 0 || totalPower == 0) {
            return baseBoost;
        }

        if (userPower < minVotingPower) {
            return baseBoost;
        }

        uint256 scaledShare = Math.mulDiv(userPower, BOOST_PRECISION * 100, totalPower);
        if (scaledShare > BOOST_PRECISION) scaledShare = BOOST_PRECISION;

        uint256 boostRange = maxBoost - baseBoost;
        boostMultiplier = baseBoost + ((boostRange * scaledShare) / BOOST_PRECISION);

        if (boostMultiplier > maxBoost) {
            boostMultiplier = maxBoost;
        }

        return boostMultiplier;
    }

    function getBoostWithEvent(address user) external returns (uint256 boostMultiplier) {
        boostMultiplier = calculateBoost(user);
        emit BoostCalculated(user, boostMultiplier);
    }

    function getTotalProbabilityBoost(address user) external view returns (uint256 totalBoostBps) {
        if (!ve4626.hasActiveLock(user)) {
            return 0;
        }

        uint256 remainingTime = ve4626.getRemainingLockTime(user);
        uint256 maxLockTime = 4 * 365 days;

        uint256 maxProbBoost = 690;
        totalBoostBps = (maxProbBoost * remainingTime) / maxLockTime;

        return totalBoostBps;
    }

    function previewBoost(address user)
        external
        view
        returns (uint256 multiplier, bool hasLock, uint256 lockTimeRemaining)
    {
        multiplier = calculateBoost(user);
        hasLock = ve4626.hasActiveLock(user);
        lockTimeRemaining = ve4626.getRemainingLockTime(user);
    }

    function getBoostInfo(address user)
        external
        view
        returns (
            uint256 boostMultiplier,
            uint256 userVotingPower,
            uint256 totalVotingPower,
            uint256 userShareBps,
            bool isProtected
        )
    {
        boostMultiplier = calculateBoost(user);
        userVotingPower = ve4626.getVotingPower(user);
        totalVotingPower = ve4626.getTotalVotingPower();

        if (totalVotingPower > 0) {
            userShareBps = (userVotingPower * BOOST_PRECISION) / totalVotingPower;
        }

        isProtected = block.number < lastBalanceUpdateBlock[user] + MIN_HOLDING_BLOCKS;
    }

    // ================================
    // FLASH LOAN PROTECTION
    // ================================

    function updateBalanceTracking(address user) external {
        require(msg.sender == address(ve4626), "Only ve4626");
        lastBalanceUpdateBlock[user] = block.number;
    }

    // ================================
    // ADMIN
    // ================================

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

    function hasBoost(address user) external view returns (bool) {
        return calculateBoost(user) > baseBoost;
    }

    function getBoostPercentage(address user) external view returns (uint256) {
        return (calculateBoost(user) * 100) / BOOST_PRECISION;
    }

    function getMaxBoost() external view returns (uint256) {
        return maxBoost;
    }
}

