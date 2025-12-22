// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {OApp, Origin, MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

import {IGaugeController} from "../../interfaces/governance/IGaugeController.sol";
import {IveDRAGON} from "../../interfaces/governance/IveDRAGON.sol";
import {IDragonOVault} from "../../interfaces/vaults/IDragonOVault.sol";
import {IOmniDragonRegistry} from "../../interfaces/config/IOmniDragonRegistry.sol";

/**
 * @title GaugeController
 * @author 0xakita.eth
 * @notice Manages gauge voting with dual benefits: voter rewards + treasury
 * @dev Weekly epochs where veDRAGON holders vote on vault reward allocation
 * 
 * CROSS-CHAIN VOTING:
 * - Users can vote from ANY chain for gauges on THIS chain
 * - Votes are sent via LayerZero
 * - Rewards are claimed LOCALLY (where the gauge exists)
 * 
 * FEE SPLIT:
 * - 69% → Jackpot Reserve (lottery payouts)
 * - 31% → Gauge Distribution:
 *   - 69% → Voter Rewards (claimable by voters)
 *   - 31% → Treasury (bribes/burns, configurable)
 * 
 * BURNS:
 * - Treasury can burn vDRAGON to increase PPS
 * - Burn percentage is configurable (default 0%)
 * 
 * PROBABILITY BOOST:
 * - Voting determines probability boost for lottery (no fee allocation)
 * - Higher votes = higher lottery win probability for vault holders
 * 
 * VOTER REWARDS:
 * - Voters earn 69% of gauge fees based on their vote weight
 * - Rewards are paid in vDRAGON (vault shares)
 * - Claim locally on the chain where you voted
 */
contract GaugeController is IGaugeController, OApp, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using OptionsBuilder for bytes;

    // ================================
    // CONSTANTS
    // ================================

    uint256 public constant override EPOCH_DURATION = 7 days;
    uint256 public constant MAX_GAUGES = 690;
    
    /// @notice Absolute max probability boost ceiling (6.9% = 690 basis points)
    uint256 public constant MAX_PROBABILITY_BOOST_CEILING = 690;
    
    /// @notice Default gauge distribution: 69% voter rewards, 31% treasury
    uint256 public constant DEFAULT_VOTER_REWARD_BPS = 6900; // 69% of gauge portion → voters
    uint256 public constant DEFAULT_TREASURY_BPS = 3100; // 31% of gauge portion → treasury

    // LayerZero message types
    uint8 public constant MSG_TYPE_VOTE = 1;
    uint8 public constant MSG_TYPE_SHARES = 2;

    // ================================
    // STATE
    // ================================

    /// @notice OmniDragon registry
    IOmniDragonRegistry public immutable registry;

    /// @notice This chain's EID
    uint32 public immutable chainEid;

    /// @notice Cached chain ID for gas efficiency
    uint16 public immutable CHAIN_ID;

    /// @notice veDRAGON contract
    address public override veDRAGON;

    /// @notice Whether probability boost is enabled
    bool public probabilityBoostEnabled;

    /// @notice Current max probability boost (can be ramped up to ceiling)
    uint256 public currentMaxProbabilityBoost;

    /// @notice Jackpot reserve percentage (basis points)
    uint256 public override jackpotReserveBps = 6900; // 69%

    /// @notice Gauge distribution percentage (basis points)
    uint256 public override gaugeBurnBps = 3100; // 31% (renamed for interface compat)

    /// @notice Voter rewards percentage of gauge portion (basis points)
    uint256 public voterRewardBps = 6900; // 69% of gauge → voters

    /// @notice Treasury percentage of gauge portion (basis points)
    uint256 public treasuryBps = 3100; // 31% of gauge → treasury

    /// @notice Burn percentage of treasury allocation (basis points, default 0%)
    uint256 public burnBps = 0; // 0% of treasury → burns (rest to multisig)

    /// @notice Treasury multisig wallet
    address public treasury;

    /// @notice Current epoch number
    uint256 public override currentEpoch;

    /// @notice Epoch data
    mapping(uint256 => Epoch) private _epochs;

    /// @notice Registered gauges
    Gauge[] private _gauges;
    mapping(address => uint256) private _gaugeIndex; // vault -> index + 1
    mapping(address => bool) private _isGauge;
    
    /// @notice Count of active gauges (for gas-efficient views)
    uint256 public activeGaugeCount;

    /// @notice Shares held per vault
    mapping(address => uint256) private _vaultShares;

    /// @notice Jackpot reserve per vault
    mapping(address => uint256) private _jackpotReserve;

    /// @notice Pending shares for gauge distribution
    mapping(address => uint256) private _pendingGaugeShares;

    /// @notice Votes per epoch: epoch -> vault -> total votes
    mapping(uint256 => mapping(address => uint256)) private _gaugeVotes;

    /// @notice User votes: epoch -> user -> allocations
    mapping(uint256 => mapping(address => VoteAllocation[])) private _userVotes;

    /// @notice Whether user has voted in epoch (includes remote voters)
    mapping(uint256 => mapping(address => bool)) private _hasVoted;

    /// @notice User vote power per gauge per epoch: epoch -> gauge -> user -> voteAmount
    mapping(uint256 => mapping(address => mapping(address => uint256))) private _userGaugeVotes;

    /// @notice Pending voter rewards: user -> vault -> amount
    mapping(address => mapping(address => uint256)) private _pendingVoterRewards;

    /// @notice Total voter rewards to distribute per epoch per gauge
    mapping(uint256 => mapping(address => uint256)) private _epochGaugeVoterRewards;

    /// @notice Whether user has claimed rewards for epoch: epoch -> user -> claimed
    mapping(uint256 => mapping(address => bool)) private _hasClaimedRewards;

    /// @notice Current probability boost per vault (in basis points)
    mapping(address => uint256) private _vaultProbabilityBoost;
    
    /// @notice Epoch when probability boost was last updated
    mapping(address => uint256) private _boostLastUpdatedEpoch;

    // ================================
    // EVENTS
    // ================================

    event RemoteVoteReceived(address indexed voter, address indexed gauge, uint256 amount, uint32 srcEid);
    event VoterRewardsDistributed(uint256 indexed epoch, address indexed gauge, uint256 totalRewards);
    event VoterRewardsClaimed(address indexed user, address indexed gauge, uint256 amount);
    event ProbabilityBoostToggled(bool enabled);
    event MaxProbabilityBoostUpdated(uint256 maxBoostBps);
    event TreasuryTransfer(address indexed vault, address indexed treasury, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeDistributionUpdated(uint256 voterRewardBps, uint256 treasuryBps, uint256 burnBps);

    // ================================
    // MODIFIERS
    // ================================

    modifier onlyHub() {
        if (!registry.isHubChain()) revert OnlyHub();
        _;
    }

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(
        address _registry,
        address _owner
    ) OApp(IOmniDragonRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid)), _owner) Ownable(_owner) {
        require(_registry != address(0), "Invalid registry");

        registry = IOmniDragonRegistry(_registry);
        CHAIN_ID = uint16(block.chainid);
        chainEid = registry.chainIdToEid(block.chainid);

        // Initialize first epoch
        _epochs[0] = Epoch({
            startTime: block.timestamp,
            endTime: block.timestamp + EPOCH_DURATION,
            totalVotes: 0,
            distributed: false
        });
    }

    // ================================
    // GAUGE MANAGEMENT
    // ================================

    function addGauge(address vault, uint16 chainId, uint32 eid) external override onlyOwner {
        if (_isGauge[vault]) revert GaugeAlreadyExists();
        if (_gauges.length >= MAX_GAUGES) revert("Max gauges reached");

        _gauges.push(Gauge({
            vault: vault,
            chainId: chainId,
            eid: eid,
            active: true,
            totalShares: 0
        }));

        _gaugeIndex[vault] = _gauges.length; // 1-indexed
        _isGauge[vault] = true;
        activeGaugeCount++;

        emit GaugeAdded(vault, chainId, eid);
    }

    function removeGauge(address vault) external override onlyOwner {
        if (!_isGauge[vault]) revert GaugeNotFound();

        uint256 index = _gaugeIndex[vault] - 1;
        if (_gauges[index].active) {
            _gauges[index].active = false;
            activeGaugeCount--;
        }

        emit GaugeRemoved(vault);
    }

    function depositShares(address vault, uint256 amount) external override nonReentrant {
        if (!_isGauge[vault]) revert GaugeNotFound();
        if (amount == 0) return;

        IERC20(vault).safeTransferFrom(msg.sender, address(this), amount);

        // Split into jackpot reserve and gauge distribution
        uint256 jackpotAmount = (amount * jackpotReserveBps) / 10000;
        uint256 gaugeAmount = amount - jackpotAmount;

        _jackpotReserve[vault] += jackpotAmount;
        _pendingGaugeShares[vault] += gaugeAmount;
        _vaultShares[vault] += amount;

        uint256 index = _gaugeIndex[vault] - 1;
        _gauges[index].totalShares += amount;

        emit SharesDeposited(vault, amount, currentEpoch);
    }

    // ================================
    // LOCAL VOTING
    // ================================

    function vote(VoteAllocation[] calldata allocations) external override nonReentrant {
        _processVote(msg.sender, allocations, true);
    }

    function _processVote(address voter, VoteAllocation[] calldata allocations, bool isLocal) internal {
        Epoch storage epoch = _epochs[currentEpoch];
        if (block.timestamp >= epoch.endTime) revert VotingClosed();

        // Get user's voting power
        uint256 userPower;
        if (isLocal) {
            userPower = IveDRAGON(veDRAGON).getTotalVotingPower(voter);
        } else {
            // For remote votes, power is encoded in the message
            // This path is handled separately in _lzReceive
            return;
        }
        
        if (userPower == 0) revert NoVotingPower();

        // Reset previous votes if any
        if (_hasVoted[currentEpoch][voter]) {
            _resetUserVotes(voter, currentEpoch);
        }

        uint256 totalWeight = 0;

        // Record new votes
        for (uint i = 0; i < allocations.length; i++) {
            address gauge = allocations[i].gauge;
            uint256 weight = allocations[i].weight;

            if (!_isGauge[gauge]) revert GaugeNotActive();
            if (!_gauges[_gaugeIndex[gauge] - 1].active) revert GaugeNotActive();

            totalWeight += weight;
            if (totalWeight > 10000) revert WeightExceedsMax();

            uint256 voteAmount = (userPower * weight) / 10000;

            _gaugeVotes[currentEpoch][gauge] += voteAmount;
            _userGaugeVotes[currentEpoch][gauge][voter] += voteAmount;
            epoch.totalVotes += voteAmount;

            _userVotes[currentEpoch][voter].push(allocations[i]);

            emit Voted(voter, currentEpoch, gauge, weight, voteAmount);
        }

        _hasVoted[currentEpoch][voter] = true;
    }

    // ================================
    // CROSS-CHAIN VOTING
    // ================================

    /**
     * @notice Vote for a gauge on a remote chain
     * @param dstEid Destination chain's endpoint ID
     * @param gauge Gauge address on destination chain
     * @param weight Vote weight (0-10000)
     */
    function voteRemote(
        uint32 dstEid,
        address gauge,
        uint256 weight
    ) external payable nonReentrant {
        if (dstEid == chainEid) revert("Use vote() for local gauges");
        if (weight > 10000) revert WeightExceedsMax();

        uint256 userPower = IveDRAGON(veDRAGON).getTotalVotingPower(msg.sender);
        if (userPower == 0) revert NoVotingPower();

        uint256 voteAmount = (userPower * weight) / 10000;

        // Encode vote message
        bytes memory payload = abi.encode(
            MSG_TYPE_VOTE,
            msg.sender,
            gauge,
            voteAmount,
            currentEpoch
        );

        // Build options
        bytes memory options = OptionsBuilder.newOptions()
            .addExecutorLzReceiveOption(100_000, 0);

        // Send vote to destination chain
        _lzSend(dstEid, payload, options, MessagingFee(msg.value, 0), payable(msg.sender));

        emit Voted(msg.sender, currentEpoch, gauge, weight, voteAmount);
    }

    /**
     * @notice Quote fee for remote voting
     */
    function quoteVoteRemote(uint32 dstEid, address gauge, uint256 weight) external view returns (uint256 fee) {
        bytes memory payload = abi.encode(
            MSG_TYPE_VOTE,
            msg.sender,
            gauge,
            weight,
            currentEpoch
        );

        bytes memory options = OptionsBuilder.newOptions()
            .addExecutorLzReceiveOption(100_000, 0);

        MessagingFee memory msgFee = _quote(dstEid, payload, options, false);
        return msgFee.nativeFee;
    }

    function resetVotes() external override {
        _resetUserVotes(msg.sender, currentEpoch);
        emit VotesReset(msg.sender, currentEpoch);
    }

    function _resetUserVotes(address user, uint256 epoch) internal {
        VoteAllocation[] storage allocations = _userVotes[epoch][user];
        uint256 userPower = IveDRAGON(veDRAGON).getTotalVotingPower(user);

        for (uint i = 0; i < allocations.length; i++) {
            address gauge = allocations[i].gauge;
            uint256 voteAmount = (userPower * allocations[i].weight) / 10000;
            
            _gaugeVotes[epoch][gauge] -= voteAmount;
            _userGaugeVotes[epoch][gauge][user] -= voteAmount;
            _epochs[epoch].totalVotes -= voteAmount;
        }

        delete _userVotes[epoch][user];
        _hasVoted[epoch][user] = false;
    }

    function getUserVotes(address user) external view override returns (VoteAllocation[] memory) {
        return _userVotes[currentEpoch][user];
    }

    // ================================
    // EPOCH DISTRIBUTION
    // ================================

    function distributeEpoch() external override nonReentrant {
        Epoch storage epoch = _epochs[currentEpoch];
        
        if (block.timestamp < epoch.endTime) revert EpochNotEnded();
        if (epoch.distributed) revert EpochAlreadyDistributed();

        (uint256 totalBurned, uint256 totalVoterRewards) = _processGaugeDistributions(epoch.totalVotes);

        // Mark epoch as distributed
        epoch.distributed = true;

        // Start new epoch
        currentEpoch++;
        _epochs[currentEpoch] = Epoch({
            startTime: block.timestamp,
            endTime: block.timestamp + EPOCH_DURATION,
            totalVotes: 0,
            distributed: false
        });

        emit EpochDistributed(currentEpoch - 1, totalBurned, totalVoterRewards);
        emit NewEpoch(currentEpoch, block.timestamp, block.timestamp + EPOCH_DURATION);
    }

    function _processGaugeDistributions(uint256 totalVotes) internal returns (uint256 totalBurned, uint256 totalVoterRewards) {
        for (uint i = 0; i < _gauges.length; i++) {
            if (!_gauges[i].active) continue;

            address vault = _gauges[i].vault;
            
            // Calculate vote share and update probability boost
            uint256 voteShareBps = _updateProbabilityBoost(vault, totalVotes);

            // Process fee distribution
            (uint256 burned, uint256 rewards) = _distributeGaugeFees(vault, i, voteShareBps);
            totalBurned += burned;
            totalVoterRewards += rewards;
        }
    }

    function _updateProbabilityBoost(address vault, uint256 totalVotes) internal returns (uint256 voteShareBps) {
        voteShareBps = totalVotes > 0 
            ? (_gaugeVotes[currentEpoch][vault] * 10000) / totalVotes 
            : 0;

        // Only calculate boost if feature is enabled
        uint256 probabilityBoost = 0;
        if (probabilityBoostEnabled && currentMaxProbabilityBoost > 0) {
            probabilityBoost = (voteShareBps * currentMaxProbabilityBoost) / 10000;
        }
        _vaultProbabilityBoost[vault] = probabilityBoost;
        _boostLastUpdatedEpoch[vault] = currentEpoch;
        
        emit VaultProbabilityBoostUpdated(vault, probabilityBoost, currentEpoch);
    }

    function _distributeGaugeFees(
        address vault, 
        uint256 gaugeIndex, 
        uint256 voteShareBps
    ) internal returns (uint256 burned, uint256 rewards) {
        uint256 pendingShares = _pendingGaugeShares[vault];
        
        if (pendingShares == 0 || voteShareBps == 0) return (0, 0);

        // This gauge's allocation based on vote share
        uint256 gaugeAllocation = (pendingShares * voteShareBps) / 10000;
        
        // 69% voter rewards, 31% treasury
        rewards = (gaugeAllocation * voterRewardBps) / 10000;
        uint256 treasuryAmount = gaugeAllocation - rewards;
        
        _epochGaugeVoterRewards[currentEpoch][vault] = rewards;
        emit VoterRewardsDistributed(currentEpoch, vault, rewards);

        // Handle treasury allocation (burns + multisig)
        if (treasuryAmount > 0) {
            // Calculate burn amount from treasury portion
            burned = (treasuryAmount * burnBps) / 10000;
            uint256 toMultisig = treasuryAmount - burned;
            
            // Burn portion (if any)
            if (burned > 0) {
                IDragonOVault(vault).burnSharesForPriceIncrease(burned);
                _vaultShares[vault] -= burned;
                _gauges[gaugeIndex].totalShares -= burned;
                emit SharesBurned(vault, burned, currentEpoch, voteShareBps);
            }
            
            // Send rest to treasury multisig
            if (toMultisig > 0 && treasury != address(0)) {
                IERC20(vault).safeTransfer(treasury, toMultisig);
                _vaultShares[vault] -= toMultisig;
                _gauges[gaugeIndex].totalShares -= toMultisig;
                emit TreasuryTransfer(vault, treasury, toMultisig);
            }
            
            _pendingGaugeShares[vault] -= gaugeAllocation;
        }
    }

    // ================================
    // VOTER REWARDS
    // ================================

    /**
     * @notice Claim voter rewards for a specific epoch
     * @param epoch Epoch to claim rewards from
     */
    function claimVoterRewards(uint256 epoch) external nonReentrant {
        if (!_epochs[epoch].distributed) revert("Epoch not distributed");
        if (_hasClaimedRewards[epoch][msg.sender]) revert("Already claimed");

        uint256 totalRewards = 0;

        // Calculate rewards for each gauge user voted for
        for (uint i = 0; i < _gauges.length; i++) {
            if (!_gauges[i].active) continue;

            address vault = _gauges[i].vault;
            uint256 userVoteAmount = _userGaugeVotes[epoch][vault][msg.sender];
            
            if (userVoteAmount == 0) continue;

            uint256 gaugeVotes = _gaugeVotes[epoch][vault];
            if (gaugeVotes == 0) continue;

            // User's share of gauge rewards
            uint256 gaugeRewards = _epochGaugeVoterRewards[epoch][vault];
            uint256 userReward = (gaugeRewards * userVoteAmount) / gaugeVotes;

            if (userReward > 0) {
                totalRewards += userReward;
                IERC20(vault).safeTransfer(msg.sender, userReward);
                
                emit VoterRewardsClaimed(msg.sender, vault, userReward);
            }
        }

        _hasClaimedRewards[epoch][msg.sender] = true;
    }

    /**
     * @notice Get pending voter rewards for a user
     */
    function getPendingVoterRewards(address user, uint256 epoch) external view returns (uint256 totalRewards) {
        if (!_epochs[epoch].distributed) return 0;
        if (_hasClaimedRewards[epoch][user]) return 0;

        for (uint i = 0; i < _gauges.length; i++) {
            if (!_gauges[i].active) continue;

            address vault = _gauges[i].vault;
            uint256 userVoteAmount = _userGaugeVotes[epoch][vault][user];
            
            if (userVoteAmount == 0) continue;

            uint256 gaugeVotes = _gaugeVotes[epoch][vault];
            if (gaugeVotes == 0) continue;

            uint256 gaugeRewards = _epochGaugeVoterRewards[epoch][vault];
            totalRewards += (gaugeRewards * userVoteAmount) / gaugeVotes;
        }
    }

    // ================================
    // JACKPOT FUNCTIONS
    // ================================

    function payJackpot(address vault, address winner, uint256 shares) external {
        require(msg.sender == registry.getLotteryManager(CHAIN_ID), "Only lottery manager");
        require(shares <= _jackpotReserve[vault], "Insufficient jackpot");

        _jackpotReserve[vault] -= shares;
        _vaultShares[vault] -= shares;

        IERC20(vault).safeTransfer(winner, shares);
    }

    // ================================
    // CROSS-CHAIN (OApp)
    // ================================

    function _lzReceive(
        Origin calldata _origin,
        bytes32 /*_guid*/,
        bytes calldata _payload,
        address /*_executor*/,
        bytes calldata /*_extraData*/
    ) internal override {
        uint8 msgType = abi.decode(_payload, (uint8));

        if (msgType == MSG_TYPE_VOTE) {
            _handleRemoteVote(_origin.srcEid, _payload);
        } else if (msgType == MSG_TYPE_SHARES) {
            _handleShareDeposit(_payload);
        }
    }

    function _handleRemoteVote(uint32 srcEid, bytes calldata _payload) internal {
        (
            ,  // msgType
            address voter,
            address gauge,
            uint256 voteAmount,
            uint256 voteEpoch
        ) = abi.decode(_payload, (uint8, address, address, uint256, uint256));

        // Validate
        if (voteEpoch != currentEpoch) return; // Ignore stale votes
        if (!_isGauge[gauge]) return;
        if (!_gauges[_gaugeIndex[gauge] - 1].active) return;

        Epoch storage epoch = _epochs[currentEpoch];
        if (block.timestamp >= epoch.endTime) return; // Voting closed

        // Record remote vote
        _gaugeVotes[currentEpoch][gauge] += voteAmount;
        _userGaugeVotes[currentEpoch][gauge][voter] += voteAmount;
        epoch.totalVotes += voteAmount;
        _hasVoted[currentEpoch][voter] = true;

        emit RemoteVoteReceived(voter, gauge, voteAmount, srcEid);
        emit Voted(voter, currentEpoch, gauge, 0, voteAmount);
    }

    function _handleShareDeposit(bytes calldata _payload) internal {
        (, address vault, uint256 amount) = abi.decode(_payload, (uint8, address, uint256));
        
        if (_isGauge[vault]) {
            uint256 jackpotAmount = (amount * jackpotReserveBps) / 10000;
            uint256 gaugeAmount = amount - jackpotAmount;

            _jackpotReserve[vault] += jackpotAmount;
            _pendingGaugeShares[vault] += gaugeAmount;
        }
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    function getEpoch(uint256 epoch) external view override returns (Epoch memory) {
        return _epochs[epoch];
    }

    function timeUntilEpochEnd() external view override returns (uint256) {
        Epoch memory epoch = _epochs[currentEpoch];
        if (block.timestamp >= epoch.endTime) return 0;
        return epoch.endTime - block.timestamp;
    }

    function canDistribute() external view override returns (bool) {
        Epoch memory epoch = _epochs[currentEpoch];
        return block.timestamp >= epoch.endTime && !epoch.distributed;
    }

    function getAllGauges() external view override returns (Gauge[] memory) {
        return _gauges;
    }

    function getGauge(address vault) external view override returns (Gauge memory) {
        if (!_isGauge[vault]) revert GaugeNotFound();
        return _gauges[_gaugeIndex[vault] - 1];
    }

    function getGaugeVotes(address vault) external view override returns (uint256) {
        return _gaugeVotes[currentEpoch][vault];
    }

    function getUserGaugeVotes(address user, address gauge, uint256 epoch) external view returns (uint256) {
        return _userGaugeVotes[epoch][gauge][user];
    }

    function getJackpotReserve(address vault) external view override returns (uint256) {
        return _jackpotReserve[vault];
    }

    function getPendingDistribution() external view override returns (uint256) {
        uint256 total = 0;
        for (uint i = 0; i < _gauges.length; i++) {
            total += _pendingGaugeShares[_gauges[i].vault];
        }
        return total;
    }

    function getVaultProbabilityBoost(address vault) external view returns (uint256) {
        return _vaultProbabilityBoost[vault];
    }

    function getUserProbabilityBoost(address user) external view returns (uint256 totalBoost) {
        for (uint i = 0; i < _gauges.length; i++) {
            if (!_gauges[i].active) continue;
            
            address vault = _gauges[i].vault;
            uint256 userShares = IERC20(vault).balanceOf(user);
            
            if (userShares > 0) {
                totalBoost += _vaultProbabilityBoost[vault];
            }
        }
        
        // Cap at current max (or ceiling if not set)
        uint256 cap = currentMaxProbabilityBoost > 0 ? currentMaxProbabilityBoost : MAX_PROBABILITY_BOOST_CEILING;
        if (totalBoost > cap) {
            totalBoost = cap;
        }
    }

    function getAllProbabilityBoosts() external view returns (address[] memory vaults, uint256[] memory boosts) {
        vaults = new address[](activeGaugeCount);
        boosts = new uint256[](activeGaugeCount);
        
        uint256 idx = 0;
        for (uint i = 0; i < _gauges.length && idx < activeGaugeCount; i++) {
            if (_gauges[i].active) {
                vaults[idx] = _gauges[i].vault;
                boosts[idx] = _vaultProbabilityBoost[_gauges[i].vault];
                idx++;
            }
        }
    }

    // ================================
    // ADMIN
    // ================================

    function setVeDRAGON(address _veDRAGON) external onlyOwner {
        require(_veDRAGON != address(0), "Invalid address");
        veDRAGON = _veDRAGON;
    }

    function setReserveSplit(uint256 _jackpotBps, uint256 _gaugeBps) external onlyOwner {
        require(_jackpotBps + _gaugeBps == 10000, "Must sum to 100%");
        jackpotReserveBps = _jackpotBps;
        gaugeBurnBps = _gaugeBps;
    }

    /**
     * @notice Enable or disable probability boost feature
     * @param enabled Whether to enable probability boost
     */
    function setProbabilityBoostEnabled(bool enabled) external onlyOwner {
        probabilityBoostEnabled = enabled;
        emit ProbabilityBoostToggled(enabled);
    }

    /**
     * @notice Set the current max probability boost (can ramp up over time)
     * @param maxBoostBps Max boost in basis points (e.g., 100 = 1%)
     */
    function setMaxProbabilityBoost(uint256 maxBoostBps) external onlyOwner {
        require(maxBoostBps <= MAX_PROBABILITY_BOOST_CEILING, "Exceeds ceiling");
        currentMaxProbabilityBoost = maxBoostBps;
        emit MaxProbabilityBoostUpdated(maxBoostBps);
    }

    /**
     * @notice Set treasury multisig address
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    /**
     * @notice Set fee distribution percentages for gauge portion
     * @param _voterRewardBps Percentage to voters (in bps, e.g., 6900 = 69%)
     * @param _treasuryBps Percentage to treasury (in bps, e.g., 3100 = 31%)
     * @param _burnBps Percentage of treasury to burn (in bps, e.g., 0 = 0%)
     */
    function setFeeDistribution(
        uint256 _voterRewardBps,
        uint256 _treasuryBps,
        uint256 _burnBps
    ) external onlyOwner {
        require(_voterRewardBps + _treasuryBps == 10000, "Must total 100%");
        require(_burnBps <= 10000, "Burn exceeds 100%");
        
        voterRewardBps = _voterRewardBps;
        treasuryBps = _treasuryBps;
        burnBps = _burnBps;
        
        emit FeeDistributionUpdated(_voterRewardBps, _treasuryBps, _burnBps);
    }

    /**
     * @notice Set burn percentage of treasury allocation
     * @dev Allows ramping up burns over time (default 0%)
     * @param _burnBps Burn percentage in basis points (max 10000)
     */
    function setBurnPercentage(uint256 _burnBps) external onlyOwner {
        require(_burnBps <= 10000, "Exceeds 100%");
        burnBps = _burnBps;
        emit FeeDistributionUpdated(voterRewardBps, treasuryBps, _burnBps);
    }

    function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
