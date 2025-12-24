// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

/**
 * @title ICreatorChainlinkOracle
 * @notice Interface for oracle V4 pool configuration
 */
interface ICreatorChainlinkOracle {
    function setV4Pool(IPoolManager _poolManager, PoolKey calldata _poolKey) external;
}

/**
 * @title ITaxHook
 * @notice Interface for the configurable tax hook
 * @dev Hook at 0xca975B9dAF772C71161f3648437c3616E5Be0088
 */
interface ITaxHook {
    function setTaxConfig(
        address token_,
        address counterAsset_,
        address recipient_,
        uint256 taxRate_,
        bool counterIsEth,
        bool enabled_,
        bool lock_
    ) external;
}

/**
 * @title IContinuousClearingAuctionFactory
 * @notice Interface for Uniswap's CCA Factory
 */
interface IContinuousClearingAuctionFactory {
    function initializeDistribution(
        address token,
        uint256 amount,
        bytes calldata configData
    ) external returns (address);
}

/**
 * @title IContinuousClearingAuction
 * @notice Interface for individual CCA auctions
 */
interface IContinuousClearingAuction {
    function submitBid(
        uint256 maxPrice,
        uint128 amount,
        address owner,
        uint256 prevTickPrice,
        bytes calldata hookData
    ) external payable returns (uint256 bidId);
    
    function checkpoint() external returns (uint256 blockNumber, uint256 clearingPrice, uint24 cumulativeMps);
    function exitBid(uint256 bidId) external;
    function claimTokens(uint256 bidId) external;
    function isGraduated() external view returns (bool);
    function sweepCurrency() external;
    function sweepUnsoldTokens() external;
    
    function clearingPrice() external view returns (uint256);
    function currencyRaised() external view returns (uint256);
    function totalSupply() external view returns (uint128);
}

/**
 * @title CCALaunchStrategy
 * @author 0xakita.eth
 * @notice Fair launch strategy using Uniswap's Continuous Clearing Auction
 * 
 * @dev USE CASES:
 *      1. Initial wsAKITA token launch - fair price discovery
 *      2. Creator token fundraise - no sniping, early participants rewarded
 *      3. Periodic fee auctions - sell accumulated fees fairly
 * 
 * @dev WHY CCA?
 *      - Official Uniswap mechanism (already deployed on Base)
 *      - Fair price discovery - no timing games
 *      - Early participants get better prices naturally
 *      - No MEV/sandwich attacks
 *      - Graduates to Uniswap V4 pool automatically
 * 
 * @dev CCA FACTORY ADDRESSES:
 *      Base:    0x0000ccaDF55C911a2FbC0BB9d2942Aa77c6FAa1D
 *      Mainnet: 0x0000ccaDF55C911a2FbC0BB9d2942Aa77c6FAa1D
 *      Unichain: 0x0000ccaDF55C911a2FbC0BB9d2942Aa77c6FAa1D
 */
contract CCALaunchStrategy is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // CONSTANTS
    // ================================

    /// @notice CCA Factory address (same on all supported chains)
    address public constant CCA_FACTORY = 0x0000ccaDF55C911a2FbC0BB9d2942Aa77c6FAa1D;
    
    /// @notice Milli-basis points constant
    uint24 public constant MPS = 1e7;

    // ================================
    // STATE
    // ================================

    /// @notice Token being auctioned (e.g., wsAKITA)
    IERC20 public immutable auctionToken;
    
    /// @notice Currency to raise (address(0) for ETH)
    address public currency;
    
    /// @notice Current active auction (if any)
    address public currentAuction;
    
    /// @notice Historical auctions
    address[] public pastAuctions;
    
    /// @notice Funds recipient (vault or treasury)
    address public fundsRecipient;
    
    /// @notice Unsold tokens recipient
    address public tokensRecipient;
    
    /// @notice Oracle to configure with V4 pool on graduation
    address public oracle;
    
    /// @notice V4 PoolManager (Base: 0x498581fF718922c3f8e6A244956aF099B2652b2b)
    IPoolManager public poolManager;
    
    /// @notice Tax hook for the V4 pool (0xca975B9dAF772C71161f3648437c3616E5Be0088 on Base)
    address public taxHook;
    
    /// @notice Fee recipient for the tax hook (GaugeController)
    address public feeRecipient;
    
    /// @notice Tax rate in basis points (690 = 6.9%)
    uint256 public taxRateBps = 690;
    
    /// @notice Fee tier for V4 pool (default 3000 = 0.3%)
    uint24 public poolFeeTier = 3000;
    
    /// @notice Tick spacing for V4 pool
    int24 public poolTickSpacing = 60;

    // ================================
    // AUCTION CONFIG
    // ================================

    /// @notice Default auction duration in blocks (~1 week on Base at 2s blocks)
    uint64 public defaultDuration = 302_400; // ~7 days
    
    /// @notice Default claim delay after auction ends
    uint64 public defaultClaimDelay = 3600; // ~2 hours
    
    /// @notice Default tick spacing (1% of floor price recommended)
    uint256 public defaultTickSpacing = 1e16; // 0.01 ETH
    
    /// @notice Default floor price
    uint256 public defaultFloorPrice = 1e15; // 0.001 ETH per token

    // ================================
    // EVENTS
    // ================================

    event AuctionCreated(
        address indexed auction,
        address indexed token,
        uint256 totalSupply,
        uint64 startBlock,
        uint64 endBlock
    );
    
    event AuctionGraduated(address indexed auction, uint256 currencyRaised, uint256 finalPrice);
    event FundsSwept(address indexed auction, uint256 amount);
    event TokensSwept(address indexed auction, uint256 amount);
    
    event ConfigUpdated(string param, uint256 value);
    event RecipientsUpdated(address fundsRecipient, address tokensRecipient);
    event OracleConfigured(address indexed oracle, address poolManager, address hook);
    event V4PoolConfigured(address indexed oracle, address token0, address token1);
    event TaxHookConfigured(address indexed token, address indexed recipient, uint256 taxRate);

    // ================================
    // ERRORS
    // ================================

    error AuctionAlreadyActive();
    error NoActiveAuction();
    error AuctionNotGraduated();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidConfig();

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Create CCA launch strategy
     * @param _auctionToken Token to auction (e.g., wsAKITA)
     * @param _currency Currency to raise (address(0) for ETH, or USDC/WETH)
     * @param _fundsRecipient Where to send raised funds
     * @param _tokensRecipient Where to send unsold tokens
     * @param _owner Strategy owner
     */
    constructor(
        address _auctionToken,
        address _currency,
        address _fundsRecipient,
        address _tokensRecipient,
        address _owner
    ) Ownable(_owner) {
        if (_auctionToken == address(0)) revert ZeroAddress();
        if (_fundsRecipient == address(0)) revert ZeroAddress();
        if (_tokensRecipient == address(0)) revert ZeroAddress();
        
        auctionToken = IERC20(_auctionToken);
        currency = _currency;
        fundsRecipient = _fundsRecipient;
        tokensRecipient = _tokensRecipient;
    }

    // ================================
    // LAUNCH AUCTION
    // ================================

    /**
     * @notice Launch a new CCA auction for token distribution
     * @param amount Amount of tokens to auction
     * @param floorPrice Starting floor price (Q96 format)
     * @param requiredRaise Minimum currency to raise for graduation
     * @param auctionSteps Packed auction steps data
     */
    function launchAuction(
        uint256 amount,
        uint256 floorPrice,
        uint128 requiredRaise,
        bytes calldata auctionSteps
    ) external onlyOwner nonReentrant returns (address auction) {
        if (currentAuction != address(0)) {
            // Check if previous auction is still active
            if (!IContinuousClearingAuction(currentAuction).isGraduated()) {
                revert AuctionAlreadyActive();
            }
            // Archive previous auction
            pastAuctions.push(currentAuction);
        }
        
        if (amount == 0) revert ZeroAmount();
        
        // Calculate blocks
        uint64 startBlock = uint64(block.number + 100); // Start in ~100 blocks
        uint64 endBlock = startBlock + defaultDuration;
        uint64 claimBlock = endBlock + defaultClaimDelay;
        
        // Build auction parameters
        bytes memory configData = _encodeAuctionParams(
            floorPrice,
            requiredRaise,
            startBlock,
            endBlock,
            claimBlock,
            auctionSteps
        );
        
        // Transfer tokens to this contract for auction
        auctionToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve factory to pull tokens
        auctionToken.forceApprove(CCA_FACTORY, amount);
        
        // Create auction via factory
        auction = IContinuousClearingAuctionFactory(CCA_FACTORY).initializeDistribution(
            address(auctionToken),
            amount,
            configData
        );
        
        currentAuction = auction;
        
        emit AuctionCreated(auction, address(auctionToken), amount, startBlock, endBlock);
    }

    /**
     * @notice Launch auction with default parameters
     * @param amount Amount of tokens to auction
     * @param requiredRaise Minimum currency to raise
     */
    function launchAuctionSimple(
        uint256 amount,
        uint128 requiredRaise
    ) external onlyOwner nonReentrant returns (address auction) {
        // Create default linear auction steps (sell evenly over duration)
        bytes memory auctionSteps = _createLinearSteps(defaultDuration);
        
        // Use default floor price
        uint256 floorPrice = defaultFloorPrice;
        
        // Forward to main function
        return this.launchAuction(amount, floorPrice, requiredRaise, auctionSteps);
    }

    // ================================
    // AUCTION MANAGEMENT
    // ================================

    /**
     * @notice Checkpoint the current auction
     * @dev Can be called by anyone, updates price discovery
     */
    function checkpoint() external {
        if (currentAuction == address(0)) revert NoActiveAuction();
        IContinuousClearingAuction(currentAuction).checkpoint();
    }

    /**
     * @notice Sweep raised currency after auction graduates
     * @dev Also configures the oracle with the V4 pool if oracle is set
     *      NOTE: Tax hook configuration must be done separately by token owner
     *      (see getTaxHookCalldata() for the exact call to make)
     */
    function sweepCurrency() external nonReentrant {
        if (currentAuction == address(0)) revert NoActiveAuction();
        if (!IContinuousClearingAuction(currentAuction).isGraduated()) {
            revert AuctionNotGraduated();
        }
        
        IContinuousClearingAuction auction = IContinuousClearingAuction(currentAuction);
        
        uint256 raised = auction.currencyRaised();
        uint256 finalPrice = auction.clearingPrice();
        
        auction.sweepCurrency();
        
        // Configure oracle with V4 pool if all components are set
        if (oracle != address(0) && address(poolManager) != address(0)) {
            _configureOracleV4Pool();
        }
        
        // NOTE: Tax hook must be configured separately by token owner!
        // The SimpleSellTaxHook at 0xca975B9dAF772C71161f3648437c3616E5Be0088
        // requires msg.sender == token.owner() to call setTaxConfig.
        // Use getTaxHookCalldata() to get the exact calldata for ERC-4337 batching.
        
        emit AuctionGraduated(currentAuction, raised, finalPrice);
        emit FundsSwept(currentAuction, raised);
    }
    
    /**
     * @notice Configure oracle with V4 pool details
     * @dev Called automatically on graduation if oracle is set
     */
    function _configureOracleV4Pool() internal {
        // Sort tokens for pool key (token0 < token1)
        address token0;
        address token1;
        
        // currency = address(0) means ETH, which is Currency.wrap(address(0)) in V4
        address tokenAddr = address(auctionToken);
        address currencyAddr = currency; // address(0) for ETH
        
        if (tokenAddr < currencyAddr || currencyAddr == address(0)) {
            // ETH (address(0)) is always token0 in Uniswap V4
            if (currencyAddr == address(0)) {
                token0 = currencyAddr;
                token1 = tokenAddr;
            } else {
                token0 = tokenAddr;
                token1 = currencyAddr;
            }
        } else {
            token0 = currencyAddr;
            token1 = tokenAddr;
        }
        
        // Build pool key
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: poolFeeTier,
            tickSpacing: poolTickSpacing,
            hooks: IHooks(taxHook)
        });
        
        // Configure oracle
        ICreatorChainlinkOracle(oracle).setV4Pool(poolManager, poolKey);
        
        emit V4PoolConfigured(oracle, token0, token1);
    }
    
    /**
     * @notice Get the calldata for configuring the tax hook
     * @dev Returns the exact bytes to call on the tax hook (for ERC-4337 batching)
     *      Token owner must call: taxHook.call(getTaxHookCalldata())
     * @return target The tax hook address to call
     * @return data The calldata for setTaxConfig
     */
    function getTaxHookCalldata() external view returns (address target, bytes memory data) {
        target = taxHook;
        data = abi.encodeWithSelector(
            ITaxHook.setTaxConfig.selector,
            address(auctionToken),  // The wsToken
            currency,               // Counter asset (address(0) for ETH)
            feeRecipient,           // GaugeController receives fees
            taxRateBps,             // 690 = 6.9%
            currency == address(0), // counterIsEth
            true,                   // enabled
            false                   // don't lock (allow changes)
        );
    }
    
    /**
     * @notice Get all calldata needed for "Click 2" (complete auction + configure hook)
     * @dev Returns array of calls for ERC-4337 batching:
     *      1. sweepCurrency() on this strategy
     *      2. setTaxConfig() on the tax hook (requires token owner)
     * @return targets Array of addresses to call
     * @return calldatas Array of calldata for each call
     */
    function getCompleteAuctionCalldata() external view returns (
        address[] memory targets,
        bytes[] memory calldatas
    ) {
        targets = new address[](2);
        calldatas = new bytes[](2);
        
        // Call 1: sweepCurrency on this strategy
        targets[0] = address(this);
        calldatas[0] = abi.encodeWithSelector(this.sweepCurrency.selector);
        
        // Call 2: setTaxConfig on the tax hook
        targets[1] = taxHook;
        calldatas[1] = abi.encodeWithSelector(
            ITaxHook.setTaxConfig.selector,
            address(auctionToken),
            currency,
            feeRecipient,
            taxRateBps,
            currency == address(0),
            true,
            false
        );
    }
    
    /**
     * @notice Manually configure oracle V4 pool (if not done on graduation)
     */
    function configureOracleV4Pool() external onlyOwner {
        if (oracle == address(0)) revert ZeroAddress();
        if (address(poolManager) == address(0)) revert ZeroAddress();
        _configureOracleV4Pool();
    }

    /**
     * @notice Sweep unsold tokens after auction ends
     */
    function sweepUnsoldTokens() external nonReentrant {
        if (currentAuction == address(0)) revert NoActiveAuction();
        
        IContinuousClearingAuction auction = IContinuousClearingAuction(currentAuction);
        
        uint256 unsold = auctionToken.balanceOf(currentAuction);
        auction.sweepUnsoldTokens();
        
        emit TokensSwept(currentAuction, unsold);
    }

    // ================================
    // INTERNAL HELPERS
    // ================================

    /**
     * @notice Encode auction parameters for CCA factory
     */
    function _encodeAuctionParams(
        uint256 floorPrice,
        uint128 requiredRaise,
        uint64 startBlock,
        uint64 endBlock,
        uint64 claimBlock,
        bytes memory auctionSteps
    ) internal view returns (bytes memory) {
        // AuctionParameters struct encoding
        return abi.encode(
            currency,           // currency (address(0) for ETH)
            tokensRecipient,    // tokensRecipient
            fundsRecipient,     // fundsRecipient
            startBlock,         // startBlock
            endBlock,           // endBlock
            claimBlock,         // claimBlock
            defaultTickSpacing, // tickSpacing
            address(0),         // validationHook (none for now)
            floorPrice,         // floorPrice
            requiredRaise,      // requiredCurrencyRaised
            auctionSteps        // auctionStepsData
        );
    }

    /**
     * @notice Create linear auction steps (sell evenly over time)
     * @param duration Total duration in blocks
     */
    function _createLinearSteps(uint64 duration) internal pure returns (bytes memory) {
        // Single step: sell 100% of tokens evenly over duration
        // mps = MPS (100% = 10,000,000 mps over entire duration)
        uint24 mpsPerBlock = uint24(MPS / duration);
        
        // Pack: first 24 bits = mps, next 40 bits = blockDelta
        bytes8 packed = bytes8(uint64(mpsPerBlock) | (uint64(duration) << 24));
        
        return abi.encodePacked(packed);
    }

    /**
     * @notice Create accelerating auction steps (sell more towards end)
     * @dev Rewards early participants more
     */
    function _createAcceleratingSteps(uint64 duration) internal pure returns (bytes memory) {
        // Three phases: 20% in first half, 30% in third quarter, 50% in last quarter
        uint64 phase1Duration = duration / 2;
        uint64 phase2Duration = duration / 4;
        uint64 phase3Duration = duration - phase1Duration - phase2Duration;
        
        // Use uint256 for intermediate calculations to avoid overflow
        uint256 mpsValue = uint256(MPS);
        
        // Phase 1: 20% over 50% of time = slow
        uint24 mps1 = uint24((mpsValue * 2000) / 10000 / phase1Duration); // 20% / phase1
        bytes8 packed1 = bytes8(uint64(mps1) | (uint64(phase1Duration) << 24));
        
        // Phase 2: 30% over 25% of time = medium
        uint24 mps2 = uint24((mpsValue * 3000) / 10000 / phase2Duration);
        bytes8 packed2 = bytes8(uint64(mps2) | (uint64(phase2Duration) << 24));
        
        // Phase 3: 50% over 25% of time = fast
        uint24 mps3 = uint24((mpsValue * 5000) / 10000 / phase3Duration);
        bytes8 packed3 = bytes8(uint64(mps3) | (uint64(phase3Duration) << 24));
        
        return abi.encodePacked(packed1, packed2, packed3);
    }

    // ================================
    // ADMIN
    // ================================

    /**
     * @notice Update default auction duration
     */
    function setDefaultDuration(uint64 _duration) external onlyOwner {
        if (_duration == 0) revert InvalidConfig();
        defaultDuration = _duration;
        emit ConfigUpdated("duration", _duration);
    }

    /**
     * @notice Update default claim delay
     */
    function setDefaultClaimDelay(uint64 _delay) external onlyOwner {
        defaultClaimDelay = _delay;
        emit ConfigUpdated("claimDelay", _delay);
    }

    /**
     * @notice Update default tick spacing
     */
    function setDefaultTickSpacing(uint256 _spacing) external onlyOwner {
        if (_spacing == 0) revert InvalidConfig();
        defaultTickSpacing = _spacing;
        emit ConfigUpdated("tickSpacing", _spacing);
    }

    /**
     * @notice Update default floor price
     */
    function setDefaultFloorPrice(uint256 _price) external onlyOwner {
        if (_price == 0) revert InvalidConfig();
        defaultFloorPrice = _price;
        emit ConfigUpdated("floorPrice", _price);
    }

    /**
     * @notice Update fund recipients
     */
    function setRecipients(address _fundsRecipient, address _tokensRecipient) external onlyOwner {
        if (_fundsRecipient == address(0)) revert ZeroAddress();
        if (_tokensRecipient == address(0)) revert ZeroAddress();
        fundsRecipient = _fundsRecipient;
        tokensRecipient = _tokensRecipient;
        emit RecipientsUpdated(_fundsRecipient, _tokensRecipient);
    }
    
    /**
     * @notice Configure oracle for V4 pool setup on graduation
     * @param _oracle Oracle address to configure
     * @param _poolManager V4 PoolManager address
     * @param _taxHook Tax hook address for the pool
     * @param _feeRecipient GaugeController to receive 6.9% trade fees
     */
    function setOracleConfig(
        address _oracle,
        address _poolManager,
        address _taxHook,
        address _feeRecipient
    ) external onlyOwner {
        oracle = _oracle;
        poolManager = IPoolManager(_poolManager);
        taxHook = _taxHook;
        feeRecipient = _feeRecipient;
        emit OracleConfigured(_oracle, _poolManager, _taxHook);
    }
    
    /**
     * @notice Update fee recipient (GaugeController)
     * @param _feeRecipient New fee recipient address
     */
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        feeRecipient = _feeRecipient;
    }
    
    /**
     * @notice Update tax rate
     * @param _taxRateBps Tax rate in basis points (690 = 6.9%)
     */
    function setTaxRate(uint256 _taxRateBps) external onlyOwner {
        if (_taxRateBps > 1000) revert("Tax too high"); // Max 10%
        taxRateBps = _taxRateBps;
    }
    
    /**
     * @notice Update V4 pool fee tier
     * @param _feeTier Fee in hundredths of bips (3000 = 0.3%)
     */
    function setPoolFeeTier(uint24 _feeTier) external onlyOwner {
        poolFeeTier = _feeTier;
        emit ConfigUpdated("poolFeeTier", _feeTier);
    }
    
    /**
     * @notice Update V4 pool tick spacing
     * @param _tickSpacing Tick spacing for the pool
     */
    function setPoolTickSpacing(int24 _tickSpacing) external onlyOwner {
        poolTickSpacing = _tickSpacing;
        emit ConfigUpdated("poolTickSpacing", uint256(int256(_tickSpacing)));
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    /**
     * @notice Get current auction status
     */
    function getAuctionStatus() external view returns (
        address auction,
        bool isActive,
        bool isGraduated,
        uint256 clearingPrice,
        uint256 currencyRaised
    ) {
        auction = currentAuction;
        if (auction == address(0)) {
            return (address(0), false, false, 0, 0);
        }
        
        IContinuousClearingAuction cca = IContinuousClearingAuction(auction);
        isGraduated = cca.isGraduated();
        isActive = !isGraduated;
        clearingPrice = cca.clearingPrice();
        currencyRaised = cca.currencyRaised();
    }

    /**
     * @notice Get all past auctions
     */
    function getPastAuctions() external view returns (address[] memory) {
        return pastAuctions;
    }

    /**
     * @notice Get auction count
     */
    function auctionCount() external view returns (uint256) {
        uint256 count = pastAuctions.length;
        if (currentAuction != address(0)) count++;
        return count;
    }

    // ================================
    // EMERGENCY
    // ================================

    /**
     * @notice Emergency withdraw tokens stuck in strategy
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @notice Emergency withdraw ETH
     */
    function emergencyWithdrawETH(address payable to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        to.transfer(address(this).balance);
    }

    receive() external payable {}
}


