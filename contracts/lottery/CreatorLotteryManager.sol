// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CreatorLotteryManager
 * @author 0xakita.eth (CreatorVault)
 * @notice SHARED swap-based lottery service for ALL Creator Coins
 * 
 * @dev ARCHITECTURE:
 *      This is a SHARED service deployed once per chain.
 *      It serves ALL Creator Coins by looking up their contracts from the registry.
 * 
 * @dev LOTTERY MECHANICS:
 *      1. User trades ANY share token (■AKITA, ■DRAGON, etc) → lottery entry created
 *      2. Win probability scales with trade size ($1 = base, $1000 = max)
 *      3. sToken holders get boosted win chances
 *      4. Winners receive % from ALL active creator vaults (diversified prize!)
 *      5. Winners are broadcast to ALL chains via LayerZero
 * 
 * @dev MULTI-TOKEN PRIZE PAYOUT:
 *      Winner gets shares from EVERY active creator vault:
 *        - ■AKITA shares (69% of AKITA vault jackpot)
 *        - wsDRAGON shares (69% of DRAGON vault jackpot)
 *        - wsXYZ shares (69% of XYZ vault jackpot)
 *        - ... etc for ALL active creators
 *      Result: Winner gets a diversified portfolio of ALL creator tokens! 🎁
 * 
 * @dev CROSS-CHAIN FLOW (Hub = Base):
 *      Winner on Base:
 *        1. Pay from ALL local vaults
 *        2. Broadcast to all remote chains
 *      
 *      Winner on Remote:
 *        1. Notify hub (Base)
 *        2. Hub broadcasts to ALL chains (including source)
 *        3. Each chain pays from ALL their local vaults
 */

import {OApp, Origin, MessagingFee} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {OAppOptionsType3} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import {EnforcedOptionParam} from "@layerzerolabs/oapp-evm/contracts/oapp/interfaces/IOAppOptionsType3.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {MessagingReceipt} from "@layerzerolabs/lz-evm-protocol-v2/contracts/interfaces/ILayerZeroEndpointV2.sol";
import {ICreatorOracle} from "../interfaces/oracles/ICreatorOracle.sol";

// ================================
// INTERFACES
// ================================

interface ICreatorRegistryLottery {
    function getLayerZeroEndpoint(uint16 _chainId) external view returns (address);
    function getEidForChainId(uint256 _chainId) external view returns (uint32);
    function getSupportedChains() external view returns (uint16[] memory);
    function isHubChain() external view returns (bool);
    function getGasReserve(uint16 chainId) external view returns (address);
    function getRemoteVaults() external view returns (uint32[] memory eids, address[] memory vaults);
    
    // Per-creator lookups
    function getVaultForToken(address _token) external view returns (address);
    function getShareOFTForToken(address _token) external view returns (address);
    function getTokenForShareOFT(address _shareOFT) external view returns (address);
    function getOracleForToken(address _token) external view returns (address);
    function getGaugeControllerForToken(address _token) external view returns (address);
    function isCreatorCoinRegistered(address _token) external view returns (bool);
    function isCreatorCoinActive(address _token) external view returns (bool);
    function getLotteryManager(uint16 _chainId) external view returns (address);
    
    // Global queries
    function getAllCreatorCoins() external view returns (address[] memory);
}

interface ICreatorGaugeController {
    function getJackpotReserve(address vault) external view returns (uint256);
    function payJackpot(address vault, address winner, uint256 shares) external;
}

interface ICreatorOVault {
    function previewRedeem(uint256 shares) external view returns (uint256);
}

interface ICreatorVRFConsumer {
    function requestRandomWords() external returns (uint256 requestId);
}

interface IChainlinkVRFIntegrator {
    function quoteFee() external view returns (MessagingFee memory);
    function requestRandomWordsPayable(uint32 targetEid) external payable returns (MessagingReceipt memory, uint64);
}

interface IveAKITABoostManager {
    function calculateBoost(address user) external view returns (uint256 boostBps);
    function getTotalProbabilityBoost(address user) external view returns (uint256 boostBps);
    function hasBoost(address user) external view returns (bool);
}

interface IVaultGaugeVoting {
    /// @notice Vault's vote-directed probability boost (PPM) from the global gauge budget.
    function getVaultGaugeProbabilityBoostPPM(address vault) external view returns (uint256);
}

contract CreatorLotteryManager is OApp, OAppOptionsType3, ReentrancyGuard, Pausable {
    using OptionsBuilder for bytes;
    using SafeERC20 for IERC20;

    // ================================
    // CONSTANTS
    // ================================

    uint256 public constant MIN_SWAP_USD = 1_000_000;      // $1 (6 decimals)
    uint256 public constant MAX_SWAP_USD = 1_000_000_000_000; // $1M
    uint256 public constant BASIS_POINTS = 10_000;
    uint256 public constant BASE_CHAIN_ID = 8453;

    uint16 public constant MSG_TYPE_WINNER_BROADCAST = 1;
    uint16 public constant MSG_TYPE_WINNER_NOTIFY = 2;

    uint128 public constant DEFAULT_GAS_LIMIT = 200_000;
    uint128 public constant DEFAULT_MSG_VALUE = 0;
    
    /// @notice Maximum boost for veAKITA lockers (2.5x = 25000 bps)
    uint256 public constant MAX_VE_BOOST = 25000;

    // ================================
    // STATE - SHARED SERVICE
    // ================================

    /// @notice Registry for looking up per-creator contracts
    ICreatorRegistryLottery public immutable registry;
    
    /// @notice Authorized swap contracts that can trigger lottery
    mapping(address => bool) public authorizedSwapContracts;

    /// @notice VRF providers (shared across all creators)
    ICreatorVRFConsumer public localVRFConsumer;
    IChainlinkVRFIntegrator public vrfIntegrator;
    uint32 public targetEid;
    bool public useLocalVRF;

    /// @notice Boost manager for veAKITA lockers
    IveAKITABoostManager public boostManager;

    /// @notice VaultGaugeVoting for ve(3,3) vault probability direction
    IVaultGaugeVoting public vaultGaugeVoting;

    /// @notice Minimum vault weight in bps (vaults with 0 votes get this minimum)
    uint256 public minVaultWeightBps = 100; // 1% minimum

    /// @notice Lottery configuration (shared across all creators)
    struct LotteryConfig {
        uint256 minSwapAmount;
        uint256 rewardPercentage;  // bps of jackpot
        bool isActive;
        uint256 baseWinChance;     // PPM (parts per million)
        uint256 maxWinChance;      // PPM
        uint256 usdMultiplierBps;  // Bonus for slippage (10500 = 1.05x)
    }

    LotteryConfig public lotteryConfig;

    /// @notice VRF request tracking - now includes creator coin
    enum VRFType { LOCAL, CROSS_CHAIN }

    struct VRFRequest {
        address user;
        address creatorCoin;     // Which creator coin this entry is for
        uint256 amountUSD;
        VRFType vrfType;
    }

    mapping(uint256 => VRFRequest) public vrfRequests;

    /// @notice Global statistics
    uint256 public totalLotteryEntries;
    uint256 public totalWinners;
    uint256 public totalRewardsPaid;
    
    /// @notice Per-creator statistics
    struct CreatorStats {
        uint256 entries;
        uint256 winners;
        uint256 rewardsPaid;
    }
    mapping(address => CreatorStats) public creatorStats;

    // ================================
    // EVENTS
    // ================================

    event LotteryEntryCreated(
        address indexed creatorCoin,
        address indexed user, 
        uint256 swapAmountUSD, 
        uint256 winChancePPM, 
        uint256 requestId
    );
    event LotteryWinner(
        address indexed creatorCoin,
        address indexed user, 
        uint256 swapAmountUSD, 
        uint256 rewardAmount, 
        uint256 requestId
    );
    event LotteryResultProcessed(
        address indexed creatorCoin,
        address indexed user, 
        uint256 swapAmountUSD, 
        bool won, 
        uint256 rewardAmount, 
        uint256 requestId
    );
    event SwapContractAuthorized(address indexed swapContract, bool authorized);
    event LotteryConfigUpdated(uint256 minSwap, uint256 rewardPercentage, bool isActive);
    event WinnerBroadcast(uint32 indexed dstEid, address indexed creatorCoin, address indexed winner, uint16 payoutBps);
    event CrossChainBroadcastFailed(uint32 indexed dstEid, address indexed winner, string reason);
    event CrossChainJackpotPaid(address indexed creatorCoin, address indexed winner, uint256 shares, uint256 tokenValue);
    event CrossChainPayoutFailed(address indexed winner, uint256 attemptedShares);
    event LotteryWon(address indexed creatorCoin, uint256 indexed entryId, address indexed winner, uint256 shares, uint256 tokenValue);
    event MultiTokenJackpotWon(address indexed triggeringCoin, address indexed winner, uint256 numVaultsPaid);
    event WinnerNotifiedToHub(address indexed creatorCoin, address indexed winner, uint16 payoutBps);
    event HubNotificationFailed(address indexed winner, string reason);
    event WinnerReceivedFromRemote(uint32 indexed srcEid, address indexed creatorCoin, address indexed winner, uint16 payoutBps);
    event VRFConsumerUpdated(address indexed consumer);
    event BoostManagerUpdated(address indexed manager);
    event VaultGaugeVotingUpdated(address indexed vaultGaugeVoting);
    event MinVaultWeightUpdated(uint256 minWeightBps);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error Unauthorized();
    error InvalidAmount();
    error CreatorCoinNotRegistered(address token);
    error NoOracleConfigured(address token);
    error NoVaultConfigured(address token);
    error NoGaugeConfigured(address token);

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Deploy shared lottery manager
     * @param _registry CreatorRegistry address
     * @param _owner Owner address
     */
    constructor(
        address _registry,
        address _owner
    ) OApp(
        ICreatorRegistryLottery(_registry).getLayerZeroEndpoint(uint16(block.chainid)),
        _owner
    ) Ownable(_owner) {
        if (_owner == address(0)) revert ZeroAddress();
        if (_registry == address(0)) revert ZeroAddress();

        registry = ICreatorRegistryLottery(_registry);

        // Initialize lottery config
        lotteryConfig = LotteryConfig({
            minSwapAmount: MIN_SWAP_USD,
            rewardPercentage: 6900, // 69% of jackpot
            isActive: true,
            baseWinChance: 40,      // 0.004%
            maxWinChance: 40000,    // 4%
            usdMultiplierBps: 10500 // 1.05x
        });
    }

    // ================================
    // MODIFIERS
    // ================================

    modifier onlyAuthorizedSwapContract() {
        if (!authorizedSwapContracts[msg.sender]) revert Unauthorized();
        _;
    }

    // ================================
    // MAIN LOTTERY FUNCTION
    // ================================

    /**
     * @notice Process swap-based lottery entry for ANY Creator Coin
     * @param buyer User who made the swap (from tx.origin)
     * @param tokenIn Token swapped (wsToken/ShareOFT)
     * @param amountIn Amount swapped
     * @return entryId VRF request ID (0 if no entry)
     */
    function processSwapLottery(
        address buyer,
        address tokenIn,
        uint256 amountIn
    ) external payable nonReentrant onlyAuthorizedSwapContract whenNotPaused returns (uint256 entryId) {
        if (buyer == address(0)) revert ZeroAddress();
        if (tokenIn == address(0)) revert ZeroAddress();
        if (amountIn == 0) revert InvalidAmount();
        
        // Derive creator coin from tokenIn (wsToken)
        address creatorCoin = registry.getTokenForShareOFT(tokenIn);
        if (creatorCoin == address(0)) {
            // Silently skip unregistered tokens (no lottery entry)
            return 0;
        }
        
        // Verify creator coin is registered AND active
        if (!registry.isCreatorCoinActive(creatorCoin)) {
            // Silently skip inactive/unregistered creators (no lottery entry)
            return 0;
        }

        // Calculate USD value using per-creator oracle
        uint256 swapValueUSD = _calculateTokenUSD(creatorCoin, tokenIn, amountIn);

        if (swapValueUSD < lotteryConfig.minSwapAmount) {
            return 0;
        }

        if (!lotteryConfig.isActive) {
            return 0;
        }

        // Get vault for this creator coin (for ve(3,3) vault weighting)
        address vault = registry.getVaultForToken(creatorCoin);

        // Calculate win probability with ve(3,3) boosts
        uint256 baseWinChance = calculateWinChance(swapValueUSD);
        uint256 boostedWinChance = _applyBoost(buyer, vault, swapValueUSD, baseWinChance);

        // Request VRF
        if (useLocalVRF && address(localVRFConsumer) != address(0)) {
            return _requestLocalVRF(creatorCoin, buyer, swapValueUSD, boostedWinChance);
        } else {
            return _requestCrossChainVRF(creatorCoin, buyer, swapValueUSD, boostedWinChance);
        }
    }

    /**
     * @notice Request cross-chain VRF
     */
    function _requestCrossChainVRF(
        address creatorCoin,
        address buyer,
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
                    MessagingReceipt memory,
                    uint64 sequence
                ) {
                    vrfRequests[uint256(sequence)] = VRFRequest({
                        user: buyer,
                        creatorCoin: creatorCoin,
                        amountUSD: swapValueUSD,
                        vrfType: VRFType.CROSS_CHAIN
                    });
                    totalLotteryEntries++;
                    creatorStats[creatorCoin].entries++;

                    emit LotteryEntryCreated(creatorCoin, buyer, swapValueUSD, winChancePPM, uint256(sequence));
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
     * @notice Request local VRF
     */
    function _requestLocalVRF(
        address creatorCoin,
        address buyer,
        uint256 swapValueUSD,
        uint256 winChancePPM
    ) internal returns (uint256) {
        if (address(localVRFConsumer) == address(0)) {
            return 0;
        }

        try localVRFConsumer.requestRandomWords() returns (uint256 requestId) {
            vrfRequests[requestId] = VRFRequest({
                user: buyer,
                creatorCoin: creatorCoin,
                amountUSD: swapValueUSD,
                vrfType: VRFType.LOCAL
            });
            totalLotteryEntries++;
            creatorStats[creatorCoin].entries++;

            emit LotteryEntryCreated(creatorCoin, buyer, swapValueUSD, winChancePPM, requestId);
            return requestId;
        } catch {
            return 0;
        }
    }

    // ================================
    // VRF CALLBACKS
    // ================================

    /**
     * @notice Local VRF callback
     */
    function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external nonReentrant {
        require(msg.sender == address(localVRFConsumer), "Only VRF consumer");
        _processVRFResult(requestId, randomWords);
    }

    /**
     * @notice Cross-chain VRF callback
     */
    function receiveRandomWords(uint256[] memory randomWords, uint256 sequence) external nonReentrant {
        require(msg.sender == address(vrfIntegrator), "Only VRF integrator");
        _processVRFResult(sequence, randomWords);
    }

    function _processVRFResult(uint256 requestId, uint256[] memory randomWords) internal {
        if (randomWords.length == 0) return;

        VRFRequest memory request = vrfRequests[requestId];
        if (request.user == address(0)) return;

        delete vrfRequests[requestId];

        uint256 winChancePPM = calculateWinChance(request.amountUSD);
        uint256 randomResult = randomWords[0] % 1_000_000;

        if (randomResult < winChancePPM) {
            uint256 reward = _processWin(request.creatorCoin, request.user, request.amountUSD, requestId);
            emit LotteryResultProcessed(request.creatorCoin, request.user, request.amountUSD, true, reward, requestId);
        } else {
            emit LotteryResultProcessed(request.creatorCoin, request.user, request.amountUSD, false, 0, requestId);
        }
    }

    // ================================
    // INTERNAL FUNCTIONS
    // ================================

    /**
     * @notice Calculate USD value of tokens using per-creator oracle
     */
    function _calculateTokenUSD(
        address creatorCoin,
        address tokenIn,
        uint256 amount
    ) internal view returns (uint256 usd1e6) {
        // Get per-creator oracle
        address oracleAddr = registry.getOracleForToken(creatorCoin);
        if (oracleAddr == address(0)) return 0;
        
        // Get per-creator shareOFT
        address shareOFT = registry.getShareOFTForToken(creatorCoin);
        
        // Only works for creator token or its shareOFT
        if (tokenIn != creatorCoin && tokenIn != shareOFT) return 0;
        if (amount == 0) return 0;

        ICreatorOracle oracle = ICreatorOracle(oracleAddr);
        (int256 priceUSD, uint256 timestamp) = oracle.getCreatorPrice();
        if (priceUSD <= 0 || timestamp == 0) return 0;
        if (block.timestamp - timestamp > 7200) return 0;

        // forge-lint: disable-next-line(unsafe-typecast)
        uint256 usd1e18 = (amount * uint256(priceUSD)) / 1e18;
        usd1e6 = usd1e18 / 1e12;

        if (lotteryConfig.usdMultiplierBps > 0) {
            usd1e6 = (usd1e6 * lotteryConfig.usdMultiplierBps) / BASIS_POINTS;
        }
    }

    function calculateWinChance(uint256 swapAmountUSD) public view returns (uint256 winChancePPM) {
        if (swapAmountUSD <= lotteryConfig.minSwapAmount) {
            return lotteryConfig.baseWinChance;
        }

        uint256 scaledAmount = swapAmountUSD - lotteryConfig.minSwapAmount;
        uint256 maxScale = 1_000_000_000; // $1000

        if (scaledAmount >= maxScale) {
            return lotteryConfig.maxWinChance;
        }

        uint256 chanceRange = lotteryConfig.maxWinChance - lotteryConfig.baseWinChance;
        winChancePPM = lotteryConfig.baseWinChance + (scaledAmount * chanceRange / maxScale);
    }

    /**
     * @notice Apply ve(3,3) boosts to base win probability
     * @param user The user who made the swap
     * @param vault The vault where the swap occurred (for gauge allocation)
     * @param swapAmountUSD Swap size in USD (1e6)
     * @param baseWinChance Base win chance in PPM
     * @return boostedWinChance Final win chance after all boosts
     *
     * @dev ve(3,3) PROBABILITY MODEL (current implementation):
     *      FinalPPM = BasePPM × PersonalBoost + LockDurationBoostPPM + VaultGaugeBoostPPM
     *
     * Where:
     * - BasePPM: derived from swap size
     * - PersonalBoost: veAKITA (up to 2.5x)
     * - LockDurationBoostPPM: additional additive boost from lock duration
     * - VaultGaugeBoostPPM: additive boost allocated from a bounded weekly gauge budget
     */
    function _applyBoost(
        address user,
        address vault,
        uint256 swapAmountUSD,
        uint256 baseWinChance
    ) internal view returns (uint256 boostedWinChance) {
        boostedWinChance = baseWinChance;

        // STEP 1: Apply personal veAKITA boost (up to 2.5x)
        if (address(boostManager) != address(0)) {
            try boostManager.calculateBoost(user) returns (uint256 boostBPS) {
                if (boostBPS > 10000) {
                    boostBPS = boostBPS > MAX_VE_BOOST ? MAX_VE_BOOST : boostBPS;
                    boostedWinChance = (baseWinChance * boostBPS) / 10000;
                }
            } catch {}

            // Additional probability boost from lock duration
            try boostManager.getTotalProbabilityBoost(user) returns (uint256 probBoostBps) {
                if (probBoostBps > 0) {
                    uint256 additionalPPM = probBoostBps * 100;
                    boostedWinChance += additionalPPM;
                }
            } catch {}
        }

        // STEP 2: Add vault gauge boost (vote-directed probability budget)
        // The gauge returns a bounded PPM boost for this vault. We scale it by swap size so
        // tiny swaps don't fully capture the weekly budget (anti-spam).
        if (address(vaultGaugeVoting) != address(0) && vault != address(0)) {
            try vaultGaugeVoting.getVaultGaugeProbabilityBoostPPM(vault) returns (uint256 gaugeBoostPPM) {
                if (gaugeBoostPPM > 0) {
                    boostedWinChance += _scaleGaugeBoostBySwapSize(gaugeBoostPPM, swapAmountUSD);
                }
            } catch {}
        }

        // Cap at maximum
        if (boostedWinChance > lotteryConfig.maxWinChance) {
            boostedWinChance = lotteryConfig.maxWinChance;
        }
    }

    function _scaleGaugeBoostBySwapSize(uint256 gaugeBoostPPM, uint256 swapAmountUSD) internal view returns (uint256) {
        // Mirror the same linear scaling region used by calculateWinChance()
        uint256 minSwap = lotteryConfig.minSwapAmount;
        if (swapAmountUSD <= minSwap) return 0;

        uint256 scaledAmount = swapAmountUSD - minSwap;
        uint256 maxScale = 1_000_000_000; // $1000 (6 decimals)
        if (scaledAmount >= maxScale) return gaugeBoostPPM;

        // Linear ramp from 0 → full boost over the first $1000 above minSwap
        return (gaugeBoostPPM * scaledAmount) / maxScale;
    }

    function _processWin(
        address creatorCoin,
        address user,
        uint256 swapAmountUSD,
        uint256 requestId
    ) internal returns (uint256) {
        totalWinners++;
        creatorStats[creatorCoin].winners++;
        emit LotteryWinner(creatorCoin, user, swapAmountUSD, 0, requestId);

        if (registry.isHubChain()) {
            uint256 localPayout = _payoutLocalJackpot(creatorCoin, user, uint16(lotteryConfig.rewardPercentage));
            _broadcastWinnerToRemoteChains(creatorCoin, user, uint16(lotteryConfig.rewardPercentage));
            return localPayout;
        } else {
            _notifyHubOfWinner(creatorCoin, user, uint16(lotteryConfig.rewardPercentage));
            return 0;
        }
    }

    // ================================
    // CROSS-CHAIN MESSAGING
    // ================================

    function _notifyHubOfWinner(address creatorCoin, address winner, uint16 payoutBps) internal {
        uint32 hubEid = registry.getEidForChainId(BASE_CHAIN_ID);

        bytes memory payload = abi.encode(MSG_TYPE_WINNER_NOTIFY, creatorCoin, winner, payoutBps);
        bytes memory options = _buildOptions(hubEid);

        address gasReserve = registry.getGasReserve(uint16(block.chainid));

        try this._quoteBroadcast(hubEid, payload, options) returns (MessagingFee memory fee) {
            uint256 availableGas = gasReserve != address(0) ? gasReserve.balance : address(this).balance;

            if (availableGas >= fee.nativeFee) {
                try this._sendBroadcast{value: fee.nativeFee}(hubEid, payload, options, fee) {
                    emit WinnerNotifiedToHub(creatorCoin, winner, payoutBps);
                } catch {
                    _payoutLocalJackpot(creatorCoin, winner, payoutBps);
                    emit HubNotificationFailed(winner, "Send failed");
                }
            } else {
                _payoutLocalJackpot(creatorCoin, winner, payoutBps);
                emit HubNotificationFailed(winner, "Insufficient gas");
            }
        } catch {
            _payoutLocalJackpot(creatorCoin, winner, payoutBps);
            emit HubNotificationFailed(winner, "Quote failed");
        }
    }

    function _broadcastWinnerToRemoteChains(address creatorCoin, address winner, uint16 payoutBps) internal {
        (uint32[] memory eids, ) = registry.getRemoteVaults();
        if (eids.length == 0) return;

        bytes memory payload = abi.encode(creatorCoin, winner, payoutBps);
        address gasReserve = registry.getGasReserve(uint16(block.chainid));

        for (uint i = 0; i < eids.length; i++) {
            uint32 dstEid = eids[i];
            bytes memory options = _buildOptions(dstEid);

            try this._quoteBroadcast(dstEid, payload, options) returns (MessagingFee memory fee) {
                uint256 availableGas = gasReserve != address(0) ? gasReserve.balance : address(this).balance;

                if (availableGas >= fee.nativeFee) {
                    try this._sendBroadcast{value: fee.nativeFee}(dstEid, payload, options, fee) {
                        emit WinnerBroadcast(dstEid, creatorCoin, winner, payoutBps);
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

    function _buildOptions(uint32 dstEid) internal view returns (bytes memory) {
        bytes memory enforcedOpts = enforcedOptions[dstEid][MSG_TYPE_WINNER_BROADCAST];

        if (enforcedOpts.length > 0) {
            return enforcedOpts;
        }

        return OptionsBuilder.newOptions()
            .addExecutorLzReceiveOption(DEFAULT_GAS_LIMIT, DEFAULT_MSG_VALUE);
    }

    function _quoteBroadcast(
        uint32 dstEid,
        bytes memory payload,
        bytes memory options
    ) external view returns (MessagingFee memory) {
        return _quote(dstEid, payload, options, false);
    }

    function _sendBroadcast(
        uint32 dstEid,
        bytes memory payload,
        bytes memory options,
        MessagingFee memory fee
    ) external payable {
        require(msg.sender == address(this), "Internal only");
        _lzSend(dstEid, payload, options, fee, payable(address(this)));
    }

    function _lzReceive(
        Origin calldata _origin,
        bytes32,
        bytes calldata _payload,
        address,
        bytes calldata
    ) internal override {
        bytes32 senderPeer = peers[_origin.srcEid];
        require(senderPeer != bytes32(0), "Unknown source");
        require(_origin.sender == senderPeer, "Invalid sender");

        // Check for winner notify message (from remote to hub)
        if (_payload.length >= 66) {
            // Try to decode as notify message first
            (uint16 msgType, address notifyCreatorCoin, address notifyWinner, uint16 notifyPayoutBps) = abi.decode(
                _payload, 
                (uint16, address, address, uint16)
            );

            if (msgType == MSG_TYPE_WINNER_NOTIFY && registry.isHubChain()) {
                emit WinnerReceivedFromRemote(_origin.srcEid, notifyCreatorCoin, notifyWinner, notifyPayoutBps);
                _payoutLocalJackpot(notifyCreatorCoin, notifyWinner, notifyPayoutBps);
                _broadcastWinnerToRemoteChains(notifyCreatorCoin, notifyWinner, notifyPayoutBps);
                return;
            }
        }

        require(!registry.isHubChain(), "Hub doesn't receive broadcasts");

        // Decode as broadcast message (hub to remote)
        (address broadcastCreatorCoin, address broadcastWinner, uint16 broadcastPayoutBps) = abi.decode(
            _payload, 
            (address, address, uint16)
        );
        _payoutLocalJackpot(broadcastCreatorCoin, broadcastWinner, broadcastPayoutBps);
    }

    /**
     * @notice Pay jackpot from ALL active creator vaults (multi-token prize!)
     * @param triggeringCoin The creator coin that triggered the lottery
     * @param winner The lottery winner
     * @param payoutBps Percentage of each vault's jackpot to pay (6900 = 69%)
     * @return totalPaidOut Total number of vaults that paid out
     */
    function _payoutLocalJackpot(
        address triggeringCoin,
        address winner,
        uint16 payoutBps
    ) internal returns (uint256) {
        // Get ALL registered creator coins
        address[] memory allCreators = registry.getAllCreatorCoins();
        uint256 totalPaidOut = 0;
        
        // Pay from EVERY active creator vault
        for (uint256 i = 0; i < allCreators.length; i++) {
            address creatorCoin = allCreators[i];
            
            // Skip inactive creators
            if (!registry.isCreatorCoinActive(creatorCoin)) continue;
            
            // Look up per-creator contracts
            address vaultAddr = registry.getVaultForToken(creatorCoin);
            address gaugeAddr = registry.getGaugeControllerForToken(creatorCoin);
            
            if (vaultAddr == address(0) || gaugeAddr == address(0)) continue;

            ICreatorGaugeController gaugeController = ICreatorGaugeController(gaugeAddr);
            ICreatorOVault vault = ICreatorOVault(vaultAddr);
            
            uint256 jackpotShares = gaugeController.getJackpotReserve(vaultAddr);

            if (jackpotShares == 0) continue;

            uint256 rewardShares = (jackpotShares * payoutBps) / BASIS_POINTS;

            if (rewardShares > 0) {
                try gaugeController.payJackpot(vaultAddr, winner, rewardShares) {
                    uint256 rewardValue = vault.previewRedeem(rewardShares);
                    totalRewardsPaid += rewardValue;
                    creatorStats[creatorCoin].rewardsPaid += rewardValue;
                    totalPaidOut++;

                    emit LotteryWon(creatorCoin, 0, winner, rewardShares, rewardValue);
                    emit CrossChainJackpotPaid(creatorCoin, winner, rewardShares, rewardValue);
                } catch {
                    emit CrossChainPayoutFailed(winner, rewardShares);
                    // Continue to next vault even if one fails
                }
            }
        }
        
        // Emit special event for multi-token win
        if (totalPaidOut > 0) {
            emit MultiTokenJackpotWon(triggeringCoin, winner, totalPaidOut);
        }
        
        return totalPaidOut;
    }

    // ================================
    // ADMIN FUNCTIONS
    // ================================

    function setAuthorizedSwapContract(address swapContract, bool authorized) external onlyOwner {
        if (swapContract == address(0)) revert ZeroAddress();
        authorizedSwapContracts[swapContract] = authorized;
        emit SwapContractAuthorized(swapContract, authorized);
    }

    function setLocalVRFConsumer(address _consumer) external onlyOwner {
        localVRFConsumer = ICreatorVRFConsumer(_consumer);
        emit VRFConsumerUpdated(_consumer);
    }

    function setVRFIntegrator(address _integrator) external onlyOwner {
        vrfIntegrator = IChainlinkVRFIntegrator(_integrator);
    }

    function setTargetEid(uint32 _eid) external onlyOwner {
        targetEid = _eid;
    }

    function setUseLocalVRF(bool _useLocal) external onlyOwner {
        useLocalVRF = _useLocal;
    }

    function setBoostManager(address _manager) external onlyOwner {
        boostManager = IveAKITABoostManager(_manager);
        emit BoostManagerUpdated(_manager);
    }

    /**
     * @notice Set VaultGaugeVoting for ve(3,3) probability direction
     * @param _vaultGaugeVoting Address of the VaultGaugeVoting contract
     */
    function setVaultGaugeVoting(address _vaultGaugeVoting) external onlyOwner {
        vaultGaugeVoting = IVaultGaugeVoting(_vaultGaugeVoting);
        emit VaultGaugeVotingUpdated(_vaultGaugeVoting);
    }

    /**
     * @notice Set minimum vault weight in bps
     * @param _minWeightBps Minimum weight (e.g., 100 = 1%)
     */
    function setMinVaultWeightBps(uint256 _minWeightBps) external onlyOwner {
        require(_minWeightBps <= 1000, "Max 10%"); // Cap at 10%
        minVaultWeightBps = _minWeightBps;
        emit MinVaultWeightUpdated(_minWeightBps);
    }

    function setLotteryConfig(
        uint256 _minSwap,
        uint256 _rewardPercentage,
        bool _isActive,
        uint256 _baseWinChance,
        uint256 _maxWinChance,
        uint256 _usdMultiplierBps
    ) external onlyOwner {
        require(_minSwap >= MIN_SWAP_USD && _minSwap <= MAX_SWAP_USD, "Invalid min");
        require(_rewardPercentage <= BASIS_POINTS, "Invalid reward");
        require(_maxWinChance <= 100_000, "Max too high");
        require(_baseWinChance <= _maxWinChance, "Base > max");
        require(_usdMultiplierBps >= 10000 && _usdMultiplierBps <= 15000, "Invalid multiplier");

        lotteryConfig.minSwapAmount = _minSwap;
        lotteryConfig.rewardPercentage = _rewardPercentage;
        lotteryConfig.isActive = _isActive;
        lotteryConfig.baseWinChance = _baseWinChance;
        lotteryConfig.maxWinChance = _maxWinChance;
        lotteryConfig.usdMultiplierBps = _usdMultiplierBps;

        emit LotteryConfigUpdated(_minSwap, _rewardPercentage, _isActive);
    }

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

    /**
     * @notice Get global lottery stats
     */
    function getGlobalStats() external view returns (
        uint256 entries,
        uint256 winners,
        uint256 rewards
    ) {
        return (totalLotteryEntries, totalWinners, totalRewardsPaid);
    }

    /**
     * @notice Get lottery stats for a specific creator coin
     */
    function getCreatorLotteryStats(address creatorCoin) external view returns (
        uint256 entries,
        uint256 winners,
        uint256 rewardsPaid,
        uint256 jackpotBalance
    ) {
        CreatorStats storage stats = creatorStats[creatorCoin];
        
        // Get jackpot balance from per-creator contracts
        address vaultAddr = registry.getVaultForToken(creatorCoin);
        address gaugeAddr = registry.getGaugeControllerForToken(creatorCoin);
        
        if (vaultAddr != address(0) && gaugeAddr != address(0)) {
            ICreatorGaugeController gaugeController = ICreatorGaugeController(gaugeAddr);
            ICreatorOVault vault = ICreatorOVault(vaultAddr);
            
            uint256 jackpotShares = gaugeController.getJackpotReserve(vaultAddr);
            jackpotBalance = vault.previewRedeem(jackpotShares);
        }

        return (stats.entries, stats.winners, stats.rewardsPaid, jackpotBalance);
    }

    function quoteWinnerBroadcast(
        uint32 dstEid,
        address creatorCoin,
        address winner,
        uint16 payoutBps
    ) external view returns (MessagingFee memory fee) {
        bytes memory payload = abi.encode(creatorCoin, winner, payoutBps);
        bytes memory options = _buildOptions(dstEid);
        return _quote(dstEid, payload, options, false);
    }

    // ================================
    // EMERGENCY
    // ================================

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool ok, ) = payable(owner()).call{value: amount}("");
            require(ok, "Failed");
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    receive() external payable {}
}
