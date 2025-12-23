// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IStrategy} from "../interfaces/strategies/IStrategy.sol";

/**
 * @title BaseCreatorStrategy
 * @author 0xakita.eth (CreatorVault)
 * @notice Base strategy contract for CreatorOVault yield strategies
 * 
 * @dev SINGLE-TOKEN PATTERN:
 *      - Each strategy manages one token (the Creator Coin)
 *      - Compatible with the IStrategy interface
 *      - Inherit this contract and implement _deployFunds() and _freeFunds()
 * 
 * @dev ARCHITECTURE:
 *      CreatorOVault → BaseCreatorStrategy → [CharmStrategy, AaveStrategy, etc.]
 *                                           └──> External yield protocols
 * 
 * @dev REQUIRED OVERRIDES:
 *      - _deployFunds(amount) - Deploy funds to yield source
 *      - _freeFunds(amount) - Withdraw from yield source
 *      - _totalDeployed() - Get total value in yield source
 *      - _harvest() - Collect yields
 */
abstract contract BaseCreatorStrategy is IStrategy, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // =================================
    // STATE
    // =================================
    
    /// @notice The underlying token this strategy manages
    IERC20 public immutable ASSET;
    
    /// @notice The vault this strategy serves
    address public vault;
    
    /// @notice Strategy metadata
    string public strategyName;
    
    /// @notice Strategy state
    bool public isActive_;
    bool public isEmergencyMode;
    
    /// @notice Accounting
    uint256 public totalDeposited;
    uint256 public totalWithdrawn;
    uint256 public totalHarvested;
    
    /// @notice Performance
    uint256 public lastHarvest;
    uint256 public lastDeposit;
    
    // =================================
    // EVENTS
    // =================================
    
    event VaultSet(address indexed vault);
    event StrategyActivated();
    event StrategyDeactivated();
    event EmergencyModeEnabled();
    event EmergencyModeDisabled();
    
    // =================================
    // ERRORS
    // =================================
    
    error NotVault();
    error NotActive();
    error EmergencyMode();
    error ZeroAmount();
    error ZeroAddress();
    
    // =================================
    // MODIFIERS
    // =================================
    
    modifier onlyVault() {
        if (msg.sender != vault && msg.sender != owner()) revert NotVault();
        _;
    }
    
    modifier whenActive() {
        if (!isActive_) revert NotActive();
        _;
    }
    
    modifier whenNotEmergency() {
        if (isEmergencyMode) revert EmergencyMode();
        _;
    }
    
    // =================================
    // CONSTRUCTOR
    // =================================
    
    /**
     * @notice Initialize the strategy
     * @param _asset The token this strategy manages (Creator Coin)
     * @param _vault The CreatorOVault address
     * @param _name Strategy name for identification
     * @param _owner Owner address
     */
    constructor(
        address _asset,
        address _vault,
        string memory _name,
        address _owner
    ) Ownable(_owner) {
        if (_asset == address(0)) revert ZeroAddress();
        if (_vault == address(0)) revert ZeroAddress();
        
        ASSET = IERC20(_asset);
        vault = _vault;
        strategyName = _name;
        isActive_ = true;
    }
    
    // =================================
    // IStrategy IMPLEMENTATION
    // =================================
    
    /**
     * @notice Check if strategy is active
     */
    function isActive() external view override returns (bool) {
        return isActive_ && !isEmergencyMode;
    }
    
    /**
     * @notice Get the underlying asset
     */
    function asset() external view override returns (address) {
        return address(ASSET);
    }
    
    /**
     * @notice Get total assets managed by this strategy
     */
    function getTotalAssets() external view override returns (uint256) {
        return _totalDeployed() + ASSET.balanceOf(address(this));
    }
    
    /**
     * @notice Deposit tokens into the strategy
     * @param amount Amount to deposit
     * @return deposited Actual amount deposited
     */
    function deposit(uint256 amount) 
        external 
        override 
        nonReentrant 
        onlyVault 
        whenActive 
        whenNotEmergency 
        returns (uint256 deposited) 
    {
        if (amount == 0) revert ZeroAmount();
        
        // Pull tokens from vault
        ASSET.safeTransferFrom(msg.sender, address(this), amount);
        
        // Deploy to yield source
        deposited = _deployFunds(amount);
        
        // Update accounting
        totalDeposited += deposited;
        lastDeposit = block.timestamp;
        
        emit StrategyDeposit(msg.sender, amount, deposited);
    }
    
    /**
     * @notice Withdraw tokens from the strategy
     * @param amount Amount to withdraw
     * @return withdrawn Actual amount withdrawn
     */
    function withdraw(uint256 amount) 
        external 
        override 
        nonReentrant 
        onlyVault 
        returns (uint256 withdrawn) 
    {
        if (amount == 0) revert ZeroAmount();
        
        // Check local balance first
        uint256 localBalance = ASSET.balanceOf(address(this));
        
        if (localBalance >= amount) {
            // Enough locally
            withdrawn = amount;
        } else {
            // Need to free funds from yield source
            uint256 needed = amount - localBalance;
            uint256 freed = _freeFunds(needed);
            withdrawn = localBalance + freed;
        }
        
        // Transfer to vault
        ASSET.safeTransfer(vault, withdrawn);
        
        // Update accounting
        totalWithdrawn += withdrawn;
        
        emit StrategyWithdraw(vault, amount, withdrawn);
    }
    
    /**
     * @notice Emergency withdraw all funds
     * @return withdrawn Total amount withdrawn
     */
    function emergencyWithdraw() 
        external 
        override 
        nonReentrant 
        onlyVault 
        returns (uint256 withdrawn) 
    {
        // Free all deployed funds
        uint256 deployed = _totalDeployed();
        if (deployed > 0) {
            _freeFunds(deployed);
        }
        
        // Transfer everything to vault
        withdrawn = ASSET.balanceOf(address(this));
        if (withdrawn > 0) {
            ASSET.safeTransfer(vault, withdrawn);
        }
        
        isEmergencyMode = true;
        
        emit EmergencyWithdraw(vault, withdrawn);
    }
    
    /**
     * @notice Harvest yields from the strategy
     * @return profit Amount harvested
     */
    function harvest() 
        external 
        override 
        nonReentrant 
        onlyVault 
        whenActive 
        whenNotEmergency 
        returns (uint256 profit) 
    {
        profit = _harvest();
        
        totalHarvested += profit;
        lastHarvest = block.timestamp;
        
        emit StrategyHarvest(profit);
    }
    
    /**
     * @notice Rebalance strategy position
     */
    function rebalance() 
        external 
        override 
        nonReentrant 
        onlyVault 
        whenActive 
        whenNotEmergency 
    {
        _rebalance();
        
        emit StrategyRebalanced(_totalDeployed());
    }
    
    // =================================
    // ABSTRACT FUNCTIONS (TO IMPLEMENT)
    // =================================
    
    /**
     * @notice Deploy funds to yield source
     * @dev Override in child contract
     * @param amount Amount to deploy
     * @return deployed Actual amount deployed
     */
    function _deployFunds(uint256 amount) internal virtual returns (uint256 deployed);
    
    /**
     * @notice Free funds from yield source
     * @dev Override in child contract
     * @param amount Amount to free
     * @return freed Actual amount freed
     */
    function _freeFunds(uint256 amount) internal virtual returns (uint256 freed);
    
    /**
     * @notice Get total value deployed to yield source
     * @dev Override in child contract
     */
    function _totalDeployed() internal view virtual returns (uint256);
    
    /**
     * @notice Harvest yields
     * @dev Override in child contract
     * @return profit Amount of profit harvested
     */
    function _harvest() internal virtual returns (uint256 profit);
    
    /**
     * @notice Rebalance position (optional)
     * @dev Override if needed, default does nothing
     */
    function _rebalance() internal virtual {
        // Default: no rebalancing needed
    }
    
    // =================================
    // ADMIN FUNCTIONS
    // =================================
    
    /**
     * @notice Set new vault address
     */
    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        vault = _vault;
        emit VaultSet(_vault);
    }
    
    /**
     * @notice Activate strategy
     */
    function activate() external onlyOwner {
        isActive_ = true;
        emit StrategyActivated();
    }
    
    /**
     * @notice Deactivate strategy
     */
    function deactivate() external onlyOwner {
        isActive_ = false;
        emit StrategyDeactivated();
    }
    
    /**
     * @notice Enable emergency mode
     */
    function enableEmergencyMode() external onlyOwner {
        isEmergencyMode = true;
        emit EmergencyModeEnabled();
    }
    
    /**
     * @notice Disable emergency mode
     */
    function disableEmergencyMode() external onlyOwner {
        isEmergencyMode = false;
        emit EmergencyModeDisabled();
    }
    
    /**
     * @notice Rescue stuck tokens (not the main asset)
     */
    function rescueToken(address token, uint256 amount, address to) external onlyOwner {
        if (token == address(ASSET)) {
            revert("Cannot rescue main asset");
        }
        IERC20(token).safeTransfer(to, amount);
    }
    
    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    /**
     * @notice Get strategy statistics
     */
    function getStats() external view returns (
        uint256 _totalDeposited,
        uint256 _totalWithdrawn,
        uint256 _totalHarvested,
        uint256 _lastHarvest,
        uint256 _lastDeposit,
        uint256 _currentBalance,
        uint256 _deployedBalance
    ) {
        return (
            totalDeposited,
            totalWithdrawn,
            totalHarvested,
            lastHarvest,
            lastDeposit,
            ASSET.balanceOf(address(this)),
            _totalDeployed()
        );
    }
    
    /**
     * @notice Get local token balance
     */
    function localBalance() external view returns (uint256) {
        return ASSET.balanceOf(address(this));
    }
    
    /**
     * @notice Get deployed balance
     */
    function deployedBalance() external view returns (uint256) {
        return _totalDeployed();
    }
}


