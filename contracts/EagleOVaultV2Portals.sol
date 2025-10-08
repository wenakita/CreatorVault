// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IStrategy } from "./interfaces/IStrategy.sol";

/**
 * @title EagleOVaultV2Portals
 * @notice Enhanced LayerZero Omnichain Vault with Portals.fi Integration
 * @dev PORTALS INTEGRATION:
 *      - Zap from ANY token using Portals API
 *      - Optimal routing across all DEXs
 *      - Multi-hop swaps for best prices
 *      - Gasless approvals via permit
 *      - Built-in slippage protection
 * 
 * FEATURES:
 *      - Deposit with ANY token (handled by Portals)
 *      - Auto-rebalancing for optimal ratio
 *      - Batch deployments for gas efficiency
 *      - Strategy management (Charm, etc.)
 *      - Omnichain via LayerZero
 * 
 * ARCHITECTURE:
 *      User → Portals (converts ANY token to WLFI+USD1) → Vault → Strategies
 */
contract EagleOVaultV2Portals is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =================================
    // STATE VARIABLES
    // =================================
    
    /// @dev The secondary token (USD1) for dual-token strategy
    IERC20 public immutable USD1_TOKEN;
    
    /// @dev The WLFI token (primary asset)
    IERC20 public immutable WLFI_TOKEN;
    
    /// @dev Portals router address (0xbf5a7f3629fb325e2a8453d595ab103465f75e62 on mainnet)
    address public immutable PORTALS_ROUTER;
    
    /// @dev Current token balances held directly by vault
    uint256 public wlfiBalance;
    uint256 public usd1Balance;
    
    /// @dev Strategy management
    mapping(address => bool) public activeStrategies;
    mapping(address => uint256) public strategyWeights;
    address[] public strategyList;
    uint256 public totalStrategyWeight;
    uint256 public maxStrategies = 5;
    
    /// @dev Vault configuration
    uint256 public targetRatio = 5000; // 50% WLFI, 50% USD1
    uint256 public maxTotalSupply = type(uint256).max;
    uint256 public protocolFee = 200; // 2% protocol fee
    uint256 public managerFee = 100;  // 1% manager fee
    
    /// @dev Batch deployment optimization
    uint256 public deploymentThreshold = 10_000e18;
    uint256 public minDeploymentInterval = 1 hours;
    uint256 public lastDeployment;
    
    /// @dev Access control
    address public manager;
    address public pendingManager;
    mapping(address => bool) public authorized;
    
    /// @dev Emergency controls
    bool public paused = false;
    uint256 public lastRebalance;
    
    /// @dev Portals integration
    address public portalsPartner; // For fee sharing
    uint256 public portalsFeePercentage = 0; // Optional fee in basis points
    
    // =================================
    // EVENTS
    // =================================
    
    event DualDeposit(address indexed user, uint256 wlfiAmount, uint256 usd1Amount, uint256 shares);
    event DualWithdraw(address indexed user, uint256 shares, uint256 wlfiAmount, uint256 usd1Amount);
    event PortalsZap(address indexed user, address indexed tokenIn, uint256 amountIn, uint256 shares);
    event StrategyAdded(address indexed strategy, uint256 weight);
    event StrategyRemoved(address indexed strategy);
    event StrategyRebalanced(address indexed strategy, uint256 wlfiDeployed, uint256 usd1Deployed);
    event Rebalanced(uint256 newWlfiBalance, uint256 newUsd1Balance);
    event ManagerSet(address indexed oldManager, address indexed newManager);
    event EmergencyPause(bool paused);
    event BatchDeployment(uint256 wlfiDeployed, uint256 usd1Deployed, uint256 timestamp);

    // =================================
    // ERRORS
    // =================================
    
    error ZeroAddress();
    error Unauthorized();
    error Paused();
    error InvalidAmount();
    error InsufficientBalance();
    error StrategyAlreadyActive();
    error StrategyNotActive();
    error MaxStrategiesReached();
    error InvalidWeight();
    error PortalsCallFailed();

    // =================================
    // CONSTRUCTOR
    // =================================
    
    /**
     * @notice Creates the Eagle Omnichain Vault with Portals Integration
     * @param _wlfiToken The WLFI token contract
     * @param _usd1Token The USD1 token contract
     * @param _portalsRouter Portals router address
     * @param _owner The vault owner
     */
    constructor(
        address _wlfiToken,
        address _usd1Token,
        address _portalsRouter,
        address _owner
    ) 
        ERC20("Eagle", "EAGLE") 
        ERC4626(IERC20(_wlfiToken)) 
        Ownable(_owner) 
    {
        if (_wlfiToken == address(0) || _usd1Token == address(0) || 
            _portalsRouter == address(0) || _owner == address(0)) {
            revert ZeroAddress();
        }
        
        WLFI_TOKEN = IERC20(_wlfiToken);
        USD1_TOKEN = IERC20(_usd1Token);
        PORTALS_ROUTER = _portalsRouter;
        
        authorized[_owner] = true;
        manager = _owner;
        
        lastRebalance = block.timestamp;
        lastDeployment = block.timestamp;
    }
    
    // Allow contract to receive ETH
    receive() external payable {}

    // =================================
    // MODIFIERS
    // =================================
    
    modifier onlyAuthorized() {
        if (!authorized[msg.sender] && msg.sender != owner()) revert Unauthorized();
        _;
    }
    
    modifier onlyManager() {
        if (msg.sender != manager && msg.sender != owner()) revert Unauthorized();
        _;
    }
    
    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }
    
    modifier validAddress(address _addr) {
        if (_addr == address(0)) revert ZeroAddress();
        _;
    }

    // =================================
    // PORTALS ZAP FUNCTIONS
    // =================================
    
    /**
     * @notice Zap into vault using Portals API
     * @dev This function accepts pre-generated Portals transaction data
     *      Users should call Portals API off-chain to get optimal routes
     * 
     * FLOW:
     * 1. User calls Portals API: GET /v2/portal with their token
     * 2. Portals returns tx data to convert token → WLFI + USD1
     * 3. User calls this function with the tx data
     * 4. Vault executes Portals tx, receives WLFI + USD1
     * 5. Vault mints EAGLE shares to user
     * 
     * @param portalsCallData The transaction data from Portals API (tx.data field)
     * @param expectedWlfiMin Minimum WLFI amount expected (slippage protection)
     * @param expectedUsd1Min Minimum USD1 amount expected (slippage protection)
     * @return shares Amount of EAGLE shares minted
     */
    function zapViaPortals(
        bytes calldata portalsCallData,
        uint256 expectedWlfiMin,
        uint256 expectedUsd1Min
    ) external payable nonReentrant whenNotPaused returns (uint256 shares) {
        // Record balances before Portals call
        uint256 wlfiBalanceBefore = WLFI_TOKEN.balanceOf(address(this));
        uint256 usd1BalanceBefore = USD1_TOKEN.balanceOf(address(this));
        
        // Execute Portals transaction
        (bool success, ) = PORTALS_ROUTER.call{value: msg.value}(portalsCallData);
        if (!success) revert PortalsCallFailed();
        
        // Calculate received amounts
        uint256 wlfiReceived = WLFI_TOKEN.balanceOf(address(this)) - wlfiBalanceBefore;
        uint256 usd1Received = USD1_TOKEN.balanceOf(address(this)) - usd1BalanceBefore;
        
        // Validate slippage
        if (wlfiReceived < expectedWlfiMin || usd1Received < expectedUsd1Min) {
            revert InvalidAmount();
        }
        
        // Update balances
        wlfiBalance += wlfiReceived;
        usd1Balance += usd1Received;
        
        // Calculate and mint shares
        uint256 totalValue = wlfiReceived + usd1Received;
        shares = _calculateShares(totalValue);
        
        if (totalSupply() + shares > maxTotalSupply) revert InvalidAmount();
        
        _mint(msg.sender, shares);
        
        // Deploy to strategies if threshold met
        if (_shouldDeployToStrategies()) {
            _deployToStrategies(wlfiBalance, usd1Balance);
            lastDeployment = block.timestamp;
            emit BatchDeployment(wlfiBalance, usd1Balance, block.timestamp);
        }
        
        emit PortalsZap(msg.sender, address(0), msg.value, shares);
    }
    
    /**
     * @notice Zap with ERC20 token using Portals
     * @dev For ERC20 tokens, user must approve this contract first
     * @param tokenIn Address of input token
     * @param amountIn Amount of input token
     * @param portalsCallData Transaction data from Portals API
     * @param expectedWlfiMin Minimum WLFI expected
     * @param expectedUsd1Min Minimum USD1 expected
     * @return shares Amount of EAGLE shares minted
     */
    function zapERC20ViaPortals(
        address tokenIn,
        uint256 amountIn,
        bytes calldata portalsCallData,
        uint256 expectedWlfiMin,
        uint256 expectedUsd1Min
    ) external nonReentrant whenNotPaused returns (uint256 shares) {
        // Transfer input token from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve Portals router if needed
        IERC20(tokenIn).safeIncreaseAllowance(PORTALS_ROUTER, amountIn);
        
        // Record balances before Portals call
        uint256 wlfiBalanceBefore = WLFI_TOKEN.balanceOf(address(this));
        uint256 usd1BalanceBefore = USD1_TOKEN.balanceOf(address(this));
        
        // Execute Portals transaction
        (bool success, ) = PORTALS_ROUTER.call(portalsCallData);
        if (!success) revert PortalsCallFailed();
        
        // Calculate received amounts
        uint256 wlfiReceived = WLFI_TOKEN.balanceOf(address(this)) - wlfiBalanceBefore;
        uint256 usd1Received = USD1_TOKEN.balanceOf(address(this)) - usd1BalanceBefore;
        
        // Validate slippage
        if (wlfiReceived < expectedWlfiMin || usd1Received < expectedUsd1Min) {
            revert InvalidAmount();
        }
        
        // Update balances
        wlfiBalance += wlfiReceived;
        usd1Balance += usd1Received;
        
        // Calculate and mint shares
        uint256 totalValue = wlfiReceived + usd1Received;
        shares = _calculateShares(totalValue);
        
        if (totalSupply() + shares > maxTotalSupply) revert InvalidAmount();
        
        _mint(msg.sender, shares);
        
        // Deploy to strategies if threshold met
        if (_shouldDeployToStrategies()) {
            _deployToStrategies(wlfiBalance, usd1Balance);
            lastDeployment = block.timestamp;
            emit BatchDeployment(wlfiBalance, usd1Balance, block.timestamp);
        }
        
        emit PortalsZap(msg.sender, tokenIn, amountIn, shares);
    }

    // =================================
    // DUAL TOKEN DEPOSIT (Direct)
    // =================================
    
    /**
     * @notice Direct deposit of WLFI + USD1 (no zap needed)
     * @dev Use this if you already have both tokens in correct ratio
     * @param wlfiAmount Amount of WLFI to deposit
     * @param usd1Amount Amount of USD1 to deposit
     * @param receiver Address to receive shares
     * @return shares Amount of shares minted
     */
    function depositDual(
        uint256 wlfiAmount,
        uint256 usd1Amount,
        address receiver
    ) external nonReentrant whenNotPaused returns (uint256 shares) {
        if (wlfiAmount == 0 && usd1Amount == 0) revert InvalidAmount();
        if (receiver == address(0)) revert ZeroAddress();
        
        // Transfer tokens from user
        if (wlfiAmount > 0) {
            WLFI_TOKEN.safeTransferFrom(msg.sender, address(this), wlfiAmount);
            wlfiBalance += wlfiAmount;
        }
        
        if (usd1Amount > 0) {
            USD1_TOKEN.safeTransferFrom(msg.sender, address(this), usd1Amount);
            usd1Balance += usd1Amount;
        }
        
        // Calculate shares
        uint256 totalValue = wlfiAmount + usd1Amount;
        shares = _calculateShares(totalValue);
        
        if (totalSupply() + shares > maxTotalSupply) revert InvalidAmount();
        
        _mint(receiver, shares);
        
        // Deploy to strategies if threshold met
        if (_shouldDeployToStrategies()) {
            _deployToStrategies(wlfiBalance, usd1Balance);
            lastDeployment = block.timestamp;
            emit BatchDeployment(wlfiBalance, usd1Balance, block.timestamp);
        }
        
        emit DualDeposit(msg.sender, wlfiAmount, usd1Amount, shares);
    }
    
    /**
     * @notice Withdraw both WLFI and USD1 tokens proportionally
     * @param shares Amount of shares to burn
     * @param receiver Address to receive tokens
     * @return wlfiAmount Amount of WLFI withdrawn
     * @return usd1Amount Amount of USD1 withdrawn
     */
    function withdrawDual(
        uint256 shares,
        address receiver
    ) external nonReentrant returns (uint256 wlfiAmount, uint256 usd1Amount) {
        if (shares == 0) revert InvalidAmount();
        if (receiver == address(0)) revert ZeroAddress();
        if (balanceOf(msg.sender) < shares) revert InsufficientBalance();
        
        // Calculate total assets including strategy positions
        uint256 totalAssetAmount = totalAssets();
        uint256 totalShares = totalSupply();
        
        uint256 totalWithdrawValue = (totalAssetAmount * shares) / totalShares;
        
        // First try to fulfill from direct balances
        uint256 wlfiFromBalance = (wlfiBalance * shares) / totalShares;
        uint256 usd1FromBalance = (usd1Balance * shares) / totalShares;
        
        wlfiAmount = wlfiFromBalance;
        usd1Amount = usd1FromBalance;
        
        // If we need more, withdraw from strategies proportionally
        uint256 remainingValue = totalWithdrawValue - wlfiFromBalance - usd1FromBalance;
        if (remainingValue > 0) {
            (uint256 wlfiFromStrategies, uint256 usd1FromStrategies) = 
                _withdrawFromStrategiesPro(remainingValue);
            wlfiAmount += wlfiFromStrategies;
            usd1Amount += usd1FromStrategies;
        }
        
        // Burn shares first
        _burn(msg.sender, shares);
        
        // Update direct balances
        wlfiBalance -= wlfiFromBalance;
        usd1Balance -= usd1FromBalance;
        
        // Transfer tokens
        if (wlfiAmount > 0) {
            WLFI_TOKEN.safeTransfer(receiver, wlfiAmount);
        }
        if (usd1Amount > 0) {
            USD1_TOKEN.safeTransfer(receiver, usd1Amount);
        }
        
        emit DualWithdraw(msg.sender, shares, wlfiAmount, usd1Amount);
    }

    // =================================
    // STRATEGY MANAGEMENT
    // =================================
    
    /**
     * @notice Add a new yield strategy
     * @param strategy Address of the strategy contract
     * @param weight Allocation weight in basis points (max 10000)
     */
    function addStrategy(address strategy, uint256 weight) external onlyManager validAddress(strategy) {
        if (activeStrategies[strategy]) revert StrategyAlreadyActive();
        if (strategyList.length >= maxStrategies) revert MaxStrategiesReached();
        if (weight == 0 || weight > 10000) revert InvalidWeight();
        if (totalStrategyWeight + weight > 10000) revert InvalidWeight();
        
        require(IStrategy(strategy).isInitialized(), "Strategy not initialized");
        
        activeStrategies[strategy] = true;
        strategyWeights[strategy] = weight;
        strategyList.push(strategy);
        totalStrategyWeight += weight;
        
        emit StrategyAdded(strategy, weight);
    }
    
    /**
     * @notice Remove a yield strategy
     * @param strategy Address of the strategy to remove
     */
    function removeStrategy(address strategy) external onlyManager {
        if (!activeStrategies[strategy]) revert StrategyNotActive();
        
        _withdrawFromStrategy(strategy, type(uint256).max);
        
        activeStrategies[strategy] = false;
        totalStrategyWeight -= strategyWeights[strategy];
        strategyWeights[strategy] = 0;
        
        for (uint256 i = 0; i < strategyList.length; i++) {
            if (strategyList[i] == strategy) {
                strategyList[i] = strategyList[strategyList.length - 1];
                strategyList.pop();
                break;
            }
        }
        
        emit StrategyRemoved(strategy);
    }

    // =================================
    // INTERNAL FUNCTIONS
    // =================================
    
    function _shouldDeployToStrategies() internal view returns (bool) {
        if (totalStrategyWeight == 0) return false;
        uint256 idleFunds = wlfiBalance + usd1Balance;
        if (idleFunds < deploymentThreshold) return false;
        if (block.timestamp < lastDeployment + minDeploymentInterval) return false;
        return true;
    }
    
    function _deployToStrategies(uint256 wlfiAmount, uint256 usd1Amount) internal {
        if (totalStrategyWeight == 0) return;
        
        uint256 totalValue = wlfiAmount + usd1Amount;
        if (totalValue == 0) return;
        
        for (uint256 i = 0; i < strategyList.length; i++) {
            address strategy = strategyList[i];
            if (activeStrategies[strategy] && strategyWeights[strategy] > 0) {
                uint256 strategyValue = (totalValue * strategyWeights[strategy]) / totalStrategyWeight;
                
                uint256 strategyWlfi = 0;
                uint256 strategyUsd1 = 0;
                
                if (totalValue > 0) {
                    strategyWlfi = (strategyValue * wlfiAmount) / totalValue;
                    strategyUsd1 = (strategyValue * usd1Amount) / totalValue;
                }
                
                if (strategyWlfi > 0 || strategyUsd1 > 0) {
                    wlfiBalance -= strategyWlfi;
                    usd1Balance -= strategyUsd1;
                    
                    if (strategyWlfi > 0) {
                        WLFI_TOKEN.safeIncreaseAllowance(strategy, strategyWlfi);
                    }
                    if (strategyUsd1 > 0) {
                        USD1_TOKEN.safeIncreaseAllowance(strategy, strategyUsd1);
                    }
                    
                    IStrategy(strategy).deposit(strategyWlfi, strategyUsd1);
                    
                    emit StrategyRebalanced(strategy, strategyWlfi, strategyUsd1);
                }
            }
        }
    }
    
    function _withdrawFromStrategiesPro(uint256 valueNeeded) internal returns (uint256 wlfiTotal, uint256 usd1Total) {
        for (uint256 i = 0; i < strategyList.length; i++) {
            address strategy = strategyList[i];
            if (activeStrategies[strategy]) {
                (uint256 strategyWlfi, uint256 strategyUsd1) = IStrategy(strategy).getTotalAmounts();
                uint256 strategyValue = strategyWlfi + strategyUsd1;
                
                if (strategyValue > 0) {
                    uint256 withdrawValue = (valueNeeded * strategyWeights[strategy]) / totalStrategyWeight;
                    
                    if (withdrawValue > 0) {
                        (uint256 wlfi, uint256 usd1) = IStrategy(strategy).withdraw(withdrawValue);
                        
                        wlfiBalance += wlfi;
                        usd1Balance += usd1;
                        wlfiTotal += wlfi;
                        usd1Total += usd1;
                    }
                }
            }
        }
    }
    
    function _withdrawFromStrategy(address strategy, uint256 sharesToWithdraw) internal {
        if (!activeStrategies[strategy]) return;
        
        (uint256 wlfi, uint256 usd1) = IStrategy(strategy).withdraw(sharesToWithdraw);
        
        wlfiBalance += wlfi;
        usd1Balance += usd1;
    }
    
    function _calculateShares(uint256 value) internal view returns (uint256 shares) {
        if (totalSupply() == 0) {
            shares = value;
        } else {
            shares = (value * totalSupply()) / totalAssets();
        }
    }

    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    function totalAssets() public view override returns (uint256) {
        uint256 directAssets = wlfiBalance + usd1Balance;
        
        for (uint256 i = 0; i < strategyList.length; i++) {
            address strategy = strategyList[i];
            if (activeStrategies[strategy]) {
                (uint256 wlfi, uint256 usd1) = IStrategy(strategy).getTotalAmounts();
                directAssets += wlfi + usd1;
            }
        }
        
        return directAssets;
    }
    
    function getVaultBalances() external view returns (uint256 wlfi, uint256 usd1) {
        return (wlfiBalance, usd1Balance);
    }
    
    function getPortalsRouter() external view returns (address) {
        return PORTALS_ROUTER;
    }

    // =================================
    // MANAGEMENT FUNCTIONS
    // =================================
    
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit EmergencyPause(_paused);
    }
    
    function setPortalsPartner(address _partner) external onlyOwner {
        portalsPartner = _partner;
    }
    
    function setPortalsFee(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 100, "Fee too high"); // Max 1%
        portalsFeePercentage = _feePercentage;
    }
    
    function deposit(uint256 assets, address receiver) public override nonReentrant whenNotPaused returns (uint256 shares) {
        if (assets == 0) revert InvalidAmount();
        if (receiver == address(0)) revert ZeroAddress();
        
        WLFI_TOKEN.safeTransferFrom(msg.sender, address(this), assets);
        wlfiBalance += assets;
        
        shares = previewDeposit(assets);
        
        if (totalSupply() + shares > maxTotalSupply) revert InvalidAmount();
        
        _mint(receiver, shares);
        
        if (_shouldDeployToStrategies()) {
            _deployToStrategies(wlfiBalance, usd1Balance);
            lastDeployment = block.timestamp;
        }
        
        emit Deposit(msg.sender, receiver, assets, shares);
    }
}

