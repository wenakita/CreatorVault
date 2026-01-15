// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VaultGaugeVoting
 * @author 0xakita.eth
 * @notice ve(3,3) style gauge voting for directing jackpot probability to creator vaults
 * 
 * @dev VOTING MECHANISM:
 *      veERC4626 holders vote to direct jackpot probability to specific creator vaults.
 *      This is similar to how veCRV/veVELO holders vote to direct emissions to pools,
 *      but instead of emissions, we're directing PROBABILITY.
 * 
 * @dev EPOCH SYSTEM:
 *      - Weekly epochs (7 days), starting Thursday 00:00 UTC
 *      - Users can vote anytime during an epoch
 *      - Votes are tallied at epoch end
 *      - Historical weights are stored per epoch
 * 
 * @dev VOTING POWER:
 *      - Voting power comes from veERC4626 (locked ■4626)
 *      - Users can split votes across multiple vaults
 *      - Votes are normalized by user's total veERC4626 balance
 */

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

interface IveERC4626 {
    function getVotingPower(address user) external view returns (uint256);
    function getTotalVotingPower() external view returns (uint256);
    function hasActiveLock(address user) external view returns (bool);
}

interface ICreatorRegistry {
    function isRegisteredVault(address vault) external view returns (bool);
}

/**
 * @title IVaultGaugeVoting
 * @notice Interface for VaultGaugeVoting
 */
interface IVaultGaugeVoting {
    // User functions
    function vote(address[] calldata vaults, uint256[] calldata weights) external;
    function resetVotes() external;
    
    // View functions
    function getVaultWeight(address vault) external view returns (uint256);
    function getTotalWeight() external view returns (uint256);
    function getVaultWeightBps(address vault) external view returns (uint256);
    function getUserVotes(address user) external view returns (address[] memory vaults, uint256[] memory weights);
    
    // Epoch management
    function checkpoint() external;
    function currentEpoch() external view returns (uint256);
    function epochStartTime(uint256 epoch) external view returns (uint256);
    
    // Events
    event Voted(address indexed user, address indexed vault, uint256 weight, uint256 epoch);
    event VotesReset(address indexed user, uint256 epoch);
    event EpochCheckpointed(uint256 indexed epoch, uint256 totalWeight);
    event VaultWhitelisted(address indexed vault, bool status);
}

contract VaultGaugeVoting is IVaultGaugeVoting, Ownable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.AddressSet;

    // ================================
    // CONSTANTS
    // ================================

    /// @notice Duration of each epoch (7 days)
    uint256 public constant EPOCH_DURATION = 7 days;

    /// @notice Precision for basis points (10000 = 100%)
    uint256 public constant BPS_PRECISION = 10000;

    /// @notice Precision for probability in PPM (1,000,000 = 100%)
    uint256 public constant PPM_PRECISION = 1_000_000;

    /// @notice Maximum number of vaults a user can vote for at once
    uint256 public constant MAX_VAULTS_PER_VOTE = 10;

    /// @notice Genesis epoch start (first Thursday 00:00 UTC after deployment)
    /// @dev This is set in constructor to the next Thursday 00:00 UTC
    uint256 public immutable genesisEpochStart;

    // ================================
    // STATE
    // ================================

    /// @notice veERC4626 token for voting power
    IveERC4626 public immutable veERC4626;

    /// @notice Optional registry for auto-whitelisting vaults
    ICreatorRegistry public registry;

    /// @notice Whether to use registry for whitelist
    bool public useRegistryWhitelist;

    /// @notice Manually whitelisted vaults
    mapping(address => bool) public isWhitelistedVault;

    /// @notice Set of all whitelisted vaults
    EnumerableSet.AddressSet private _whitelistedVaults;

    // ================================
    // ve(3,3) PROBABILITY BUDGET (CONFIG)
    // ================================

    /**
     * @notice Total gauge probability budget (in bps) is derived from creator count (and optionally TVL).
     *
     * The intent: veERC4626 votes allocate a bounded pool of "probability bps" each week,
     * analogous to emissions in ve(3,3) systems.
     *
     * Example target behavior:
     * - 5 creators  → 100 bps total (1.00%)
     * - 100 creators → 300 bps total (3.00%)
     *
     * We implement a simple linear interpolation on creator count (whitelisted vault count),
     * and allow an optional multiplicative TVL multiplier for future tuning.
     */
    uint256 public minCreatorsForBudget = 5;
    uint256 public maxCreatorsForBudget = 100;
    uint256 public minTotalGaugeProbabilityBps = 100; // 1.00%
    uint256 public maxTotalGaugeProbabilityBps = 300; // 3.00%

    /// @notice Optional multiplier for future TVL-based scaling (10000 = 1.0x)
    uint256 public tvlMultiplierBps = BPS_PRECISION;

    // ================================
    // VOTE STORAGE (PER-EPOCH)
    // ================================

    /// @notice Vault votes per epoch: epoch => vault => total votes (veERC4626-weighted)
    mapping(uint256 => mapping(address => uint256)) private _epochVaultVotes;

    /// @notice Total votes per epoch: epoch => total votes
    mapping(uint256 => uint256) private _epochTotalVotes;

    /// @notice User votes per epoch: epoch => user => vault => votes
    mapping(uint256 => mapping(address => mapping(address => uint256))) private _epochUserVaultVotes;

    /// @notice Set of vaults a user voted for in a given epoch: epoch => user => set(vault)
    mapping(uint256 => mapping(address => EnumerableSet.AddressSet)) private _epochUserVotedVaults;

    /// @notice Last epoch that emitted a checkpoint event (for UI/debug)
    uint256 public lastCheckpointedEpoch;

    // ================================
    // EVENTS
    // ================================

    event GaugeProbabilityBudgetParamsUpdated(
        uint256 minCreators,
        uint256 maxCreators,
        uint256 minBudgetBps,
        uint256 maxBudgetBps
    );
    event GaugeProbabilityTvlMultiplierUpdated(uint256 tvlMultiplierBps);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error NoVotingPower();
    error VaultNotWhitelisted(address vault);
    error TooManyVaults();
    error ArrayLengthMismatch();
    error ZeroWeight();
    error EpochNotEnded();

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Constructor
     * @param _veERC4626 veERC4626 token address
     * @param owner_ Owner address
     */
    constructor(address _veERC4626, address owner_) Ownable(owner_) {
        if (_veERC4626 == address(0)) revert ZeroAddress();
        veERC4626 = IveERC4626(_veERC4626);

        // Set genesis to the next Thursday 00:00 UTC.
        uint256 currentTime = block.timestamp;
        // slither-disable-next-line weak-prng
        uint256 startOfToday = currentTime - (currentTime % 1 days);
        // slither-disable-next-line weak-prng
        uint256 dayOfWeek = ((currentTime / 1 days) + 4) % 7; // 0=Sunday, 4=Thursday
        // slither-disable-next-line weak-prng
        uint256 daysUntilThursday = (7 + 4 - dayOfWeek) % 7;
        if (daysUntilThursday < 1) {
            daysUntilThursday = 7;
        }
        genesisEpochStart = startOfToday + (daysUntilThursday * 1 days);
    }

    // ================================
    // VOTING FUNCTIONS
    // ================================

    /**
     * @notice Vote for vaults with specified weights
     * @param vaults Array of vault addresses to vote for
     * @param weights Array of relative weights for each vault
     * @dev Weights are relative - [100, 50, 50] means 50%/25%/25%
     */
    function vote(
        address[] calldata vaults,
        uint256[] calldata weights
    ) external override nonReentrant {
        if (vaults.length != weights.length) revert ArrayLengthMismatch();
        if (vaults.length > MAX_VAULTS_PER_VOTE) revert TooManyVaults();

        uint256 userPower = veERC4626.getVotingPower(msg.sender);
        if (userPower == 0) revert NoVotingPower();

        uint256 epoch = currentEpoch();

        // Clear previous votes in THIS epoch (allows re-voting)
        _clearUserVotes(epoch, msg.sender);

        // Calculate total weight for normalization
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            if (weights[i] == 0) revert ZeroWeight();
            totalWeight += weights[i];
        }

        // Apply votes
        for (uint256 i = 0; i < vaults.length; i++) {
            address vault = vaults[i];
            
            // Check whitelist
            if (!_isVaultWhitelisted(vault)) revert VaultNotWhitelisted(vault);

            // Normalize weight: userPower * (weight / totalWeight)
            uint256 normalizedWeight = (userPower * weights[i]) / totalWeight;

            // Update vault votes
            _epochVaultVotes[epoch][vault] += normalizedWeight;
            _epochTotalVotes[epoch] += normalizedWeight;

            // Track user's vote
            _epochUserVaultVotes[epoch][msg.sender][vault] = normalizedWeight;
            bool added = _epochUserVotedVaults[epoch][msg.sender].add(vault);
            if (!added) {
                // Vault already tracked for this user/epoch; weights still updated above.
            }

            emit Voted(msg.sender, vault, normalizedWeight, epoch);
        }
    }

    /**
     * @notice Reset all votes for the caller
     */
    function resetVotes() external override nonReentrant {
        uint256 epoch = currentEpoch();
        _clearUserVotes(epoch, msg.sender);
        emit VotesReset(msg.sender, epoch);
    }

    /**
     * @dev Clear all votes for a user
     */
    function _clearUserVotes(uint256 epoch, address user) internal {
        EnumerableSet.AddressSet storage votedVaults = _epochUserVotedVaults[epoch][user];
        uint256 length = votedVaults.length();

        for (uint256 i = length; i > 0; i--) {
            address vault = votedVaults.at(i - 1);
            uint256 weight = _epochUserVaultVotes[epoch][user][vault];

            if (weight > 0) {
                _epochVaultVotes[epoch][vault] -= weight;
                _epochTotalVotes[epoch] -= weight;
                _epochUserVaultVotes[epoch][user][vault] = 0;
            }

            bool removed = votedVaults.remove(vault);
            if (!removed) {
                // Vault already removed; no action needed.
            }
        }
    }

    // ================================
    // EPOCH MANAGEMENT
    // ================================

    /**
     * @notice Checkpoint the current epoch (anyone can call)
     * @dev Stores final weights for the epoch that just ended
     */
    function checkpoint() external override {
        uint256 epoch = currentEpoch();
        if (lastCheckpointedEpoch < epoch) {
            lastCheckpointedEpoch = epoch;
        }
        emit EpochCheckpointed(epoch, _epochTotalVotes[epoch]);
    }

    /**
     * @notice Get the current epoch number
     * @return Current epoch (0-indexed from genesis)
     */
    function currentEpoch() public view override returns (uint256) {
        if (block.timestamp < genesisEpochStart) return 0;
        return (block.timestamp - genesisEpochStart) / EPOCH_DURATION;
    }

    /**
     * @notice Get the start time of a specific epoch
     * @param epoch Epoch number
     * @return Start timestamp of the epoch
     */
    function epochStartTime(uint256 epoch) public view override returns (uint256) {
        return genesisEpochStart + (epoch * EPOCH_DURATION);
    }

    /**
     * @notice Get the end time of a specific epoch
     * @param epoch Epoch number
     * @return End timestamp of the epoch
     */
    function epochEndTime(uint256 epoch) public view returns (uint256) {
        return epochStartTime(epoch) + EPOCH_DURATION;
    }

    /**
     * @notice Get time remaining in current epoch
     * @return Seconds until epoch ends
     */
    function timeUntilNextEpoch() public view returns (uint256) {
        uint256 epoch = currentEpoch();
        uint256 endTime = epochEndTime(epoch);
        if (block.timestamp >= endTime) return 0;
        return endTime - block.timestamp;
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    /**
     * @notice Total gauge probability budget in bps (basis points) for the current system size.
     * @dev Uses whitelisted vault count as the proxy for number of active creators.
     */
    function getTotalGaugeProbabilityBps() public view returns (uint256 budgetBps) {
        uint256 n = _whitelistedVaults.length();

        // Base curve by creator count (linear interpolation)
        if (n <= minCreatorsForBudget) {
            budgetBps = minTotalGaugeProbabilityBps;
        } else if (n >= maxCreatorsForBudget) {
            budgetBps = maxTotalGaugeProbabilityBps;
        } else {
            uint256 rangeCreators = maxCreatorsForBudget - minCreatorsForBudget;
            uint256 rangeBudget = maxTotalGaugeProbabilityBps - minTotalGaugeProbabilityBps;
            budgetBps = minTotalGaugeProbabilityBps + ((n - minCreatorsForBudget) * rangeBudget) / rangeCreators;
        }

        // Optional multiplier (future TVL scaling hook)
        budgetBps = (budgetBps * tvlMultiplierBps) / BPS_PRECISION;

        // Clamp to configured min/max
        if (budgetBps < minTotalGaugeProbabilityBps) budgetBps = minTotalGaugeProbabilityBps;
        if (budgetBps > maxTotalGaugeProbabilityBps) budgetBps = maxTotalGaugeProbabilityBps;
    }

    /**
     * @notice Total gauge probability budget in PPM (parts per million) for easier, low-rounding math.
     * @dev 1 bps = 100 PPM.
     */
    function getTotalGaugeProbabilityPPM() public view returns (uint256) {
        return getTotalGaugeProbabilityBps() * 100;
    }

    /**
     * @notice Vault's vote-directed probability boost in PPM.
     * @dev This is the vault's share of the total gauge probability budget, based on veERC4626 votes.
     *
     * Rules:
     * - If totalVotes == 0: equal split across whitelisted vaults
     * - If vault is not whitelisted: 0
     */
    function getVaultGaugeProbabilityBoostPPM(address vault) external view returns (uint256 boostPPM) {
        if (!_isVaultWhitelisted(vault)) return 0;

        uint256 budgetPPM = getTotalGaugeProbabilityPPM();
        uint256 epoch = currentEpoch();
        uint256 total = _epochTotalVotes[epoch];

        if (budgetPPM == 0) return 0;

        if (total == 0) {
            uint256 n = _whitelistedVaults.length();
            if (n == 0) return 0;
            return budgetPPM / n;
        }

        uint256 v = _epochVaultVotes[epoch][vault];
        if (v == 0) return 0;

        return (budgetPPM * v) / total;
    }

    /**
     * @notice Get total votes for a vault
     * @param vault Vault address
     * @return Total voting weight for the vault
     */
    function getVaultWeight(address vault) external view override returns (uint256) {
        return _epochVaultVotes[currentEpoch()][vault];
    }

    /**
     * @notice Get total votes across all vaults
     * @return Total voting weight
     */
    function getTotalWeight() external view override returns (uint256) {
        return _epochTotalVotes[currentEpoch()];
    }

    /**
     * @notice Get vault's weight as basis points of total
     * @param vault Vault address
     * @return Weight in basis points (0-10000)
     */
    function getVaultWeightBps(address vault) external view override returns (uint256) {
        uint256 epoch = currentEpoch();
        uint256 total = _epochTotalVotes[epoch];
        if (total == 0) return 0;
        return (_epochVaultVotes[epoch][vault] * BPS_PRECISION) / total;
    }

    /**
     * @notice Get historical vault weight for a specific epoch
     * @param epoch Epoch number
     * @param vault Vault address
     * @return Weight for that epoch
     */
    function getHistoricalVaultWeight(uint256 epoch, address vault) external view returns (uint256) {
        return _epochVaultVotes[epoch][vault];
    }

    /**
     * @notice Get historical total weight for a specific epoch
     * @param epoch Epoch number
     * @return Total weight for that epoch
     */
    function getHistoricalTotalWeight(uint256 epoch) external view returns (uint256) {
        return _epochTotalVotes[epoch];
    }

    /**
     * @notice Get all vaults a user voted for and their weights
     * @param user User address
     * @return vaults Array of vault addresses
     * @return weights Array of vote weights
     */
    function getUserVotes(address user) external view override returns (
        address[] memory vaults,
        uint256[] memory weights
    ) {
        uint256 epoch = currentEpoch();
        EnumerableSet.AddressSet storage votedVaults = _epochUserVotedVaults[epoch][user];
        uint256 length = votedVaults.length();

        vaults = new address[](length);
        weights = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            address vault = votedVaults.at(i);
            vaults[i] = vault;
            weights[i] = _epochUserVaultVotes[epoch][user][vault];
        }
    }

    /**
     * @notice Check if user has voted in current epoch
     * @param user User address
     * @return True if user has voted
     */
    function hasVotedThisEpoch(address user) external view returns (bool) {
        uint256 epoch = currentEpoch();
        return _epochUserVotedVaults[epoch][user].length() > 0;
    }

    // ================================
    // CLAIM HELPERS (for voter fee distribution)
    // ================================

    function getVaultWeightAtEpoch(uint256 epoch, address vault) external view returns (uint256) {
        return _epochVaultVotes[epoch][vault];
    }

    function getTotalWeightAtEpoch(uint256 epoch) external view returns (uint256) {
        return _epochTotalVotes[epoch];
    }

    function getUserVoteWeightAtEpoch(uint256 epoch, address user, address vault) external view returns (uint256) {
        return _epochUserVaultVotes[epoch][user][vault];
    }

    /**
     * @notice Get all whitelisted vaults
     * @return Array of whitelisted vault addresses
     */
    function getWhitelistedVaults() external view returns (address[] memory) {
        return _whitelistedVaults.values();
    }

    /**
     * @notice Get number of whitelisted vaults
     * @return Count of whitelisted vaults
     */
    function whitelistedVaultCount() external view returns (uint256) {
        return _whitelistedVaults.length();
    }

    // ================================
    // WHITELIST MANAGEMENT
    // ================================

    /**
     * @dev Check if a vault is whitelisted
     */
    function _isVaultWhitelisted(address vault) internal view returns (bool) {
        // Check manual whitelist first
        if (isWhitelistedVault[vault]) return true;

        // Check registry if enabled
        if (useRegistryWhitelist && address(registry) != address(0)) {
            // slither-disable-next-line calls-loop
            try registry.isRegisteredVault(vault) returns (bool registered) {
                return registered;
            } catch {
                return false;
            }
        }

        return false;
    }

    /**
     * @notice Check if a vault can receive votes
     * @param vault Vault address
     * @return True if vault is whitelisted
     */
    function canReceiveVotes(address vault) external view returns (bool) {
        return _isVaultWhitelisted(vault);
    }

    /**
     * @notice Whitelist or remove a vault (admin only)
     * @param vault Vault address
     * @param status True to whitelist, false to remove
     */
    function setVaultWhitelist(address vault, bool status) external onlyOwner {
        if (vault == address(0)) revert ZeroAddress();
        
        isWhitelistedVault[vault] = status;
        
        if (status) {
            bool added = _whitelistedVaults.add(vault);
            if (!added) {
                // Already whitelisted.
            }
        } else {
            bool removed = _whitelistedVaults.remove(vault);
            if (!removed) {
                // Already removed.
            }
        }

        emit VaultWhitelisted(vault, status);
    }

    /**
     * @notice Batch whitelist vaults
     * @param vaults Array of vault addresses
     * @param statuses Array of whitelist statuses
     */
    function batchSetVaultWhitelist(
        address[] calldata vaults,
        bool[] calldata statuses
    ) external onlyOwner {
        if (vaults.length != statuses.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < vaults.length; i++) {
            if (vaults[i] == address(0)) revert ZeroAddress();
            
            isWhitelistedVault[vaults[i]] = statuses[i];
            
            if (statuses[i]) {
                bool added = _whitelistedVaults.add(vaults[i]);
                if (!added) {
                    // Already whitelisted.
                }
            } else {
                bool removed = _whitelistedVaults.remove(vaults[i]);
                if (!removed) {
                    // Already removed.
                }
            }

            emit VaultWhitelisted(vaults[i], statuses[i]);
        }
    }

    /**
     * @notice Set the creator registry for auto-whitelisting
     * @param _registry Registry address
     */
    function setRegistry(address _registry) external onlyOwner {
        registry = ICreatorRegistry(_registry);
    }

    /**
     * @notice Enable/disable registry-based whitelisting
     * @param enabled True to enable
     */
    function setUseRegistryWhitelist(bool enabled) external onlyOwner {
        useRegistryWhitelist = enabled;
    }

    // ================================
    // ve(3,3) PROBABILITY BUDGET (ADMIN)
    // ================================

    /**
     * @notice Configure the creator-count → probability-budget curve.
     * @dev Values are in basis points (bps). Must keep min <= max.
     */
    function setGaugeProbabilityBudgetParams(
        uint256 _minCreators,
        uint256 _maxCreators,
        uint256 _minBudgetBps,
        uint256 _maxBudgetBps
    ) external onlyOwner {
        require(_minCreators > 0 && _maxCreators > _minCreators, "Invalid creator range");
        require(_minBudgetBps > 0 && _maxBudgetBps >= _minBudgetBps, "Invalid budget range");
        require(_maxBudgetBps <= 10_000, "Budget too large"); // cap at 100%

        minCreatorsForBudget = _minCreators;
        maxCreatorsForBudget = _maxCreators;
        minTotalGaugeProbabilityBps = _minBudgetBps;
        maxTotalGaugeProbabilityBps = _maxBudgetBps;

        emit GaugeProbabilityBudgetParamsUpdated(_minCreators, _maxCreators, _minBudgetBps, _maxBudgetBps);
    }

    /**
     * @notice Set an optional multiplier for future TVL-based scaling (10000 = 1.0x).
     */
    function setGaugeProbabilityTvlMultiplierBps(uint256 _tvlMultiplierBps) external onlyOwner {
        require(_tvlMultiplierBps > 0 && _tvlMultiplierBps <= 50_000, "Invalid multiplier"); // cap at 5x
        tvlMultiplierBps = _tvlMultiplierBps;
        emit GaugeProbabilityTvlMultiplierUpdated(_tvlMultiplierBps);
    }

    // ================================
    // EMERGENCY
    // ================================

    /**
     * @notice Emergency reset of all votes (admin only)
     * @dev Only use in case of critical bug
     */
    function emergencyResetAllVotes() external onlyOwner {
        uint256 epoch = currentEpoch();
        uint256 vaultCount = _whitelistedVaults.length();
        for (uint256 i = 0; i < vaultCount; i++) {
            address vault = _whitelistedVaults.at(i);
            _epochVaultVotes[epoch][vault] = 0;
        }
        _epochTotalVotes[epoch] = 0;
    }
}

