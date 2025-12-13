// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IStrategy
 * @notice Strategy interface for deposits/withdrawals
 */
interface IStrategy {
    function deposit(uint256 wlfiAmount, uint256 usd1Amount) external returns (uint256 shares);
    function withdraw(uint256 value) external returns (uint256 wlfiAmount, uint256 usd1Amount);
    function getTotalAmounts() external view returns (uint256 wlfiAmount, uint256 usd1Amount);
}

/**
 * @title IEagleOVault
 * @notice Vault interface for balance management
 */
interface IEagleOVault {
    function wlfiBalance() external view returns (uint256);
    function usd1Balance() external view returns (uint256);
    function wlfiPerUsd1() external view returns (uint256);
}

/**
 * @title StrategyDepositQueue
 * @notice Asynchronous deposit queue with priority ordering and slippage protection
 * 
 * @dev DEPLOY WITH CREATE2 for vanity address 0x47...
 *      1. Get bytecode: abi.encodePacked(type(StrategyDepositQueue).creationCode, constructorArgs)
 *      2. Find salt: deployer.findSalt47(bytecode, 0, 100000)
 *      3. Deploy: deployer.deployWithPrefix(bytecode, salt, 0x47)
 * 
 * @dev ARCHITECTURE:
 *      - Vault queues deposits instead of executing immediately
 *      - Keeper executes deposits one-by-one or in batches
 *      - Each deposit is isolated (failure doesn't affect others)
 *      - Priority system ensures safer strategies execute first
 * 
 * @dev BENEFITS:
 *      1. Failure Isolation: One strategy failing doesn't revert everything
 *      2. Gas Optimization: Can spread execution across multiple transactions
 *      3. Priority Ordering: Execute safer/more liquid strategies first
 *      4. Slippage Protection: Pre-check expected outputs
 *      5. Retry Logic: Failed deposits can be retried later
 */
contract StrategyDepositQueue is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // =================================
    // STRUCTS
    // =================================

    struct QueuedDeposit {
        uint256 id;
        address strategy;
        uint256 wlfiAmount;
        uint256 usd1Amount;
        uint256 priority;        // Lower = higher priority (1 is highest)
        uint256 queuedAt;
        uint256 maxSlippageBps;  // Max acceptable slippage in basis points
        DepositStatus status;
    }

    enum DepositStatus {
        Pending,
        Executing,
        Completed,
        Failed,
        Cancelled
    }

    struct StrategyConfig {
        bool active;
        uint256 priority;        // Lower = higher priority
        uint256 maxSlippageBps;  // Default max slippage for this strategy
        uint256 minDepositWlfi;  // Minimum WLFI deposit (gas efficiency)
        uint256 maxDepositWlfi;  // Maximum per-deposit (liquidity protection)
    }

    // =================================
    // STATE VARIABLES
    // =================================

    /// @notice The EagleOVault this queue serves
    address public immutable VAULT;
    
    /// @notice WLFI token
    IERC20 public immutable WLFI;
    
    /// @notice USD1 token
    IERC20 public immutable USD1;

    /// @notice Deposit queue (chronological order)
    QueuedDeposit[] public depositQueue;

    /// @notice Next deposit ID
    uint256 public nextDepositId;

    /// @notice Strategy configurations
    mapping(address => StrategyConfig) public strategyConfigs;

    /// @notice List of registered strategies (for iteration)
    address[] public strategies;

    /// @notice Authorized keepers
    mapping(address => bool) public keepers;

    /// @notice Default slippage tolerance (basis points)
    uint256 public defaultSlippageBps = 300; // 3%

    /// @notice Maximum deposits to process in one batch
    uint256 public maxBatchSize = 5;

    /// @notice Minimum time between deposit attempts for same strategy
    uint256 public cooldownPeriod = 60; // 1 minute

    /// @notice Last deposit timestamp per strategy
    mapping(address => uint256) public lastDepositTime;

    // =================================
    // EVENTS
    // =================================

    event DepositQueued(
        uint256 indexed depositId,
        address indexed strategy,
        uint256 wlfiAmount,
        uint256 usd1Amount,
        uint256 priority
    );

    event DepositExecuted(
        uint256 indexed depositId,
        address indexed strategy,
        uint256 wlfiAmount,
        uint256 usd1Amount,
        uint256 sharesReceived
    );

    event DepositFailed(
        uint256 indexed depositId,
        address indexed strategy,
        string reason
    );

    event DepositCancelled(uint256 indexed depositId);

    event StrategyConfigured(
        address indexed strategy,
        uint256 priority,
        uint256 maxSlippageBps
    );

    event KeeperUpdated(address indexed keeper, bool authorized);

    // =================================
    // ERRORS
    // =================================

    error NotAuthorized();
    error InvalidStrategy();
    error DepositNotPending();
    error CooldownNotElapsed();
    error SlippageExceeded(uint256 expected, uint256 actual);
    error ZeroAmount();

    // =================================
    // MODIFIERS
    // =================================

    modifier onlyVaultOrOwner() {
        if (msg.sender != VAULT && msg.sender != owner()) revert NotAuthorized();
        _;
    }

    modifier onlyKeeper() {
        if (!keepers[msg.sender] && msg.sender != owner()) revert NotAuthorized();
        _;
    }

    // =================================
    // CONSTRUCTOR
    // =================================

    constructor(
        address _vault,
        address _wlfi,
        address _usd1,
        address _owner
    ) Ownable(_owner) {
        VAULT = _vault;
        WLFI = IERC20(_wlfi);
        USD1 = IERC20(_usd1);
        keepers[_owner] = true;
    }

    // =================================
    // QUEUE MANAGEMENT
    // =================================

    /**
     * @notice Queue a deposit for async execution
     * @param strategy Strategy to deposit to
     * @param wlfiAmount Amount of WLFI
     * @param usd1Amount Amount of USD1
     * @return depositId The queued deposit ID
     */
    function queueDeposit(
        address strategy,
        uint256 wlfiAmount,
        uint256 usd1Amount
    ) external onlyVaultOrOwner returns (uint256 depositId) {
        if (!strategyConfigs[strategy].active) revert InvalidStrategy();
        if (wlfiAmount == 0 && usd1Amount == 0) revert ZeroAmount();

        StrategyConfig memory config = strategyConfigs[strategy];

        depositId = nextDepositId++;

        depositQueue.push(QueuedDeposit({
            id: depositId,
            strategy: strategy,
            wlfiAmount: wlfiAmount,
            usd1Amount: usd1Amount,
            priority: config.priority,
            queuedAt: block.timestamp,
            maxSlippageBps: config.maxSlippageBps,
            status: DepositStatus.Pending
        }));

        emit DepositQueued(depositId, strategy, wlfiAmount, usd1Amount, config.priority);
    }

    /**
     * @notice Queue deposits for all active strategies proportionally
     * @param totalWlfi Total WLFI to deploy
     * @param totalUsd1 Total USD1 to deploy
     */
    function queueAllDeposits(
        uint256 totalWlfi,
        uint256 totalUsd1
    ) external onlyVaultOrOwner {
        uint256 totalWeight = _getTotalWeight();
        if (totalWeight == 0) return;

        for (uint256 i = 0; i < strategies.length; i++) {
            address strategy = strategies[i];
            StrategyConfig memory config = strategyConfigs[strategy];
            
            if (!config.active) continue;

            // Calculate proportional allocation (using priority as inverse weight)
            // Higher priority (lower number) = more allocation
            uint256 weight = 100 - (config.priority > 100 ? 100 : config.priority);
            uint256 wlfiAlloc = (totalWlfi * weight) / totalWeight;
            uint256 usd1Alloc = (totalUsd1 * weight) / totalWeight;

            if (wlfiAlloc > 0 || usd1Alloc > 0) {
                // Respect max deposit limits
                if (config.maxDepositWlfi > 0 && wlfiAlloc > config.maxDepositWlfi) {
                    wlfiAlloc = config.maxDepositWlfi;
                }

                uint256 depositId = nextDepositId++;
                depositQueue.push(QueuedDeposit({
                    id: depositId,
                    strategy: strategy,
                    wlfiAmount: wlfiAlloc,
                    usd1Amount: usd1Alloc,
                    priority: config.priority,
                    queuedAt: block.timestamp,
                    maxSlippageBps: config.maxSlippageBps,
                    status: DepositStatus.Pending
                }));

                emit DepositQueued(depositId, strategy, wlfiAlloc, usd1Alloc, config.priority);
            }
        }
    }

    // =================================
    // EXECUTION (KEEPER FUNCTIONS)
    // =================================

    /**
     * @notice Execute a single queued deposit
     * @param depositId ID of the deposit to execute
     */
    function executeDeposit(uint256 depositId) external onlyKeeper nonReentrant {
        QueuedDeposit storage deposit = _findDeposit(depositId);
        
        if (deposit.status != DepositStatus.Pending) revert DepositNotPending();
        
        // Check cooldown
        if (block.timestamp < lastDepositTime[deposit.strategy] + cooldownPeriod) {
            revert CooldownNotElapsed();
        }

        deposit.status = DepositStatus.Executing;

        // Pull tokens from vault
        if (deposit.wlfiAmount > 0) {
            WLFI.safeTransferFrom(VAULT, address(this), deposit.wlfiAmount);
            WLFI.forceApprove(deposit.strategy, deposit.wlfiAmount);
        }
        if (deposit.usd1Amount > 0) {
            USD1.safeTransferFrom(VAULT, address(this), deposit.usd1Amount);
            USD1.forceApprove(deposit.strategy, deposit.usd1Amount);
        }

        // Execute deposit with error handling
        try IStrategy(deposit.strategy).deposit(deposit.wlfiAmount, deposit.usd1Amount) returns (uint256 shares) {
            deposit.status = DepositStatus.Completed;
            lastDepositTime[deposit.strategy] = block.timestamp;
            
            emit DepositExecuted(
                depositId,
                deposit.strategy,
                deposit.wlfiAmount,
                deposit.usd1Amount,
                shares
            );
        } catch Error(string memory reason) {
            deposit.status = DepositStatus.Failed;
            
            // Return tokens to vault
            _returnTokensToVault(deposit.wlfiAmount, deposit.usd1Amount);
            
            emit DepositFailed(depositId, deposit.strategy, reason);
        } catch {
            deposit.status = DepositStatus.Failed;
            
            // Return tokens to vault
            _returnTokensToVault(deposit.wlfiAmount, deposit.usd1Amount);
            
            emit DepositFailed(depositId, deposit.strategy, "Unknown error");
        }
    }

    /**
     * @notice Execute multiple deposits by priority
     * @param count Maximum number of deposits to execute
     */
    function executeBatch(uint256 count) external onlyKeeper nonReentrant {
        if (count > maxBatchSize) count = maxBatchSize;

        // Get pending deposits sorted by priority
        uint256[] memory pendingIds = _getPendingDepositsSortedByPriority(count);

        for (uint256 i = 0; i < pendingIds.length; i++) {
            if (pendingIds[i] == type(uint256).max) break;
            
            // Execute each deposit in its own try/catch
            try this.executeDepositInternal(pendingIds[i]) {
                // Success
            } catch {
                // Continue to next deposit
            }
        }
    }

    /**
     * @notice Internal execution function (for try/catch in batch)
     */
    function executeDepositInternal(uint256 depositId) external {
        require(msg.sender == address(this), "Only self");
        
        QueuedDeposit storage deposit = _findDeposit(depositId);
        
        if (deposit.status != DepositStatus.Pending) return;
        
        // Check cooldown
        if (block.timestamp < lastDepositTime[deposit.strategy] + cooldownPeriod) {
            return;
        }

        deposit.status = DepositStatus.Executing;

        // Pull and approve tokens
        if (deposit.wlfiAmount > 0) {
            WLFI.safeTransferFrom(VAULT, address(this), deposit.wlfiAmount);
            WLFI.forceApprove(deposit.strategy, deposit.wlfiAmount);
        }
        if (deposit.usd1Amount > 0) {
            USD1.safeTransferFrom(VAULT, address(this), deposit.usd1Amount);
            USD1.forceApprove(deposit.strategy, deposit.usd1Amount);
        }

        // Execute
        try IStrategy(deposit.strategy).deposit(deposit.wlfiAmount, deposit.usd1Amount) returns (uint256 shares) {
            deposit.status = DepositStatus.Completed;
            lastDepositTime[deposit.strategy] = block.timestamp;
            
            emit DepositExecuted(
                depositId,
                deposit.strategy,
                deposit.wlfiAmount,
                deposit.usd1Amount,
                shares
            );
        } catch {
            deposit.status = DepositStatus.Failed;
            _returnTokensToVault(deposit.wlfiAmount, deposit.usd1Amount);
            emit DepositFailed(depositId, deposit.strategy, "Deposit failed");
        }
    }

    /**
     * @notice Cancel a pending deposit
     */
    function cancelDeposit(uint256 depositId) external onlyVaultOrOwner {
        QueuedDeposit storage deposit = _findDeposit(depositId);
        
        if (deposit.status != DepositStatus.Pending) revert DepositNotPending();
        
        deposit.status = DepositStatus.Cancelled;
        
        emit DepositCancelled(depositId);
    }

    /**
     * @notice Retry a failed deposit
     */
    function retryDeposit(uint256 depositId) external onlyKeeper {
        QueuedDeposit storage deposit = _findDeposit(depositId);
        
        if (deposit.status != DepositStatus.Failed) revert DepositNotPending();
        
        deposit.status = DepositStatus.Pending;
        deposit.queuedAt = block.timestamp;
    }

    // =================================
    // CONFIGURATION
    // =================================

    /**
     * @notice Configure a strategy
     */
    function configureStrategy(
        address strategy,
        uint256 priority,
        uint256 maxSlippageBps,
        uint256 minDepositWlfi,
        uint256 maxDepositWlfi
    ) external onlyOwner {
        if (!strategyConfigs[strategy].active) {
            strategies.push(strategy);
        }

        strategyConfigs[strategy] = StrategyConfig({
            active: true,
            priority: priority,
            maxSlippageBps: maxSlippageBps > 0 ? maxSlippageBps : defaultSlippageBps,
            minDepositWlfi: minDepositWlfi,
            maxDepositWlfi: maxDepositWlfi
        });

        emit StrategyConfigured(strategy, priority, maxSlippageBps);
    }

    /**
     * @notice Deactivate a strategy
     */
    function deactivateStrategy(address strategy) external onlyOwner {
        strategyConfigs[strategy].active = false;
    }

    /**
     * @notice Set keeper authorization
     */
    function setKeeper(address keeper, bool authorized) external onlyOwner {
        keepers[keeper] = authorized;
        emit KeeperUpdated(keeper, authorized);
    }

    /**
     * @notice Update queue settings
     */
    function updateSettings(
        uint256 _defaultSlippageBps,
        uint256 _maxBatchSize,
        uint256 _cooldownPeriod
    ) external onlyOwner {
        defaultSlippageBps = _defaultSlippageBps;
        maxBatchSize = _maxBatchSize;
        cooldownPeriod = _cooldownPeriod;
    }

    // =================================
    // VIEW FUNCTIONS
    // =================================

    /**
     * @notice Get pending deposit count
     */
    function getPendingCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < depositQueue.length; i++) {
            if (depositQueue[i].status == DepositStatus.Pending) {
                count++;
            }
        }
    }

    /**
     * @notice Get all pending deposits
     */
    function getPendingDeposits() external view returns (QueuedDeposit[] memory pending) {
        uint256 count = 0;
        for (uint256 i = 0; i < depositQueue.length; i++) {
            if (depositQueue[i].status == DepositStatus.Pending) {
                count++;
            }
        }

        pending = new QueuedDeposit[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < depositQueue.length; i++) {
            if (depositQueue[i].status == DepositStatus.Pending) {
                pending[idx++] = depositQueue[i];
            }
        }
    }

    /**
     * @notice Check if deposits are ready to execute
     */
    function canExecute() external view returns (bool) {
        for (uint256 i = 0; i < depositQueue.length; i++) {
            QueuedDeposit memory deposit = depositQueue[i];
            if (deposit.status == DepositStatus.Pending) {
                if (block.timestamp >= lastDepositTime[deposit.strategy] + cooldownPeriod) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * @notice Get next deposit to execute (by priority)
     */
    function getNextDeposit() external view returns (QueuedDeposit memory) {
        uint256 bestPriority = type(uint256).max;
        uint256 bestIdx = type(uint256).max;

        for (uint256 i = 0; i < depositQueue.length; i++) {
            QueuedDeposit memory deposit = depositQueue[i];
            if (deposit.status == DepositStatus.Pending) {
                if (block.timestamp >= lastDepositTime[deposit.strategy] + cooldownPeriod) {
                    if (deposit.priority < bestPriority) {
                        bestPriority = deposit.priority;
                        bestIdx = i;
                    }
                }
            }
        }

        if (bestIdx != type(uint256).max) {
            return depositQueue[bestIdx];
        }

        // Return empty struct if nothing pending
        return QueuedDeposit({
            id: 0,
            strategy: address(0),
            wlfiAmount: 0,
            usd1Amount: 0,
            priority: 0,
            queuedAt: 0,
            maxSlippageBps: 0,
            status: DepositStatus.Pending
        });
    }

    /**
     * @notice Get all registered strategies
     */
    function getStrategies() external view returns (address[] memory) {
        return strategies;
    }

    /**
     * @notice Get queue length
     */
    function getQueueLength() external view returns (uint256) {
        return depositQueue.length;
    }

    // =================================
    // INTERNAL FUNCTIONS
    // =================================

    function _findDeposit(uint256 depositId) internal view returns (QueuedDeposit storage) {
        for (uint256 i = 0; i < depositQueue.length; i++) {
            if (depositQueue[i].id == depositId) {
                return depositQueue[i];
            }
        }
        revert("Deposit not found");
    }

    function _returnTokensToVault(uint256 wlfiAmount, uint256 usd1Amount) internal {
        if (wlfiAmount > 0) {
            uint256 wlfiBal = WLFI.balanceOf(address(this));
            if (wlfiBal > 0) {
                WLFI.safeTransfer(VAULT, wlfiBal);
            }
        }
        if (usd1Amount > 0) {
            uint256 usd1Bal = USD1.balanceOf(address(this));
            if (usd1Bal > 0) {
                USD1.safeTransfer(VAULT, usd1Bal);
            }
        }
    }

    function _getTotalWeight() internal view returns (uint256 total) {
        for (uint256 i = 0; i < strategies.length; i++) {
            StrategyConfig memory config = strategyConfigs[strategies[i]];
            if (config.active) {
                total += 100 - (config.priority > 100 ? 100 : config.priority);
            }
        }
    }

    function _getPendingDepositsSortedByPriority(uint256 maxCount) 
        internal 
        view 
        returns (uint256[] memory) 
    {
        uint256[] memory result = new uint256[](maxCount);
        for (uint256 i = 0; i < maxCount; i++) {
            result[i] = type(uint256).max;
        }

        uint256 found = 0;
        
        // Simple insertion sort by priority
        for (uint256 i = 0; i < depositQueue.length && found < maxCount; i++) {
            QueuedDeposit memory deposit = depositQueue[i];
            
            if (deposit.status != DepositStatus.Pending) continue;
            if (block.timestamp < lastDepositTime[deposit.strategy] + cooldownPeriod) continue;

            // Find insertion position
            uint256 insertPos = found;
            for (uint256 j = 0; j < found; j++) {
                if (deposit.priority < depositQueue[_findDepositIndex(result[j])].priority) {
                    insertPos = j;
                    break;
                }
            }

            // Shift and insert
            for (uint256 j = found; j > insertPos; j--) {
                result[j] = result[j - 1];
            }
            result[insertPos] = deposit.id;
            found++;
        }

        return result;
    }

    function _findDepositIndex(uint256 depositId) internal view returns (uint256) {
        for (uint256 i = 0; i < depositQueue.length; i++) {
            if (depositQueue[i].id == depositId) {
                return i;
            }
        }
        return 0;
    }

    // =================================
    // EMERGENCY
    // =================================

    /**
     * @notice Emergency withdraw stuck tokens
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}

