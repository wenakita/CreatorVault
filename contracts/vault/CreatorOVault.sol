// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IStrategy} from "../interfaces/strategies/IStrategy.sol";

/**
 * @title CreatorOVault
 * @author 0xakita.eth
 * @notice Synchronous ERC-4626 vault for Creator Coins with full strategy support
 * 
 * @dev ARCHITECTURE:
 *      - Fully ERC-4626 compliant vault
 *      - Deposit Creator Coin → mint vault shares
 *      - Deploy idle assets to yield strategies
 *      - Profit unlocking prevents PPS manipulation
 * 
 * @dev STRATEGY SYSTEM:
 *      - addStrategy() - Add yield strategy with allocation weight
 *      - removeStrategy() - Remove strategy and withdraw funds
 *      - deployToStrategies() - Deploy idle funds
 *      - report() - Harvest yields and update accounting
 * 
 * @dev ACCESS CONTROL:
 *      - Owner: Full control
 *      - Management: Strategy management, fees
 *      - Keeper: Can call report/tend
 *      - EmergencyAdmin: Can shutdown
 * 
 * @dev CONSTRUCTOR ARGS (same on all chains):
 *      - _creatorCoin: Creator Coin address
 *      - _owner: deployer
 *      - _name: Vault name (e.g., "Creator OVault - AKITA")
 *      - _symbol: Vault symbol (e.g., "sAKITA")
 */
contract CreatorOVault is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =================================
    // CONSTANTS
    // =================================
    
    /// @notice Maximum performance fee (20%)
    uint16 public constant MAX_FEE = 2_000;
    
    /// @notice Basis points denominator
    uint256 internal constant MAX_BPS = 10_000;
    
    /// @notice Extended precision for profit unlocking rate
    uint256 internal constant MAX_BPS_EXTENDED = 1_000_000_000_000;
    
    /// @notice Seconds per year
    uint256 internal constant SECONDS_PER_YEAR = 31_556_952;
    
    /// @notice Maximum strategies
    uint256 public constant MAX_STRATEGIES = 5;
    
    // =================================
    // ANTI-INFLATION ATTACK CONSTANTS
    // =================================
    
    /**
     * @notice Virtual offset for share calculations (prevents first-depositor inflation attack)
     * @dev Based on OpenZeppelin ERC4626 security recommendations
     *      Offset of 1e3 means an attacker needs to donate 1000x the victim's deposit
     *      to steal 0.1% of their funds - economically unfeasible
     * @custom:security Mitigates yTUSD-style "dust-balance / non-zero-supply" attacks
     */
    uint256 internal constant VIRTUAL_SHARES_OFFSET = 1e3;
    uint256 internal constant VIRTUAL_ASSETS_OFFSET = 1;
    
    /**
     * @notice Minimum first deposit to ensure meaningful liquidity
     * @dev Serves two purposes:
     *      1. Prevents dust manipulation attacks
     *      2. Ensures creator launches have real liquidity
     * 
     * @custom:security Prevents "dust deposit → inflate → drain" attack vector
     * @custom:economics 50M tokens = 5% of typical 1B supply
     */
    uint256 public constant MINIMUM_FIRST_DEPOSIT = 50_000_000e18; // 50,000,000 tokens minimum (5%)
    
    /**
     * @notice Maximum price change per transaction (in basis points)
     * @dev Prevents catastrophic single-tx price manipulation
     * @custom:security Limits impact of any oracle/accounting manipulation
     */
    uint256 public constant MAX_PRICE_CHANGE_BPS = 1000; // 10% max change per tx

    // =================================
    // STATE VARIABLES
    // =================================
    
    /// @notice Creator Coin token
    IERC20 public immutable CREATOR_COIN;
    
    /// @notice Current Creator Coin balance held directly by vault
    uint256 public coinBalance;
    
    /// @notice Strategy management
    mapping(address => bool) public activeStrategies;
    mapping(address => uint256) public strategyWeights;
    address[] public strategyList;
    uint256 public totalStrategyWeight;

    // =================================
    // ACCESS CONTROL
    // =================================
    
    /// @notice Management role (can manage strategies)
    address public management;
    address public pendingManagement;
    
    /// @notice Keeper role (can call report/tend)
    address public keeper;
    
    /// @notice Emergency admin (can shutdown)
    address public emergencyAdmin;
    
    /// @notice GaugeController (can burn shares)
    address public gaugeController;

    // =================================
    // PERFORMANCE FEES
    // =================================
    
    /// @notice Performance fee in basis points
    uint16 public performanceFee;
    
    /// @notice Performance fee recipient
    address public performanceFeeRecipient;

    // =================================
    // PROFIT UNLOCKING
    // =================================
    
    /// @notice Shares to unlock per second
    uint256 public profitUnlockingRate;
    
    /// @notice When all profits unlocked
    uint96 public fullProfitUnlockDate;
    
    /// @notice Max time to unlock profits
    uint32 public profitMaxUnlockTime;
    
    /// @notice Shares locked from last report
    uint256 public totalLockedShares;

    // =================================
    // REPORTING
    // =================================
    
    /// @notice Last report timestamp
    uint96 public lastReport;
    
    /// @notice Total assets at last report
    uint256 public totalAssetsAtLastReport;
    
    /// @notice Total shares burned for price increase
    uint256 public totalSharesBurned;

    // =================================
    // CONTROLS
    // =================================
    
    /// @notice Shutdown flag
    bool public isShutdown;
    
    /// @notice Pause flag
    bool public paused;
    
    /// @notice Whitelist enabled
    bool public whitelistEnabled;
    
    /// @notice Whitelist mapping
    mapping(address => bool) public whitelist;
    
    /// @notice Maximum total supply (in shares)
    uint256 public maxTotalSupply = type(uint256).max;
    
    /// @notice Keep this much Creator Coin idle for redemptions
    uint256 public deploymentThreshold = 1000e18;
    
    /// @notice Minimum deployment interval
    uint256 public minDeploymentInterval = 5 minutes;
    
    /// @notice Last deployment timestamp
    uint256 public lastDeployment;
    
    // =================================
    // FLASH LOAN / MEV PROTECTION
    // =================================
    
    /// @notice Block number of last deposit (per user)
    mapping(address => uint256) public lastDepositBlock;
    
    /// @notice Minimum blocks between deposit and withdraw (flash loan protection)
    uint256 public withdrawDelayBlocks = 1;
    
    /// @notice Large withdrawal threshold (requires delay)
    uint256 public largeWithdrawalThreshold = 100_000e18; // 100k tokens
    
    /// @notice Extra delay for large withdrawals (in blocks)
    uint256 public largeWithdrawalDelayBlocks = 10;
    
    /// @notice Queued large withdrawals
    struct QueuedWithdrawal {
        uint256 shares;
        uint256 unlockBlock;
        address receiver;
    }
    mapping(address => QueuedWithdrawal) public queuedWithdrawals;

    // =================================
    // YEARN V3 INSPIRED FEATURES
    // =================================
    
    /// @notice Default withdrawal queue (ordered list of strategies)
    /// @dev Based on Yearn V3: default_queue pattern for predictable withdrawals
    address[] public defaultQueue;
    
    /// @notice Maximum queue size
    uint256 public constant MAX_QUEUE = 10;
    
    /// @notice Force use of default queue (ignore custom queue in withdrawals)
    bool public useDefaultQueue;
    
    /// @notice Automatically allocate deposits to first strategy in queue
    bool public autoAllocate;
    
    /// @notice Minimum Creator Coin to keep idle for fast redemptions
    /// @dev Based on Yearn V3: minimum_total_idle pattern
    uint256 public minimumTotalIdle = 10_000e18; // 10k tokens default
    
    /// @notice Current debt per strategy (tracks actual deployed amount)
    mapping(address => uint256) public strategyDebt;
    
    /// @notice Total debt across all strategies
    uint256 public totalDebt;
    
    /// @notice Debt purchaser role (can buy bad debt from vault)
    address public debtPurchaser;

    // =================================
    // EVENTS
    // =================================
    
    event Reported(
        uint256 profit,
        uint256 loss,
        uint256 performanceFees,
        uint256 totalAssets
    );
    
    event StrategyAdded(address indexed strategy, uint256 weight);
    event StrategyRemoved(address indexed strategy);
    event StrategyDeployed(address indexed strategy, uint256 amount);
    event StrategyWithdrawn(address indexed strategy, uint256 amount);
    
    event UpdateManagement(address indexed newManagement);
    event UpdatePendingManagement(address indexed newPendingManagement);
    event UpdateKeeper(address indexed newKeeper);
    event UpdateEmergencyAdmin(address indexed newEmergencyAdmin);
    event UpdateGaugeController(address indexed oldController, address indexed newController);
    event UpdatePerformanceFee(uint16 newPerformanceFee);
    event UpdatePerformanceFeeRecipient(address indexed newRecipient);
    event UpdateProfitMaxUnlockTime(uint256 newProfitMaxUnlockTime);
    
    event BalancesSynced(uint256 coinBalance);
    event WhitelistEnabled(bool enabled);
    event WhitelistUpdated(address indexed account, bool status);
    event EmergencyPause(bool paused);
    event VaultShutdown();
    
    event CapitalInjected(address indexed from, uint256 amount, uint256 newPricePerShare);
    event SharesBurnedForPrice(address indexed from, uint256 shares, uint256 newPricePerShare);
    event EmergencyWithdraw(address indexed to, uint256 amount);
    
    // Flash loan / MEV protection events
    event WithdrawalQueued(address indexed user, uint256 shares, uint256 unlockBlock);
    event WithdrawalClaimed(address indexed user, uint256 assets);
    event WithdrawalCancelled(address indexed user, uint256 shares);
    
    // Yearn V3 inspired events
    event UpdateDefaultQueue(address[] newDefaultQueue);
    event UpdateUseDefaultQueue(bool useDefaultQueue);
    event UpdateAutoAllocate(bool autoAllocate);
    event UpdateMinimumTotalIdle(uint256 minimumTotalIdle);
    event UpdateDebtPurchaser(address indexed newDebtPurchaser);
    event DebtUpdated(address indexed strategy, uint256 currentDebt, uint256 newDebt);
    event DebtPurchased(address indexed strategy, uint256 amount, address indexed buyer);
    event UnrealisedLossAssessed(address indexed strategy, uint256 lossAmount);
    event AutoAllocated(address indexed strategy, uint256 amount);

    // =================================
    // ERRORS
    // =================================
    
    error ZeroAddress();
    error ZeroAmount();
    error ZeroShares();
    error Unauthorized();
    error Paused();
    error InvalidAmount();
    error InsufficientBalance();
    error StrategyAlreadyActive();
    error StrategyNotActive();
    error MaxStrategiesReached();
    error InvalidWeight();
    error VaultIsShutdown();
    error VaultNotShutdown();
    error OnlyGaugeController();
    
    /// @notice First deposit must meet minimum threshold
    error FirstDepositTooSmall(uint256 provided, uint256 minimum);
    
    /// @notice Price change exceeds safety bounds
    error PriceChangeExceedsLimit(uint256 priceBefore, uint256 priceAfter, uint256 maxChangeBps);
    
    /// @notice Mint would result in too many shares for assets (inflation protection)
    error InflationAttackDetected(uint256 assets, uint256 shares);
    
    /// @notice Flash loan protection - must wait before withdrawing
    error WithdrawTooSoon(uint256 currentBlock, uint256 requiredBlock);
    
    /// @notice Large withdrawal must be queued
    error LargeWithdrawalMustBeQueued(uint256 amount, uint256 threshold);
    
    /// @notice Withdrawal not yet unlocked
    error WithdrawalNotUnlocked(uint256 currentBlock, uint256 unlockBlock);
    
    /// @notice No queued withdrawal
    error NoQueuedWithdrawal();
    
    // Yearn V3 inspired errors
    error StrategyHasUnrealisedLosses(address strategy, uint256 lossAmount);
    error InsufficientIdleForWithdrawal(uint256 requested, uint256 available);
    error QueueTooLong(uint256 length, uint256 maxLength);
    error StrategyNotInQueue(address strategy);
    error NothingToBuy();
    error OnlyDebtPurchaser();

    // =================================
    // MODIFIERS
    // =================================
    
    modifier onlyManagement() {
        if (msg.sender != management && msg.sender != owner()) revert Unauthorized();
        _;
    }
    
    modifier onlyKeepers() {
        if (msg.sender != keeper && msg.sender != management && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }
    
    modifier onlyEmergencyAuthorized() {
        if (msg.sender != emergencyAdmin && msg.sender != management && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }
    
    modifier onlyGaugeController() {
        if (msg.sender != gaugeController) revert OnlyGaugeController();
        _;
    }
    
    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }
    
    modifier whenNotShutdown() {
        if (isShutdown) revert VaultIsShutdown();
        _;
    }
    
    modifier onlyWhitelisted() {
        if (whitelistEnabled && !whitelist[msg.sender]) revert Unauthorized();
        _;
    }
    
    modifier onlyDebtPurchaser() {
        if (msg.sender != debtPurchaser && msg.sender != owner()) revert OnlyDebtPurchaser();
        _;
    }

    // =================================
    // CONSTRUCTOR
    // =================================
    
    /**
     * @notice Deploy CreatorOVault with same address on all chains via CREATE2
     * @param _creatorCoin Creator Coin address
     * @param _owner Owner address
     * @param _name Vault name (e.g., "Creator OVault - AKITA")
     * @param _symbol Vault symbol (e.g., "sAKITA")
     */
    constructor(
        address _creatorCoin,
        address _owner,
        string memory _name,
        string memory _symbol
    ) 
        ERC20(_name, _symbol) 
        ERC4626(IERC20(_creatorCoin)) 
        Ownable(_owner) 
    {
        if (_creatorCoin == address(0)) revert ZeroAddress();
        
        CREATOR_COIN = IERC20(_creatorCoin);
        
        // Initialize roles
        management = _owner;
        keeper = _owner;
        emergencyAdmin = _owner;
        performanceFeeRecipient = _owner;
        performanceFee = 1000; // 10% default
        profitMaxUnlockTime = 7 days;
        
        whitelist[_owner] = true;
        lastDeployment = block.timestamp;
        lastReport = uint96(block.timestamp);
    }
    
    receive() external payable {}

    // =================================
    // PROFIT UNLOCKING
    // =================================
    
    /**
     * @notice Calculate unlocked shares since last report
     * @dev Prevents PPS manipulation by gradual unlock
     */
    function unlockedShares() public view returns (uint256) {
        if (fullProfitUnlockDate <= block.timestamp || fullProfitUnlockDate == 0) {
            return totalLockedShares;
        }
        
        uint256 timeSinceLastReport = block.timestamp - lastReport;
        uint256 unlockedAmount = (profitUnlockingRate * timeSinceLastReport) / MAX_BPS_EXTENDED;
        
        return unlockedAmount > totalLockedShares ? totalLockedShares : unlockedAmount;
    }
    
    /**
     * @notice Get locked (not yet unlocked) shares
     */
    function lockedShares() public view returns (uint256) {
        return totalLockedShares - unlockedShares();
    }

    // =================================
    // ERC4626 OVERRIDES
    // =================================
    
    /**
     * @notice Total assets controlled by vault
     * @dev Includes idle balance + strategy deployments
     */
    function totalAssets() public view override returns (uint256) {
        uint256 total = coinBalance;
        
        // Add strategy holdings
        uint256 len = strategyList.length;
        for (uint256 i; i < len; i++) {
            if (activeStrategies[strategyList[i]]) {
                total += IStrategy(strategyList[i]).getTotalAssets();
            }
        }
        
        return total;
    }
    
    /**
     * @notice Deposit Creator Coin into vault
     * @dev Protected against first-depositor inflation attacks via:
     *      1. Minimum first deposit requirement
     *      2. Virtual shares offset in conversion
     *      3. Shares/assets ratio sanity check
     * @custom:security See yTUSD exploit mitigation notes
     */
    function deposit(uint256 assets, address receiver) 
        public 
        override 
        nonReentrant 
        whenNotPaused 
        whenNotShutdown
        onlyWhitelisted
        returns (uint256 shares) 
    {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();
        
        // SECURITY: First deposit must meet minimum to prevent dust manipulation
        if (totalSupply() == 0 && assets < MINIMUM_FIRST_DEPOSIT) {
            revert FirstDepositTooSmall(assets, MINIMUM_FIRST_DEPOSIT);
        }
        
        // Store price before for sanity check (only if not first deposit)
        bool isFirstDeposit = totalSupply() == 0;
        uint256 priceBefore = isFirstDeposit ? 0 : pricePerShare();
        
        shares = previewDeposit(assets);
        if (shares == 0) revert ZeroShares();
        if (totalSupply() + shares > maxTotalSupply) revert InvalidAmount();
        
        // SECURITY: Check for inflation attack - shares should never be extremely larger than assets
        if (!isFirstDeposit && shares > assets * 10_000) {
            revert InflationAttackDetected(assets, shares);
        }
        
        // Pull Creator Coin
        CREATOR_COIN.safeTransferFrom(msg.sender, address(this), assets);
        coinBalance += assets;
        
        // Mint shares
        _mint(receiver, shares);
        
        // SECURITY: Track deposit block for flash loan protection
        lastDepositBlock[receiver] = block.number;
        
        // SECURITY: Verify price didn't change dramatically (prevents manipulation)
        if (!isFirstDeposit) {
            uint256 priceAfter = pricePerShare();
            _checkPriceChange(priceBefore, priceAfter);
        }
        
        emit Deposit(msg.sender, receiver, assets, shares);
        
        // Yearn V3: Auto-allocate to first strategy if enabled
        if (autoAllocate && defaultQueue.length > 0) {
            _autoAllocateToStrategy();
        }
    }
    
    /**
     * @notice Mint exact shares
     * @dev Protected against inflation attacks
     * @custom:security See yTUSD exploit mitigation notes
     */
    function mint(uint256 shares, address receiver) 
        public 
        override 
        nonReentrant 
        whenNotPaused 
        whenNotShutdown
        onlyWhitelisted
        returns (uint256 assets)
    {
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0)) revert ZeroAddress();
        
        // Store price before for sanity check (only if not first deposit)
        bool isFirstDeposit = totalSupply() == 0;
        uint256 priceBefore = isFirstDeposit ? 0 : pricePerShare();
        
        assets = previewMint(shares);
        if (assets == 0) revert ZeroAmount();
        if (totalSupply() + shares > maxTotalSupply) revert InvalidAmount();
        
        // SECURITY: First deposit must meet minimum
        if (isFirstDeposit && assets < MINIMUM_FIRST_DEPOSIT) {
            revert FirstDepositTooSmall(assets, MINIMUM_FIRST_DEPOSIT);
        }
        
        // SECURITY: Check for inflation attack
        if (!isFirstDeposit && shares > assets * 10_000) {
            revert InflationAttackDetected(assets, shares);
        }
        
        // Pull Creator Coin
        CREATOR_COIN.safeTransferFrom(msg.sender, address(this), assets);
        coinBalance += assets;
        
        // Mint shares
        _mint(receiver, shares);
        
        // SECURITY: Track deposit block for flash loan protection
        lastDepositBlock[receiver] = block.number;
        
        // SECURITY: Verify price stability (skip for first deposit)
        if (!isFirstDeposit) {
            uint256 priceAfter = pricePerShare();
            _checkPriceChange(priceBefore, priceAfter);
        }
        
        emit Deposit(msg.sender, receiver, assets, shares);
    }
    
    /**
     * @notice Redeem shares for Creator Coin
     * @dev SYNCHRONOUS - Transfers immediately for small amounts
     *      Large withdrawals must be queued for MEV protection
     * @custom:security Flash loan protected - cannot withdraw same block as deposit
     */
    function redeem(uint256 shares, address receiver, address owner_)
        public
        override
        nonReentrant
        returns (uint256 assets)
    {
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0)) revert ZeroAddress();
        
        // SECURITY: Flash loan protection - must wait at least 1 block after deposit
        uint256 requiredBlock = lastDepositBlock[owner_] + withdrawDelayBlocks;
        if (block.number < requiredBlock) {
            revert WithdrawTooSoon(block.number, requiredBlock);
        }
        
        if (msg.sender != owner_) {
            _spendAllowance(owner_, msg.sender, shares);
        }
        
        assets = previewRedeem(shares);
        if (assets == 0) revert ZeroAmount();
        
        // SECURITY: Large withdrawals must be queued
        if (assets >= largeWithdrawalThreshold) {
            revert LargeWithdrawalMustBeQueued(assets, largeWithdrawalThreshold);
        }
        
        _burn(owner_, shares);
        
        // Ensure we have enough Creator Coin
        _ensureCoin(assets);
        
        coinBalance -= assets;
        CREATOR_COIN.safeTransfer(receiver, assets);
        
        emit Withdraw(msg.sender, receiver, owner_, assets, shares);
    }
    
    /**
     * @notice Withdraw exact Creator Coin amount
     * @dev SYNCHRONOUS - Transfers immediately for small amounts
     *      Large withdrawals must be queued for MEV protection
     * @custom:security Flash loan protected - cannot withdraw same block as deposit
     */
    function withdraw(uint256 assets, address receiver, address owner_)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();
        
        // SECURITY: Flash loan protection - must wait at least 1 block after deposit
        uint256 requiredBlock = lastDepositBlock[owner_] + withdrawDelayBlocks;
        if (block.number < requiredBlock) {
            revert WithdrawTooSoon(block.number, requiredBlock);
        }
        
        shares = previewWithdraw(assets);
        if (shares == 0) revert ZeroShares();
        
        // SECURITY: Large withdrawals must be queued
        if (assets >= largeWithdrawalThreshold) {
            revert LargeWithdrawalMustBeQueued(assets, largeWithdrawalThreshold);
        }
        
        if (msg.sender != owner_) {
            _spendAllowance(owner_, msg.sender, shares);
        }
        
        _burn(owner_, shares);
        
        // Ensure we have enough Creator Coin
        _ensureCoin(assets);
        
        coinBalance -= assets;
        CREATOR_COIN.safeTransfer(receiver, assets);
        
        emit Withdraw(msg.sender, receiver, owner_, assets, shares);
    }
    
    // =================================
    // LARGE WITHDRAWAL QUEUE (MEV Protection)
    // =================================
    
    /**
     * @notice Queue a large withdrawal
     * @dev Required for withdrawals >= largeWithdrawalThreshold
     *      Must wait largeWithdrawalDelayBlocks before claiming
     * @param shares Amount of shares to withdraw
     * @param receiver Address to receive Creator Coin when claimed
     */
    function queueWithdrawal(uint256 shares, address receiver) external nonReentrant {
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0)) revert ZeroAddress();
        
        // SECURITY: Flash loan protection
        uint256 requiredBlock = lastDepositBlock[msg.sender] + withdrawDelayBlocks;
        if (block.number < requiredBlock) {
            revert WithdrawTooSoon(block.number, requiredBlock);
        }
        
        uint256 assets = previewRedeem(shares);
        if (assets < largeWithdrawalThreshold) {
            // Small withdrawals don't need queue, use regular redeem
            revert InvalidAmount();
        }
        
        // Transfer shares to vault (lock them)
        _transfer(msg.sender, address(this), shares);
        
        // Set unlock block
        uint256 unlockBlock = block.number + largeWithdrawalDelayBlocks;
        
        // If there's already a queued withdrawal, add to it
        QueuedWithdrawal storage queued = queuedWithdrawals[msg.sender];
        queued.shares += shares;
        queued.unlockBlock = unlockBlock;
        queued.receiver = receiver;
        
        emit WithdrawalQueued(msg.sender, shares, unlockBlock);
    }
    
    /**
     * @notice Claim a queued withdrawal after delay period
     * @dev Can only be called after unlockBlock has passed
     */
    function claimQueuedWithdrawal() external nonReentrant returns (uint256 assets) {
        QueuedWithdrawal storage queued = queuedWithdrawals[msg.sender];
        
        if (queued.shares == 0) revert NoQueuedWithdrawal();
        if (block.number < queued.unlockBlock) {
            revert WithdrawalNotUnlocked(block.number, queued.unlockBlock);
        }
        
        uint256 shares = queued.shares;
        address receiver = queued.receiver;
        
        // Clear the queued withdrawal
        delete queuedWithdrawals[msg.sender];
        
        // Calculate assets
        assets = previewRedeem(shares);
        
        // Burn the locked shares
        _burn(address(this), shares);
        
        // Ensure we have enough Creator Coin
        _ensureCoin(assets);
        
        // Transfer
        coinBalance -= assets;
        CREATOR_COIN.safeTransfer(receiver, assets);
        
        emit WithdrawalClaimed(msg.sender, assets);
    }
    
    /**
     * @notice Cancel a queued withdrawal and get shares back
     */
    function cancelQueuedWithdrawal() external nonReentrant returns (uint256 shares) {
        QueuedWithdrawal storage queued = queuedWithdrawals[msg.sender];
        
        if (queued.shares == 0) revert NoQueuedWithdrawal();
        
        shares = queued.shares;
        
        // Clear the queued withdrawal
        delete queuedWithdrawals[msg.sender];
        
        // Return shares to user
        _transfer(address(this), msg.sender, shares);
        
        emit WithdrawalCancelled(msg.sender, shares);
    }
    
    /**
     * @notice Max deposit (standard ERC4626)
     */
    function maxDeposit(address receiver) public view override returns (uint256) {
        if (paused || isShutdown) return 0;
        if (whitelistEnabled && !whitelist[receiver]) return 0;
        uint256 currentSupply = totalSupply();
        if (currentSupply >= maxTotalSupply) return 0;
        
        uint256 remainingShares = maxTotalSupply - currentSupply;
        uint256 supply = totalSupply();
        if (supply == 0) return remainingShares;
        
        return (remainingShares * totalAssets()) / supply;
    }
    
    /**
     * @notice Max mint (standard ERC4626)
     */
    function maxMint(address receiver) public view override returns (uint256) {
        if (paused || isShutdown) return 0;
        if (whitelistEnabled && !whitelist[receiver]) return 0;
        uint256 currentSupply = totalSupply();
        if (currentSupply >= maxTotalSupply) return 0;
        return maxTotalSupply - currentSupply;
    }
    
    /**
     * @notice Max withdraw (standard ERC4626)
     */
    function maxWithdraw(address owner_) public view override returns (uint256) {
        if (paused) return 0;
        uint256 userShares = balanceOf(owner_);
        if (userShares == 0) return 0;
        return previewRedeem(userShares);
    }
    
    /**
     * @notice Max redeem (standard ERC4626)
     */
    function maxRedeem(address owner_) public view override returns (uint256) {
        if (paused) return 0;
        return balanceOf(owner_);
    }

    // =================================
    // ENSURE COIN HELPER
    // =================================
    
    /**
     * @notice Ensure vault has enough Creator Coin for redemptions
     * @dev Withdraws from strategies if needed
     */
    function _ensureCoin(uint256 coinNeeded) internal {
        if (coinBalance >= coinNeeded) return;
        
        uint256 deficit = coinNeeded - coinBalance;
        
        // Withdraw from strategies
        _withdrawFromStrategies(deficit);
        
        if (coinBalance < coinNeeded) {
            revert InsufficientBalance();
        }
    }
    
    /**
     * @notice Check that price change is within acceptable bounds
     * @dev Prevents catastrophic single-tx price manipulation
     * @custom:security Key defense against yTUSD-style cascading failures
     * @param priceBefore Price per share before operation
     * @param priceAfter Price per share after operation
     */
    function _checkPriceChange(uint256 priceBefore, uint256 priceAfter) internal pure {
        if (priceBefore == 0) return; // First deposit, no check needed
        
        uint256 priceDiff;
        if (priceAfter > priceBefore) {
            priceDiff = priceAfter - priceBefore;
        } else {
            priceDiff = priceBefore - priceAfter;
        }
        
        // Check if change exceeds MAX_PRICE_CHANGE_BPS (default 10%)
        uint256 maxAllowedChange = (priceBefore * MAX_PRICE_CHANGE_BPS) / MAX_BPS;
        if (priceDiff > maxAllowedChange) {
            revert PriceChangeExceedsLimit(priceBefore, priceAfter, MAX_PRICE_CHANGE_BPS);
        }
    }

    // =================================
    // STRATEGY MANAGEMENT
    // =================================
    
    /**
     * @notice Add a new strategy
     * @param strategy Strategy address
     * @param weight Allocation weight (basis points, total <= 10000)
     */
    function addStrategy(address strategy, uint256 weight) external onlyManagement {
        addStrategy(strategy, weight, true);
    }
    
    /**
     * @notice Add a new yield strategy with queue option
     * @dev Based on Yearn V3: add_strategy pattern
     * @param strategy Strategy address (must be ERC-4626 compatible)
     * @param weight Allocation weight (basis points, max 10000)
     * @param addToQueue Whether to add to default withdrawal queue
     */
    function addStrategy(address strategy, uint256 weight, bool addToQueue) public onlyManagement {
        if (strategy == address(0)) revert ZeroAddress();
        if (activeStrategies[strategy]) revert StrategyAlreadyActive();
        if (strategyList.length >= MAX_STRATEGIES) revert MaxStrategiesReached();
        if (weight == 0 || weight > 10000) revert InvalidWeight();
        if (totalStrategyWeight + weight > 10000) revert InvalidWeight();
        
        require(IStrategy(strategy).isActive(), "Strategy not active");
        require(IStrategy(strategy).asset() == address(CREATOR_COIN), "Wrong asset");
        
        activeStrategies[strategy] = true;
        strategyWeights[strategy] = weight;
        strategyList.push(strategy);
        totalStrategyWeight += weight;
        
        // Yearn V3: Add to default queue if requested and there's space
        if (addToQueue && defaultQueue.length < MAX_QUEUE) {
            defaultQueue.push(strategy);
            emit UpdateDefaultQueue(defaultQueue);
        }
        
        emit StrategyAdded(strategy, weight);
    }
    
    /**
     * @notice Remove a strategy
     * @dev Withdraws all funds before removal
     */
    function removeStrategy(address strategy) external onlyManagement {
        if (!activeStrategies[strategy]) revert StrategyNotActive();
        
        // Withdraw all funds from strategy
        uint256 currentDebt = strategyDebt[strategy];
        if (currentDebt > 0) {
            uint256 withdrawn = IStrategy(strategy).withdraw(currentDebt);
            coinBalance += withdrawn;
            totalDebt -= currentDebt;
            strategyDebt[strategy] = 0;
            emit DebtUpdated(strategy, currentDebt, 0);
        }
        
        activeStrategies[strategy] = false;
        totalStrategyWeight -= strategyWeights[strategy];
        strategyWeights[strategy] = 0;
        
        // Remove from strategy list
        uint256 length = strategyList.length;
        for (uint256 i = 0; i < length; i++) {
            if (strategyList[i] == strategy) {
                strategyList[i] = strategyList[length - 1];
                strategyList.pop();
                break;
            }
        }
        
        // Yearn V3: Remove from default queue
        _removeFromQueue(strategy);
        
        emit StrategyRemoved(strategy);
    }
    
    /**
     * @notice Remove a strategy from the default queue
     * @dev Internal helper based on Yearn V3 pattern
     */
    function _removeFromQueue(address strategy) internal {
        uint256 queueLength = defaultQueue.length;
        for (uint256 i = 0; i < queueLength; i++) {
            if (defaultQueue[i] == strategy) {
                defaultQueue[i] = defaultQueue[queueLength - 1];
                defaultQueue.pop();
                emit UpdateDefaultQueue(defaultQueue);
                break;
            }
        }
    }
    
    /**
     * @notice Update strategy weight
     */
    function updateStrategyWeight(address strategy, uint256 newWeight) external onlyManagement {
        if (!activeStrategies[strategy]) revert StrategyNotActive();
        if (newWeight > 10000) revert InvalidWeight();
        
        uint256 oldWeight = strategyWeights[strategy];
        uint256 newTotal = totalStrategyWeight - oldWeight + newWeight;
        if (newTotal > 10000) revert InvalidWeight();
        
        strategyWeights[strategy] = newWeight;
        totalStrategyWeight = newTotal;
    }
    
    /**
     * @notice Deploy idle funds to strategies
     */
    function deployToStrategies() external nonReentrant onlyKeepers {
        _deployToStrategies();
    }
    
    /**
     * @notice Force deploy (management only)
     */
    function forceDeployToStrategies() external nonReentrant onlyManagement {
        require(totalStrategyWeight > 0, "No strategies");
        _deployToStrategies();
    }
    
    /**
     * @notice Internal deploy logic
     */
    function _deployToStrategies() internal {
        if (totalStrategyWeight == 0) return;
        
        // Yearn V3: Use minimumTotalIdle instead of deploymentThreshold
        uint256 minIdle = minimumTotalIdle > deploymentThreshold ? minimumTotalIdle : deploymentThreshold;
        uint256 deployable = coinBalance > minIdle 
            ? coinBalance - minIdle 
            : 0;
        
        if (deployable == 0) return;
        
        uint256 length = strategyList.length;
        for (uint256 i = 0; i < length; i++) {
            address strategy = strategyList[i];
            if (activeStrategies[strategy] && strategyWeights[strategy] > 0) {
                uint256 amount = (deployable * strategyWeights[strategy]) / totalStrategyWeight;
                
                if (amount > coinBalance) amount = coinBalance;
                
                if (amount > 0) {
                    uint256 currentDebt = strategyDebt[strategy];
                    coinBalance -= amount;
                    CREATOR_COIN.forceApprove(strategy, amount);
                    uint256 deposited = IStrategy(strategy).deposit(amount);
                    
                    // Yearn V3: Track strategy debt
                    uint256 newDebt = currentDebt + deposited;
                    strategyDebt[strategy] = newDebt;
                    totalDebt += deposited;
                    
                    emit DebtUpdated(strategy, currentDebt, newDebt);
                    emit StrategyDeployed(strategy, deposited);
                }
            }
        }
        
        lastDeployment = block.timestamp;
    }
    
    /**
     * @notice Withdraw from strategies
     */
    function _withdrawFromStrategies(uint256 amountNeeded) internal returns (uint256 totalWithdrawn) {
        uint256 remaining = amountNeeded;
        
        // Yearn V3: Use default queue for withdrawal order
        address[] memory queue = defaultQueue.length > 0 ? defaultQueue : strategyList;
        uint256 length = queue.length;
        
        for (uint256 i = 0; i < length && remaining > 0; i++) {
            address strategy = queue[i];
            if (activeStrategies[strategy]) {
                uint256 currentDebt = strategyDebt[strategy];
                uint256 strategyAssets = IStrategy(strategy).getTotalAssets();
                
                if (strategyAssets > 0) {
                    uint256 toWithdraw = remaining > strategyAssets ? strategyAssets : remaining;
                    
                    // Yearn V3: Assess unrealized losses before withdrawal
                    uint256 unrealizedLoss = _assessUnrealisedLoss(strategy, currentDebt, toWithdraw);
                    if (unrealizedLoss > 0) {
                        emit UnrealisedLossAssessed(strategy, unrealizedLoss);
                    }
                    
                    uint256 withdrawn = IStrategy(strategy).withdraw(toWithdraw);
                    
                    coinBalance += withdrawn;
                    totalWithdrawn += withdrawn;
                    remaining = remaining > withdrawn ? remaining - withdrawn : 0;
                    
                    // Yearn V3: Update debt tracking
                    uint256 debtReduction = withdrawn > currentDebt ? currentDebt : withdrawn;
                    uint256 newDebt = currentDebt - debtReduction;
                    strategyDebt[strategy] = newDebt;
                    totalDebt -= debtReduction;
                    
                    emit DebtUpdated(strategy, currentDebt, newDebt);
                    emit StrategyWithdrawn(strategy, withdrawn);
                }
            }
        }
    }
    
    /**
     * @notice Assess unrealized losses for a strategy
     * @dev Based on Yearn V3: _assess_share_of_unrealised_losses pattern
     * @param strategy The strategy to assess
     * @param currentDebt What vault thinks strategy should have
     * @param assetsNeeded Amount being withdrawn
     * @return Loss share of unrealized losses
     */
    function _assessUnrealisedLoss(
        address strategy,
        uint256 currentDebt,
        uint256 assetsNeeded
    ) internal view returns (uint256) {
        uint256 strategyAssets = IStrategy(strategy).getTotalAssets();
        
        // If no losses, return 0
        if (strategyAssets >= currentDebt || currentDebt == 0) {
            return 0;
        }
        
        // User takes proportional share of losses
        uint256 numerator = assetsNeeded * strategyAssets;
        uint256 lossShare = assetsNeeded - (numerator / currentDebt);
        
        // Round up
        if (numerator % currentDebt != 0) {
            lossShare += 1;
        }
        
        return lossShare;
    }
    
    /**
     * @notice Auto-allocate idle funds to first strategy in queue
     * @dev Based on Yearn V3: auto_allocate pattern
     */
    function _autoAllocateToStrategy() internal {
        if (defaultQueue.length == 0) return;
        
        address firstStrategy = defaultQueue[0];
        if (!activeStrategies[firstStrategy]) return;
        
        uint256 minIdle = minimumTotalIdle > deploymentThreshold ? minimumTotalIdle : deploymentThreshold;
        if (coinBalance <= minIdle) return;
        
        uint256 toAllocate = coinBalance - minIdle;
        if (toAllocate == 0) return;
        
        uint256 currentDebt = strategyDebt[firstStrategy];
        
        coinBalance -= toAllocate;
        CREATOR_COIN.forceApprove(firstStrategy, toAllocate);
        uint256 deposited = IStrategy(firstStrategy).deposit(toAllocate);
        
        uint256 newDebt = currentDebt + deposited;
        strategyDebt[firstStrategy] = newDebt;
        totalDebt += deposited;
        
        emit DebtUpdated(firstStrategy, currentDebt, newDebt);
        emit AutoAllocated(firstStrategy, deposited);
    }

    // =================================
    // REPORT FUNCTION
    // =================================
    
    /**
     * @notice Report profit/loss and charge fees
     * @dev Called periodically by keeper
     */
    function report() external nonReentrant onlyKeepers returns (uint256 profit, uint256 loss) {
        uint256 currentTotalAssets = totalAssets();
        uint256 previousTotalAssets = totalAssetsAtLastReport;
        
        if (currentTotalAssets > previousTotalAssets) {
            profit = currentTotalAssets - previousTotalAssets;
            
            // Charge performance fee
            uint256 performanceFees = 0;
            if (performanceFee > 0 && profit > 0) {
                performanceFees = (profit * performanceFee) / MAX_BPS;
                
                if (performanceFees > 0 && performanceFeeRecipient != address(0)) {
                    uint256 supply = totalSupply();
                    uint256 feeShares = supply > 0 
                        ? (performanceFees * supply) / currentTotalAssets 
                        : performanceFees;
                    _mint(performanceFeeRecipient, feeShares);
                }
            }
            
            // Lock remaining profit (gradual unlock prevents PPS manipulation)
            uint256 profitAfterFees = profit - performanceFees;
            if (profitAfterFees > 0 && profitMaxUnlockTime > 0) {
                uint256 supply = totalSupply();
                uint256 profitShares = supply > 0 
                    ? (profitAfterFees * supply) / currentTotalAssets 
                    : profitAfterFees;
                
                _mint(address(this), profitShares);
                totalLockedShares += profitShares;
                
                fullProfitUnlockDate = uint96(block.timestamp + profitMaxUnlockTime);
                profitUnlockingRate = (profitShares * MAX_BPS_EXTENDED) / profitMaxUnlockTime;
            }
            
            emit Reported(profit, 0, performanceFees, currentTotalAssets);
        } else {
            loss = previousTotalAssets - currentTotalAssets;
            
            // Offset loss with locked shares
            if (loss > 0 && totalLockedShares > 0) {
                uint256 supply = totalSupply();
                uint256 lossShares = supply > 0 
                    ? (loss * supply) / currentTotalAssets 
                    : 0;
                uint256 sharesToBurn = lossShares > totalLockedShares 
                    ? totalLockedShares 
                    : lossShares;
                
                if (sharesToBurn > 0) {
                    _burn(address(this), sharesToBurn);
                    totalLockedShares -= sharesToBurn;
                }
            }
            
            emit Reported(0, loss, 0, currentTotalAssets);
        }
        
        lastReport = uint96(block.timestamp);
        totalAssetsAtLastReport = currentTotalAssets;
    }
    
    /**
     * @notice Perform maintenance without full report
     */
    function tend() external nonReentrant onlyKeepers {
        if (coinBalance > deploymentThreshold && totalStrategyWeight > 0) {
            _deployToStrategies();
        }
    }
    
    /**
     * @notice Check if tend should be called
     */
    function tendTrigger() external view returns (bool) {
        return coinBalance > deploymentThreshold 
            && totalStrategyWeight > 0 
            && block.timestamp >= lastDeployment + minDeploymentInterval;
    }

    // =================================
    // GAUGE CONTROLLER
    // =================================
    
    /**
     * @notice Burn shares to increase price (called by GaugeController)
     */
    function burnSharesForPriceIncrease(uint256 shares) external onlyGaugeController {
        if (shares == 0) revert ZeroAmount();
        
        _burn(msg.sender, shares);
        totalSharesBurned += shares;
        
        emit SharesBurnedForPrice(msg.sender, shares, pricePerShare());
    }

    // =================================
    // CAPITAL INJECTION
    // =================================
    
    /**
     * @notice Inject capital without minting shares (increases PPS)
     * @dev Anyone can call (typically protocol treasury)
     * @custom:security Price change check prevents dramatic manipulation
     */
    function injectCapital(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        
        // Store price before
        uint256 priceBefore = pricePerShare();
        
        CREATOR_COIN.safeTransferFrom(msg.sender, address(this), amount);
        coinBalance += amount;
        
        // SECURITY: Verify price change is within bounds
        uint256 priceAfter = pricePerShare();
        _checkPriceChange(priceBefore, priceAfter);
        
        emit CapitalInjected(msg.sender, amount, priceAfter);
    }
    
    /**
     * @notice Preview capital injection impact
     */
    function previewCapitalInjection(uint256 amount) 
        external 
        view 
        returns (
            uint256 newShareValue, 
            uint256 valueIncrease, 
            uint256 percentageIncrease
        ) 
    {
        uint256 supply = totalSupply();
        if (supply == 0) return (0, 0, 0);
        
        uint256 currentTotalAssets = totalAssets();
        uint256 currentShareValue = (currentTotalAssets * 1e18) / supply;
        uint256 newTotalAssets = currentTotalAssets + amount;
        
        newShareValue = (newTotalAssets * 1e18) / supply;
        valueIncrease = newShareValue - currentShareValue;
        
        if (currentShareValue > 0) {
            percentageIncrease = (valueIncrease * 10000) / currentShareValue;
        }
    }

    // =================================
    // YEARN V3 INSPIRED: QUEUE MANAGEMENT
    // =================================
    
    /**
     * @notice Set the default withdrawal queue
     * @dev Based on Yearn V3: set_default_queue pattern
     * @param newQueue Ordered array of strategies for withdrawals
     */
    function setDefaultQueue(address[] calldata newQueue) external onlyManagement {
        if (newQueue.length > MAX_QUEUE) revert QueueTooLong(newQueue.length, MAX_QUEUE);
        
        // Validate each strategy is active
        for (uint256 i = 0; i < newQueue.length; i++) {
            if (!activeStrategies[newQueue[i]]) revert StrategyNotActive();
        }
        
        defaultQueue = newQueue;
        emit UpdateDefaultQueue(newQueue);
    }
    
    /**
     * @notice Get the default withdrawal queue
     */
    function getDefaultQueue() external view returns (address[] memory) {
        return defaultQueue;
    }
    
    /**
     * @notice Set whether to force use of default queue
     * @dev Based on Yearn V3: set_use_default_queue pattern
     */
    function setUseDefaultQueue(bool _useDefaultQueue) external onlyManagement {
        useDefaultQueue = _useDefaultQueue;
        emit UpdateUseDefaultQueue(_useDefaultQueue);
    }
    
    /**
     * @notice Set auto-allocate option
     * @dev Based on Yearn V3: set_auto_allocate pattern
     */
    function setAutoAllocate(bool _autoAllocate) external onlyManagement {
        autoAllocate = _autoAllocate;
        emit UpdateAutoAllocate(_autoAllocate);
    }
    
    /**
     * @notice Set minimum total idle
     * @dev Based on Yearn V3: set_minimum_total_idle pattern
     */
    function setMinimumTotalIdle(uint256 _minimumTotalIdle) external onlyManagement {
        minimumTotalIdle = _minimumTotalIdle;
        emit UpdateMinimumTotalIdle(_minimumTotalIdle);
    }

    // =================================
    // YEARN V3 INSPIRED: DEBT PURCHASING
    // =================================
    
    /**
     * @notice Set debt purchaser address
     */
    function setDebtPurchaser(address _debtPurchaser) external onlyOwner {
        debtPurchaser = _debtPurchaser;
        emit UpdateDebtPurchaser(_debtPurchaser);
    }
    
    /**
     * @notice Buy bad debt from a strategy
     * @dev Based on Yearn V3: buy_debt pattern
     * @param strategy Strategy to buy debt from
     * @param amount Amount of debt to purchase
     */
    function buyDebt(address strategy, uint256 amount) external nonReentrant onlyDebtPurchaser {
        if (!activeStrategies[strategy]) revert StrategyNotActive();
        
        uint256 currentDebt = strategyDebt[strategy];
        if (currentDebt == 0) revert NothingToBuy();
        if (amount == 0) revert NothingToBuy();
        
        uint256 _amount = amount > currentDebt ? currentDebt : amount;
        
        // Buyer sends Creator Coin to vault
        CREATOR_COIN.safeTransferFrom(msg.sender, address(this), _amount);
        coinBalance += _amount;
        
        // Reduce strategy debt
        uint256 newDebt = currentDebt - _amount;
        strategyDebt[strategy] = newDebt;
        totalDebt -= _amount;
        
        emit DebtUpdated(strategy, currentDebt, newDebt);
        emit DebtPurchased(strategy, _amount, msg.sender);
    }
    
    /**
     * @notice Get unrealized losses for a strategy
     * @dev Based on Yearn V3: assess_share_of_unrealised_losses pattern
     */
    function assessUnrealisedLosses(address strategy, uint256 assetsNeeded) 
        external 
        view 
        returns (uint256) 
    {
        uint256 currentDebt = strategyDebt[strategy];
        return _assessUnrealisedLoss(strategy, currentDebt, assetsNeeded);
    }

    // =================================
    // EMERGENCY CONTROLS
    // =================================
    
    function shutdownVault() external onlyEmergencyAuthorized {
        isShutdown = true;
        emit VaultShutdown();
    }
    
    function emergencyWithdrawFromStrategies() external onlyEmergencyAuthorized {
        uint256 length = strategyList.length;
        for (uint256 i = 0; i < length; i++) {
            address strategy = strategyList[i];
            if (activeStrategies[strategy]) {
                try IStrategy(strategy).emergencyWithdraw() returns (uint256 withdrawn) {
                    coinBalance += withdrawn;
                } catch {}
            }
        }
    }
    
    function emergencyWithdraw(uint256 amount, address to) external onlyEmergencyAuthorized {
        if (!isShutdown) revert VaultNotShutdown();
        if (to == address(0)) revert ZeroAddress();
        
        if (amount > 0) {
            CREATOR_COIN.safeTransfer(to, amount);
        }
        
        coinBalance = CREATOR_COIN.balanceOf(address(this));
        
        emit EmergencyWithdraw(to, amount);
    }
    
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit EmergencyPause(_paused);
    }

    // =================================
    // ADMIN FUNCTIONS
    // =================================
    
    function setGaugeController(address _gaugeController) external onlyOwner {
        address old = gaugeController;
        gaugeController = _gaugeController;
        emit UpdateGaugeController(old, _gaugeController);
    }
    
    function setKeeper(address _keeper) external onlyManagement {
        if (_keeper == address(0)) revert ZeroAddress();
        keeper = _keeper;
        emit UpdateKeeper(_keeper);
    }
    
    function setEmergencyAdmin(address _emergencyAdmin) external onlyManagement {
        if (_emergencyAdmin == address(0)) revert ZeroAddress();
        emergencyAdmin = _emergencyAdmin;
        emit UpdateEmergencyAdmin(_emergencyAdmin);
    }
    
    function setWhitelistEnabled(bool _enabled) external onlyOwner {
        whitelistEnabled = _enabled;
        emit WhitelistEnabled(_enabled);
    }
    
    function setWhitelist(address _account, bool _status) external onlyOwner {
        if (_account == address(0)) revert ZeroAddress();
        whitelist[_account] = _status;
        emit WhitelistUpdated(_account, _status);
    }
    
    function setWhitelistBatch(address[] calldata _accounts, bool _status) external onlyOwner {
        for (uint256 i = 0; i < _accounts.length; i++) {
            if (_accounts[i] == address(0)) revert ZeroAddress();
            whitelist[_accounts[i]] = _status;
            emit WhitelistUpdated(_accounts[i], _status);
        }
    }
    
    function setPerformanceFee(uint16 _performanceFee) external onlyManagement {
        if (_performanceFee > MAX_FEE) revert InvalidAmount();
        performanceFee = _performanceFee;
        emit UpdatePerformanceFee(_performanceFee);
    }
    
    function setPerformanceFeeRecipient(address _performanceFeeRecipient) external onlyManagement {
        if (_performanceFeeRecipient == address(0)) revert ZeroAddress();
        performanceFeeRecipient = _performanceFeeRecipient;
        emit UpdatePerformanceFeeRecipient(_performanceFeeRecipient);
    }
    
    function setProfitMaxUnlockTime(uint256 _profitMaxUnlockTime) external onlyManagement {
        if (_profitMaxUnlockTime > SECONDS_PER_YEAR) revert InvalidAmount();
        profitMaxUnlockTime = uint32(_profitMaxUnlockTime);
        emit UpdateProfitMaxUnlockTime(_profitMaxUnlockTime);
    }
    
    function setPendingManagement(address _management) external onlyManagement {
        if (_management == address(0)) revert ZeroAddress();
        pendingManagement = _management;
        emit UpdatePendingManagement(_management);
    }
    
    function acceptManagement() external {
        if (msg.sender != pendingManagement) revert Unauthorized();
        management = pendingManagement;
        pendingManagement = address(0);
        emit UpdateManagement(management);
    }
    
    function setDeploymentParams(uint256 _threshold, uint256 _interval) external onlyOwner {
        deploymentThreshold = _threshold;
        minDeploymentInterval = _interval;
    }
    
    function setMaxTotalSupply(uint256 _maxTotalSupply) external onlyOwner {
        require(_maxTotalSupply >= totalSupply(), "Below current supply");
        maxTotalSupply = _maxTotalSupply;
    }
    
    /**
     * @notice Configure flash loan protection parameters
     * @dev MEV/flash loan exploit mitigation
     * @param _withdrawDelayBlocks Blocks to wait after deposit before withdraw allowed
     * @param _largeWithdrawalThreshold Assets above which queue is required
     * @param _largeWithdrawalDelayBlocks Extra blocks for large withdrawal queue
     */
    function setFlashLoanProtection(
        uint256 _withdrawDelayBlocks,
        uint256 _largeWithdrawalThreshold,
        uint256 _largeWithdrawalDelayBlocks
    ) external onlyOwner {
        require(_withdrawDelayBlocks <= 100, "Too many blocks");
        require(_largeWithdrawalDelayBlocks <= 1000, "Too many blocks");
        
        withdrawDelayBlocks = _withdrawDelayBlocks;
        largeWithdrawalThreshold = _largeWithdrawalThreshold;
        largeWithdrawalDelayBlocks = _largeWithdrawalDelayBlocks;
    }
    
    function syncBalances() external onlyManagement {
        uint256 actual = CREATOR_COIN.balanceOf(address(this));
        coinBalance = actual;
        emit BalancesSynced(actual);
    }
    
    function rescueETH() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            payable(owner()).transfer(balance);
        }
    }
    
    function rescueToken(address token, uint256 amount, address to) external onlyOwner {
        if (token == address(CREATOR_COIN)) {
            revert("Use emergency functions for Creator Coin");
        }
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    /**
     * @notice Get price per share (1e18 scale)
     */
    function pricePerShare() public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e18;
        return (totalAssets() * 1e18) / supply;
    }
    
    /**
     * @notice Get idle balance
     */
    function idleBalance() external view returns (uint256) {
        return coinBalance;
    }
    
    /**
     * @notice Get deployed balance in strategies
     */
    function deployedBalance() external view returns (uint256 total) {
        uint256 len = strategyList.length;
        for (uint256 i; i < len; i++) {
            if (activeStrategies[strategyList[i]]) {
                total += IStrategy(strategyList[i]).getTotalAssets();
            }
        }
    }
    
    /**
     * @notice Get queued withdrawal status
     */
    function getQueuedWithdrawal(address user) external view returns (
        uint256 shares,
        uint256 unlockBlock,
        address receiver,
        bool isClaimable
    ) {
        QueuedWithdrawal storage queued = queuedWithdrawals[user];
        shares = queued.shares;
        unlockBlock = queued.unlockBlock;
        receiver = queued.receiver;
        isClaimable = shares > 0 && block.number >= unlockBlock;
    }
    
    /**
     * @notice Check if user can withdraw immediately (flash loan protection check)
     */
    function canWithdrawNow(address user) external view returns (bool, uint256 blocksRemaining) {
        uint256 requiredBlock = lastDepositBlock[user] + withdrawDelayBlocks;
        if (block.number >= requiredBlock) {
            return (true, 0);
        }
        return (false, requiredBlock - block.number);
    }
    
    /**
     * @notice Get all strategies
     */
    function getStrategies() external view returns (
        address[] memory strategies,
        uint256[] memory weights,
        uint256[] memory assets
    ) {
        uint256 length = strategyList.length;
        strategies = new address[](length);
        weights = new uint256[](length);
        assets = new uint256[](length);
        
        for (uint256 i = 0; i < length; i++) {
            strategies[i] = strategyList[i];
            weights[i] = strategyWeights[strategyList[i]];
            if (activeStrategies[strategyList[i]]) {
                assets[i] = IStrategy(strategyList[i]).getTotalAssets();
            }
        }
    }
    
    /**
     * @notice Get vault state
     */
    function getVaultState() external view returns (
        bool _paused,
        bool _isShutdown,
        bool _whitelistEnabled,
        uint256 _totalAssets,
        uint256 _totalSupply,
        uint256 _pricePerShare,
        uint256 _coinBalance,
        uint256 _totalStrategyWeight
    ) {
        return (
            paused,
            isShutdown,
            whitelistEnabled,
            totalAssets(),
            totalSupply(),
            pricePerShare(),
            coinBalance,
            totalStrategyWeight
        );
    }
    
    /**
     * @notice Get locked profit state
     */
    function getProfitState() external view returns (
        uint256 _totalLockedShares,
        uint256 _unlockedShares,
        uint256 _lockedShares,
        uint96 _fullProfitUnlockDate,
        uint96 _lastReport
    ) {
        return (
            totalLockedShares,
            unlockedShares(),
            lockedShares(),
            fullProfitUnlockDate,
            lastReport
        );
    }
    
    function decimals() public pure override returns (uint8) {
        return 18;
    }
    
    /**
     * @notice Decimals offset for virtual shares (inflation attack protection)
     * @dev OpenZeppelin ERC4626 uses this to add "virtual" shares/assets
     *      An offset of 3 means 10^3 = 1000 virtual shares exist
     *      This makes the first-depositor inflation attack economically infeasible
     * 
     * @custom:security CRITICAL for yTUSD-style attack prevention
     *      With offset of 3:
     *      - Attacker needs to donate 1000 tokens per 1 token stolen
     *      - Makes dust-balance manipulation unprofitable
     * 
     * Reference: https://blog.openzeppelin.com/a-novel-defense-against-erc4626-inflation-attacks
     */
    function _decimalsOffset() internal pure override returns (uint8) {
        return 3; // 10^3 = 1000 virtual shares
    }
}
