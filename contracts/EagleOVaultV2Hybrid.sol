// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IStrategy } from "./interfaces/IStrategy.sol";
import { ISwapRouter } from "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import { IWETH9 } from "./interfaces/IWETH9.sol";

/**
 * @title EagleOVaultV2Hybrid
 * @notice The Ultimate Omnichain Vault - Combines Portals + Uniswap + Direct Deposits
 * 
 * @dev THREE DEPOSIT METHODS:
 * 
 *      METHOD 1: PORTALS ZAP (Best UX - ANY token)
 *      └─ zapViaPortals() - Deposit with ANY ERC20 token
 *      └─ zapETHViaPortals() - Deposit with ETH
 *      └─ Uses Portals API for optimal routing across all DEXs
 *      └─ Perfect for: Exotic tokens, large trades, best prices
 * 
 *      METHOD 2: DIRECT UNISWAP (Good gas - Common tokens)
 *      └─ zapDepositETH() - Optimized ETH deposits
 *      └─ zapDeposit() - Optimized for USDC, WBTC, etc.
 *      └─ Uses Uniswap V3 directly for efficiency
 *      └─ Perfect for: ETH, stablecoins, fast execution
 * 
 *      METHOD 3: DIRECT DEPOSIT (Best gas - Power users)
 *      └─ depositDual() - For users with WLFI+USD1
 *      └─ deposit() - ERC4626 standard (WLFI only)
 *      └─ No swaps needed
 *      └─ Perfect for: DeFi natives, traders, lowest gas
 * 
 * @dev FEATURES:
 *      - Auto-rebalancing to target ratio
 *      - Batch deployments for gas optimization
 *      - Multi-strategy support (Charm, etc.)
 *      - Cross-chain via LayerZero OVault
 *      - Emergency pause functionality
 */
contract EagleOVaultV2Hybrid is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =================================
    // STATE VARIABLES
    // =================================
    
    /// @dev Tokens
    IERC20 public immutable USD1_TOKEN;
    IERC20 public immutable WLFI_TOKEN;
    IWETH9 public immutable WETH9;
    
    /// @dev Integration contracts
    ISwapRouter public immutable UNISWAP_ROUTER;
    address public immutable PORTALS_ROUTER;
    
    /// @dev Balances
    uint256 public wlfiBalance;
    uint256 public usd1Balance;
    
    /// @dev Strategy management
    mapping(address => bool) public activeStrategies;
    mapping(address => uint256) public strategyWeights;
    address[] public strategyList;
    uint256 public totalStrategyWeight;
    uint256 public maxStrategies = 5;
    
    /// @dev Configuration
    uint256 public targetRatio = 5000; // 50/50
    uint256 public maxTotalSupply = type(uint256).max;
    uint256 public maxSlippage = 500; // 5%
    
    /// @dev Batch deployment
    uint256 public deploymentThreshold = 10_000e18;
    uint256 public minDeploymentInterval = 1 hours;
    uint256 public lastDeployment;
    
    /// @dev Uniswap pool fees
    uint24 public constant POOL_FEE_LOW = 500;
    uint24 public constant POOL_FEE_MEDIUM = 3000;
    uint24 public constant POOL_FEE_HIGH = 10000;
    uint24 public poolFeeWlfiUsd1 = POOL_FEE_HIGH;
    
    /// @dev Access control
    address public manager;
    mapping(address => bool) public authorized;
    
    /// @dev Emergency
    bool public paused = false;
    uint256 public lastRebalance;
    
    /// @dev Portals configuration
    address public portalsPartner;
    uint256 public portalsFeePercentage = 0;

    // =================================
    // EVENTS
    // =================================
    
    event PortalsZap(address indexed user, address indexed tokenIn, uint256 amountIn, uint256 shares, string method);
    event UniswapZap(address indexed user, address indexed tokenIn, uint256 amountIn, uint256 shares);
    event DualDeposit(address indexed user, uint256 wlfiAmount, uint256 usd1Amount, uint256 shares);
    event StrategyDeployed(uint256 wlfiDeployed, uint256 usd1Deployed, uint256 timestamp);
    event TokensSwapped(address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);

    // =================================
    // ERRORS
    // =================================
    
    error ZeroAddress();
    error Unauthorized();
    error Paused();
    error InvalidAmount();
    error SlippageExceeded();
    error InsufficientBalance();
    error PortalsCallFailed();
    error SwapFailed();

    // =================================
    // CONSTRUCTOR
    // =================================
    
    constructor(
        address _wlfiToken,
        address _usd1Token,
        address _uniswapRouter,
        address _portalsRouter,
        address _weth9,
        address _owner
    ) 
        ERC20("Eagle", "EAGLE") 
        ERC4626(IERC20(_wlfiToken)) 
        Ownable(_owner) 
    {
        if (_wlfiToken == address(0) || _usd1Token == address(0) || 
            _uniswapRouter == address(0) || _portalsRouter == address(0) || 
            _weth9 == address(0) || _owner == address(0)) {
            revert ZeroAddress();
        }
        
        WLFI_TOKEN = IERC20(_wlfiToken);
        USD1_TOKEN = IERC20(_usd1Token);
        UNISWAP_ROUTER = ISwapRouter(_uniswapRouter);
        PORTALS_ROUTER = _portalsRouter;
        WETH9 = IWETH9(_weth9);
        
        authorized[_owner] = true;
        manager = _owner;
        
        lastRebalance = block.timestamp;
        lastDeployment = block.timestamp;
    }
    
    receive() external payable {}

    // =================================
    // MODIFIERS
    // =================================
    
    modifier onlyManager() {
        if (msg.sender != manager && msg.sender != owner()) revert Unauthorized();
        _;
    }
    
    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    // =================================
    // METHOD 1: PORTALS ZAP
    // =================================
    
    /**
     * @notice Zap ETH into vault using Portals
     * @dev User flow:
     *      1. Frontend calls Portals API: GET /v2/portal
     *      2. Portals returns optimal route for ETH → WLFI+USD1
     *      3. User calls this function with the transaction data
     *      4. Vault executes Portals tx, receives WLFI+USD1
     *      5. Vault mints EAGLE shares
     * 
     * @param portalsCallData Transaction data from Portals API
     * @param expectedWlfiMin Minimum WLFI expected (slippage protection)
     * @param expectedUsd1Min Minimum USD1 expected (slippage protection)
     * @return shares Amount of EAGLE shares minted
     */
    function zapETHViaPortals(
        bytes calldata portalsCallData,
        uint256 expectedWlfiMin,
        uint256 expectedUsd1Min
    ) external payable nonReentrant whenNotPaused returns (uint256 shares) {
        if (msg.value == 0) revert InvalidAmount();
        
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
            revert SlippageExceeded();
        }
        
        // Update balances and mint shares
        shares = _processDeposit(wlfiReceived, usd1Received, msg.sender);
        
        emit PortalsZap(msg.sender, address(0), msg.value, shares, "ETH");
    }
    
    /**
     * @notice Zap any ERC20 token into vault using Portals
     * @dev Same flow as ETH zap but for ERC20 tokens
     * @param tokenIn Address of input token
     * @param amountIn Amount of input token
     * @param portalsCallData Transaction data from Portals API
     * @param expectedWlfiMin Minimum WLFI expected
     * @param expectedUsd1Min Minimum USD1 expected
     * @return shares Amount of EAGLE shares minted
     */
    function zapViaPortals(
        address tokenIn,
        uint256 amountIn,
        bytes calldata portalsCallData,
        uint256 expectedWlfiMin,
        uint256 expectedUsd1Min
    ) external nonReentrant whenNotPaused returns (uint256 shares) {
        if (amountIn == 0) revert InvalidAmount();
        
        // Transfer input token from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve Portals router
        IERC20(tokenIn).safeIncreaseAllowance(PORTALS_ROUTER, amountIn);
        
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
            revert SlippageExceeded();
        }
        
        // Update balances and mint shares
        shares = _processDeposit(wlfiReceived, usd1Received, msg.sender);
        
        emit PortalsZap(msg.sender, tokenIn, amountIn, shares, "ERC20");
    }

    // =================================
    // METHOD 2: DIRECT UNISWAP ZAP
    // =================================
    
    /**
     * @notice Zap ETH into vault using Uniswap V3
     * @dev Optimized for ETH → WLFI+USD1 swaps
     * @param receiver Address to receive EAGLE shares
     * @param minSharesOut Minimum shares to receive
     * @return shares Amount of EAGLE shares minted
     */
    function zapDepositETH(
        address receiver,
        uint256 minSharesOut
    ) external payable nonReentrant whenNotPaused returns (uint256 shares) {
        if (msg.value == 0) revert InvalidAmount();
        if (receiver == address(0)) revert ZeroAddress();
        
        // Wrap ETH
        WETH9.deposit{value: msg.value}();
        
        // Swap half to WLFI, half to USD1
        uint256 halfValue = msg.value / 2;
        
        uint256 wlfiAmount = _swapExactInput(
            address(WETH9),
            address(WLFI_TOKEN),
            halfValue,
            POOL_FEE_MEDIUM
        );
        
        uint256 usd1Amount = _swapExactInput(
            address(WETH9),
            address(USD1_TOKEN),
            msg.value - halfValue,
            POOL_FEE_MEDIUM
        );
        
        // Update balances and mint shares
        shares = _processDeposit(wlfiAmount, usd1Amount, receiver);
        
        if (shares < minSharesOut) revert SlippageExceeded();
        
        emit UniswapZap(msg.sender, address(0), msg.value, shares);
    }
    
    /**
     * @notice Zap ERC20 token into vault using Uniswap V3
     * @dev Optimized for common tokens (USDC, WBTC, etc.)
     * @param tokenIn Address of input token
     * @param amountIn Amount of input token
     * @param receiver Address to receive EAGLE shares
     * @param minSharesOut Minimum shares to receive
     * @return shares Amount of EAGLE shares minted
     */
    function zapDeposit(
        address tokenIn,
        uint256 amountIn,
        address receiver,
        uint256 minSharesOut
    ) external nonReentrant whenNotPaused returns (uint256 shares) {
        if (amountIn == 0) revert InvalidAmount();
        if (receiver == address(0)) revert ZeroAddress();
        
        // Transfer token from user
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        uint256 wlfiAmount;
        uint256 usd1Amount;
        
        // Optimize based on input token
        if (tokenIn == address(WLFI_TOKEN)) {
            // Already WLFI, just swap half to USD1
            wlfiAmount = amountIn / 2;
            usd1Amount = _swapExactInput(
                address(WLFI_TOKEN),
                address(USD1_TOKEN),
                amountIn - wlfiAmount,
                poolFeeWlfiUsd1
            );
        } else if (tokenIn == address(USD1_TOKEN)) {
            // Already USD1, just swap half to WLFI
            usd1Amount = amountIn / 2;
            wlfiAmount = _swapExactInput(
                address(USD1_TOKEN),
                address(WLFI_TOKEN),
                amountIn - usd1Amount,
                poolFeeWlfiUsd1
            );
        } else {
            // Other token: swap half to WLFI, half to USD1
            uint256 halfValue = amountIn / 2;
            wlfiAmount = _swapExactInput(tokenIn, address(WLFI_TOKEN), halfValue, POOL_FEE_MEDIUM);
            usd1Amount = _swapExactInput(tokenIn, address(USD1_TOKEN), amountIn - halfValue, POOL_FEE_MEDIUM);
        }
        
        // Update balances and mint shares
        shares = _processDeposit(wlfiAmount, usd1Amount, receiver);
        
        if (shares < minSharesOut) revert SlippageExceeded();
        
        emit UniswapZap(msg.sender, tokenIn, amountIn, shares);
    }

    // =================================
    // METHOD 3: DIRECT DEPOSIT
    // =================================
    
    /**
     * @notice Direct deposit of WLFI + USD1 (no zap needed)
     * @dev Best for power users who already have both tokens
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
        }
        if (usd1Amount > 0) {
            USD1_TOKEN.safeTransferFrom(msg.sender, address(this), usd1Amount);
        }
        
        // Update balances and mint shares
        shares = _processDeposit(wlfiAmount, usd1Amount, receiver);
        
        emit DualDeposit(msg.sender, wlfiAmount, usd1Amount, shares);
    }
    
    /**
     * @notice ERC4626 standard deposit (WLFI only)
     * @param assets Amount of WLFI to deposit
     * @param receiver Address to receive shares
     * @return shares Amount of shares minted
     */
    function deposit(uint256 assets, address receiver) 
        public 
        override 
        nonReentrant 
        whenNotPaused 
        returns (uint256 shares) 
    {
        if (assets == 0) revert InvalidAmount();
        if (receiver == address(0)) revert ZeroAddress();
        
        WLFI_TOKEN.safeTransferFrom(msg.sender, address(this), assets);
        
        shares = _processDeposit(assets, 0, receiver);
        
        emit Deposit(msg.sender, receiver, assets, shares);
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
        
        uint256 totalAssetAmount = totalAssets();
        uint256 totalShares = totalSupply();
        
        // Calculate proportional withdrawal
        uint256 wlfiFromBalance = (wlfiBalance * shares) / totalShares;
        uint256 usd1FromBalance = (usd1Balance * shares) / totalShares;
        
        wlfiAmount = wlfiFromBalance;
        usd1Amount = usd1FromBalance;
        
        // Withdraw from strategies if needed
        uint256 totalWithdrawValue = (totalAssetAmount * shares) / totalShares;
        uint256 remainingValue = totalWithdrawValue - wlfiFromBalance - usd1FromBalance;
        
        if (remainingValue > 0) {
            (uint256 wlfiFromStrategies, uint256 usd1FromStrategies) = 
                _withdrawFromStrategies(remainingValue);
            wlfiAmount += wlfiFromStrategies;
            usd1Amount += usd1FromStrategies;
        }
        
        // Burn shares and transfer tokens
        _burn(msg.sender, shares);
        
        wlfiBalance -= wlfiFromBalance;
        usd1Balance -= usd1FromBalance;
        
        if (wlfiAmount > 0) WLFI_TOKEN.safeTransfer(receiver, wlfiAmount);
        if (usd1Amount > 0) USD1_TOKEN.safeTransfer(receiver, usd1Amount);
    }

    // =================================
    // INTERNAL FUNCTIONS
    // =================================
    
    /**
     * @notice Process deposit: update balances, mint shares, deploy to strategies
     * @param wlfiReceived Amount of WLFI received
     * @param usd1Received Amount of USD1 received
     * @param receiver Address to receive shares
     * @return shares Amount of shares minted
     */
    function _processDeposit(
        uint256 wlfiReceived,
        uint256 usd1Received,
        address receiver
    ) internal returns (uint256 shares) {
        // Calculate shares BEFORE updating balances (critical!)
        uint256 totalValue = wlfiReceived + usd1Received;
        shares = _calculateShares(totalValue);
        
        if (totalSupply() + shares > maxTotalSupply) revert InvalidAmount();
        
        // Update balances AFTER share calculation
        wlfiBalance += wlfiReceived;
        usd1Balance += usd1Received;
        
        // Mint shares
        _mint(receiver, shares);
        
        // Deploy to strategies if threshold met
        if (_shouldDeployToStrategies()) {
            _deployToStrategies(wlfiBalance, usd1Balance);
            lastDeployment = block.timestamp;
            emit StrategyDeployed(wlfiBalance, usd1Balance, block.timestamp);
        }
    }
    
    /**
     * @notice Swap tokens using Uniswap V3
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount to swap
     * @param fee Pool fee tier
     * @return amountOut Amount received
     */
    function _swapExactInput(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 fee
    ) internal returns (uint256 amountOut) {
        IERC20(tokenIn).safeIncreaseAllowance(address(UNISWAP_ROUTER), amountIn);
        
        uint256 minAmountOut = (amountIn * (10000 - maxSlippage)) / 10000;
        
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: fee,
                recipient: address(this),
                deadline: block.timestamp,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            });
        
        amountOut = UNISWAP_ROUTER.exactInputSingle(params);
        
        if (amountOut < minAmountOut) revert SlippageExceeded();
        
        emit TokensSwapped(tokenIn, tokenOut, amountIn, amountOut);
    }
    
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
                
                uint256 strategyWlfi = (strategyValue * wlfiAmount) / totalValue;
                uint256 strategyUsd1 = (strategyValue * usd1Amount) / totalValue;
                
                if (strategyWlfi > 0 || strategyUsd1 > 0) {
                    wlfiBalance -= strategyWlfi;
                    usd1Balance -= strategyUsd1;
                    
                    if (strategyWlfi > 0) WLFI_TOKEN.safeIncreaseAllowance(strategy, strategyWlfi);
                    if (strategyUsd1 > 0) USD1_TOKEN.safeIncreaseAllowance(strategy, strategyUsd1);
                    
                    IStrategy(strategy).deposit(strategyWlfi, strategyUsd1);
                }
            }
        }
    }
    
    function _withdrawFromStrategies(uint256 valueNeeded) 
        internal 
        returns (uint256 wlfiTotal, uint256 usd1Total) 
    {
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
    
    function _calculateShares(uint256 value) internal view returns (uint256 shares) {
        if (totalSupply() == 0) {
            shares = value;
        } else {
            shares = (value * totalSupply()) / totalAssets();
        }
    }

    // =================================
    // STRATEGY MANAGEMENT
    // =================================
    
    function addStrategy(address strategy, uint256 weight) external onlyManager {
        require(!activeStrategies[strategy], "Already active");
        require(strategyList.length < maxStrategies, "Max strategies");
        require(weight > 0 && weight <= 10000, "Invalid weight");
        require(totalStrategyWeight + weight <= 10000, "Total weight exceeded");
        require(IStrategy(strategy).isInitialized(), "Not initialized");
        
        activeStrategies[strategy] = true;
        strategyWeights[strategy] = weight;
        strategyList.push(strategy);
        totalStrategyWeight += weight;
    }
    
    function removeStrategy(address strategy) external onlyManager {
        require(activeStrategies[strategy], "Not active");
        
        (uint256 wlfi, uint256 usd1) = IStrategy(strategy).withdraw(type(uint256).max);
        wlfiBalance += wlfi;
        usd1Balance += usd1;
        
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
    }

    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    function totalAssets() public view override returns (uint256) {
        uint256 total = wlfiBalance + usd1Balance;
        
        for (uint256 i = 0; i < strategyList.length; i++) {
            if (activeStrategies[strategyList[i]]) {
                (uint256 wlfi, uint256 usd1) = IStrategy(strategyList[i]).getTotalAmounts();
                total += wlfi + usd1;
            }
        }
        
        return total;
    }
    
    function getVaultBalances() external view returns (uint256 wlfi, uint256 usd1) {
        return (wlfiBalance, usd1Balance);
    }
    
    function getIntegrationAddresses() external view returns (
        address uniswapRouter,
        address portalsRouter,
        address weth9
    ) {
        return (address(UNISWAP_ROUTER), PORTALS_ROUTER, address(WETH9));
    }

    // =================================
    // MANAGEMENT FUNCTIONS
    // =================================
    
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }
    
    function setManager(address _manager) external onlyOwner {
        require(_manager != address(0), "Zero address");
        manager = _manager;
        authorized[_manager] = true;
    }
    
    function setDeploymentParams(uint256 _threshold, uint256 _interval) external onlyOwner {
        deploymentThreshold = _threshold;
        minDeploymentInterval = _interval;
    }
    
    function setPortalsConfig(address _partner, uint256 _feePercentage) external onlyOwner {
        portalsPartner = _partner;
        require(_feePercentage <= 100, "Fee too high");
        portalsFeePercentage = _feePercentage;
    }
    
    function forceDeployToStrategies() external onlyManager nonReentrant {
        require(totalStrategyWeight > 0, "No strategies");
        _deployToStrategies(wlfiBalance, usd1Balance);
        lastDeployment = block.timestamp;
        emit StrategyDeployed(wlfiBalance, usd1Balance, block.timestamp);
    }
}

