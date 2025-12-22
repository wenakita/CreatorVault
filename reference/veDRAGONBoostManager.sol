// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IveDRAGON} from "../../../interfaces/governance/IveDRAGON.sol";
import {IGaugeController} from "../../../interfaces/governance/IGaugeController.sol";
import {IveDRAGONBoostManager} from "../../../interfaces/governance/voting/IveDRAGONBoostManager.sol";
import {IDragonGaugeRegistry} from "../../../interfaces/governance/partners/IDragonGaugeRegistry.sol";
import {DragonDateTimeLib} from "../../../libraries/core/DragonDateTimeLib.sol";
import {veDRAGONMath} from "../../../libraries/math/veDRAGONMath.sol";

/**
 * @title veDRAGONBoostManager
 * @dev Two-tier voting system for probability boost allocation
 *
 * TIER 1: veDRAGON holders vote on vault allocations (GaugeController)
 *   - Splits 6.9% probability pool among DragonOVault vaults
 *   - e.g., baseDRAGON: 1%, monadDRAGON: 4%, arbDRAGON: 1.9%
 *
 * TIER 2: DragonOVault vault holders vote on partner allocations (this contract)
 *   - monadDRAGON holders direct their 4% to partners
 *   - Partners get probability boosts for their token holders
 *
 * https://x.com/sonicreddragon
 * https://t.me/sonicreddragon
 */
contract veDRAGONBoostManager is Ownable, ReentrancyGuard, IveDRAGONBoostManager {
  // === Custom Errors ===
  error ZeroAddress();
  error ZeroAmount();
  error BaseBoostMustBePositive();
  error MaxBoostMustBeGreaterThanBase();
  error UnauthorizedCaller();
  error PartnerDoesNotExist();
  error PartnerNotActive();
  error InsufficientVotingPower();
  error NoVotesForOldPartner();
  error TooSoonToRecalculate();
  error PeriodTooShort();
  error FeeMRegistrationFailed();
  error InvalidMultiplier();

  // Core contract references
  IveDRAGON public immutable veDRAGON;
  IGaugeController public gaugeController;
  IDragonGaugeRegistry public partnerRegistry;
  
  /// @notice Local DragonOVault vault (for partner voting power)
  address public localChainDragon;

  // ===== BOOST PARAMETERS =====
  /// @dev Precision for boost calculations (10000 = 100%)
  uint256 public constant BOOST_PRECISION = 10000;

  /// @dev Base boost value (10000 = 100%)
  uint256 public baseBoost = 10000;

  /// @dev Maximum boost value (25000 = 250%)
  uint256 public maxBoost = 25000;

  // Optional parameters for refined boost calculation (packed into single storage slot)
  uint64 public minLockDuration = 7 days; // Minimum lock duration for boost
  uint64 public maxLockDuration = 4 * 365 days; // Maximum lock duration (4 years)

  // ===== VOTING PARAMETERS =====
  /// @dev Voting period length in seconds
  uint64 public votingPeriodLength = 7 days;

  /// @dev Current voting period
  uint64 private _currentPeriod;

  /// @dev Maximum total probability boost (6.9% expressed in basis points)
  /// @notice This is the ECOSYSTEM-WIDE cap, split among vaults via gauge voting
  uint256 public constant MAX_TOTAL_BOOST = 690;
  
  /// @dev Percentage of vault's probability allocation that goes to partners (30%)
  /// @notice The remaining 70% goes directly to vault holders
  uint256 public partnerShareBps = 3000; // 30% of vault allocation → partners

  /// @dev Minimum voting power to participate
  uint256 public minVotingPower = 0.1 ether; // 0.1 veDRAGON

  // Track votes for each partner in each period
  // period => partnerId => votes
  mapping(uint256 => mapping(uint256 => uint256)) public partnerVotes;

  // Track total votes in each period
  // period => totalVotes
  mapping(uint256 => uint256) public periodTotalVotes;

  // Track if a user has voted in current period
  // period => user => hasVoted
  mapping(uint256 => mapping(address => bool)) public hasVoted;

  // Track votes by user
  // period => user => partnerId => votes
  mapping(uint256 => mapping(address => mapping(uint256 => uint256))) public userVotes;

  // Track allocated probability boost
  // partnerId => probabilityBoost (in basis points)
  mapping(uint256 => uint256) public partnerProbabilityBoost;

  // Last calculation timestamp
  uint64 public lastCalculation;

  // Flash loan protection
  mapping(address => uint256) public lastBalanceUpdateBlock;
  uint256 public constant MIN_HOLDING_BLOCKS = 10; // ~2 minutes on most chains

  // Timelock for critical parameters
  bool public boostTimelockInitialized;
  uint256 public constant BOOST_TIMELOCK_DELAY = 24 hours; // 24 hour delay for boost changes

  struct BoostTimelockProposal {
    uint256 newBaseBoost;
    uint256 newMaxBoost;
    uint256 executeTime;
    bool executed;
    bool exists;
  }

  mapping(bytes32 => BoostTimelockProposal) public boostTimelockProposals;
  bool public boostParametersSetOnce;

  // ===== EVENTS =====
  // Boost Events (BoostCalculated is inherited from interface)
  event BoostParametersUpdated(uint256 baseBoost, uint256 maxBoost);
  event JackpotAddressUpdated(address indexed newJackpot);
  event JackpotEntryWithBoost(address indexed user, uint256 amount, uint256 boostedAmount);

  // Voting Events
  event VoteCast(address indexed user, uint256 indexed partnerId, uint256 votes, uint256 period);
  event VoteChanged(
    address indexed user,
    uint256 indexed oldPartnerId,
    uint256 indexed newPartnerId,
    uint256 votes,
    uint256 period
  );
  event VoteRemoved(address indexed user, uint256 indexed partnerId, uint256 votes, uint256 period);
  event PartnersBoostCalculated(uint256 period, uint256 totalVotes);
  event PartnerBoostUpdated(uint256 indexed partnerId, uint256 probabilityBoost);
  event PartnerShareUpdated(uint256 newPartnerShareBps);
  event LocalChainDragonUpdated(address indexed localChainDragon);
  event VotingPeriodChanged(uint256 newPeriodLength);
  event MinVotingPowerChanged(uint256 newMinVotingPower);
  event PartnerRegistryUpdated(address indexed newRegistry);

  event BoostProposalCreated(
    bytes32 indexed proposalId,
    uint256 newBaseBoost,
    uint256 newMaxBoost,
    uint256 executeTime
  );
  event BoostProposalExecuted(bytes32 indexed proposalId);
  event BoostTimelockInitialized();

  /**
   * @dev Constructor
   * @param _veDRAGON Address of the veDRAGON token
   * @param _gaugeController Address of the gauge controller contract
   * @param _partnerRegistry Address of the partner registry
   */
  constructor(address _veDRAGON, address _gaugeController, address _partnerRegistry) Ownable(msg.sender) {
    if (_veDRAGON == address(0)) revert ZeroAddress();
    if (_gaugeController == address(0)) revert ZeroAddress();
    if (_partnerRegistry == address(0)) revert ZeroAddress();

    veDRAGON = IveDRAGON(_veDRAGON);
    gaugeController = IGaugeController(_gaugeController);
    partnerRegistry = IDragonGaugeRegistry(_partnerRegistry);

    // Initialize period and calculation timestamp
    _currentPeriod = uint64(block.timestamp / votingPeriodLength);
    lastCalculation = uint64(block.timestamp);
  }

  /**
   * @dev Get the current voting period
   * @return Current period ID
   */
  function currentPeriod() external view returns (uint256) {
    return _currentPeriod;
  }

  // ============================================================
  // ==================== BOOST FUNCTIONS =======================
  // ============================================================

  /**
   * @dev Calculate boost multiplier based on user's veDRAGON balance with linear scaling
   * @param _user Address of the user
   * @return boostMultiplier Boost multiplier in BOOST_PRECISION (10000 = 100%)
   */
  function calculateBoost(address _user) public view returns (uint256 boostMultiplier) {
    // Use secure calculation with flash loan protection
    return calculateBoostWithProtection(_user);
  }

  /**
   * @dev Calculate boost with flash loan protection
   */
  function calculateBoostWithProtection(address _user) public view returns (uint256 boostMultiplier) {
    // Check if user has held tokens for minimum duration
    if (block.number < lastBalanceUpdateBlock[_user] + MIN_HOLDING_BLOCKS) {
      return baseBoost; // Only base boost for recent holders
    }

    // Get user's time-weighted veDRAGON voting power
    uint256 userVeDRAGONBalance = veDRAGON.getVotingPower(_user);
    uint256 totalVeDRAGONSupply = veDRAGON.getTotalVotingPower();

    // Use the veDRAGONMath library for boost calculation
    uint256 standardBoost = veDRAGONMath.calculateNormalizedBoostMultiplier(
      userVeDRAGONBalance,
      totalVeDRAGONSupply,
      maxBoost
    );

    // Check if today is a special event day for additional boost
    (bool isSpecialEvent, uint256 eventMultiplier) = DragonDateTimeLib.checkForSpecialEvent(block.timestamp);

    if (isSpecialEvent) {
      return (standardBoost * eventMultiplier) / 10000;
    }

    return standardBoost;
  }

  /**
   * @dev Calculate boost and emit event (non-view version)
   * @param _user Address of the user
   * @return boostMultiplier Boost multiplier
   */
  function getBoostWithEvent(address _user) public override returns (uint256 boostMultiplier) {
    boostMultiplier = calculateBoost(_user);
    emit BoostCalculated(_user, boostMultiplier);
    return boostMultiplier;
  }

  /**
   * @dev Enter jackpot with a boosted amount based on veDRAGON holdings
   * @param _user Address of the user entering the jackpot
   * @param _amount Base amount for jackpot entry
   * @return boostedAmount The amount after applying the boost
   */
  function enterJackpotWithBoost(address _user, uint256 _amount) external override returns (uint256 boostedAmount) {
    // Only authorized integrators can call this function
    if (msg.sender != owner() && msg.sender != address(gaugeController)) revert UnauthorizedCaller();

    // Calculate boost
    uint256 boostMultiplier = calculateBoost(_user);

    // Apply boost to amount
    boostedAmount = (_amount * boostMultiplier) / BOOST_PRECISION;

    // Emit events
    emit BoostCalculated(_user, boostMultiplier);
    emit JackpotEntryWithBoost(_user, _amount, boostedAmount);

    return boostedAmount;
  }

  // ============================================================
  //                    VAULT PROBABILITY BOOST
  // ============================================================

  /**
   * @dev Get total probability boost for a user (from partner associations)
   * @param _user Address of the user
   * @return totalBoostBps Total probability boost in basis points
   * 
   * Two-tier voting flow:
   * 1. veDRAGON holders vote to allocate 6.9% among vaults (e.g., monadDRAGON: 4%)
   * 2. DragonOVault holders vote to direct their vault's allocation to partners
   * 3. Users holding partner tokens get that partner's probability boost
   */
  function getTotalProbabilityBoost(address _user) public view returns (uint256 totalBoostBps) {
    // User gets probability boosts from partners they're associated with
    // Partners receive allocations from vault holder voting
    totalBoostBps = _getUserPartnerBoost(_user);
    
    // Cap at MAX_TOTAL_BOOST (6.9%)
    if (totalBoostBps > MAX_TOTAL_BOOST) {
      totalBoostBps = MAX_TOTAL_BOOST;
    }
  }

  /**
   * @dev Calculate partner probability boost for a user
   * @param _user User address
   * @return boost Partner boost in bps
   * 
   * Users get probability boosts if they hold partner tokens.
   * Partner boosts come from vault holder voting.
   */
  function _getUserPartnerBoost(address _user) internal view returns (uint256 boost) {
    if (address(partnerRegistry) == address(0)) {
      return 0;
    }

    // User gets partner boost if they hold partner tokens
    for (uint256 i = 0; i < partnerRegistry.getPartnerCount(); i++) {
      address partnerAddress = partnerRegistry.partnerList(i);
      
      // Check if user holds partner tokens (assuming partner address is token)
      try IERC20(partnerAddress).balanceOf(_user) returns (uint256 balance) {
        if (balance > 0) {
          boost += partnerProbabilityBoost[i];
        }
      } catch {
        // Partner might not be a token, skip
      }
    }
  }

  /**
   * @dev Get vault probability boost from gauge votes (convenience function)
   * @param _user User address
   * @return boost Vault-derived probability boost in bps
   */
  /**
   * @dev Get probability boost from partner associations
   * @param _user User address
   * @return boost Partner-derived probability boost in bps
   * @notice In the new model, vault holders vote to direct probability to partners,
   *         so this returns the boost from partner tokens the user holds
   */
  function getVaultProbabilityBoost(address _user) external view returns (uint256 boost) {
    return _getUserPartnerBoost(_user);
  }

  /**
   * @dev Update boost parameters (with timelock protection after first use)
   * @param _baseBoost New base boost (10000 = 100%)
   * @param _maxBoost New max boost (25000 = 250%)
   */
  function setBoostParameters(uint256 _baseBoost, uint256 _maxBoost) external onlyOwner {
    if (_baseBoost == 0) revert BaseBoostMustBePositive();
    if (_maxBoost <= _baseBoost) revert MaxBoostMustBeGreaterThanBase();

    // First time can be set immediately
    if (!boostParametersSetOnce) {
      boostParametersSetOnce = true;
      boostTimelockInitialized = true;

      baseBoost = _baseBoost;
      maxBoost = _maxBoost;

      emit BoostParametersUpdated(_baseBoost, _maxBoost);
      emit BoostTimelockInitialized();
      return;
    }

    // Subsequent changes require timelock
    revert("Use proposeBoostParameterChange");
  }

  /**
   * @dev Propose boost parameter changes (required after first use)
   */
  function proposeBoostParameterChange(
    uint256 _baseBoost,
    uint256 _maxBoost
  ) external onlyOwner returns (bytes32 proposalId) {
    require(boostTimelockInitialized, "Timelock not initialized");
    if (_baseBoost == 0) revert BaseBoostMustBePositive();
    if (_maxBoost <= _baseBoost) revert MaxBoostMustBeGreaterThanBase();

    proposalId = keccak256(abi.encode(_baseBoost, _maxBoost, block.timestamp));
    require(!boostTimelockProposals[proposalId].exists, "Proposal already exists");

    uint256 executeTime = block.timestamp + BOOST_TIMELOCK_DELAY;

    boostTimelockProposals[proposalId] = BoostTimelockProposal({
      newBaseBoost: _baseBoost,
      newMaxBoost: _maxBoost,
      executeTime: executeTime,
      executed: false,
      exists: true
    });

    emit BoostProposalCreated(proposalId, _baseBoost, _maxBoost, executeTime);
    return proposalId;
  }

  /**
   * @dev Execute boost parameter change after timelock
   */
  function executeBoostParameterChange(bytes32 proposalId) external onlyOwner {
    BoostTimelockProposal storage proposal = boostTimelockProposals[proposalId];
    require(proposal.exists, "Proposal does not exist");
    require(!proposal.executed, "Proposal already executed");
    require(block.timestamp >= proposal.executeTime, "Timelock not expired");

    proposal.executed = true;

    baseBoost = proposal.newBaseBoost;
    maxBoost = proposal.newMaxBoost;

    emit BoostParametersUpdated(proposal.newBaseBoost, proposal.newMaxBoost);
    emit BoostProposalExecuted(proposalId);
  }

  /**
   * @dev Update gauge controller address
   * @param _gaugeController New gauge controller address
   */
  function setGaugeController(address _gaugeController) external onlyOwner {
    if (_gaugeController == address(0)) revert ZeroAddress();
    gaugeController = IGaugeController(_gaugeController);
    emit JackpotAddressUpdated(_gaugeController);
  }

  // ============================================================
  // =================== VOTING FUNCTIONS =======================
  // ============================================================

  /**
   * @dev Vote for a partner to receive probability boost
   * @param _partnerId ID of the partner to vote for
   * @param _weight Voting weight to allocate (not used, for interface compatibility)
   */
  /**
   * @dev Vote for a partner to receive probability boost allocation
   * @notice Voting power = user's DragonOVault balance (vault holders direct probability)
   * @param _partnerId Partner ID to vote for
   * @param _weight Weight parameter (unused, for interface compatibility)
   */
  function voteForPartner(uint256 _partnerId, uint256 _weight) external override {
    // _weight parameter is not used in this implementation but is included for interface compatibility
    _weight; // Silence unused variable warning

    // Get partner address from ID
    address partnerAddress = partnerRegistry.partnerList(_partnerId);

    // Verify partner exists and is active
    bool isActive = partnerRegistry.isPartnerActive(partnerAddress);
    if (partnerAddress == address(0)) revert PartnerDoesNotExist();
    if (!isActive) revert PartnerNotActive();

    // Check if we need to move to a new period
    updatePeriodIfNeeded();

    // Get user's voting power from DragonOVault holdings (vault holders direct probability)
    uint256 votingPower = _getChainDragonVotingPower(msg.sender);
    if (votingPower < minVotingPower) revert InsufficientVotingPower();

    // If user has already voted in this period, remove their previous vote
    if (hasVoted[_currentPeriod][msg.sender]) {
      removeVote(msg.sender);
    }

    // Record the new vote
    partnerVotes[_currentPeriod][_partnerId] += votingPower;
    periodTotalVotes[_currentPeriod] += votingPower;
    hasVoted[_currentPeriod][msg.sender] = true;
    userVotes[_currentPeriod][msg.sender][_partnerId] = votingPower;

    emit VoteCast(msg.sender, _partnerId, votingPower, _currentPeriod);
  }

  /**
   * @dev Get voting power for partner allocation (based on DragonOVault holdings)
   * @param _user User address
   * @return votingPower User's DragonOVault balance
   */
  function _getChainDragonVotingPower(address _user) internal view returns (uint256 votingPower) {
    if (localChainDragon == address(0)) {
      // Fallback to veDRAGON if no local vault set
      return veDRAGON.getVotingPower(_user);
    }
    
    // Voting power = DragonOVault balance
    // Vault holders direct the vault's probability allocation
    return IERC20(localChainDragon).balanceOf(_user);
  }

  /**
   * @dev Change vote from one partner to another
   * @param _oldPartnerId Current partner ID the user is voting for
   * @param _newPartnerId New partner ID to vote for
   */
  function changeVote(uint256 _oldPartnerId, uint256 _newPartnerId) external {
    // Get partner address from ID
    address newPartnerAddress = partnerRegistry.partnerList(_newPartnerId);

    // Verify new partner exists and is active
    bool isActive = partnerRegistry.isPartnerActive(newPartnerAddress);
    if (newPartnerAddress == address(0)) revert PartnerDoesNotExist();
    if (!isActive) revert PartnerNotActive();

    // Check if we need to move to a new period
    updatePeriodIfNeeded();

    // Check if user has voted for the old partner
    uint256 oldVotes = userVotes[_currentPeriod][msg.sender][_oldPartnerId];
    if (oldVotes == 0) revert NoVotesForOldPartner();

    // Remove old vote
    partnerVotes[_currentPeriod][_oldPartnerId] -= oldVotes;
    userVotes[_currentPeriod][msg.sender][_oldPartnerId] = 0;

    // Add new vote
    partnerVotes[_currentPeriod][_newPartnerId] += oldVotes;
    userVotes[_currentPeriod][msg.sender][_newPartnerId] = oldVotes;

    emit VoteChanged(msg.sender, _oldPartnerId, _newPartnerId, oldVotes, _currentPeriod);
  }

  /**
   * @dev Remove a user's vote
   * @param user Address of the user
   */
  function removeVote(address user) internal {
    // Find all partners the user voted for
    for (uint256 i = 0; i < partnerRegistry.getPartnerCount(); i++) {
      uint256 userVoteAmount = userVotes[_currentPeriod][user][i];
      if (userVoteAmount > 0) {
        // Remove votes
        partnerVotes[_currentPeriod][i] -= userVoteAmount;
        periodTotalVotes[_currentPeriod] -= userVoteAmount;
        userVotes[_currentPeriod][user][i] = 0;

        emit VoteRemoved(user, i, userVoteAmount, _currentPeriod);
      }
    }

    // Mark user as not having voted
    hasVoted[_currentPeriod][user] = false;
  }

  /**
   * @dev Calculate probability boosts based on votes
   * Can be called by anyone, but has a time restriction
   */
  function calculatePartnersBoost() external {
    // Check if 24 hours have passed since last calculation
    if (block.timestamp < lastCalculation + 1 days) revert TooSoonToRecalculate();

    // Update period if needed
    updatePeriodIfNeeded();

    // Get the LOCAL vault's probability allocation from gauge voting
    // Partners can only share a portion of THIS vault's allocation
    uint256 localVaultBoostCap = _getLocalVaultPartnerPool();

    // Get total votes in the current period
    uint256 totalVotes = periodTotalVotes[_currentPeriod];

    // If no votes, reset all boosts
    if (totalVotes == 0) {
      for (uint256 i = 0; i < partnerRegistry.getPartnerCount(); i++) {
        if (partnerProbabilityBoost[i] > 0) {
          partnerProbabilityBoost[i] = 0;
          emit PartnerBoostUpdated(i, 0);
        }
      }
    } else {
      // Calculate boost for each partner
      // Partners share the vault's partner allocation (partnerShareBps % of vault's total)
      for (uint256 i = 0; i < partnerRegistry.getPartnerCount(); i++) {
        uint256 votes = partnerVotes[_currentPeriod][i];

        // Calculate partner's share of the LOCAL vault's partner pool
        uint256 boost = (votes * localVaultBoostCap) / totalVotes;

        // Update partner's probability boost if changed
        if (boost != partnerProbabilityBoost[i]) {
          partnerProbabilityBoost[i] = boost;
          emit PartnerBoostUpdated(i, boost);
        }
      }
    }

    // Update last calculation timestamp
    lastCalculation = uint64(block.timestamp);

    emit PartnersBoostCalculated(_currentPeriod, totalVotes);
  }

  /**
   * @dev Get the partner probability pool for the local chain's vault
   * @return Partner pool in basis points (portion of vault's allocation for partners)
   * 
   * Flow: 
   * 1. GaugeController allocates X% to this chain's vault (from 6.9% total)
   * 2. Partners on this chain share (X% × partnerShareBps) 
   * 3. Vault holders get the remaining (X% × (1 - partnerShareBps))
   */
  function _getLocalVaultPartnerPool() internal view returns (uint256) {
    if (address(gaugeController) == address(0)) {
      return 0;
    }

    // Get local DragonOVault vault from registry (via gauge controller)
    IGaugeController.Gauge[] memory gauges = gaugeController.getAllGauges();
    
    for (uint i = 0; i < gauges.length; i++) {
      if (gauges[i].chainId == uint16(block.chainid) && gauges[i].active) {
        // Found local vault - get its probability allocation
        uint256 vaultBoost = gaugeController.getVaultProbabilityBoost(gauges[i].vault);
        
        // Partner pool = vault's allocation × partnerShareBps
        return (vaultBoost * partnerShareBps) / 10000;
      }
    }
    
    return 0;
  }

  /**
   * @dev Get the total probability pool available for this chain's vault holders to direct
   * @return Total probability pool in basis points that vault holders can allocate to partners
   */
  function getLocalVaultProbabilityPool() external view returns (uint256) {
    if (address(gaugeController) == address(0)) {
      return 0;
    }

    IGaugeController.Gauge[] memory gauges = gaugeController.getAllGauges();
    
    for (uint i = 0; i < gauges.length; i++) {
      if (gauges[i].chainId == uint16(block.chainid) && gauges[i].active) {
        // Return the full vault allocation that vault holders can direct to partners
        return gaugeController.getVaultProbabilityBoost(gauges[i].vault);
      }
    }
    
    return 0;
  }

  /**
   * @dev Get probability boost for a partner
   * @param _partnerId ID of the partner
   * @return Probability boost in basis points (e.g., 100 = 1%)
   */
  function getPartnerProbabilityBoost(uint256 _partnerId) external view override returns (uint256) {
    return partnerProbabilityBoost[_partnerId];
  }

  /**
   * @dev Get probability boost for a partner address
   * @param _partner Address of the partner
   * @return Probability boost in basis points (e.g., 100 = 1%)
   */
  function getPartnerProbabilityBoostByAddress(address _partner) external view returns (uint256) {
    // Iterate through partner list to find matching address
    for (uint256 i = 0; i < partnerRegistry.getPartnerCount(); i++) {
      if (partnerRegistry.partnerList(i) == _partner) {
        return partnerProbabilityBoost[i];
      }
    }
    return 0;
  }

  /**
   * @dev Update current period if needed
   */
  function updatePeriodIfNeeded() internal {
    uint64 calculatedPeriod = uint64(block.timestamp / votingPeriodLength);
    if (calculatedPeriod > _currentPeriod) {
      _currentPeriod = calculatedPeriod;
    }
  }

  /**
   * @dev Set minimum voting power required to participate
   * @param _minVotingPower New minimum voting power
   */
  function setMinVotingPower(uint256 _minVotingPower) external onlyOwner {
    minVotingPower = _minVotingPower;
    emit MinVotingPowerChanged(_minVotingPower);
  }

  /**
   * @dev Set the partner share of vault probability allocations
   * @param _partnerShareBps Percentage in basis points (e.g., 3000 = 30%)
   */
  function setPartnerShareBps(uint256 _partnerShareBps) external onlyOwner {
    require(_partnerShareBps <= 10000, "Cannot exceed 100%");
    partnerShareBps = _partnerShareBps;
    emit PartnerShareUpdated(_partnerShareBps);
  }

  /**
   * @dev Set the local DragonOVault vault address
   * @param _localChainDragon DragonOVault vault address for this chain
   * @notice This vault's holders will vote on partner probability allocation
   */
  function setLocalChainDragon(address _localChainDragon) external onlyOwner {
    require(_localChainDragon != address(0), "Invalid address");
    localChainDragon = _localChainDragon;
    emit LocalChainDragonUpdated(_localChainDragon);
  }

  /**
   * @dev Set voting period length
   * @param _votingPeriodLength New voting period length in seconds
   */
  function setVotingPeriodLength(uint256 _votingPeriodLength) external onlyOwner {
    if (_votingPeriodLength < 1 days) revert PeriodTooShort();
    votingPeriodLength = uint64(_votingPeriodLength);
    emit VotingPeriodChanged(_votingPeriodLength);
  }

  /**
   * @dev Update partner registry address
   * @param _partnerRegistry New partner registry address
   */
  function setPartnerRegistry(address _partnerRegistry) external onlyOwner {
    if (_partnerRegistry == address(0)) revert ZeroAddress();
    partnerRegistry = IDragonGaugeRegistry(_partnerRegistry);
    emit PartnerRegistryUpdated(_partnerRegistry);
  }

  /**
   * @dev Update balance tracking (should be called on veDRAGON transfers)
   */
  function updateBalanceTracking(address user) external {
    require(msg.sender == address(veDRAGON), "Only veDRAGON can update");
    lastBalanceUpdateBlock[user] = block.number;
  }

  /**
   * @dev Check if a special event is active
   * @return Whether a special event is currently active
   */
  function isSpecialEventActive() external view returns (bool) {
    (bool isActive, ) = DragonDateTimeLib.checkForSpecialEvent(block.timestamp);
    return isActive;
  }

  /**
   * @dev Get normalized boost multiplier for a user
   * @param user User address
   * @return Normalized boost multiplier
   */
  function getNormalizedBoostMultiplier(address user) external view returns (uint256) {
    return calculateBoost(user);
  }

  /**
   * @notice Registers the contract with Sonic FeeM system
   * @dev Only callable by owner. Makes external call to FeeM contract.
   */
  function registerMe() external onlyOwner {
    (bool _success, ) = address(0xDC2B0D2Dd2b7759D97D50db4eabDC36973110830).call(
      abi.encodeWithSignature("selfRegister(uint256)", 143)
    );
    require(_success, "FeeM registration failed");
  }
}