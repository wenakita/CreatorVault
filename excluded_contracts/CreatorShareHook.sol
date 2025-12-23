// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface ICreatorGaugeController {
    function receiveFees(uint256 amount) external;
}

/**
 * @title CreatorShareHook
 * @author 0xakita.eth (CreatorVault)
 * @notice Uniswap V4 Hook for Creator Share Token pools (e.g., stkmaakita/ETH)
 * 
 * @dev SOCIAL-FI FEATURES:
 *      1. Dynamic fees that adjust with volatility
 *      2. Buy detection with surcharge → GaugeController
 *      3. Referral rewards for bringing new users
 *      4. Creator fee distribution
 * 
 * @dev FEE BREAKDOWN:
 *      
 *      BASE SWAP FEE: 1% (dynamic, ±0.5% based on volatility)
 *        ├── 70% → LPs (earned via standard Uniswap mechanism)
 *        └── 30% → Protocol fee → GaugeController
 *      
 *      BUY SURCHARGE: 5.9% (on buys of stkmaakita)
 *        ├── 50% → Vault Burn (increases PPS for all holders)
 *        ├── 31% → Lottery Jackpot
 *        └── 19% → Creator Treasury
 *      
 *      REFERRAL: 0.69% (deducted from buy surcharge if referrer set)
 *        └── Credited to referrer's claimable balance
 * 
 * @dev HOOK PERMISSIONS:
 *      - beforeSwap: Calculate dynamic fee + detect buy direction
 *      - afterSwap: Collect fees and route to GaugeController
 *      - beforeInitialize: Set initial fee
 */
contract CreatorShareHook is BaseHook, Ownable {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using SafeERC20 for IERC20;
    using LPFeeLibrary for uint24;

    // ================================
    // CONSTANTS
    // ================================

    uint24 public constant BASE_FEE = 10000;        // 1% = 10000 (in hundredths of bip)
    uint24 public constant MIN_FEE = 5000;          // 0.5%
    uint24 public constant MAX_FEE = 30000;         // 3%
    
    uint256 public constant BUY_SURCHARGE_BPS = 590; // 5.9%
    uint256 public constant REFERRAL_BPS = 69;       // 0.69%
    uint256 public constant MAX_BPS = 10000;
    
    // Surcharge distribution (within the 5.9%)
    uint256 public constant VAULT_BURN_BPS = 5000;   // 50% of surcharge → burn
    uint256 public constant LOTTERY_BPS = 3100;      // 31% of surcharge → lottery
    uint256 public constant CREATOR_BPS = 1900;      // 19% of surcharge → creator

    // ================================
    // STATE
    // ================================

    /// @notice Share token (e.g., stkmaakita) - token0 or token1
    address public shareToken;
    
    /// @notice Whether shareToken is token0 in the pool
    bool public shareTokenIsToken0;
    
    /// @notice GaugeController that receives fees
    ICreatorGaugeController public gaugeController;
    
    /// @notice Creator's treasury
    address public creatorTreasury;
    
    /// @notice Referral tracking: user → referrer
    mapping(address => address) public referrers;
    
    /// @notice Referral earnings: referrer → claimable amount
    mapping(address => uint256) public referralEarnings;
    
    /// @notice Total referral earnings (lifetime)
    uint256 public totalReferralPaid;
    
    /// @notice Volatility tracking for dynamic fees
    uint256 public lastPrice;
    uint256 public lastPriceTimestamp;
    uint256 public volatilityBps; // Current volatility estimate in bps
    
    /// @notice Fee collection tracking
    uint256 public pendingSurcharge;
    uint256 public totalSurchargeCollected;

    // ================================
    // EVENTS
    // ================================

    event BuyDetected(address indexed buyer, uint256 amount, uint256 surcharge);
    event SurchargeDistributed(uint256 toBurn, uint256 toLottery, uint256 toCreator);
    event ReferralSet(address indexed user, address indexed referrer);
    event ReferralPaid(address indexed referrer, uint256 amount);
    event DynamicFeeUpdated(uint24 newFee, uint256 volatility);

    // ================================
    // ERRORS
    // ================================

    error InvalidPool();
    error ZeroAddress();
    error SelfReferral();

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(
        IPoolManager _poolManager,
        address _shareToken,
        address _gaugeController,
        address _creatorTreasury,
        address _owner
    ) BaseHook(_poolManager) Ownable(_owner) {
        if (_shareToken == address(0)) revert ZeroAddress();
        if (_gaugeController == address(0)) revert ZeroAddress();
        
        shareToken = _shareToken;
        gaugeController = ICreatorGaugeController(_gaugeController);
        creatorTreasury = _creatorTreasury;
    }

    // ================================
    // HOOK PERMISSIONS
    // ================================

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: true,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // ================================
    // HOOK CALLBACKS
    // ================================

    /**
     * @notice Called before pool initialization
     * @dev Sets up the pool with dynamic fee flag
     */
    function beforeInitialize(
        address,
        PoolKey calldata key,
        uint160,
        bytes calldata
    ) external override returns (bytes4) {
        // Determine which token is the share token
        address token0 = Currency.unwrap(key.currency0);
        address token1 = Currency.unwrap(key.currency1);
        
        if (token0 == shareToken) {
            shareTokenIsToken0 = true;
        } else if (token1 == shareToken) {
            shareTokenIsToken0 = false;
        } else {
            revert InvalidPool();
        }
        
        return BaseHook.beforeInitialize.selector;
    }

    /**
     * @notice Called before each swap
     * @dev Calculates dynamic fee based on volatility
     */
    function beforeSwap(
        address,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        // Update volatility estimate
        _updateVolatility(key);
        
        // Calculate dynamic fee
        uint24 dynamicFee = _calculateDynamicFee();
        
        // Decode referrer from hookData if present
        if (hookData.length >= 20) {
            address swapper = abi.decode(hookData, (address));
            if (hookData.length >= 40) {
                (, address referrer) = abi.decode(hookData, (address, address));
                _setReferrer(swapper, referrer);
            }
        }
        
        // Return dynamic fee (will be applied by pool manager)
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, dynamicFee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    /**
     * @notice Called after each swap
     * @dev Detects buy direction and collects surcharge
     */
    function afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external override returns (bytes4, int128) {
        // Determine if this is a BUY (user receiving shareToken)
        bool isBuy = _isBuyTransaction(params);
        
        if (!isBuy) {
            // No surcharge on sells
            return (BaseHook.afterSwap.selector, 0);
        }
        
        // Calculate surcharge amount
        uint256 shareAmount = _getShareTokenAmount(delta);
        uint256 surcharge = (shareAmount * BUY_SURCHARGE_BPS) / MAX_BPS;
        
        if (surcharge == 0) {
            return (BaseHook.afterSwap.selector, 0);
        }
        
        // Get the actual buyer address from hookData
        address buyer = sender;
        if (hookData.length >= 20) {
            buyer = abi.decode(hookData, (address));
        }
        
        // Handle referral
        address referrer = referrers[buyer];
        uint256 referralAmount = 0;
        if (referrer != address(0)) {
            referralAmount = (surcharge * REFERRAL_BPS) / BUY_SURCHARGE_BPS;
            referralEarnings[referrer] += referralAmount;
            surcharge -= referralAmount;
        }
        
        // Accumulate surcharge for distribution
        pendingSurcharge += surcharge;
        totalSurchargeCollected += surcharge;
        
        emit BuyDetected(buyer, shareAmount, surcharge);
        
        // Return the surcharge amount to be deducted
        return (BaseHook.afterSwap.selector, int128(uint128(surcharge + referralAmount)));
    }

    // ================================
    // FEE DISTRIBUTION
    // ================================

    /**
     * @notice Distribute accumulated surcharges to GaugeController
     * @dev Can be called by anyone (permissionless)
     */
    function distributeSurcharges() external {
        uint256 amount = pendingSurcharge;
        if (amount == 0) return;
        
        pendingSurcharge = 0;
        
        // Approve and send to gauge controller
        IERC20(shareToken).forceApprove(address(gaugeController), amount);
        gaugeController.receiveFees(amount);
        
        // Calculate distribution for event (actual distribution happens in GaugeController)
        uint256 toBurn = (amount * VAULT_BURN_BPS) / MAX_BPS;
        uint256 toLottery = (amount * LOTTERY_BPS) / MAX_BPS;
        uint256 toCreator = amount - toBurn - toLottery;
        
        emit SurchargeDistributed(toBurn, toLottery, toCreator);
    }

    // ================================
    // REFERRAL SYSTEM
    // ================================

    /**
     * @notice Set referrer for a user
     * @dev Can only be set once per user
     */
    function setReferrer(address referrer) external {
        _setReferrer(msg.sender, referrer);
    }

    function _setReferrer(address user, address referrer) internal {
        if (referrer == address(0)) return;
        if (referrer == user) revert SelfReferral();
        if (referrers[user] != address(0)) return; // Already set
        
        referrers[user] = referrer;
        emit ReferralSet(user, referrer);
    }

    /**
     * @notice Claim accumulated referral earnings
     */
    function claimReferralEarnings() external {
        uint256 amount = referralEarnings[msg.sender];
        if (amount == 0) return;
        
        referralEarnings[msg.sender] = 0;
        totalReferralPaid += amount;
        
        IERC20(shareToken).safeTransfer(msg.sender, amount);
        
        emit ReferralPaid(msg.sender, amount);
    }

    // ================================
    // DYNAMIC FEE CALCULATION
    // ================================

    function _calculateDynamicFee() internal view returns (uint24) {
        // Base fee ± adjustment based on volatility
        // Higher volatility = higher fees (protect LPs)
        
        uint256 adjustment = (volatilityBps * BASE_FEE) / MAX_BPS;
        uint24 fee = uint24(BASE_FEE + adjustment);
        
        // Clamp to min/max
        if (fee < MIN_FEE) fee = MIN_FEE;
        if (fee > MAX_FEE) fee = MAX_FEE;
        
        return fee;
    }

    function _updateVolatility(PoolKey calldata key) internal {
        // Simple volatility estimate based on time-weighted price changes
        // In production, would use TWAP oracle
        
        // Get current price from pool (simplified)
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(key.toId());
        uint256 currentPrice = uint256(sqrtPriceX96) * uint256(sqrtPriceX96) / (1 << 192);
        
        if (lastPrice > 0 && block.timestamp > lastPriceTimestamp) {
            // Calculate price change
            uint256 priceDiff = currentPrice > lastPrice 
                ? currentPrice - lastPrice 
                : lastPrice - currentPrice;
            
            uint256 priceChangeBps = (priceDiff * MAX_BPS) / lastPrice;
            
            // Exponential moving average for volatility
            volatilityBps = (volatilityBps * 90 + priceChangeBps * 10) / 100;
        }
        
        lastPrice = currentPrice;
        lastPriceTimestamp = block.timestamp;
    }

    // ================================
    // INTERNAL HELPERS
    // ================================

    /**
     * @notice Determine if swap is a BUY (user receiving shareToken)
     */
    function _isBuyTransaction(SwapParams calldata params) internal view returns (bool) {
        // zeroForOne = true means swapping token0 → token1
        // If shareToken is token1 and zeroForOne is true, user is BUYING shareToken
        // If shareToken is token0 and zeroForOne is false, user is BUYING shareToken
        
        if (shareTokenIsToken0) {
            return !params.zeroForOne; // Buying token0
        } else {
            return params.zeroForOne; // Buying token1
        }
    }

    /**
     * @notice Get the amount of shareToken in the swap delta
     */
    function _getShareTokenAmount(BalanceDelta delta) internal view returns (uint256) {
        if (shareTokenIsToken0) {
            int128 amount = delta.amount0();
            return amount > 0 ? uint256(uint128(amount)) : uint256(uint128(-amount));
        } else {
            int128 amount = delta.amount1();
            return amount > 0 ? uint256(uint128(amount)) : uint256(uint128(-amount));
        }
    }

    // ================================
    // ADMIN
    // ================================

    function setGaugeController(address _gaugeController) external onlyOwner {
        if (_gaugeController == address(0)) revert ZeroAddress();
        gaugeController = ICreatorGaugeController(_gaugeController);
    }

    function setCreatorTreasury(address _treasury) external onlyOwner {
        creatorTreasury = _treasury;
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    function getCurrentFee() external view returns (uint24) {
        return _calculateDynamicFee();
    }

    function getVolatility() external view returns (uint256) {
        return volatilityBps;
    }

    function getPendingSurcharge() external view returns (uint256) {
        return pendingSurcharge;
    }

    function getReferralInfo(address user) external view returns (
        address referrer,
        uint256 earnings
    ) {
        return (referrers[user], referralEarnings[user]);
    }

    function getStats() external view returns (
        uint256 _totalSurchargeCollected,
        uint256 _totalReferralPaid,
        uint256 _pendingSurcharge,
        uint256 _volatilityBps,
        uint24 _currentFee
    ) {
        return (
            totalSurchargeCollected,
            totalReferralPaid,
            pendingSurcharge,
            volatilityBps,
            _calculateDynamicFee()
        );
    }
}


