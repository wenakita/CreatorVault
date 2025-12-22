// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICreatorShareHook
 * @notice Interface for CreatorShareHook - Uniswap V4 hook for Creator Share Tokens
 */
interface ICreatorShareHook {
    // ================================
    // EVENTS
    // ================================

    event BuyDetected(address indexed buyer, uint256 amount, uint256 surcharge);
    event SurchargeDistributed(uint256 toBurn, uint256 toLottery, uint256 toCreator);
    event ReferralSet(address indexed user, address indexed referrer);
    event ReferralPaid(address indexed referrer, uint256 amount);
    event DynamicFeeUpdated(uint24 newFee, uint256 volatility);

    // ================================
    // FUNCTIONS
    // ================================

    /// @notice Distribute accumulated surcharges to GaugeController
    function distributeSurcharges() external;

    /// @notice Set referrer for the caller
    function setReferrer(address referrer) external;

    /// @notice Claim accumulated referral earnings
    function claimReferralEarnings() external;

    // ================================
    // VIEW FUNCTIONS
    // ================================

    /// @notice Get current dynamic fee
    function getCurrentFee() external view returns (uint24);

    /// @notice Get current volatility estimate
    function getVolatility() external view returns (uint256);

    /// @notice Get pending surcharge to distribute
    function getPendingSurcharge() external view returns (uint256);

    /// @notice Get referral info for a user
    function getReferralInfo(address user) external view returns (
        address referrer,
        uint256 earnings
    );

    /// @notice Get hook statistics
    function getStats() external view returns (
        uint256 totalSurchargeCollected,
        uint256 totalReferralPaid,
        uint256 pendingSurcharge,
        uint256 volatilityBps,
        uint24 currentFee
    );

    // ================================
    // CONSTANTS
    // ================================

    function BASE_FEE() external view returns (uint24);
    function MIN_FEE() external view returns (uint24);
    function MAX_FEE() external view returns (uint24);
    function BUY_SURCHARGE_BPS() external view returns (uint256);
    function REFERRAL_BPS() external view returns (uint256);
}


