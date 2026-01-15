// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CreatorVRFConsumerV2_5
 * @author 0xakita.eth (CreatorVault)
 * @notice Multi-chain VRF Consumer for Creator Coin lottery system
 * @dev Accepts requests from multiple chains AND direct local requests from Base.
 *      Sends randomness back to the originating chain or calls local callbacks.
 *      This acts as a VRF hub on Base using Chainlink VRF 2.5.
 * 
 * @dev ARCHITECTURE:
 *      - Base (Hub): Chainlink VRF lives here
 *      - Remote chains: Send VRF requests via LayerZero
 *      - Hub processes VRF, sends randomness back
 *      - Local contracts can also request VRF directly
 * 
 * @dev PRICE AGGREGATION:
 *      - Collects ■AKITA/USD prices from all chains
 *      - Returns aggregated average price with VRF responses
 *      - Ensures consistent pricing for lottery across all chains
 */

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OApp, MessagingFee, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";

// Interface for local callbacks
interface IVRFCallbackReceiver {
    function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external;
}

// Interface for CreatorRegistry
interface ICreatorRegistry {
    function getLayerZeroEndpoint(uint16 _chainId) external view returns (address);
    function getEidForChainId(uint256 _chainId) external view returns (uint32);
    function getSupportedChains() external view returns (uint16[] memory);
}

// Interface for CreatorOracle
interface ICreatorOracle {
    function getCreatorPrice() external view returns (int256 price, uint256 timestamp);
    function getCreatorEthTWAP(uint32 duration) external view returns (uint256 price);
    function getEthPrice() external view returns (int256 price, uint256 timestamp);
}

// Chainlink VRF V2.5 interface
interface IVRFCoordinatorV2Plus {
    function requestRandomWords(RandomWordsRequest calldata req) external returns (uint256 requestId);
}

struct RandomWordsRequest {
    bytes32 keyHash;
    uint256 subId;
    uint16 requestConfirmations;
    uint32 callbackGasLimit;
    uint32 numWords;
    bytes extraArgs;
}

contract CreatorVRFConsumerV2_5 is OApp, ReentrancyGuard {
    using OptionsBuilder for bytes;

    // ================================
    // STATE
    // ================================

    IVRFCoordinatorV2Plus public vrfCoordinator;
    ICreatorRegistry public immutable registry;
    ICreatorOracle public priceOracle;

    /// @notice Base EID (hub chain where VRF lives)
    uint32 public immutable BASE_EID;

    /// @notice Supported chains for cross-chain VRF
    mapping(uint32 => bool) public supportedChains;
    mapping(uint32 => uint32) public chainGasLimits;
    uint32[] public registeredChainEids;
    mapping(uint32 => string) public chainNames;

    /// @notice VRF configuration
    uint256 public subscriptionId;
    bytes32 public keyHash;
    uint32 public callbackGasLimit = 2500000;
    uint16 public requestConfirmations = 3;
    uint32 public numWords = 1;
    bool public nativePayment = false;

    /// @notice VRF request tracking
    struct VRFRequest {
        uint64 sequence;
        uint32 sourceChainEid;
        bytes32 sourcePeer;
        address localRequester;
        bool isLocalRequest;
        uint256 randomWord;
        bool fulfilled;
        bool responseSent;
        bool callbackSent;
        uint256 timestamp;
    }

    mapping(uint256 => VRFRequest) public vrfRequests;
    mapping(uint64 => uint256) public sequenceToRequestId;
    mapping(uint64 => bool) public pendingResponses;

    /// @notice Local request tracking
    uint256 public localRequestCounter;
    mapping(address => uint256[]) public userLocalRequests;
    mapping(address => bool) public authorizedLocalCallers;

    /// @notice Gas configuration
    uint256 public minimumBalance = 0.005 ether;
    uint32 public defaultGasLimit = 2500000;

    // ================================
    // CROSS-CHAIN PRICE AGGREGATION
    // ================================

    /// @notice Price data from each chain
    struct ChainPriceData {
        int256 creatorPriceUSD;
        uint256 timestamp;
        uint256 lastUpdated;
    }

    mapping(uint32 => ChainPriceData) public chainPrices;
    uint32[] public priceReportingChains;
    mapping(uint32 => bool) public hasPriceReported;

    /// @notice Local price from Base's oracle
    int256 public localCreatorPriceUSD;
    uint256 public localPriceTimestamp;

    /// @notice TWAP period (default 5 minutes)
    uint32 public twapPeriod = 300;

    /// @notice Staleness threshold (2 hours)
    uint256 public constant PRICE_STALENESS = 7200;

    // ================================
    // EVENTS
    // ================================

    event RandomWordsRequested(uint256 indexed requestId, uint32 indexed srcEid, bytes32 indexed requester, uint64 sequence, uint256 timestamp);
    event LocalRandomWordsRequested(uint256 indexed requestId, address indexed requester, uint256 timestamp);
    event VRFRequestSent(uint256 indexed originalRequestId, uint256 indexed vrfRequestId, uint32 sourceChain);
    event RandomnessFulfilled(uint256 indexed requestId, uint256[] randomWords, uint32 targetChain);
    event ResponseSentToChain(uint64 indexed sequence, uint256 randomWord, uint32 targetChain, uint256 fee);
    event ResponsePending(uint64 indexed sequence, uint256 indexed requestId, uint32 targetChain, string reason);
    event LocalCallbackSent(uint256 indexed requestId, address indexed requester, uint256 randomWord);
    event LocalCallbackFailed(uint256 indexed requestId, address indexed requester, string reason);
    event VRFConfigUpdated(uint256 subscriptionId, bytes32 keyHash, uint32 callbackGasLimit, uint16 requestConfirmations);
    event ChainSupportUpdated(uint32 chainEid, bool supported, uint32 gasLimit);
    event ContractFunded(address indexed funder, uint256 amount, uint256 newBalance);
    event LocalCallerAuthorized(address indexed caller, bool authorized);
    event ChainPriceReceived(uint32 indexed chainEid, int256 creatorPriceUSD, uint256 timestamp);
    event LocalPriceUpdated(int256 creatorPriceUSD, uint256 timestamp);
    event AggregatedPriceCalculated(int256 avgPrice, uint256 numChains, uint256 timestamp);
    event PriceOracleSet(address oracle);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error Unauthorized();
    error InvalidChain();
    error DuplicateSequence();
    error InsufficientBalance();
    error InvalidRequest();

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Constructor using registry for LZ endpoint
     * @param _registry CreatorRegistry address
     * @param _owner Owner address
     */
    constructor(
        address _registry,
        address _owner
    ) OApp(ICreatorRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid)), _owner) Ownable(_owner) {
        if (_registry == address(0)) revert ZeroAddress();
        if (_owner == address(0)) revert ZeroAddress();
        
        registry = ICreatorRegistry(_registry);
        BASE_EID = registry.getEidForChainId(block.chainid);
        
        // Enable owner for local requests
        authorizedLocalCallers[_owner] = true;
    }

    // ================================
    // VRF CONFIGURATION
    // ================================

    function setVRFCoordinator(address _vrfCoordinator) external onlyOwner {
        if (_vrfCoordinator == address(0)) revert ZeroAddress();
        vrfCoordinator = IVRFCoordinatorV2Plus(_vrfCoordinator);
        emit VRFConfigUpdated(subscriptionId, keyHash, callbackGasLimit, requestConfirmations);
    }

    function setVRFConfig(
        uint256 _subscriptionId,
        bytes32 _keyHash,
        uint32 _callbackGasLimit,
        uint16 _requestConfirmations
    ) external onlyOwner {
        require(_subscriptionId > 0, "Invalid subscription");
        require(_keyHash != bytes32(0), "Invalid key hash");
        require(_callbackGasLimit >= 40000 && _callbackGasLimit <= 2500000, "Invalid gas limit");
        require(_requestConfirmations >= 3 && _requestConfirmations <= 200, "Invalid confirmations");

        subscriptionId = _subscriptionId;
        keyHash = _keyHash;
        callbackGasLimit = _callbackGasLimit;
        requestConfirmations = _requestConfirmations;

        emit VRFConfigUpdated(_subscriptionId, _keyHash, _callbackGasLimit, _requestConfirmations);
    }

    function setPriceOracle(address _oracle) external onlyOwner {
        priceOracle = ICreatorOracle(_oracle);
        emit PriceOracleSet(_oracle);
    }

    // ================================
    // LAYERZERO RECEIVE
    // ================================

    /**
     * @notice Receive VRF request from remote chain
     * @dev Decodes piggybacked price data if present
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32,
        bytes calldata _message,
        address,
        bytes calldata
    ) internal override {
        if (!supportedChains[_origin.srcEid]) revert InvalidChain();
        require(peers[_origin.srcEid] == _origin.sender, "Invalid peer");

        uint64 sequence;
        int256 reportedPrice;
        uint256 priceTimestamp;

        // Decode payload (supports legacy and new format)
        if (_message.length == 96) {
            // New format with price piggybacking
            (sequence, reportedPrice, priceTimestamp) = abi.decode(_message, (uint64, int256, uint256));
            
            if (reportedPrice > 0 && priceTimestamp > 0) {
                _updateChainPrice(_origin.srcEid, reportedPrice, priceTimestamp);
            }
        } else {
            // Legacy format
            sequence = abi.decode(_message, (uint64));
        }

        if (sequenceToRequestId[sequence] != 0) revert DuplicateSequence();

        // Request VRF
        uint256 requestId = vrfCoordinator.requestRandomWords(
            RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: numWords,
                extraArgs: ""
            })
        );

        vrfRequests[requestId] = VRFRequest({
            sequence: sequence,
            sourceChainEid: _origin.srcEid,
            sourcePeer: _origin.sender,
            localRequester: address(0),
            isLocalRequest: false,
            randomWord: 0,
            fulfilled: false,
            responseSent: false,
            callbackSent: false,
            timestamp: block.timestamp
        });

        sequenceToRequestId[sequence] = requestId;

        emit VRFRequestSent(sequence, requestId, _origin.srcEid);
        emit RandomWordsRequested(requestId, _origin.srcEid, _origin.sender, sequence, block.timestamp);
    }

    // ================================
    // LOCAL VRF REQUESTS
    // ================================

    /**
     * @notice Request random words locally on Base
     * @return requestId The VRF request ID
     */
    function requestRandomWords() external returns (uint256 requestId) {
        return _requestRandomWordsLocal();
    }

    function requestRandomWordsLocal() external returns (uint256 requestId) {
        return _requestRandomWordsLocal();
    }

    function _requestRandomWordsLocal() internal returns (uint256 requestId) {
        require(address(vrfCoordinator) != address(0), "VRF not configured");
        if (!authorizedLocalCallers[msg.sender]) revert Unauthorized();

        requestId = vrfCoordinator.requestRandomWords(
            RandomWordsRequest({
                keyHash: keyHash,
                subId: subscriptionId,
                requestConfirmations: requestConfirmations,
                callbackGasLimit: callbackGasLimit,
                numWords: numWords,
                extraArgs: ""
            })
        );

        localRequestCounter++;

        vrfRequests[requestId] = VRFRequest({
            sequence: 0,
            sourceChainEid: BASE_EID,
            sourcePeer: bytes32(0),
            localRequester: msg.sender,
            isLocalRequest: true,
            randomWord: 0,
            fulfilled: false,
            responseSent: false,
            callbackSent: false,
            timestamp: block.timestamp
        });

        userLocalRequests[msg.sender].push(requestId);

        emit LocalRandomWordsRequested(requestId, msg.sender, block.timestamp);
    }

    // ================================
    // VRF FULFILLMENT
    // ================================

    /**
     * @notice Callback from VRF Coordinator
     */
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
        require(msg.sender == address(vrfCoordinator), "Only VRF Coordinator");

        VRFRequest storage request = vrfRequests[requestId];
        if (request.timestamp == 0) revert InvalidRequest();
        require(!request.fulfilled, "Already fulfilled");

        request.fulfilled = true;
        request.randomWord = randomWords[0];

        if (request.isLocalRequest) {
            _handleLocalCallback(requestId, request, randomWords);
        } else {
            _handleCrossChainResponse(requestId, request, randomWords);
        }

        emit RandomnessFulfilled(requestId, randomWords, request.sourceChainEid);
    }

    function _handleLocalCallback(
        uint256 requestId,
        VRFRequest storage request,
        uint256[] calldata randomWords
    ) internal {
        address requester = request.localRequester;

        if (requester.code.length > 0) {
            try IVRFCallbackReceiver(requester).receiveRandomWords(requestId, randomWords) {
                request.callbackSent = true;
                emit LocalCallbackSent(requestId, requester, request.randomWord);
            } catch Error(string memory reason) {
                emit LocalCallbackFailed(requestId, requester, reason);
            } catch {
                emit LocalCallbackFailed(requestId, requester, "Unknown error");
            }
        }
    }

    function _handleCrossChainResponse(
        uint256 requestId,
        VRFRequest storage request,
        uint256[] calldata
    ) internal {
        uint32 targetGasLimit = chainGasLimits[request.sourceChainEid];
        if (targetGasLimit == 0) targetGasLimit = defaultGasLimit;

        bytes memory payload = abi.encode(request.sequence, request.randomWord);
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(targetGasLimit, 0);
        MessagingFee memory fee = _quote(request.sourceChainEid, payload, options, false);

        // Add 5% buffer
        fee.nativeFee = fee.nativeFee * 105 / 100;

        if (address(this).balance < fee.nativeFee) {
            pendingResponses[request.sequence] = true;
            emit ResponsePending(request.sequence, requestId, request.sourceChainEid, "Insufficient balance");
            return;
        }

        _sendResponseToChain(request, fee);
    }

    function _sendResponseToChain(VRFRequest storage _request, MessagingFee memory _fee) internal {
        uint32 targetGasLimit = chainGasLimits[_request.sourceChainEid];
        if (targetGasLimit == 0) targetGasLimit = defaultGasLimit;

        // Get aggregated price
        (int256 aggregatedPrice, uint256 numChains) = getAggregatedCreatorPrice();

        // Extended payload with price
        bytes memory payload = abi.encode(
            _request.sequence,
            _request.randomWord,
            aggregatedPrice,
            block.timestamp
        );
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(targetGasLimit, 0);

        _request.responseSent = true;

        _lzSend(
            _request.sourceChainEid,
            payload,
            options,
            _fee,
            payable(owner())
        );

        emit ResponseSentToChain(_request.sequence, _request.randomWord, _request.sourceChainEid, _fee.nativeFee);
        if (aggregatedPrice > 0) {
            emit AggregatedPriceCalculated(aggregatedPrice, numChains, block.timestamp);
        }
    }

    // ================================
    // PRICE AGGREGATION
    // ================================

    function _updateChainPrice(uint32 chainEid, int256 price, uint256 timestamp) internal {
        if (!hasPriceReported[chainEid]) {
            priceReportingChains.push(chainEid);
            hasPriceReported[chainEid] = true;
        }

        chainPrices[chainEid] = ChainPriceData({
            creatorPriceUSD: price,
            timestamp: timestamp,
            lastUpdated: block.timestamp
        });

        emit ChainPriceReceived(chainEid, price, timestamp);
    }

    function updateLocalPrice() public {
        if (address(priceOracle) == address(0)) return;

        try priceOracle.getCreatorPrice() returns (int256 creatorUsd, uint256 timestamp) {
            if (creatorUsd > 0) {
                localCreatorPriceUSD = creatorUsd;
                localPriceTimestamp = timestamp;
                emit LocalPriceUpdated(localCreatorPriceUSD, localPriceTimestamp);
            }
        } catch {
            // Fallback: calculate from TWAP
            try priceOracle.getCreatorEthTWAP(twapPeriod) returns (uint256 creatorPerEth) {
                if (creatorPerEth == 0) return;

                try priceOracle.getEthPrice() returns (int256 ethUsd, uint256) {
                    if (ethUsd <= 0) return;

                    localCreatorPriceUSD = int256((creatorPerEth * uint256(ethUsd)) / 1e18);
                    localPriceTimestamp = block.timestamp;
                    emit LocalPriceUpdated(localCreatorPriceUSD, localPriceTimestamp);
                } catch {}
            } catch {}
        }
    }

    function getAggregatedCreatorPrice() public view returns (int256 avgPrice, uint256 numChains) {
        int256 totalPrice;
        uint256 validChains;

        // Include local price
        if (localCreatorPriceUSD > 0 && block.timestamp - localPriceTimestamp < PRICE_STALENESS) {
            totalPrice += localCreatorPriceUSD;
            validChains++;
        }

        // Include remote prices
        uint256 priceChainsLen = priceReportingChains.length;
        for (uint256 i = 0; i < priceChainsLen; i++) {
            uint32 chainEid = priceReportingChains[i];
            ChainPriceData memory priceData = chainPrices[chainEid];

            if (priceData.creatorPriceUSD > 0 && block.timestamp - priceData.lastUpdated < PRICE_STALENESS) {
                totalPrice += priceData.creatorPriceUSD;
                validChains++;
            }
        }

        if (validChains == 0) return (0, 0);

        avgPrice = totalPrice / int256(validChains);
        numChains = validChains;
    }

    // ================================
    // ADMIN FUNCTIONS
    // ================================

    function setLocalCallerAuthorization(address caller, bool authorized) external onlyOwner {
        authorizedLocalCallers[caller] = authorized;
        emit LocalCallerAuthorized(caller, authorized);
    }

    function setSupportedChain(uint32 chainEid, bool supported, uint32 gasLimit) external onlyOwner {
        supportedChains[chainEid] = supported;
        if (supported) {
            require(gasLimit >= 100000 && gasLimit <= 10000000, "Invalid gas limit");
            chainGasLimits[chainEid] = gasLimit;
        } else {
            chainGasLimits[chainEid] = 0;
        }
        emit ChainSupportUpdated(chainEid, supported, gasLimit);
    }

    function addNewChain(uint32 chainEid, string calldata chainName, uint32 gasLimit) external onlyOwner {
        require(!supportedChains[chainEid], "Already supported");
        require(bytes(chainName).length > 0, "Name required");

        bool found = false;
        uint256 registeredLen = registeredChainEids.length;
        for (uint256 i = 0; i < registeredLen; i++) {
            if (registeredChainEids[i] == chainEid) {
                found = true;
                break;
            }
        }
        if (!found) registeredChainEids.push(chainEid);

        chainNames[chainEid] = chainName;
        supportedChains[chainEid] = true;
        chainGasLimits[chainEid] = gasLimit;
        emit ChainSupportUpdated(chainEid, true, gasLimit);
    }

    function setDefaultGasLimit(uint32 _gasLimit) external onlyOwner {
        require(_gasLimit >= 100000 && _gasLimit <= 10000000, "Invalid");
        defaultGasLimit = _gasLimit;
    }

    function setTwapPeriod(uint32 _period) external onlyOwner {
        require(_period > 0, "Invalid");
        twapPeriod = _period;
    }

    function fundContract() external payable {
        require(msg.value > 0, "Send ETH");
        emit ContractFunded(msg.sender, msg.value, address(this).balance);
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    function getLocalRequest(uint256 requestId) external view returns (
        address requester,
        bool fulfilled,
        bool callbackSent,
        uint256 randomWord,
        uint256 timestamp
    ) {
        VRFRequest storage request = vrfRequests[requestId];
        require(request.isLocalRequest, "Not local");
        return (request.localRequester, request.fulfilled, request.callbackSent, request.randomWord, request.timestamp);
    }

    function getUserLocalRequests(address user) external view returns (uint256[] memory) {
        return userLocalRequests[user];
    }

    function getRequestStats() external view returns (uint256 totalLocal, uint256 totalCrossChain) {
        return (localRequestCounter, 0);
    }

    function getAllChainPrices() external view returns (
        uint32[] memory chainEids,
        int256[] memory prices,
        uint256[] memory timestamps
    ) {
        uint256 priceLen = priceReportingChains.length;
        chainEids = new uint32[](priceLen);
        prices = new int256[](priceLen);
        timestamps = new uint256[](priceLen);

        for (uint256 i = 0; i < priceLen; i++) {
            uint32 chainEid = priceReportingChains[i];
            chainEids[i] = chainEid;
            prices[i] = chainPrices[chainEid].creatorPriceUSD;
            timestamps[i] = chainPrices[chainEid].lastUpdated;
        }
    }

    function getContractStatus() external view returns (
        uint256 balance,
        uint256 minBalance,
        bool canSendResponses,
        uint32 gasLimit,
        uint256 supportedChainsCount
    ) {
        balance = address(this).balance;
        minBalance = minimumBalance;
        canSendResponses = balance >= minBalance;
        gasLimit = defaultGasLimit;

        uint256 count = 0;
        uint256 registeredCount = registeredChainEids.length;
        for (uint256 i = 0; i < registeredCount; i++) {
            if (supportedChains[registeredChainEids[i]]) count++;
        }
        supportedChainsCount = count;
    }

    // ================================
    // EMERGENCY
    // ================================

    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Failed");
    }

    receive() external payable {}
}
