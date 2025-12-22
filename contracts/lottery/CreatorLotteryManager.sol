// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CreatorLotteryManager
 * @author 0xakita.eth (CreatorVault)
 * @notice Swap-based lottery for Creator Coin vaults with cross-chain winner broadcast
 * 
 * @dev LOTTERY MECHANICS:
 *      1. User trades wsAKITA → lottery entry created
 *      2. Win probability scales with trade size ($1 = base, $1000 = max)
 *      3. vAKITA holders get boosted win chances
 *      4. Winners receive % of jackpot (stored in GaugeController)
 *      5. Winners are broadcast to ALL chains via LayerZero
 * 
 * @dev CROSS-CHAIN FLOW (Hub = Base):
 *      Winner on Base:
 *        1. Pay local jackpot
 *        2. Broadcast to all remote chains
 *      
 *      Winner on Remote:
 *        1. Notify hub (Base)
 *        2. Hub broadcasts to ALL chains (including source)
 *        3. Each chain pays from their local jackpot
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

// ================================
// INTERFACES
// ================================

interface ICreatorRegistry {
    function getLayerZeroEndpoint(uint16 _chainId) external view returns (address);
    function getEidForChainId(uint256 _chainId) external view returns (uint32);
    function getSupportedChains() external view returns (uint16[] memory);
    function isHubChain() external view returns (bool);
    function getGasReserve(uint16 chainId) external view returns (address);
    function getRemoteVaults() external view returns (uint32[] memory eids, address[] memory vaults);
}

interface ICreatorChainlinkOracle {
    function getCreatorPrice() external view returns (int256 price, uint256 timestamp);
}

interface ICreatorGaugeController {
    function getJackpotReserve(address vault) external view returns (uint256);
    function payJackpot(address vault, address winner, uint256 shares) external;
}

interface ICreatOVault {
    function previewRedeem(uint256 shares) external view returns (uint256);
}

interface ICreatorVRFConsumer {
    function requestRandomWords() external returns (uint256 requestId);
}

interface IChainlinkVRFIntegrator {
    function quoteFee() external view returns (MessagingFee memory);
    function requestRandomWordsPayable(uint32 targetEid) external payable returns (MessagingReceipt memory, uint64);
}

interface IveCreatorShareBoostManager {
    function calculateBoost(address user) external view returns (uint256 boostBps);
    function getTotalProbabilityBoost(address user) external view returns (uint256 boostBps);
    function hasBoost(address user) external view returns (bool);
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
    
    /// @notice Maximum boost for veCreatorShare lockers (2.5x = 25000 bps)
    uint256 public constant MAX_VE_BOOST = 25000;

    // ================================
    // STATE
    // ================================

    ICreatorRegistry public immutable registry;
    mapping(address => bool) public authorizedSwapContracts;

    /// @notice Creator token (underlying, e.g., akita)
    address public creatorToken;

    /// @notice ShareOFT token (wsAKITA)
    address public shareOFTToken;

    /// @notice Vault shares token (vAKITA)
    address public vaultSharesToken;

    /// @notice Oracle for price feeds
    ICreatorChainlinkOracle public oracle;

    /// @notice GaugeController (holds jackpot)
    ICreatorGaugeController public gaugeController;

    /// @notice CreatOVault
    ICreatOVault public vault;

    /// @notice VRF providers
    ICreatorVRFConsumer public localVRFConsumer;
    IChainlinkVRFIntegrator public vrfIntegrator;
    uint32 public targetEid;
    bool public useLocalVRF;

    /// @notice Boost manager for veCreatorShare lockers
    IveCreatorShareBoostManager public boostManager;

    /// @notice Lottery configuration
    struct LotteryConfig {
        uint256 minSwapAmount;
        uint256 rewardPercentage;  // bps of jackpot
        bool isActive;
        uint256 baseWinChance;     // PPM (parts per million)
        uint256 maxWinChance;      // PPM
        uint256 usdMultiplierBps;  // Bonus for slippage (10500 = 1.05x)
    }

    LotteryConfig public lotteryConfig;

    /// @notice VRF request tracking
    enum VRFType { LOCAL, CROSS_CHAIN }

    struct VRFRequest {
        address user;
        uint256 amountUSD;
        VRFType vrfType;
    }

    mapping(uint256 => VRFRequest) public vrfRequests;

    /// @notice Statistics
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
    event WinnerBroadcast(uint32 indexed dstEid, address indexed winner, uint16 payoutBps);
    event CrossChainBroadcastFailed(uint32 indexed dstEid, address indexed winner, string reason);
    event CrossChainJackpotPaid(address indexed winner, uint256 shares, uint256 tokenValue);
    event CrossChainPayoutFailed(address indexed winner, uint256 attemptedShares);
    event LotteryWon(uint256 indexed entryId, address indexed winner, uint256 shares, uint256 tokenValue);
    event WinnerNotifiedToHub(address indexed winner, uint16 payoutBps);
    event HubNotificationFailed(address indexed winner, string reason);
    event WinnerReceivedFromRemote(uint32 indexed srcEid, address indexed winner, uint16 payoutBps);
    event OracleUpdated(address indexed oracle);
    event VRFConsumerUpdated(address indexed consumer);
    event GaugeControllerUpdated(address indexed controller);
    event VaultUpdated(address indexed vault);
    event BoostManagerUpdated(address indexed manager);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error Unauthorized();
    error InvalidAmount();

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(
        address _registry,
        address _gaugeController,
        address _vault,
        address _creatorToken,
        address _shareOFTToken,
        address _oracle,
        address _owner
    ) OApp(
        ICreatorRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid)),
        _owner
    ) Ownable(_owner) {
        if (_owner == address(0)) revert ZeroAddress();
        if (_registry == address(0)) revert ZeroAddress();
        if (_gaugeController == address(0)) revert ZeroAddress();
        if (_vault == address(0)) revert ZeroAddress();
        if (_creatorToken == address(0)) revert ZeroAddress();
        if (_oracle == address(0)) revert ZeroAddress();

        registry = ICreatorRegistry(_registry);
        gaugeController = ICreatorGaugeController(_gaugeController);
        vault = ICreatOVault(_vault);
        creatorToken = _creatorToken;
        shareOFTToken = _shareOFTToken;
        oracle = ICreatorChainlinkOracle(_oracle);

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
     * @notice Process swap-based lottery entry
     * @param trader User who made the swap
     * @param tokenIn Token swapped (should be creator token or shareOFT)
     * @param amountIn Amount swapped
     * @return entryId VRF request ID (0 if no entry)
     */
    function processSwapLottery(
        address trader,
        address tokenIn,
        uint256 amountIn
    ) external payable nonReentrant onlyAuthorizedSwapContract whenNotPaused returns (uint256 entryId) {
        if (trader == address(0)) revert ZeroAddress();
        if (tokenIn == address(0)) revert ZeroAddress();
        if (amountIn == 0) revert InvalidAmount();

        // Calculate USD value
        uint256 swapValueUSD = _calculateTokenUSD(tokenIn, amountIn);

        if (swapValueUSD < lotteryConfig.minSwapAmount) {
            return 0;
        }

        if (!lotteryConfig.isActive) {
            return 0;
        }

        // Calculate win probability with boost
        uint256 baseWinChance = calculateWinChance(swapValueUSD);
        uint256 boostedWinChance = _applyBoost(trader, baseWinChance, swapValueUSD);

        // Request VRF
        if (useLocalVRF && address(localVRFConsumer) != address(0)) {
            return _requestLocalVRF(trader, swapValueUSD, boostedWinChance);
        } else {
            return _requestCrossChainVRF(trader, swapValueUSD, boostedWinChance);
        }
    }

    /**
     * @notice Request cross-chain VRF
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
                    MessagingReceipt memory,
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
     * @notice Request local VRF
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
            uint256 reward = _processWin(request.user, request.amountUSD, requestId);
            emit LotteryResultProcessed(request.user, request.amountUSD, true, reward, requestId);
        } else {
            emit LotteryResultProcessed(request.user, request.amountUSD, false, 0, requestId);
        }
    }

    // ================================
    // INTERNAL FUNCTIONS
    // ================================

    /**
     * @notice Calculate USD value of tokens
     */
    function _calculateTokenUSD(address tokenIn, uint256 amount) internal view returns (uint256 usd1e6) {
        // Only works for creator token or shareOFT
        if (tokenIn != creatorToken && tokenIn != shareOFTToken) return 0;
        if (amount == 0) return 0;
        if (address(oracle) == address(0)) return 0;

        (int256 priceUSD, uint256 timestamp) = oracle.getCreatorPrice();
        if (priceUSD <= 0 || timestamp == 0) return 0;
        if (block.timestamp - timestamp > 7200) return 0;

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

    function _applyBoost(
        address user,
        uint256 baseWinChance,
        uint256 /* swapAmountUSD */
    ) internal view returns (uint256 boostedWinChance) {
        boostedWinChance = baseWinChance;

        if (address(boostManager) == address(0)) {
            return boostedWinChance;
        }

        // veCreatorShare boost (users who lock wrapped shares)
        try boostManager.calculateBoost(user) returns (uint256 boostBPS) {
            if (boostBPS > 10000) {
                boostBPS = boostBPS > MAX_VE_BOOST ? MAX_VE_BOOST : boostBPS;
                boostedWinChance = (baseWinChance * boostBPS) / 10000;
            }
        } catch {}

        // Probability boost from gauge votes
        try boostManager.getTotalProbabilityBoost(user) returns (uint256 vaultBoostBps) {
            if (vaultBoostBps > 0) {
                uint256 additionalPPM = vaultBoostBps * 100;
                boostedWinChance += additionalPPM;
            }
        } catch {}

        if (boostedWinChance > lotteryConfig.maxWinChance) {
            boostedWinChance = lotteryConfig.maxWinChance;
        }
    }

    function _processWin(address user, uint256 swapAmountUSD, uint256 requestId) internal returns (uint256) {
        totalWinners++;
        emit LotteryWinner(user, swapAmountUSD, 0, requestId);

        if (registry.isHubChain()) {
            uint256 localPayout = _payoutLocalJackpot(user, uint16(lotteryConfig.rewardPercentage));
            _broadcastWinnerToRemoteChains(user, uint16(lotteryConfig.rewardPercentage));
            return localPayout;
        } else {
            _notifyHubOfWinner(user, uint16(lotteryConfig.rewardPercentage));
            return 0;
        }
    }

    // ================================
    // CROSS-CHAIN MESSAGING
    // ================================

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
                    _payoutLocalJackpot(winner, payoutBps);
                    emit HubNotificationFailed(winner, "Send failed");
                }
            } else {
                _payoutLocalJackpot(winner, payoutBps);
                emit HubNotificationFailed(winner, "Insufficient gas");
            }
        } catch {
            _payoutLocalJackpot(winner, payoutBps);
            emit HubNotificationFailed(winner, "Quote failed");
        }
    }

    function _broadcastWinnerToRemoteChains(address winner, uint16 payoutBps) internal {
        (uint32[] memory eids, ) = registry.getRemoteVaults();
        if (eids.length == 0) return;

        bytes memory payload = abi.encode(winner, payoutBps);
        address gasReserve = registry.getGasReserve(uint16(block.chainid));

        for (uint i = 0; i < eids.length; i++) {
            uint32 dstEid = eids[i];
            bytes memory options = _buildOptions(dstEid);

            try this._quoteBroadcast(dstEid, payload, options) returns (MessagingFee memory fee) {
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

        if (_payload.length >= 34) {
            (uint16 msgType, address winner, uint16 payoutBps) = abi.decode(_payload, (uint16, address, uint16));

            if (msgType == MSG_TYPE_WINNER_NOTIFY && registry.isHubChain()) {
                emit WinnerReceivedFromRemote(_origin.srcEid, winner, payoutBps);
                _payoutLocalJackpot(winner, payoutBps);
                _broadcastWinnerToRemoteChains(winner, payoutBps);
                return;
            }
        }

        require(!registry.isHubChain(), "Hub doesn't receive broadcasts");

        (address winner, uint16 payoutBps) = abi.decode(_payload, (address, uint16));
        _payoutLocalJackpot(winner, payoutBps);
    }

    function _payoutLocalJackpot(address winner, uint16 payoutBps) internal returns (uint256) {
        if (address(gaugeController) == address(0)) return 0;
        if (address(vault) == address(0)) return 0;

        address vaultAddr = address(vault);
        uint256 jackpotShares = gaugeController.getJackpotReserve(vaultAddr);

        if (jackpotShares == 0) return 0;

        uint256 rewardShares = (jackpotShares * payoutBps) / BASIS_POINTS;

        if (rewardShares > 0) {
            try gaugeController.payJackpot(vaultAddr, winner, rewardShares) {
                uint256 rewardValue = vault.previewRedeem(rewardShares);
                totalRewardsPaid += rewardValue;

                emit LotteryWon(0, winner, rewardShares, rewardValue);
                emit CrossChainJackpotPaid(winner, rewardShares, rewardValue);
                return rewardShares;
            } catch {
                emit CrossChainPayoutFailed(winner, rewardShares);
                return 0;
            }
        }
        return 0;
    }

    // ================================
    // ADMIN FUNCTIONS
    // ================================

    function setAuthorizedSwapContract(address swapContract, bool authorized) external onlyOwner {
        if (swapContract == address(0)) revert ZeroAddress();
        authorizedSwapContracts[swapContract] = authorized;
        emit SwapContractAuthorized(swapContract, authorized);
    }

    function setCreatorToken(address _token) external onlyOwner {
        if (_token == address(0)) revert ZeroAddress();
        creatorToken = _token;
    }

    function setShareOFTToken(address _token) external onlyOwner {
        shareOFTToken = _token;
    }

    function setVaultSharesToken(address _token) external onlyOwner {
        vaultSharesToken = _token;
    }

    function setOracle(address _oracle) external onlyOwner {
        if (_oracle == address(0)) revert ZeroAddress();
        oracle = ICreatorChainlinkOracle(_oracle);
        emit OracleUpdated(_oracle);
    }

    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        vault = ICreatOVault(_vault);
        emit VaultUpdated(_vault);
    }

    function setGaugeController(address _controller) external onlyOwner {
        if (_controller == address(0)) revert ZeroAddress();
        gaugeController = ICreatorGaugeController(_controller);
        emit GaugeControllerUpdated(_controller);
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
        boostManager = IveCreatorShareBoostManager(_manager);
        emit BoostManagerUpdated(_manager);
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

    function getLotteryStats() external view returns (
        uint256 entries,
        uint256 winners,
        uint256 totalRewards,
        uint256 jackpotBalance
    ) {
        address vaultAddr = address(vault);
        uint256 jackpotShares = gaugeController.getJackpotReserve(vaultAddr);
        jackpotBalance = vault.previewRedeem(jackpotShares);

        return (
            totalLotteryEntries,
            totalWinners,
            totalRewardsPaid,
            jackpotBalance
        );
    }

    function quoteWinnerBroadcast(
        uint32 dstEid,
        address winner,
        uint16 payoutBps
    ) external view returns (MessagingFee memory fee) {
        bytes memory payload = abi.encode(winner, payoutBps);
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

