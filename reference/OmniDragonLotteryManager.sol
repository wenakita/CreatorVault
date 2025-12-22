// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OApp, Origin, MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {OAppOptionsType3} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OAppOptionsType3.sol";
import {EnforcedOptionParam} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/interfaces/IOAppOptionsType3.sol";
import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IChainlinkVRFIntegratorV2_5} from "../../interfaces/vrf/IChainlinkVRFIntegratorV2_5.sol";
import {IOmniDragonVRFConsumerV2_5} from "../../interfaces/vrf/IOmniDragonVRFConsumerV2_5.sol";
import {IOmniDragonChainlinkOracle} from "../../interfaces/oracles/IOmniDragonChainlinkOracle.sol";
import {IOmniDragonRegistry} from "../../interfaces/config/IOmniDragonRegistry.sol";
import {IGaugeController} from "../../interfaces/governance/IGaugeController.sol";
import {IDragonOVault} from "../../interfaces/vaults/IDragonOVault.sol";
import {MessagingReceipt} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import {IveDRAGONBoostManager} from "../../interfaces/governance/voting/IveDRAGONBoostManager.sol";

/**
 * @title OmniDragonLotteryManager
 * @notice Lottery manager for OmniDragon ecosystem with cross-chain winner broadcast
 * @dev Features:
 * - Swap-based instant lottery with VRF
 * - Cross-chain winner broadcast via LayerZero OApp
 * - Registry-centric design
 * - Hub chain broadcasts winners to all remote vaults
 */
contract OmniDragonLotteryManager is OApp, OAppOptionsType3, ReentrancyGuard, Pausable {
    using OptionsBuilder for bytes;
    
    // ================================
    // CONSTANTS
    // ================================
    
    uint256 public constant MIN_SWAP_USD = 1_000_000; // $1 (6 decimals)
    uint256 public constant MAX_SWAP_USD = 1_000_000_000_000; // $1M (6 decimals)
    uint256 public constant BASIS_POINTS = 10_000;
    uint256 public constant BASE_CHAIN_ID = 8453; // Hub chain
    
    // LayerZero message types for enforced options
    uint16 public constant MSG_TYPE_WINNER_BROADCAST = 1;  // Hub -> All: "Pay this winner"
    uint16 public constant MSG_TYPE_WINNER_NOTIFY = 2;     // Remote -> Hub: "We have a winner"
    
    // Default gas limits for cross-chain messages
    uint128 public constant DEFAULT_GAS_LIMIT = 200_000;
    uint128 public constant DEFAULT_MSG_VALUE = 0;
    
    // ================================
    // STATE VARIABLES
    // ================================

    /// @notice OmniDragon registry
    IOmniDragonRegistry public immutable registry;
    
    /// @notice Authorized contracts that can trigger lottery
    mapping(address => bool) public authorizedSwapContracts;
    
    /// @notice DRAGON token contract
    address public dragonToken;
    
    /// @notice Primary oracle for price feeds
    IOmniDragonChainlinkOracle public primaryOracle;
    
    /// @notice GaugeController (holds jackpot reserve)
    IGaugeController public gaugeController;
    
    /// @notice DragonOVault vault for this chain
    IDragonOVault public dragonOVault;
    
    /// @notice veDRAGON token for boost calculations
  IERC20 public veDRAGONToken;
    
    /// @notice veDRAGON boost manager
  IveDRAGONBoostManager public veDRAGONBoostManager;

    /// @notice Cross-chain VRF integrator for randomness
  IChainlinkVRFIntegratorV2_5 public vrfIntegrator;
    
    /// @notice Local VRF consumer for direct randomness (e.g., on Arbitrum)
  IOmniDragonVRFConsumerV2_5 public localVRFConsumer;
    
    /// @notice Target EID for cross-chain VRF requests
    uint32 public targetEid;
    
    /// @notice VRF preference: true = prefer local, false = prefer cross-chain
    bool public useLocalVRF;
    
    /// @notice Lottery configuration
    struct LotteryConfig {
        uint256 minSwapAmount;      // Minimum USD for lottery entry
        uint256 rewardPercentage;   // Percentage of jackpot for winners (bps)
        bool isActive;              // Whether lottery is active
        uint256 baseWinChance;      // Base win chance in parts per million
        uint256 maxWinChance;       // Maximum win chance in parts per million
        uint256 usdMultiplierBps;   // Multiplier for USD calculation (10000 = 1x, 10500 = 1.05x)
    }
    
    LotteryConfig public lotteryConfig;
    
    /// @notice VRF request type
    enum VRFType { LOCAL, CROSS_CHAIN }
    
    /// @notice Consolidated VRF request tracking
    struct VRFRequest {
        address user;
        uint256 amountUSD;
        VRFType vrfType;
    }
    
    /// @notice All VRF requests (local and cross-chain share namespace)
    mapping(uint256 => VRFRequest) public vrfRequests;
    
    /// @notice Lottery statistics
    uint256 public totalLotteryEntries;
    uint256 public totalWinners;
    uint256 public totalRewardsPaid;
    
    // ================================
    // EVENTS
    // ================================
    
    event LotteryEntryCreated(address indexed user, uint256 swapAmountUSD, uint256 winChancePPM, uint256 requestId);
    event LotteryWinner(address indexed user, uint256 swapAmountUSD, uint256 rewardAmount, uint256 requestId);
    event LotteryResultProcessed(address indexed user, uint256 swapAmountUSD, bool won, uint256 rewardAmount, uint256 requestId);
    event SwapContractAuthorized(address indexed swapContract, bool authorized);
    event LotteryConfigUpdated(uint256 minSwap, uint256 rewardPercentage, bool isActive);
    event VRFIntegratorUpdated(address indexed vrfIntegrator);
    event DragonTokenUpdated(address indexed dragonToken);
    event DragonOVaultUpdated(address indexed vault);
    event PrimaryOracleUpdated(address indexed oracle);
    event VeDRAGONTokenUpdated(address indexed veDRAGONToken);
    event VeDRAGONBoostManagerUpdated(address indexed veDRAGONBoostManager);
    event WinnerBroadcast(uint32 indexed dstEid, address indexed winner, uint16 payoutBps);
    event CrossChainBroadcastFailed(uint32 indexed dstEid, address indexed winner, string reason);
    event CrossChainJackpotPaid(address indexed winner, uint256 shares, uint256 dragonValue);
    event CrossChainPayoutFailed(address indexed winner, uint256 attemptedShares);
    event LotteryWon(uint256 indexed entryId, address indexed winner, uint256 shares, uint256 dragonValue);
    event WinnerNotifiedToHub(address indexed winner, uint16 payoutBps);
    event HubNotificationFailed(address indexed winner, string reason);
    event WinnerReceivedFromRemote(uint32 indexed srcEid, address indexed winner, uint16 payoutBps);
    
    // ================================
    // CONSTRUCTOR
    // ================================

  /**
   * @param _registry OmniDragon registry address
   * @param _gaugeController GaugeController address
   * @param _dragonOVault DragonOVault vault address
   * @param _dragonToken DRAGON token address
   * @param _veDRAGONToken veDRAGON token address
   * @param _primaryOracle Primary oracle address
   */
  constructor(
        address _registry,
        address _gaugeController,
        address _dragonOVault,
        address _dragonToken,
        address _veDRAGONToken,
        address _primaryOracle,
        address _owner
    ) OApp(
        IOmniDragonRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid)),
        _owner
  ) Ownable(_owner) {
        require(_owner != address(0), "Invalid owner");
        require(_registry != address(0), "Invalid registry");
        require(_gaugeController != address(0), "Invalid gauge controller");
        require(_dragonOVault != address(0), "Invalid vault");
        require(_dragonToken != address(0), "Invalid token");
        require(_veDRAGONToken != address(0), "Invalid veDRAGON token");
        require(_primaryOracle != address(0), "Invalid oracle");

        registry = IOmniDragonRegistry(_registry);
        gaugeController = IGaugeController(_gaugeController);
        dragonOVault = IDragonOVault(_dragonOVault);
        dragonToken = _dragonToken;
        veDRAGONToken = IERC20(_veDRAGONToken);
        primaryOracle = IOmniDragonChainlinkOracle(_primaryOracle);
        
        // Initialize lottery config
        lotteryConfig = LotteryConfig({
      minSwapAmount: MIN_SWAP_USD,
      rewardPercentage: 6900, // 69% of jackpot
      isActive: true,
            baseWinChance: 40, // 0.004% base chance
            maxWinChance: 40000, // 4% max chance
            usdMultiplierBps: 10500 // 1.05x multiplier (5% bonus for slippage)
    });
  }

    // ================================
    // MODIFIERS
    // ================================

  modifier onlyAuthorizedSwapContract() {
    require(authorizedSwapContracts[msg.sender], "Unauthorized swap contract");
    _;
  }

    // ================================
    // MAIN LOTTERY FUNCTION
    // ================================
    
    /**
     * @notice Process swap-based lottery entry
     * @param trader User who made the swap
     * @param tokenIn Token being swapped (should be DRAGON token)
     * @param amountIn Amount of tokens swapped
     * @dev Calculates USD value internally using oracle
   */
  function processSwapLottery(
    address trader,
    address tokenIn,
    uint256 amountIn
  ) external payable nonReentrant onlyAuthorizedSwapContract whenNotPaused returns (uint256 entryId) {
        require(trader != address(0), "Invalid trader");
        require(tokenIn != address(0), "Invalid token");
        require(amountIn > 0, "Invalid amount");
        
        // Calculate USD value using oracle (only works for DRAGON token)
        uint256 swapValueUSD = _calculateDragonUSD(tokenIn, amountIn);
        
        // Check minimum swap amount
        if (swapValueUSD < lotteryConfig.minSwapAmount) {
      return 0;  // Below minimum, no lottery entry
    }

        // Check if lottery is active
        if (!lotteryConfig.isActive) {
          return 0;  // Lottery inactive
        }

        // Calculate win probability with veDRAGON boost
        uint256 baseWinChance = calculateWinChance(swapValueUSD);
        uint256 boostedWinChance = _applyVeDRAGONBoost(trader, baseWinChance, swapValueUSD);
        
        // Request VRF (local or cross-chain based on configuration)
        if (useLocalVRF && address(localVRFConsumer) != address(0)) {
            return _requestLocalVRF(trader, swapValueUSD, boostedWinChance);
    } else {
            return _requestCrossChainVRF(trader, swapValueUSD, boostedWinChance);
        }
    }
    
    /**
     * @notice Request cross-chain VRF with proper fee handling
     */
    function _requestCrossChainVRF(
        address trader,
        uint256 swapValueUSD,
        uint256 winChancePPM
    ) internal returns (uint256) {
        if (address(vrfIntegrator) == address(0) || targetEid == 0) {
            return 0;
        }
        
      try vrfIntegrator.quoteFee() returns (MessagingFee memory fee) {
        uint256 availableFee = address(this).balance;
        
        if (availableFee >= fee.nativeFee) {
          try vrfIntegrator.requestRandomWordsPayable{value: fee.nativeFee}(targetEid) returns (
        MessagingReceipt memory /* receipt */,
        uint64 sequence
      ) {
                    vrfRequests[uint256(sequence)] = VRFRequest({
                        user: trader,
                        amountUSD: swapValueUSD,
                        vrfType: VRFType.CROSS_CHAIN
                    });
      totalLotteryEntries++;
      
                    emit LotteryEntryCreated(trader, swapValueUSD, winChancePPM, uint256(sequence));
                    return uint256(sequence);
    } catch {
      return 0;
    }
            }
    } catch {
            return 0;
  }

      return 0;
    }
    
    /**
     * @notice Request local VRF with proper handling
     */
    function _requestLocalVRF(
        address trader,
        uint256 swapValueUSD,
        uint256 winChancePPM
    ) internal returns (uint256) {
        if (address(localVRFConsumer) == address(0)) {
      return 0;
    }
    
        try localVRFConsumer.requestRandomWords() returns (uint256 requestId) {
            vrfRequests[requestId] = VRFRequest({
                user: trader,
                amountUSD: swapValueUSD,
                vrfType: VRFType.LOCAL
            });
            totalLotteryEntries++;
            
            emit LotteryEntryCreated(trader, swapValueUSD, winChancePPM, requestId);
            return requestId;
    } catch {
      return 0;
    }
  }
  
  /**
     * @notice Local VRF callback - determine lottery winner
     */
    function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external nonReentrant {
        require(msg.sender == address(localVRFConsumer), "Only local VRF consumer");
        require(randomWords.length > 0, "No random words");
        
        VRFRequest memory request = vrfRequests[requestId];
        if (request.user == address(0)) return;
        
        // Clear request
        delete vrfRequests[requestId];
        
        // Calculate win chance
        uint256 winChancePPM = calculateWinChance(request.amountUSD);
        
        // Check if won (random number vs win chance)
        uint256 randomResult = randomWords[0] % 1_000_000; // PPM
        
        if (randomResult < winChancePPM) {
            // Winner!
            uint256 reward = _processWin(request.user, request.amountUSD, requestId);
            emit LotteryResultProcessed(request.user, request.amountUSD, true, reward, requestId);
        } else {
            // Lost - emit result event for transparency
            emit LotteryResultProcessed(request.user, request.amountUSD, false, 0, requestId);
        }
  }

  /**
     * @notice Cross-chain VRF callback - determine lottery winner
     */
    function receiveRandomWords(uint256[] memory randomWords, uint256 sequence) external nonReentrant {
        require(msg.sender == address(vrfIntegrator), "Only VRF integrator");
        require(randomWords.length > 0, "No random words");
        
        VRFRequest memory request = vrfRequests[sequence];
        if (request.user == address(0)) return;
        
        // Clear request
        delete vrfRequests[sequence];
        
        // Calculate win chance
        uint256 winChancePPM = calculateWinChance(request.amountUSD);
        
        // Check if won (random number vs win chance)
        uint256 randomResult = randomWords[0] % 1_000_000; // PPM
        
        if (randomResult < winChancePPM) {
            // Winner!
            uint256 reward = _processWin(request.user, request.amountUSD, sequence);
            emit LotteryResultProcessed(request.user, request.amountUSD, true, reward, sequence);
        } else {
            // Lost - emit result event for transparency
            emit LotteryResultProcessed(request.user, request.amountUSD, false, 0, sequence);
        }
    }
    
    // ================================
    // INTERNAL FUNCTIONS
    // ================================
    
    /**
     * @dev Calculate USD value of DRAGON tokens using oracle
     * @param tokenIn Token address (must be DRAGON token)
     * @param amount Amount of tokens (1e18 decimals)
     * @return usd1e6 USD value with 6 decimals
     */
    function _calculateDragonUSD(address tokenIn, uint256 amount) internal view returns (uint256 usd1e6) {
        // Only works for DRAGON token
        if (tokenIn != dragonToken) return 0;
        if (amount == 0) return 0;
        if (address(primaryOracle) == address(0)) return 0;
        
        // Get DRAGON/USD price from oracle
        (int256 dragonPriceUSD, uint256 timestamp) = primaryOracle.getDragonPrice();
        
        // Validate price
        if (dragonPriceUSD <= 0 || timestamp == 0) return 0;
        
        // Check staleness (use oracle's MAX_STALENESS: 2 hours)
        if (block.timestamp - timestamp > 7200) return 0;  // 2 hours
        
        // Calculate USD value (6 decimals)
        // usd = amount(1e18) * price(1e18) / 1e18 = 1e18
        // Scale to 1e6: / 1e12
        uint256 usd1e18 = (amount * uint256(dragonPriceUSD)) / 1e18;
        usd1e6 = usd1e18 / 1e12;
        
        // Apply multiplier to give users credit for slippage/fees (default 1.05x = 5% bonus)
        if (lotteryConfig.usdMultiplierBps > 0) {
            usd1e6 = (usd1e6 * lotteryConfig.usdMultiplierBps) / BASIS_POINTS;
        }
        
        return usd1e6;
    }
    
    function calculateWinChance(uint256 swapAmountUSD) internal view returns (uint256 winChancePPM) {
        // Linear scaling: $1 = base chance, $1000 = max chance
        if (swapAmountUSD <= lotteryConfig.minSwapAmount) {
            return lotteryConfig.baseWinChance;
        }
        
        // Scale linearly up to max
        uint256 scaledAmount = swapAmountUSD - lotteryConfig.minSwapAmount;
        uint256 maxScale = 1_000_000_000; // $1000 in 6 decimals
        
        if (scaledAmount >= maxScale) {
            return lotteryConfig.maxWinChance;
        }
        
        // Linear interpolation
        uint256 chanceRange = lotteryConfig.maxWinChance - lotteryConfig.baseWinChance;
        winChancePPM = lotteryConfig.baseWinChance + (scaledAmount * chanceRange / maxScale);

        return winChancePPM;
    }
    
    /**
     * @notice Apply DUAL boost to win chance: personal veDRAGON boost + vault gauge boost
     * @param user User address
     * @param baseWinChance Base win chance in PPM
     * @param swapAmountUSD Swap amount in USD (6 decimals)
     * @return boostedWinChance Boosted win chance in PPM
     *
     * Two boost sources:
     * 1. Personal veDRAGON boost (from locking DragonOVault)
     * 2. Vault probability boost (from gauge votes on vaults user holds)
     */
    function _applyVeDRAGONBoost(
    address user,
        uint256 baseWinChance,
    uint256 swapAmountUSD
    ) internal view returns (uint256 boostedWinChance) {
        boostedWinChance = baseWinChance;
        
        // If no boost manager set, return base chance
        if (address(veDRAGONBoostManager) == address(0)) {
            return boostedWinChance;
        }
        
        // === BOOST 1: Personal veDRAGON boost (multiplier on base chance) ===
        try veDRAGONBoostManager.calculateBoost(user) returns (uint256 boostBPS) {
            // boostBPS: 10000 = 1x, 20000 = 2x, etc.
            if (boostBPS > 10000) {
                // Apply boost (cap at 5x for safety)
                uint256 maxBoost = 50000; // 5x max
                boostBPS = boostBPS > maxBoost ? maxBoost : boostBPS;
                
                boostedWinChance = (baseWinChance * boostBPS) / 10000;
            }
    } catch {
            // If boost calculation fails, continue with base chance
        }
        
        // === BOOST 2: Vault gauge probability boost (additive on top of personal boost) ===
        try veDRAGONBoostManager.getTotalProbabilityBoost(user) returns (uint256 vaultBoostBps) {
            // vaultBoostBps is in basis points (e.g., 100 = 1%, 690 = 6.9%)
            // Convert to PPM and add to win chance
            if (vaultBoostBps > 0) {
                // 690 bps = 6.9% = 69000 PPM
                uint256 additionalPPM = vaultBoostBps * 100; // Convert bps to PPM
                boostedWinChance += additionalPPM;
            }
        } catch {
            // If vault boost calculation fails, continue with personal boost only
        }
        
        // Cap at maximum win chance
        if (boostedWinChance > lotteryConfig.maxWinChance) {
            boostedWinChance = lotteryConfig.maxWinChance;
        }
        
        return boostedWinChance;
    }
    
    function _processWin(address user, uint256 swapAmountUSD, uint256 requestId) internal returns (uint256) {
        totalWinners++;
        emit LotteryWinner(user, swapAmountUSD, 0, requestId);
        
        if (registry.isHubChain()) {
            // HUB CHAIN: Broadcast to ALL chains (including self via local payout)
            // 1. Pay local jackpot
            uint256 localPayout = _payoutLocalJackpot(user, uint16(lotteryConfig.rewardPercentage));
            
            // 2. Broadcast to all remote chains
            _broadcastWinnerToRemoteChains(user, uint16(lotteryConfig.rewardPercentage));
            
            return localPayout;
        } else {
            // REMOTE CHAIN: Notify hub, hub will broadcast to all chains (including us)
            // We do NOT pay locally here - we wait for hub's broadcast
            _notifyHubOfWinner(user, uint16(lotteryConfig.rewardPercentage));
            
            // Return 0 - actual payout happens when hub broadcasts back
            return 0;
        }
    }
    
    /**
     * @notice Notify hub chain about a winner (remote chain only)
     * @param winner Address of the winner
     * @param payoutBps Payout percentage in basis points
     */
    function _notifyHubOfWinner(address winner, uint16 payoutBps) internal {
        uint32 hubEid = registry.getEidForChainId(BASE_CHAIN_ID);
        
        bytes memory payload = abi.encode(MSG_TYPE_WINNER_NOTIFY, winner, payoutBps);
        bytes memory options = _buildOptions(hubEid);
        
        address gasReserve = registry.getGasReserve(uint16(block.chainid));
        
        try this._quoteBroadcast(hubEid, payload, options) returns (MessagingFee memory fee) {
            uint256 availableGas = gasReserve != address(0) ? gasReserve.balance : address(this).balance;
            
            if (availableGas >= fee.nativeFee) {
                try this._sendBroadcast{value: fee.nativeFee}(hubEid, payload, options, fee) {
                    emit WinnerNotifiedToHub(winner, payoutBps);
                } catch {
                    // If hub notification fails, fallback to local-only payout
                    _payoutLocalJackpot(winner, payoutBps);
                    emit HubNotificationFailed(winner, "Send failed, paid locally");
                }
            } else {
                // Insufficient gas, fallback to local-only payout
                _payoutLocalJackpot(winner, payoutBps);
                emit HubNotificationFailed(winner, "Insufficient gas, paid locally");
            }
        } catch {
            // Quote failed, fallback to local-only payout
            _payoutLocalJackpot(winner, payoutBps);
            emit HubNotificationFailed(winner, "Quote failed, paid locally");
        }
    }
    
    /**
     * @notice Broadcast winner to all remote chain vaults
     * @param winner Address of the winner
     * @param payoutBps Payout percentage in basis points
     */
    function _broadcastWinnerToRemoteChains(address winner, uint16 payoutBps) internal {
        // Get remote vaults from registry
        (uint32[] memory eids, ) = registry.getRemoteVaults();
        
        if (eids.length == 0) return;
        
        bytes memory payload = abi.encode(winner, payoutBps);
        
        address gasReserve = registry.getGasReserve(uint16(block.chainid));
        
        for (uint i = 0; i < eids.length; i++) {
            uint32 dstEid = eids[i];
            
            // Build options with enforced options (from OAppOptionsType3)
            bytes memory options = _buildOptions(dstEid);
            
            try this._quoteBroadcast(dstEid, payload, options) returns (MessagingFee memory fee) {
                // Check if we have enough gas
                uint256 availableGas = gasReserve != address(0) ? gasReserve.balance : address(this).balance;
                
                if (availableGas >= fee.nativeFee) {
                    try this._sendBroadcast{value: fee.nativeFee}(dstEid, payload, options, fee) {
                        emit WinnerBroadcast(dstEid, winner, payoutBps);
                    } catch {
                        emit CrossChainBroadcastFailed(dstEid, winner, "Send failed");
                    }
                } else {
                    emit CrossChainBroadcastFailed(dstEid, winner, "Insufficient gas");
                }
            } catch {
                emit CrossChainBroadcastFailed(dstEid, winner, "Quote failed");
            }
        }
    }
    
    /**
     * @notice Build options for cross-chain message with enforced options
     * @param dstEid Destination chain endpoint ID
     * @return Combined options (enforced + extra)
     */
    function _buildOptions(uint32 dstEid) internal view returns (bytes memory) {
        // Check if enforced options are set for this destination
        bytes memory enforcedOpts = enforcedOptions[dstEid][MSG_TYPE_WINNER_BROADCAST];
        
        if (enforcedOpts.length > 0) {
            // Use enforced options (already includes gas limit, etc.)
            return enforcedOpts;
        }
        
        // Fallback to default options if no enforced options set
        return OptionsBuilder.newOptions()
            .addExecutorLzReceiveOption(DEFAULT_GAS_LIMIT, DEFAULT_MSG_VALUE);
    }
    
    /**
     * @notice Quote broadcast fee (external for try/catch)
     */
    function _quoteBroadcast(
        uint32 dstEid,
        bytes memory payload,
        bytes memory options
    ) external view returns (MessagingFee memory) {
        return _quote(dstEid, payload, options, false);
    }
    
    /**
     * @notice Send broadcast (external for try/catch)
     */
    function _sendBroadcast(
        uint32 dstEid,
        bytes memory payload,
        bytes memory options,
        MessagingFee memory fee
    ) external payable {
        require(msg.sender == address(this), "Internal only");
        _lzSend(dstEid, payload, options, fee, payable(address(this)));
    }
    
    /**
     * @notice LayerZero receive - handles messages from other chains
     * @dev Two message types:
     *   - MSG_TYPE_WINNER_BROADCAST (from hub): Pay this winner 69% of local jackpot
     *   - MSG_TYPE_WINNER_NOTIFY (from remote): A winner was determined, broadcast to all
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32 /* _guid */,
        bytes calldata _payload,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) internal override {
        // Verify sender is a known peer
        bytes32 senderPeer = peers[_origin.srcEid];
        require(senderPeer != bytes32(0), "Unknown source");
        require(_origin.sender == senderPeer, "Invalid sender");
        
        // Check if payload starts with a message type
        if (_payload.length >= 34) {
            // Try to decode as typed message (msgType, winner, payoutBps)
            (uint16 msgType, address winner, uint16 payoutBps) = abi.decode(_payload, (uint16, address, uint16));
            
            if (msgType == MSG_TYPE_WINNER_NOTIFY && registry.isHubChain()) {
                // Remote chain notified us of a winner
                // Broadcast to ALL chains (including the source and ourselves)
                emit WinnerReceivedFromRemote(_origin.srcEid, winner, payoutBps);
                
                // Pay our local jackpot
                _payoutLocalJackpot(winner, payoutBps);
                
                // Broadcast to all remote chains
                _broadcastWinnerToRemoteChains(winner, payoutBps);
                return;
            }
        }
        
        // Default: Treat as winner broadcast (legacy format or MSG_TYPE_WINNER_BROADCAST)
        // Only remote chains should receive these
        require(!registry.isHubChain(), "Hub doesn't receive broadcasts");
        
        // Decode winner info (address, uint16) - legacy format
        (address winner, uint16 payoutBps) = abi.decode(_payload, (address, uint16));
        
        // Pay out from local jackpot reserve
        _payoutLocalJackpot(winner, payoutBps);
    }
    
    /**
     * @notice Pay out local jackpot to cross-chain winner
     * @param winner Winner address
     * @param payoutBps Payout percentage in basis points (6900 = 69%)
     * @return rewardShares Amount of shares paid out (0 if failed)
     */
    function _payoutLocalJackpot(address winner, uint16 payoutBps) internal returns (uint256) {
        if (address(gaugeController) == address(0)) return 0;
        if (address(dragonOVault) == address(0)) return 0;
        
        address vault = address(dragonOVault);
        uint256 jackpotShares = gaugeController.getJackpotReserve(vault);
        
        if (jackpotShares == 0) return 0;
        
        uint256 rewardShares = (jackpotShares * payoutBps) / BASIS_POINTS;
        
        if (rewardShares > 0) {
            try gaugeController.payJackpot(vault, winner, rewardShares) {
                uint256 rewardDragonValue = dragonOVault.previewRedeem(rewardShares);
                totalRewardsPaid += rewardDragonValue;
                
                emit LotteryWon(
                    0, // No local entry ID for cross-chain wins
                    winner,
                    rewardShares,
                    rewardDragonValue
                );
                emit CrossChainJackpotPaid(winner, rewardShares, rewardDragonValue);
                return rewardShares;
            } catch {
                emit CrossChainPayoutFailed(winner, rewardShares);
                return 0;
            }
        }
        return 0;
    }
    
    // ================================
    // QUOTE FUNCTIONS
    // ================================
    
    /**
     * @notice Quote fee for broadcasting winner to a specific chain
     * @param dstEid Destination chain endpoint ID
     * @param winner Winner address
     * @param payoutBps Payout percentage in basis points
     * @return fee MessagingFee struct with native and LZ token fees
     */
    function quoteWinnerBroadcast(
        uint32 dstEid,
        address winner,
        uint16 payoutBps
    ) external view returns (MessagingFee memory fee) {
        bytes memory payload = abi.encode(winner, payoutBps);
        bytes memory options = _buildOptions(dstEid);
        return _quote(dstEid, payload, options, false);
    }
    
    /**
     * @notice Quote fee for broadcasting winner to all remote chains
     * @param winner Winner address
     * @param payoutBps Payout percentage in basis points
     * @return totalFee Total native fee for all chains
     * @return chainCount Number of chains to broadcast to
     */
    function quoteWinnerBroadcastAll(
        address winner,
        uint16 payoutBps
    ) external view returns (uint256 totalFee, uint256 chainCount) {
        (uint32[] memory eids, ) = registry.getRemoteVaults();
        bytes memory payload = abi.encode(winner, payoutBps);
        
        for (uint i = 0; i < eids.length; i++) {
            bytes memory options = _buildOptions(eids[i]);
            MessagingFee memory fee = _quote(eids[i], payload, options, false);
            totalFee += fee.nativeFee;
        }
        
        return (totalFee, eids.length);
    }
    
    // ================================
    // ADMIN FUNCTIONS
    // ================================
    
    function setAuthorizedSwapContract(address swapContract, bool authorized) external onlyOwner {
        require(swapContract != address(0), "Invalid contract");
        authorizedSwapContracts[swapContract] = authorized;
        emit SwapContractAuthorized(swapContract, authorized);
    }
    
    function setDragonToken(address _dragonToken) external onlyOwner {
        require(_dragonToken != address(0), "Invalid token");
        dragonToken = _dragonToken;
        emit DragonTokenUpdated(_dragonToken);
    }

    function setDragonOVault(address _vault) external onlyOwner {
        require(_vault != address(0), "Invalid vault");
        dragonOVault = IDragonOVault(_vault);
        emit DragonOVaultUpdated(_vault);
    }
    
    function setPrimaryOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle");
        primaryOracle = IOmniDragonChainlinkOracle(_oracle);
        emit PrimaryOracleUpdated(_oracle);
    }
    
    function setVRFIntegrator(address _vrfIntegrator) external onlyOwner {
        require(_vrfIntegrator != address(0), "Invalid VRF integrator");
        vrfIntegrator = IChainlinkVRFIntegratorV2_5(_vrfIntegrator);
        emit VRFIntegratorUpdated(_vrfIntegrator);
    }
    
    function setLocalVRFConsumer(address _localVRFConsumer) external onlyOwner {
        require(_localVRFConsumer != address(0), "Invalid VRF consumer");
        localVRFConsumer = IOmniDragonVRFConsumerV2_5(_localVRFConsumer);
    }
    
    function setTargetEid(uint32 _targetEid) external onlyOwner {
        require(_targetEid > 0, "Invalid EID");
        targetEid = _targetEid;
    }
    
    function setUseLocalVRF(bool _useLocal) external onlyOwner {
        useLocalVRF = _useLocal;
    }
    
    function setVeDRAGONToken(address _veDRAGONToken) external onlyOwner {
        require(_veDRAGONToken != address(0), "Invalid veDRAGON token");
        veDRAGONToken = IERC20(_veDRAGONToken);
    }
    
    function setVeDRAGONBoostManager(address _veDRAGONBoostManager) external onlyOwner {
        require(_veDRAGONBoostManager != address(0), "Invalid boost manager");
        veDRAGONBoostManager = IveDRAGONBoostManager(_veDRAGONBoostManager);
    }
    
    function setLotteryConfig(
        uint256 _minSwap,
        uint256 _rewardPercentage,
        bool _isActive,
        uint256 _baseWinChance,
        uint256 _maxWinChance,
        uint256 _usdMultiplierBps
    ) external onlyOwner {
        require(_minSwap >= MIN_SWAP_USD && _minSwap <= MAX_SWAP_USD, "Invalid min swap");
        require(_rewardPercentage <= BASIS_POINTS, "Invalid reward percentage");
        require(_maxWinChance <= 100_000, "Max chance too high"); // 10% max
        require(_baseWinChance <= _maxWinChance, "Base > max");
        require(_usdMultiplierBps >= 10000 && _usdMultiplierBps <= 15000, "Multiplier must be 1x-1.5x");
        
        lotteryConfig.minSwapAmount = _minSwap;
        lotteryConfig.rewardPercentage = _rewardPercentage;
        lotteryConfig.isActive = _isActive;
        lotteryConfig.baseWinChance = _baseWinChance;
        lotteryConfig.maxWinChance = _maxWinChance;
        lotteryConfig.usdMultiplierBps = _usdMultiplierBps;
        
        emit LotteryConfigUpdated(_minSwap, _rewardPercentage, _isActive);
    }
    
    /**
     * @notice Set enforced options for a specific chain
     * @dev OAppOptionsType3 stores enforced options per (eid, msgType)
     * @param dstEid Destination chain endpoint ID
     * @param gasLimit Gas limit for execution on destination
     * @param msgValue Native value to send with message
     */
    function setWinnerBroadcastOptions(
        uint32 dstEid,
        uint128 gasLimit,
        uint128 msgValue
    ) external onlyOwner {
        bytes memory options = OptionsBuilder.newOptions()
            .addExecutorLzReceiveOption(gasLimit, msgValue);
        
        EnforcedOptionParam[] memory params = new EnforcedOptionParam[](1);
        params[0] = EnforcedOptionParam({
            eid: dstEid,
            msgType: MSG_TYPE_WINNER_BROADCAST,
            options: options
        });
        
        _setEnforcedOptions(params);
    }
    
    /**
     * @notice Set enforced options for all remote chains
     * @param gasLimit Gas limit for execution on destination
     * @param msgValue Native value to send with message
     */
    function setWinnerBroadcastOptionsAll(
        uint128 gasLimit,
        uint128 msgValue
    ) external onlyOwner {
        (uint32[] memory eids, ) = registry.getRemoteVaults();
        
        if (eids.length == 0) return;
        
        EnforcedOptionParam[] memory params = new EnforcedOptionParam[](eids.length);
        
        bytes memory options = OptionsBuilder.newOptions()
            .addExecutorLzReceiveOption(gasLimit, msgValue);
        
        for (uint i = 0; i < eids.length; i++) {
            params[i] = EnforcedOptionParam({
                eid: eids[i],
                msgType: MSG_TYPE_WINNER_BROADCAST,
                options: options
            });
        }
        
        _setEnforcedOptions(params);
    }
    
    function pause() external onlyOwner {
        _pause();
    }

  function unpause() external onlyOwner {
    _unpause();
  }

    // ================================
    // VIEW FUNCTIONS
    // ================================
    
    function getWinChance(uint256 swapAmountUSD) external view returns (uint256) {
        return calculateWinChance(swapAmountUSD);
    }
    
    function getLotteryStats() external view returns (
        uint256 entries,
        uint256 winners,
        uint256 totalRewards,
        uint256 jackpotBalance
    ) {
        // Get jackpot balance from GaugeController reserve
        address vault = address(dragonOVault);
        uint256 jackpotShares = gaugeController.getJackpotReserve(vault);
        jackpotBalance = dragonOVault.previewRedeem(jackpotShares);
        
    return (
            totalLotteryEntries,
            totalWinners,
            totalRewardsPaid,
            jackpotBalance
        );
    }
    
    // ================================
    // EMERGENCY FUNCTIONS
    // ================================
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool ok, ) = payable(owner()).call{value: amount}("");
            require(ok, "Transfer failed");
        } else {
            SafeERC20.safeTransfer(IERC20(token), owner(), amount);
        }
    }
    
  receive() external payable {
        // Accept ETH for VRF fees
  }
}
