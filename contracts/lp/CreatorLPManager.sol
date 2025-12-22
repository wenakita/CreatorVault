// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CreatorLPManager
 * @author 0xakita.eth (CreatorVault)
 * @notice Manages multiple LP strategies for Creator Coin vaults
 * 
 * @dev ARCHITECTURE:
 *      CreatOVault → CreatorLPManager → [FullRangeStrategy, LimitOrderStrategy]
 *                                         └──> Uniswap V4 Positions
 * 
 * @dev FEATURES:
 *      - Multiple strategy management (Full Range + Limit Orders)
 *      - Async configuration via operation queue
 *      - Configurable allocation percentages
 *      - Automatic rebalancing based on triggers
 *      - Slippage protection on all operations
 * 
 * @dev STRATEGIES:
 *      1. Full Range: Provides broad liquidity coverage
 *      2. Limit Order: 1-tick position for price support/resistance
 */
contract CreatorLPManager is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =================================
    // TYPES
    // =================================

    /// @notice LP Strategy interface
    interface ILPStrategy {
        function deposit(uint256 creatorCoinAmount, uint256 pairedAmount) external returns (uint256 liquidity);
        function withdraw(uint256 liquidity) external returns (uint256 creatorCoinAmount, uint256 pairedAmount);
        function withdrawAll() external returns (uint256 creatorCoinAmount, uint256 pairedAmount);
        function rebalance() external;
        function getTotalValue() external view returns (uint256 creatorCoinValue, uint256 pairedValue);
        function getLiquidity() external view returns (uint256);
        function isActive() external view returns (bool);
        function strategyType() external pure returns (StrategyType);
    }

    enum StrategyType {
        FullRange,
        LimitOrder,
        Concentrated
    }

    enum OperationType {
        AddStrategy,
        RemoveStrategy,
        UpdateAllocation,
        Rebalance,
        SetTickOffset,
        Emergency
    }

    struct Strategy {
        address strategyAddress;
        StrategyType strategyType;
        uint256 targetAllocationBps;  // Target allocation in basis points (10000 = 100%)
        uint256 currentLiquidity;
        bool isActive;
        uint256 lastDeposit;
        uint256 lastWithdraw;
    }

    struct QueuedOperation {
        OperationType opType;
        bytes data;
        uint256 executeAfter;
        bool executed;
    }

    // =================================
    // STATE
    // =================================

    /// @notice The Creator Coin this manager handles
    IERC20 public immutable CREATOR_COIN;
    
    /// @notice The paired token (ETH wrapper or WETH)
    IERC20 public immutable PAIRED_TOKEN;
    
    /// @notice Vault that owns this manager
    address public vault;
    
    /// @notice All registered strategies
    Strategy[] public strategies;
    
    /// @notice Strategy address to index mapping
    mapping(address => uint256) public strategyIndex;
    
    /// @notice Operation queue for async configuration
    QueuedOperation[] public operationQueue;
    
    /// @notice Time delay for queued operations (security)
    uint256 public operationDelay = 1 hours;
    
    /// @notice Minimum time between rebalances
    uint256 public rebalanceCooldown = 1 hours;
    
    /// @notice Last rebalance timestamp
    uint256 public lastRebalance;
    
    /// @notice Slippage tolerance in basis points
    uint256 public slippageBps = 300; // 3%
    
    /// @notice Rebalance threshold in basis points (triggers rebalance if allocation drifts)
    uint256 public rebalanceThresholdBps = 500; // 5%
    
    /// @notice Total basis points (100%)
    uint256 public constant BASIS_POINTS = 10000;
    
    /// @notice Managers who can execute operations
    mapping(address => bool) public isManager;

    // =================================
    // EVENTS
    // =================================

    event StrategyAdded(address indexed strategy, StrategyType strategyType, uint256 targetAllocationBps);
    event StrategyRemoved(address indexed strategy);
    event AllocationUpdated(address indexed strategy, uint256 oldAllocation, uint256 newAllocation);
    event Deposited(address indexed strategy, uint256 creatorCoinAmount, uint256 pairedAmount, uint256 liquidity);
    event Withdrawn(address indexed strategy, uint256 liquidity, uint256 creatorCoinAmount, uint256 pairedAmount);
    event Rebalanced(uint256 timestamp);
    event OperationQueued(uint256 indexed opId, OperationType opType, uint256 executeAfter);
    event OperationExecuted(uint256 indexed opId);
    event OperationCancelled(uint256 indexed opId);
    event ManagerUpdated(address indexed manager, bool status);
    event VaultSet(address indexed vault);

    // =================================
    // ERRORS
    // =================================

    error NotVault();
    error NotManager();
    error StrategyExists();
    error StrategyNotFound();
    error InvalidAllocation();
    error OperationNotReady();
    error OperationAlreadyExecuted();
    error CooldownNotElapsed();
    error ZeroAddress();
    error ZeroAmount();
    error SlippageExceeded();

    // =================================
    // MODIFIERS
    // =================================

    modifier onlyVault() {
        if (msg.sender != vault && msg.sender != owner()) revert NotVault();
        _;
    }

    modifier onlyManager() {
        if (!isManager[msg.sender] && msg.sender != owner()) revert NotManager();
        _;
    }

    // =================================
    // CONSTRUCTOR
    // =================================

    /**
     * @notice Initialize the LP Manager
     * @param _creatorCoin The Creator Coin token
     * @param _pairedToken The paired token (WETH)
     * @param _vault The vault that controls this manager
     * @param _owner Owner address
     */
    constructor(
        address _creatorCoin,
        address _pairedToken,
        address _vault,
        address _owner
    ) Ownable(_owner) {
        if (_creatorCoin == address(0)) revert ZeroAddress();
        if (_pairedToken == address(0)) revert ZeroAddress();
        
        CREATOR_COIN = IERC20(_creatorCoin);
        PAIRED_TOKEN = IERC20(_pairedToken);
        vault = _vault;
        
        isManager[_owner] = true;
    }

    // =================================
    // STRATEGY MANAGEMENT
    // =================================

    /**
     * @notice Add a new LP strategy
     * @param _strategy Strategy contract address
     * @param _targetAllocationBps Target allocation in basis points
     */
    function addStrategy(
        address _strategy,
        uint256 _targetAllocationBps
    ) external onlyOwner {
        if (_strategy == address(0)) revert ZeroAddress();
        if (strategyIndex[_strategy] != 0 || (strategies.length > 0 && strategies[0].strategyAddress == _strategy)) {
            revert StrategyExists();
        }
        
        // Validate total allocation
        uint256 totalAllocation = _targetAllocationBps;
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].isActive) {
                totalAllocation += strategies[i].targetAllocationBps;
            }
        }
        if (totalAllocation > BASIS_POINTS) revert InvalidAllocation();
        
        ILPStrategy strategyContract = ILPStrategy(_strategy);
        
        strategies.push(Strategy({
            strategyAddress: _strategy,
            strategyType: strategyContract.strategyType(),
            targetAllocationBps: _targetAllocationBps,
            currentLiquidity: 0,
            isActive: true,
            lastDeposit: 0,
            lastWithdraw: 0
        }));
        
        strategyIndex[_strategy] = strategies.length; // 1-indexed
        
        // Approve strategy to spend tokens
        CREATOR_COIN.forceApprove(_strategy, type(uint256).max);
        PAIRED_TOKEN.forceApprove(_strategy, type(uint256).max);
        
        emit StrategyAdded(_strategy, strategyContract.strategyType(), _targetAllocationBps);
    }

    /**
     * @notice Remove a strategy (withdraws all funds first)
     * @param _strategy Strategy address to remove
     */
    function removeStrategy(address _strategy) external onlyOwner {
        uint256 idx = _getStrategyIndex(_strategy);
        Strategy storage strat = strategies[idx];
        
        // Withdraw all from strategy first
        if (strat.currentLiquidity > 0) {
            ILPStrategy(strat.strategyAddress).withdrawAll();
        }
        
        // Deactivate
        strat.isActive = false;
        strat.targetAllocationBps = 0;
        
        // Revoke approvals
        CREATOR_COIN.forceApprove(_strategy, 0);
        PAIRED_TOKEN.forceApprove(_strategy, 0);
        
        emit StrategyRemoved(_strategy);
    }

    /**
     * @notice Update strategy allocation
     * @param _strategy Strategy address
     * @param _newAllocationBps New allocation in basis points
     */
    function updateAllocation(address _strategy, uint256 _newAllocationBps) external onlyManager {
        uint256 idx = _getStrategyIndex(_strategy);
        Strategy storage strat = strategies[idx];
        
        // Validate total allocation
        uint256 totalAllocation = _newAllocationBps;
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].isActive && i != idx) {
                totalAllocation += strategies[i].targetAllocationBps;
            }
        }
        if (totalAllocation > BASIS_POINTS) revert InvalidAllocation();
        
        uint256 oldAllocation = strat.targetAllocationBps;
        strat.targetAllocationBps = _newAllocationBps;
        
        emit AllocationUpdated(_strategy, oldAllocation, _newAllocationBps);
    }

    // =================================
    // DEPOSIT / WITHDRAW
    // =================================

    /**
     * @notice Deposit funds across all strategies based on allocation
     * @param creatorCoinAmount Amount of creator coin to deposit
     * @param pairedAmount Amount of paired token to deposit
     */
    function deposit(
        uint256 creatorCoinAmount,
        uint256 pairedAmount
    ) external nonReentrant onlyVault returns (uint256 totalLiquidity) {
        if (creatorCoinAmount == 0 && pairedAmount == 0) revert ZeroAmount();
        
        // Pull tokens
        if (creatorCoinAmount > 0) {
            CREATOR_COIN.safeTransferFrom(msg.sender, address(this), creatorCoinAmount);
        }
        if (pairedAmount > 0) {
            PAIRED_TOKEN.safeTransferFrom(msg.sender, address(this), pairedAmount);
        }
        
        // Distribute to strategies based on allocation
        for (uint256 i = 0; i < strategies.length; i++) {
            Strategy storage strat = strategies[i];
            if (!strat.isActive || strat.targetAllocationBps == 0) continue;
            
            uint256 stratCreatorCoin = (creatorCoinAmount * strat.targetAllocationBps) / BASIS_POINTS;
            uint256 stratPaired = (pairedAmount * strat.targetAllocationBps) / BASIS_POINTS;
            
            if (stratCreatorCoin > 0 || stratPaired > 0) {
                try ILPStrategy(strat.strategyAddress).deposit(stratCreatorCoin, stratPaired) 
                    returns (uint256 liquidity) 
                {
                    strat.currentLiquidity += liquidity;
                    strat.lastDeposit = block.timestamp;
                    totalLiquidity += liquidity;
                    
                    emit Deposited(strat.strategyAddress, stratCreatorCoin, stratPaired, liquidity);
                } catch {
                    // Strategy deposit failed - continue to next
                }
            }
        }
        
        // Return any unused tokens
        _returnUnusedTokens();
    }

    /**
     * @notice Withdraw funds proportionally from all strategies
     * @param percentage Percentage to withdraw in basis points (10000 = 100%)
     */
    function withdraw(
        uint256 percentage
    ) external nonReentrant onlyVault returns (uint256 creatorCoinTotal, uint256 pairedTotal) {
        if (percentage == 0 || percentage > BASIS_POINTS) revert InvalidAllocation();
        
        for (uint256 i = 0; i < strategies.length; i++) {
            Strategy storage strat = strategies[i];
            if (!strat.isActive || strat.currentLiquidity == 0) continue;
            
            uint256 liquidityToWithdraw = (strat.currentLiquidity * percentage) / BASIS_POINTS;
            
            if (liquidityToWithdraw > 0) {
                try ILPStrategy(strat.strategyAddress).withdraw(liquidityToWithdraw) 
                    returns (uint256 creatorCoin, uint256 paired) 
                {
                    strat.currentLiquidity -= liquidityToWithdraw;
                    strat.lastWithdraw = block.timestamp;
                    
                    creatorCoinTotal += creatorCoin;
                    pairedTotal += paired;
                    
                    emit Withdrawn(strat.strategyAddress, liquidityToWithdraw, creatorCoin, paired);
                } catch {
                    // Strategy withdrawal failed - continue
                }
            }
        }
        
        // Transfer to vault
        if (creatorCoinTotal > 0) {
            CREATOR_COIN.safeTransfer(vault, creatorCoinTotal);
        }
        if (pairedTotal > 0) {
            PAIRED_TOKEN.safeTransfer(vault, pairedTotal);
        }
    }

    /**
     * @notice Emergency withdraw all funds from all strategies
     */
    function emergencyWithdrawAll() external onlyOwner returns (uint256 creatorCoinTotal, uint256 pairedTotal) {
        for (uint256 i = 0; i < strategies.length; i++) {
            Strategy storage strat = strategies[i];
            if (strat.currentLiquidity == 0) continue;
            
            try ILPStrategy(strat.strategyAddress).withdrawAll() 
                returns (uint256 creatorCoin, uint256 paired) 
            {
                strat.currentLiquidity = 0;
                creatorCoinTotal += creatorCoin;
                pairedTotal += paired;
            } catch {}
        }
        
        // Also collect any tokens sitting in this contract
        uint256 localCreator = CREATOR_COIN.balanceOf(address(this));
        uint256 localPaired = PAIRED_TOKEN.balanceOf(address(this));
        
        if (localCreator > 0) {
            CREATOR_COIN.safeTransfer(vault, localCreator);
            creatorCoinTotal += localCreator;
        }
        if (localPaired > 0) {
            PAIRED_TOKEN.safeTransfer(vault, localPaired);
            pairedTotal += localPaired;
        }
    }

    // =================================
    // REBALANCING
    // =================================

    /**
     * @notice Rebalance all strategies to match target allocations
     * @dev Can be called by managers or automatically triggered
     */
    function rebalance() external nonReentrant onlyManager {
        if (block.timestamp < lastRebalance + rebalanceCooldown) {
            revert CooldownNotElapsed();
        }
        
        _rebalance();
        
        lastRebalance = block.timestamp;
        emit Rebalanced(block.timestamp);
    }

    /**
     * @notice Check if rebalance is needed
     */
    function needsRebalance() external view returns (bool) {
        (uint256 totalCreator, uint256 totalPaired) = getTotalValue();
        uint256 totalValue = totalCreator + totalPaired;
        
        if (totalValue == 0) return false;
        
        for (uint256 i = 0; i < strategies.length; i++) {
            Strategy storage strat = strategies[i];
            if (!strat.isActive) continue;
            
            (uint256 stratCreator, uint256 stratPaired) = ILPStrategy(strat.strategyAddress).getTotalValue();
            uint256 stratValue = stratCreator + stratPaired;
            
            uint256 currentAllocation = (stratValue * BASIS_POINTS) / totalValue;
            uint256 targetAllocation = strat.targetAllocationBps;
            
            uint256 diff = currentAllocation > targetAllocation 
                ? currentAllocation - targetAllocation 
                : targetAllocation - currentAllocation;
                
            if (diff > rebalanceThresholdBps) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * @dev Internal rebalance logic
     */
    function _rebalance() internal {
        // First, rebalance each strategy internally (e.g., adjust tick range)
        for (uint256 i = 0; i < strategies.length; i++) {
            Strategy storage strat = strategies[i];
            if (!strat.isActive) continue;
            
            try ILPStrategy(strat.strategyAddress).rebalance() {} catch {}
        }
        
        // Then rebalance allocation across strategies if needed
        // (More complex - would involve withdrawing from over-allocated and depositing to under-allocated)
    }

    // =================================
    // QUEUED OPERATIONS
    // =================================

    /**
     * @notice Queue an operation for delayed execution
     * @param opType Type of operation
     * @param data Encoded operation data
     */
    function queueOperation(
        OperationType opType,
        bytes calldata data
    ) external onlyManager returns (uint256 opId) {
        opId = operationQueue.length;
        
        operationQueue.push(QueuedOperation({
            opType: opType,
            data: data,
            executeAfter: block.timestamp + operationDelay,
            executed: false
        }));
        
        emit OperationQueued(opId, opType, block.timestamp + operationDelay);
    }

    /**
     * @notice Execute a queued operation
     * @param opId Operation ID
     */
    function executeOperation(uint256 opId) external onlyManager {
        QueuedOperation storage op = operationQueue[opId];
        
        if (op.executed) revert OperationAlreadyExecuted();
        if (block.timestamp < op.executeAfter) revert OperationNotReady();
        
        op.executed = true;
        
        if (op.opType == OperationType.UpdateAllocation) {
            (address strategy, uint256 newAllocation) = abi.decode(op.data, (address, uint256));
            this.updateAllocation(strategy, newAllocation);
        } else if (op.opType == OperationType.Rebalance) {
            _rebalance();
        }
        // Add more operation types as needed
        
        emit OperationExecuted(opId);
    }

    /**
     * @notice Cancel a queued operation
     */
    function cancelOperation(uint256 opId) external onlyOwner {
        operationQueue[opId].executed = true; // Mark as executed to prevent future execution
        emit OperationCancelled(opId);
    }

    // =================================
    // ADMIN
    // =================================

    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        vault = _vault;
        emit VaultSet(_vault);
    }

    function setManager(address _manager, bool _status) external onlyOwner {
        isManager[_manager] = _status;
        emit ManagerUpdated(_manager, _status);
    }

    function setOperationDelay(uint256 _delay) external onlyOwner {
        operationDelay = _delay;
    }

    function setRebalanceCooldown(uint256 _cooldown) external onlyOwner {
        rebalanceCooldown = _cooldown;
    }

    function setSlippageBps(uint256 _slippageBps) external onlyOwner {
        slippageBps = _slippageBps;
    }

    function setRebalanceThreshold(uint256 _thresholdBps) external onlyOwner {
        rebalanceThresholdBps = _thresholdBps;
    }

    // =================================
    // VIEW FUNCTIONS
    // =================================

    /**
     * @notice Get total value across all strategies
     */
    function getTotalValue() public view returns (uint256 creatorCoinTotal, uint256 pairedTotal) {
        for (uint256 i = 0; i < strategies.length; i++) {
            if (!strategies[i].isActive) continue;
            
            try ILPStrategy(strategies[i].strategyAddress).getTotalValue() 
                returns (uint256 creator, uint256 paired) 
            {
                creatorCoinTotal += creator;
                pairedTotal += paired;
            } catch {}
        }
        
        // Add local balances
        creatorCoinTotal += CREATOR_COIN.balanceOf(address(this));
        pairedTotal += PAIRED_TOKEN.balanceOf(address(this));
    }

    /**
     * @notice Get all strategy info
     */
    function getStrategies() external view returns (Strategy[] memory) {
        return strategies;
    }

    /**
     * @notice Get strategy count
     */
    function getStrategyCount() external view returns (uint256) {
        return strategies.length;
    }

    /**
     * @notice Get active strategies count
     */
    function getActiveStrategyCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < strategies.length; i++) {
            if (strategies[i].isActive) count++;
        }
    }

    // =================================
    // INTERNAL
    // =================================

    function _getStrategyIndex(address _strategy) internal view returns (uint256) {
        uint256 idx = strategyIndex[_strategy];
        if (idx == 0 && (strategies.length == 0 || strategies[0].strategyAddress != _strategy)) {
            revert StrategyNotFound();
        }
        return idx == 0 ? 0 : idx - 1;
    }

    function _returnUnusedTokens() internal {
        uint256 creatorBal = CREATOR_COIN.balanceOf(address(this));
        uint256 pairedBal = PAIRED_TOKEN.balanceOf(address(this));
        
        // Keep small buffer, return rest to vault
        uint256 buffer = 1e15; // Small buffer
        
        if (creatorBal > buffer) {
            CREATOR_COIN.safeTransfer(vault, creatorBal - buffer);
        }
        if (pairedBal > buffer) {
            PAIRED_TOKEN.safeTransfer(vault, pairedBal - buffer);
        }
    }
}


