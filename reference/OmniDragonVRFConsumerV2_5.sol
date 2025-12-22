// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title OmniDragonVRFConsumerV2_5
 * @author 0xakita.eth
 * @dev Multi-chain VRF Consumer that accepts requests from multiple chains
 *      (Monad, Base, etc.) AND direct local requests from Base.
 *      Sends randomness back to the originating chain or calls local callbacks.
 *      This acts as a VRF hub on Base using Chainlink VRF 2.5.
 */

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OApp, MessagingFee, Origin} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OApp.sol";
import {MessagingReceipt} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/OAppSender.sol";
import {OAppOptionsType3} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OAppOptionsType3.sol";
import {OptionsBuilder} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oapp/libs/OptionsBuilder.sol";
import {IOmniDragonRegistry} from "../../interfaces/config/IOmniDragonRegistry.sol";
import {IOmniDragonChainlinkOracle} from "../../interfaces/oracles/IOmniDragonChainlinkOracle.sol";

// Interface for local callbacks
interface IVRFCallbackReceiver {
  function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external;
}

// Chainlink VRF V2.5 imports
import "../../../lib/chainlink-vrf-v2.5/IVRFCoordinatorV2Plus.sol";

// Use the library from the imported file
import {VRFV2PlusClient} from "../../../lib/chainlink-vrf-v2.5/IVRFCoordinatorV2Plus.sol";

contract OmniDragonVRFConsumerV2_5 is OApp, OAppOptionsType3, ReentrancyGuard {
  using OptionsBuilder for bytes;

  IVRFCoordinatorV2Plus public vrfCoordinator;
  IOmniDragonRegistry public immutable registry;

  // Base EID (hub chain where VRF lives)
  uint32 public immutable BASE_EID;

  mapping(uint32 => bool) public supportedChains;
  mapping(uint32 => uint32) public chainGasLimits;

  uint32[] public registeredChainEids;
  mapping(uint32 => string) public chainNames;

  uint256 public subscriptionId;
  bytes32 public keyHash;
  uint32 public callbackGasLimit = 2500000;
  uint16 public requestConfirmations = 3;
  uint32 public numWords = 1;

  bool public nativePayment = false;

  // Enhanced VRF Request structure to support both cross-chain and local requests
  struct VRFRequest {
    uint64 sequence; // For cross-chain requests
    uint32 sourceChainEid; // 0 for local requests, chain EID for cross-chain
    bytes32 sourcePeer; // LayerZero peer for cross-chain
    address localRequester; // Local requester address for direct requests
    bool isLocalRequest; // True for local requests, false for cross-chain
    uint256 randomWord;
    bool fulfilled;
    bool responseSent; // For cross-chain only
    bool callbackSent; // For local requests only
    uint256 timestamp;
  }

  mapping(uint256 => VRFRequest) public vrfRequests;
  mapping(uint64 => uint256) public sequenceToRequestId; // Cross-chain mapping

  mapping(uint64 => bool) public pendingResponses;

  // Local request tracking
  uint256 public localRequestCounter;
  mapping(address => uint256[]) public userLocalRequests; // user => requestIds[]
  mapping(address => bool) public authorizedLocalCallers; // Authorization for local requests

  /**
   * @dev Minimum ETH balance threshold for monitoring purposes only.
   */
  uint256 public minimumBalance = 0.005 ether;
  uint32 public defaultGasLimit = 2500000;

  // ================================
  // CROSS-CHAIN PRICE AGGREGATION
  // ================================
  
  /// @notice Price data reported from each chain
  struct ChainPriceData {
    int256 dragonPriceUSD;  // DRAGON/USD price in 1e18 format
    uint256 timestamp;       // When the price was reported
    uint256 lastUpdated;     // Block timestamp when we stored it
  }
  
  /// @notice Mapping of chain EID to their reported DRAGON price
  mapping(uint32 => ChainPriceData) public chainPrices;
  
  /// @notice List of chains that have reported prices
  uint32[] public priceReportingChains;
  mapping(uint32 => bool) public hasPriceReported;
  
  /// @notice Local DRAGON price from Base's own V3 pool TWAP
  int256 public localDragonPriceUSD;
  uint256 public localPriceTimestamp;
  
  /// @notice Price oracle (OmniDragonChainlinkOracle with V4 TWAP)
  address public priceOracle;
  
  /// @notice TWAP period for price calculation (default 5 minutes)
  uint32 public twapPeriod = 300;
  
  /// @notice Staleness threshold for prices (2 hours)
  uint256 public constant PRICE_STALENESS = 7200;

  // Enhanced events for both cross-chain and local requests
  event RandomWordsRequested(
    uint256 indexed requestId,
    uint32 indexed srcEid,
    bytes32 indexed requester,
    uint64 sequence,
    uint256 timestamp
  );

  event LocalRandomWordsRequested(uint256 indexed requestId, address indexed requester, uint256 timestamp);

  event VRFRequestSent(uint256 indexed originalRequestId, uint256 indexed vrfRequestId, uint32 sourceChain);
  event RandomnessFulfilled(uint256 indexed requestId, uint256[] randomWords, uint32 targetChain);
  event ResponseSentToChain(uint64 indexed sequence, uint256 randomWord, uint32 targetChain, uint256 fee);
  event ResponsePending(uint64 indexed sequence, uint256 indexed requestId, uint32 targetChain, string reason);

  event LocalCallbackSent(uint256 indexed requestId, address indexed requester, uint256 randomWord);
  event LocalCallbackFailed(uint256 indexed requestId, address indexed requester, string reason);

  event VRFConfigUpdated(uint256 subscriptionId, bytes32 keyHash, uint32 callbackGasLimit, uint16 requestConfirmations);
  event MinimumBalanceUpdated(uint256 oldBalance, uint256 newBalance);
  event ChainSupportUpdated(uint32 chainEid, bool supported, uint32 gasLimit);
  event ContractFunded(address indexed funder, uint256 amount, uint256 newBalance);
  event LocalCallerAuthorized(address indexed caller, bool authorized);
  
  // Price aggregation events
  event ChainPriceReceived(uint32 indexed chainEid, int256 dragonPriceUSD, uint256 timestamp);
  event LocalPriceUpdated(int256 dragonPriceUSD, uint256 timestamp);
  event AggregatedPriceCalculated(int256 avgPrice, uint256 numChains, uint256 timestamp);
  event PriceOracleSet(address oracle);
  event TwapPeriodSet(uint32 period);

  /**
   * @notice Constructor using registry for LZ endpoint (CREATE2 compatible)
   * @dev Registry must be deployed first at same address on all chains
   * @param _registry OmniDragon registry address (same on all chains)
   */
  constructor(
    address _registry,
    address _owner
  ) OApp(IOmniDragonRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid)), _owner) Ownable(_owner) {
    require(_registry != address(0), "Invalid registry");
    require(_owner != address(0), "Invalid owner");
    registry = IOmniDragonRegistry(_registry);
    
    // Get Base EID from registry (this contract is deployed on Base)
    BASE_EID = registry.getEidForChainId(block.chainid);
    
    // Enable owner for local requests by default
    authorizedLocalCallers[_owner] = true;
  }

  /**
   * @notice Set VRF coordinator address (only owner)
   */
  function setVRFCoordinator(address _vrfCoordinator) external onlyOwner {
    require(_vrfCoordinator != address(0), "Invalid VRF coordinator");
    vrfCoordinator = IVRFCoordinatorV2Plus(_vrfCoordinator);
    emit VRFConfigUpdated(subscriptionId, keyHash, callbackGasLimit, requestConfirmations);
  }

  /**
   * @notice Set VRF subscription ID (only owner)
   */
  function setSubscriptionId(uint256 _subscriptionId) external onlyOwner {
    subscriptionId = _subscriptionId;
    emit VRFConfigUpdated(subscriptionId, keyHash, callbackGasLimit, requestConfirmations);
  }

  /**
   * @notice Set VRF key hash (only owner)
   */
  function setKeyHash(bytes32 _keyHash) external onlyOwner {
    keyHash = _keyHash;
    emit VRFConfigUpdated(subscriptionId, keyHash, callbackGasLimit, requestConfirmations);
  }

  /**
   * @notice Set all VRF parameters at once (only owner)
   */
  function setVRFConfig(
    address _vrfCoordinator,
    uint256 _subscriptionId,
    bytes32 _keyHash
  ) external onlyOwner {
    require(_vrfCoordinator != address(0), "Invalid VRF coordinator");
    vrfCoordinator = IVRFCoordinatorV2Plus(_vrfCoordinator);
    subscriptionId = _subscriptionId;
    keyHash = _keyHash;
    emit VRFConfigUpdated(subscriptionId, keyHash, callbackGasLimit, requestConfirmations);
  }

  /**
   * @notice LayerZero V2 receive function - accepts VRF requests from multiple chains
   * @dev Extended to decode piggybacked DRAGON/USD price from remote chains
   */
  function _lzReceive(
    Origin calldata _origin,
    bytes32,
    bytes calldata _message,
    address,
    bytes calldata
  ) internal override {
    require(supportedChains[_origin.srcEid], "Chain not supported");
    require(peers[_origin.srcEid] == _origin.sender, "Invalid source peer");

    // Decode payload - supports both legacy (8 bytes) and new format (96 bytes)
    uint64 sequence;
    int256 reportedPrice;
    uint256 priceTimestamp;
    
    if (_message.length == 96) {
      // New format with price piggybacking: (sequence, dragonPriceUSD, timestamp)
      (sequence, reportedPrice, priceTimestamp) = abi.decode(_message, (uint64, int256, uint256));
      
      // Store the reported price from this chain
      if (reportedPrice > 0 && priceTimestamp > 0) {
        _updateChainPrice(_origin.srcEid, reportedPrice, priceTimestamp);
      }
    } else {
      // Legacy format: just sequence
      sequence = abi.decode(_message, (uint64));
    }
    
    require(sequenceToRequestId[sequence] == 0, "Duplicate sequence");

    bytes memory extraArgs = "";

    uint256 requestId = vrfCoordinator.requestRandomWords(
      VRFV2PlusClient.RandomWordsRequest({
        keyHash: keyHash,
        subId: subscriptionId,
        requestConfirmations: requestConfirmations,
        callbackGasLimit: callbackGasLimit,
        numWords: numWords,
        extraArgs: extraArgs
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

  /**
   * @notice Request random words directly on Base (simplified API)
   * @dev Alias for requestRandomWordsLocal() - used by LotteryManager
   * @return requestId The VRF request ID
   */
  function requestRandomWords() external returns (uint256 requestId) {
    return _requestRandomWordsLocal();
  }

  /**
   * @notice Request random words directly on Base (local request)
   * @dev For contracts/users on Base that want randomness without cross-chain messaging
   * @return requestId The VRF request ID
   */
  function requestRandomWordsLocal() external returns (uint256 requestId) {
    return _requestRandomWordsLocal();
  }

  /**
   * @dev Internal implementation of local VRF request
   */
  function _requestRandomWordsLocal() internal returns (uint256 requestId) {
    require(address(vrfCoordinator) != address(0), "VRF coordinator not set");
    require(authorizedLocalCallers[msg.sender], "Not authorized for local requests");

    bytes memory extraArgs = "";

    requestId = vrfCoordinator.requestRandomWords(
      VRFV2PlusClient.RandomWordsRequest({
        keyHash: keyHash,
        subId: subscriptionId,
        requestConfirmations: requestConfirmations,
        callbackGasLimit: callbackGasLimit,
        numWords: numWords,
        extraArgs: extraArgs
      })
    );

    localRequestCounter++;

    vrfRequests[requestId] = VRFRequest({
      sequence: 0, // Not used for local requests
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

    return requestId;
  }

  /**
   * @notice Callback function used by VRF Coordinator
   * @dev This function is called by the VRF Coordinator when randomness is ready
   * @param requestId The request ID
   * @param randomWords Array of random words
   */
  function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
    require(msg.sender == address(vrfCoordinator), "Only VRF Coordinator can fulfill");

    VRFRequest storage request = vrfRequests[requestId];
    require(request.timestamp != 0, "Invalid request ID");
    require(!request.fulfilled, "Already fulfilled");

    request.fulfilled = true;
    request.randomWord = randomWords[0];

    if (request.isLocalRequest) {
      // Handle local request callback
      _handleLocalCallback(requestId, request, randomWords);
    } else {
      // Handle cross-chain response
      _handleCrossChainResponse(requestId, request, randomWords);
    }

    emit RandomnessFulfilled(requestId, randomWords, request.sourceChainEid);
  }

  /**
   * @dev Handle callback for local requests
   */
  function _handleLocalCallback(
    uint256 requestId,
    VRFRequest storage request,
    uint256[] calldata randomWords
  ) internal {
    address requester = request.localRequester;

    // Try to call receiveRandomWords if the requester is a contract
    if (requester.code.length > 0) {
      try IVRFCallbackReceiver(requester).receiveRandomWords(requestId, randomWords) {
        request.callbackSent = true;
        emit LocalCallbackSent(requestId, requester, request.randomWord);
      } catch Error(string memory reason) {
        emit LocalCallbackFailed(requestId, requester, reason);
      } catch {
        emit LocalCallbackFailed(requestId, requester, "Unknown callback error");
      }
    }
    // For EOA requests, they can query the result using getLocalRequest()
  }

  /**
   * @dev Handle response for cross-chain requests
   * @notice Adds 5% buffer to quoted fee to handle gas price fluctuation between quote and send
   */
  function _handleCrossChainResponse(
    uint256 requestId,
    VRFRequest storage request,
    uint256[] calldata /* randomWords */
  ) internal {
    uint32 targetGasLimit = chainGasLimits[request.sourceChainEid];
    if (targetGasLimit == 0) {
      targetGasLimit = defaultGasLimit;
    }

    bytes memory payload = abi.encode(request.sequence, request.randomWord);
    bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(targetGasLimit, 0);
    MessagingFee memory fee = _quote(request.sourceChainEid, payload, options, false);
    
    // Add 5% buffer to handle gas price fluctuation between quote and send
    MessagingFee memory feeWithBuffer = MessagingFee({
      nativeFee: fee.nativeFee * 105 / 100,
      lzTokenFee: fee.lzTokenFee
    });

    if (address(this).balance < feeWithBuffer.nativeFee) {
      pendingResponses[request.sequence] = true;
      emit ResponsePending(
        request.sequence,
        requestId,
        request.sourceChainEid,
        "Insufficient balance for LayerZero fees"
      );
      return;
    }

    _sendResponseToChain(request, feeWithBuffer);
  }

  /**
   * @notice Authorize/deauthorize local callers (owner only)
   * @param caller The address to authorize/deauthorize
   * @param authorized Whether to authorize or deauthorize
   */
  function setLocalCallerAuthorization(address caller, bool authorized) external onlyOwner {
    authorizedLocalCallers[caller] = authorized;
    emit LocalCallerAuthorized(caller, authorized);
  }

  /**
   * @notice Get local request details
   * @param requestId The VRF request ID
   * @return requester The address that made the request
   * @return fulfilled Whether the request has been fulfilled
   * @return callbackSent Whether callback was successfully sent
   * @return randomWord The random word (0 if not fulfilled)
   * @return timestamp When the request was made
   */
  function getLocalRequest(
    uint256 requestId
  )
    external
    view
    returns (address requester, bool fulfilled, bool callbackSent, uint256 randomWord, uint256 timestamp)
  {
    VRFRequest storage request = vrfRequests[requestId];
    require(request.isLocalRequest, "Not a local request");

    return (request.localRequester, request.fulfilled, request.callbackSent, request.randomWord, request.timestamp);
  }

  /**
   * @notice Get all local requests for a user
   * @param user The user address
   * @return requestIds Array of request IDs for the user
   */
  function getUserLocalRequests(address user) external view returns (uint256[] memory requestIds) {
    return userLocalRequests[user];
  }

  /**
   * @notice Get local request statistics
   * @return totalLocalRequests Total number of local requests
   * @return totalCrossChainRequests Total number of cross-chain requests (approximate)
   */
  function getRequestStats() external view returns (uint256 totalLocalRequests, uint256 totalCrossChainRequests) {
    totalLocalRequests = localRequestCounter;
    // Cross-chain requests don't have a simple counter, this is an approximation
    totalCrossChainRequests = 0; // Would need to track this separately if needed
  }

  /**
   * @dev Set peer for a specific endpoint ID (owner only)
   * @param _eid The endpoint ID to set the peer for
   * @param _peer The peer address (as bytes32)
   */
  function setPeer(uint32 _eid, bytes32 _peer) public override onlyOwner {
    _setPeer(_eid, _peer);
  }

  /**
   * @notice Add or remove support for a chain
   * @param chainEid The LayerZero endpoint ID of the chain
   * @param supported Whether the chain should be supported
   * @param gasLimit Gas limit for responses to this chain
   */
  function setSupportedChain(uint32 chainEid, bool supported, uint32 gasLimit) external onlyOwner {
    _setSupportedChain(chainEid, supported, gasLimit);
  }

  /**
   * @notice Add a new chain with name (for better UX)
   * @param chainEid The LayerZero endpoint ID of the chain
   * @param chainName Human-readable name for the chain
   * @param gasLimit Gas limit for responses to this chain
   */
  function addNewChain(uint32 chainEid, string calldata chainName, uint32 gasLimit) external onlyOwner {
    require(!supportedChains[chainEid], "Chain already supported");
    require(bytes(chainName).length > 0, "Chain name required");

    bool found = false;
    uint256 regLen = registeredChainEids.length;
    for (uint i = 0; i < regLen; i++) {
      if (registeredChainEids[i] == chainEid) {
        found = true;
        break;
      }
    }

    if (!found) {
      registeredChainEids.push(chainEid);
    }

    chainNames[chainEid] = chainName;
    _setSupportedChain(chainEid, true, gasLimit);
  }

  /**
   * @notice Internal function to set chain support
   */
  function _setSupportedChain(uint32 chainEid, bool supported, uint32 gasLimit) internal {
    supportedChains[chainEid] = supported;
    if (supported) {
      require(gasLimit >= 100000 && gasLimit <= 10000000, "Invalid gas limit");
      chainGasLimits[chainEid] = gasLimit;
    } else {
      chainGasLimits[chainEid] = 0;
    }
    emit ChainSupportUpdated(chainEid, supported, gasLimit);
  }

  /**
   * @notice Get supported chains info (REGISTRY-BASED VERSION)
   */
  function getSupportedChains()
    external
    view
    returns (uint32[] memory eids, bool[] memory supported, uint32[] memory gasLimits)
  {
    uint16[] memory supportedChainIds = registry.getSupportedChains();
    uint256 totalChains = supportedChainIds.length + registeredChainEids.length;

    eids = new uint32[](totalChains);
    supported = new bool[](totalChains);
    gasLimits = new uint32[](totalChains);

    // Add chains from registry
    for (uint i = 0; i < supportedChainIds.length; i++) {
      uint16 chainId = supportedChainIds[i];
      IOmniDragonRegistry.ChainConfig memory config = registry.getChainConfig(chainId);

      eids[i] = registry.chainIdToEid(chainId);
      supported[i] = config.isActive && registry.isChainSupported(chainId);
      gasLimits[i] = chainGasLimits[eids[i]];
    }

    // Add any additional chains registered locally
    uint256 dynLen = registeredChainEids.length;
    for (uint i = 0; i < dynLen; i++) {
      uint256 index = supportedChainIds.length + i;
      eids[index] = registeredChainEids[i];
      supported[index] = supportedChains[registeredChainEids[i]];
      gasLimits[index] = chainGasLimits[registeredChainEids[i]];
    }
  }

  /**
   * @notice Get all registered chains with names
   */
  function getAllChainsWithNames()
    external
    view
    returns (uint32[] memory eids, string[] memory names, bool[] memory supported, uint32[] memory gasLimits)
  {
    uint16[] memory supportedChainIds = registry.getSupportedChains();
    uint256 totalChains = supportedChainIds.length + registeredChainEids.length;

    eids = new uint32[](totalChains);
    names = new string[](totalChains);
    supported = new bool[](totalChains);
    gasLimits = new uint32[](totalChains);

    // Add chains from registry
    for (uint i = 0; i < supportedChainIds.length; i++) {
      uint16 chainId = supportedChainIds[i];
      IOmniDragonRegistry.ChainConfig memory config = registry.getChainConfig(chainId);

      eids[i] = registry.chainIdToEid(chainId);
      names[i] = config.chainName;
      supported[i] = config.isActive && registry.isChainSupported(chainId);
      gasLimits[i] = chainGasLimits[eids[i]];
    }

    // Add any additional chains registered locally
    uint256 dynLen2 = registeredChainEids.length;
    for (uint i = 0; i < dynLen2; i++) {
      uint256 index = supportedChainIds.length + i;
      eids[index] = registeredChainEids[i];
      names[index] = chainNames[registeredChainEids[i]];
      supported[index] = supportedChains[registeredChainEids[i]];
      gasLimits[index] = chainGasLimits[registeredChainEids[i]];
    }
  }

  /**
   * @notice Manual retry for pending responses
   * @dev Call this after funding the contract to retry failed responses.
   * @param sequence The sequence number to retry
   */
  function retryPendingResponse(uint64 sequence) external payable {
    require(pendingResponses[sequence], "No pending response for this sequence");
    
    uint256 requestId = sequenceToRequestId[sequence];
    require(requestId != 0, "Invalid sequence");

    VRFRequest storage request = vrfRequests[requestId];
    require(request.fulfilled, "VRF not fulfilled yet");
    require(!request.responseSent, "Response already sent");

    uint32 targetGasLimit = chainGasLimits[request.sourceChainEid];
    if (targetGasLimit == 0) {
      targetGasLimit = defaultGasLimit;
    }

    bytes memory payload = abi.encode(request.sequence, request.randomWord);
    bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(targetGasLimit, 0);
    MessagingFee memory fee = _quote(request.sourceChainEid, payload, options, false);
    
    // Add 5% buffer to handle gas price fluctuation
    MessagingFee memory feeWithBuffer = MessagingFee({
      nativeFee: fee.nativeFee * 105 / 100,
      lzTokenFee: fee.lzTokenFee
    });

    require(address(this).balance >= feeWithBuffer.nativeFee, "Insufficient contract balance for LayerZero fee");

    delete pendingResponses[sequence];

    _sendResponseToChain(request, feeWithBuffer);
  }

  /**
   * @notice Quote LayerZero fee for sending response to any supported chain
   * @param targetChainEid The chain to send the response to
   */
  function quoteSendToChain(uint32 targetChainEid) external view returns (MessagingFee memory fee) {
    require(supportedChains[targetChainEid], "Chain not supported");

    uint32 targetGasLimit = chainGasLimits[targetChainEid];
    if (targetGasLimit == 0) {
      targetGasLimit = defaultGasLimit;
    }

    // New payload format with aggregated price: (sequence, randomWord, aggregatedPrice, timestamp)
    bytes memory payload = abi.encode(uint64(1), uint256(12345), int256(0), uint256(0));
    bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(targetGasLimit, 0);
    return _quote(targetChainEid, payload, options, false);
  }

  /**
   * @dev Internal function to send the VRF response back to the originating chain.
   * @param _request The VRF request struct containing all necessary data.
   * @param _fee The pre-calculated LayerZero messaging fee.
   * @dev Now includes aggregated DRAGON/USD price in the payload
   */
  function _sendResponseToChain(VRFRequest storage _request, MessagingFee memory _fee) internal {
    uint32 targetGasLimit = chainGasLimits[_request.sourceChainEid];
    if (targetGasLimit == 0) {
      targetGasLimit = defaultGasLimit;
    }

    // Get aggregated price to include in response
    (int256 aggregatedPrice, uint256 numChains) = getAggregatedDragonPrice();
    
    // Extended payload: (sequence, randomWord, aggregatedPrice, timestamp)
    bytes memory payload = abi.encode(
      _request.sequence, 
      _request.randomWord, 
      aggregatedPrice, 
      block.timestamp
    );
    bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(targetGasLimit, 0);

    _request.responseSent = true;

    _lzSend(
      _request.sourceChainEid, // Send back to the originating chain
      payload,
      options,
      _fee,
      payable(owner()) // Refund any excess gas to the owner
    );

    emit ResponseSentToChain(_request.sequence, _request.randomWord, _request.sourceChainEid, _fee.nativeFee);
    if (aggregatedPrice > 0) {
      emit AggregatedPriceCalculated(aggregatedPrice, numChains, block.timestamp);
    }
  }
  
  // ================================
  // PRICE AGGREGATION FUNCTIONS
  // ================================
  
  /**
   * @dev Update the price reported from a remote chain
   */
  function _updateChainPrice(uint32 chainEid, int256 price, uint256 timestamp) internal {
    // Add to tracking list if first time
    if (!hasPriceReported[chainEid]) {
      priceReportingChains.push(chainEid);
      hasPriceReported[chainEid] = true;
    }
    
    chainPrices[chainEid] = ChainPriceData({
      dragonPriceUSD: price,
      timestamp: timestamp,
      lastUpdated: block.timestamp
    });
    
    emit ChainPriceReceived(chainEid, price, timestamp);
  }
  
  /**
   * @notice Update local DRAGON/USD price from OmniDragonChainlinkOracle (V4 TWAP)
   * @dev Oracle calculates: V4 TWAP (DRAGON/Native) × Chainlink (Native/USD) = DRAGON/USD
   */
  function updateLocalPrice() public {
    if (priceOracle == address(0)) return;
    
    IOmniDragonChainlinkOracle oracle = IOmniDragonChainlinkOracle(priceOracle);
    
    // Get DRAGON/USD price from the oracle (which uses V4 TWAP internally)
    try oracle.getDragonPrice() returns (int256 dragonUsd, uint256 timestamp) {
      if (dragonUsd > 0) {
        localDragonPriceUSD = dragonUsd;
        localPriceTimestamp = timestamp;
        emit LocalPriceUpdated(localDragonPriceUSD, localPriceTimestamp);
      }
    } catch {
      // Unable to get price from oracle - try calculating manually
      try oracle.getDragonNativeTWAP(twapPeriod) returns (uint256 dragonPerNative) {
      if (dragonPerNative == 0) return;
      
        try oracle.getNativePrice() returns (int256 nativeUsd, uint256) {
        if (nativeUsd <= 0) return;
        
          // DRAGON/USD = (DRAGON per Native) * (Native/USD)
          localDragonPriceUSD = int256((dragonPerNative * uint256(nativeUsd)) / 1e18);
        localPriceTimestamp = block.timestamp;
        emit LocalPriceUpdated(localDragonPriceUSD, localPriceTimestamp);
      } catch {
        // Unable to get native price
      }
    } catch {
        // Unable to get TWAP from oracle
      }
    }
  }
  
  /**
   * @notice Get aggregated DRAGON/USD price across all chains
   * @return avgPrice The average price in 1e18 format
   * @return numChains Number of chains included in the average
   */
  function getAggregatedDragonPrice() public view returns (int256 avgPrice, uint256 numChains) {
    // Update local price first (view-compatible estimation)
    int256 totalPrice;
    uint256 validChains;
    
    // Include local Base price if valid
    if (localDragonPriceUSD > 0 && block.timestamp - localPriceTimestamp < PRICE_STALENESS) {
      totalPrice += localDragonPriceUSD;
      validChains++;
    }
    
    // Include prices from all reporting chains
    for (uint256 i = 0; i < priceReportingChains.length; i++) {
      uint32 chainEid = priceReportingChains[i];
      ChainPriceData memory priceData = chainPrices[chainEid];
      
      // Check staleness
      if (priceData.dragonPriceUSD > 0 && block.timestamp - priceData.lastUpdated < PRICE_STALENESS) {
        totalPrice += priceData.dragonPriceUSD;
        validChains++;
      }
    }
    
    if (validChains == 0) {
      return (0, 0);
    }
    
    avgPrice = totalPrice / int256(validChains);
    numChains = validChains;
  }
  
  /**
   * @notice Get all chain prices for debugging/monitoring
   * @return chainEids Array of chain EIDs
   * @return prices Array of prices
   * @return timestamps Array of timestamps
   */
  function getAllChainPrices() external view returns (
    uint32[] memory chainEids,
    int256[] memory prices,
    uint256[] memory timestamps
  ) {
    uint256 len = priceReportingChains.length;
    chainEids = new uint32[](len);
    prices = new int256[](len);
    timestamps = new uint256[](len);
    
    for (uint256 i = 0; i < len; i++) {
      chainEids[i] = priceReportingChains[i];
      prices[i] = chainPrices[priceReportingChains[i]].dragonPriceUSD;
      timestamps[i] = chainPrices[priceReportingChains[i]].lastUpdated;
    }
  }
  
  /**
   * @notice Set price oracle (OmniDragonChainlinkOracle with V4 TWAP)
   * @param _oracle OmniDragonChainlinkOracle address
   */
  function setPriceOracle(address _oracle) external onlyOwner {
    priceOracle = _oracle;
    emit PriceOracleSet(_oracle);
  }
  
  /**
   * @notice Set TWAP period for price calculation
   * @param _period TWAP period in seconds
   */
  function setTwapPeriod(uint32 _period) external onlyOwner {
    require(_period > 0, "Invalid period");
    twapPeriod = _period;
    emit TwapPeriodSet(_period);
  }

  /**
   * @dev Set VRF 2.5 configuration (owner only)
   */
  function setVRFConfig(
    uint256 _subscriptionId,
    bytes32 _keyHash,
    uint32 _callbackGasLimit,
    uint16 _requestConfirmations,
    bool _nativePayment
  ) external onlyOwner {
    require(_subscriptionId > 0, "Invalid subscription ID");
    require(_keyHash != bytes32(0), "Invalid key hash");
    require(_callbackGasLimit >= 40000 && _callbackGasLimit <= 2500000, "Invalid callback gas limit");
    require(_requestConfirmations >= 3 && _requestConfirmations <= 200, "Invalid request confirmations");

    subscriptionId = _subscriptionId;
    keyHash = _keyHash;
    callbackGasLimit = _callbackGasLimit;
    requestConfirmations = _requestConfirmations;
    nativePayment = _nativePayment;

    emit VRFConfigUpdated(_subscriptionId, _keyHash, _callbackGasLimit, _requestConfirmations);
  }

  /**
   * @dev Set minimum balance for responses (owner only)
   */
  function setMinimumBalance(uint256 _minimumBalance) external onlyOwner {
    require(_minimumBalance <= 1 ether, "Minimum balance too high");

    uint256 oldBalance = minimumBalance;
    minimumBalance = _minimumBalance;
    emit MinimumBalanceUpdated(oldBalance, _minimumBalance);
  }

  /**
   * @dev Set default gas limit (owner only)
   */
  function setDefaultGasLimit(uint32 _gasLimit) external onlyOwner {
    require(_gasLimit >= 100000 && _gasLimit <= 10000000, "Invalid gas limit");
    defaultGasLimit = _gasLimit;
  }

  /**
   * @dev Fund contract with ETH for LayerZero fees
   */
  function fundContract() external payable {
    require(msg.value > 0, "Must send ETH to fund contract");
    emit ContractFunded(msg.sender, msg.value, address(this).balance);
  }

  /**
   * @dev Override _payNative to handle payments from contract balance when msg.value is 0
   * This is necessary for VRF callbacks where msg.value is 0 but the contract has ETH balance
   */
  function _payNative(uint256 _nativeFee) internal override returns (uint256 nativeFee) {
    // If msg.value is 0 (e.g., from VRF callback), use contract balance
    if (msg.value == 0) {
      require(address(this).balance >= _nativeFee, "Insufficient contract balance for LayerZero fee");
      return _nativeFee;
    }

    // Otherwise, use the standard payment method
    if (msg.value != _nativeFee) revert NotEnoughNative(msg.value);
    return _nativeFee;
  }

  /**
   * @dev Get request details by sequence
   */
  function getRequestBySequence(
    uint64 sequence
  )
    external
    view
    returns (
      uint256 requestId,
      bool exists,
      bool fulfilled,
      bool responseSent,
      uint256 randomWord,
      uint32 sourceChainEid,
      uint256 timestamp
    )
  {
    requestId = sequenceToRequestId[sequence];
    if (requestId == 0) {
      return (0, false, false, false, 0, 0, 0);
    }

    VRFRequest storage request = vrfRequests[requestId];
    return (
      requestId,
      true,
      request.fulfilled,
      request.responseSent,
      request.randomWord,
      request.sourceChainEid,
      request.timestamp
    );
  }

  /**
   * @dev Get request details by VRF request ID
   */
  function getRequestById(
    uint256 requestId
  )
    external
    view
    returns (
      uint64 sequence,
      bool exists,
      bool fulfilled,
      bool responseSent,
      uint256 randomWord,
      uint32 sourceChainEid,
      uint256 timestamp
    )
  {
    VRFRequest storage request = vrfRequests[requestId];
    if (request.timestamp == 0) {
      return (0, false, false, false, 0, 0, 0);
    }

    return (
      request.sequence,
      true,
      request.fulfilled,
      request.responseSent,
      request.randomWord,
      request.sourceChainEid,
      request.timestamp
    );
  }

  /**
   * @dev Check contract status
   */
  function getContractStatus()
    external
    view
    returns (uint256 balance, uint256 minBalance, bool canSendResponses, uint32 gasLimit, uint256 supportedChainsCount)
  {
    balance = address(this).balance;
    minBalance = minimumBalance;
    canSendResponses = balance >= minBalance;
    gasLimit = defaultGasLimit;

    // Count supported chains from registered chains
    uint256 count = 0;
    for (uint i = 0; i < registeredChainEids.length; i++) {
      if (supportedChains[registeredChainEids[i]]) count++;
    }
    supportedChainsCount = count;

    return (balance, minBalance, canSendResponses, gasLimit, supportedChainsCount);
  }

  /**
   * @dev Withdraw ETH (owner only)
   */
  function withdraw() external onlyOwner nonReentrant {
    uint256 balance = address(this).balance;
    require(balance > 0, "No balance to withdraw");

    (bool success, ) = payable(owner()).call{value: balance}("");
    require(success, "Withdrawal failed");
  }

  /**
   * @dev Receive ETH for LayerZero fees
   */
  receive() external payable {}

}