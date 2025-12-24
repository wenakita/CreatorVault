// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAjnaPool
 * @notice Interface for Ajna lending pools
 * @dev Simplified interface for ERC20 pools (quote token lending)
 */
interface IAjnaPool {
    /**
     * @notice Add quote tokens to a lending bucket
     * @param amount Amount of quote tokens to add
     * @param index Bucket index (price point)
     * @param expiry Expiration timestamp for the transaction
     * @return bucketLP The amount of LP tokens received
     * @return addedAmount The actual amount of tokens added
     */
    function addQuoteToken(
        uint256 amount,
        uint256 index,
        uint256 expiry
    ) external returns (uint256 bucketLP, uint256 addedAmount);

    /**
     * @notice Remove quote tokens from a lending bucket
     * @param amount Amount of LP tokens to burn
     * @param index Bucket index
     * @return removedAmount The amount of quote tokens removed
     * @return redeemedLP The amount of LP tokens burned
     */
    function removeQuoteToken(
        uint256 amount,
        uint256 index
    ) external returns (uint256 removedAmount, uint256 redeemedLP);

    /**
     * @notice Move quote tokens between buckets
     * @param maxAmount Maximum amount of LP to move
     * @param fromIndex Source bucket index
     * @param toIndex Destination bucket index
     * @param expiry Expiration timestamp
     * @return fromBucketLP LP tokens moved from source
     * @return toBucketLP LP tokens received in destination
     * @return movedAmount Amount of quote tokens moved
     */
    function moveQuoteToken(
        uint256 maxAmount,
        uint256 fromIndex,
        uint256 toIndex,
        uint256 expiry
    ) external returns (
        uint256 fromBucketLP,
        uint256 toBucketLP,
        uint256 movedAmount
    );

    /**
     * @notice Get lender info for a specific bucket
     * @param index Bucket index
     * @param lender Lender address
     * @return lpBalance LP token balance in bucket
     * @return depositTime Timestamp of last deposit
     */
    function lenderInfo(
        uint256 index,
        address lender
    ) external view returns (uint256 lpBalance, uint256 depositTime);

    /**
     * @notice Get bucket info
     * @param index Bucket index
     * @return lpBalance Total LP in bucket
     * @return collateral Total collateral in bucket
     * @return bankruptcyTime Bankruptcy timestamp
     * @return deposit Total quote tokens deposited
     * @return scale Scaling factor
     */
    function bucketInfo(
        uint256 index
    ) external view returns (
        uint256 lpBalance,
        uint256 collateral,
        uint256 bankruptcyTime,
        uint256 deposit,
        uint256 scale
    );

    /**
     * @notice Get the pool's quote token address
     * @return Quote token address
     */
    function quoteTokenAddress() external view returns (address);

    /**
     * @notice Get the pool's collateral token address
     * @return Collateral token address
     */
    function collateralAddress() external view returns (address);

    /**
     * @notice Get pool utilization rate
     * @return Utilization in WAD (1e18 = 100%)
     */
    function poolUtilization() external view returns (uint256);

    /**
     * @notice Get current pool interest rate
     * @return Interest rate in WAD (1e18 = 100% per year)
     */
    function interestRate() external view returns (uint256);
}

/**
 * @title IAjnaPoolFactory
 * @notice Interface for Ajna pool factory
 */
interface IAjnaPoolFactory {
    /**
     * @notice Deploy a new ERC20 pool
     * @param collateral Collateral token
     * @param quote Quote token
     * @param interestRate Initial interest rate
     * @return pool Address of deployed pool
     */
    function deployPool(
        address collateral,
        address quote,
        uint256 interestRate
    ) external returns (address pool);

    /**
     * @notice Get deployed pool for token pair
     * @param collateral Collateral token
     * @param quote Quote token
     * @param interestRate Interest rate
     * @return pool Pool address (address(0) if doesn't exist)
     */
    function deployedPools(
        address collateral,
        address quote,
        uint256 interestRate
    ) external view returns (address pool);

    /**
     * @notice Get deployed pools by hash
     * @param subsetHash Hash of token pair + rate
     * @return pool Pool address
     */
    function deployedPoolsList(bytes32 subsetHash) external view returns (address pool);
}

