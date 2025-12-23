// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ChainlinkVRFIntegratorV2_5 - Cross-Chain VRF System
 * @author 0xakita.eth
 * @dev Spoke chain contract that receives random words requests and forwards them to Hub chain
 *      for Chainlink VRF 2.5 processing. Part of the CreatorVault cross-chain lottery
 *      and random words infrastructure.
 * 
 * @notice Ready for future cross-chain VRF implementation
 */

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OApp, MessagingFee, Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {MessagingReceipt} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppSender.sol";
import {OAppOptionsType3} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {ICreatorRegistry} from "../interfaces/core/ICreatorRegistry.sol";
import {ICreatorChainlinkOracle} from "../interfaces/oracles/ICreatorChainlinkOracle.sol";

/**
 * @dev Callback interface for VRF consumers
 */
interface IRandomWordsCallbackV2_5 {
    function receiveRandomWords(uint256[] memory randomWords, uint256 requestId) external;
}

contract ChainlinkVRFIntegratorV2_5 is OApp, OAppOptionsType3 {
    using OptionsBuilder for bytes;

    // State variables
    uint64 public requestCounter;
    uint32 public defaultGasLimit = 690420;
    
    /// @notice Hub chain EID for VRF requests (Base by default)
    uint32 public hubEid;

    // ================================
    // PRICE PIGGYBACKING STATE
    // ================================
    
    /// @notice Price oracle for token/USD price
    address public priceOracle;
    
    /// @notice Last aggregated token/USD price received from Hub
    int256 public lastAggregatedPrice;
    uint256 public lastPriceTimestamp;
    
    // Events for price piggybacking
    event PriceReported(int256 priceUSD, uint256 timestamp);
    event AggregatedPriceReceived(int256 aggregatedPrice, uint256 timestamp);
    event PriceOracleSet(address oracle);

    // Request tracking
    struct RequestStatus {
        bool fulfilled;
        bool exists;
        address provider;
        uint256 randomWord;
        uint256 timestamp;
        bool isContract;
    }
    mapping(uint64 => RequestStatus) public s_requests;
    mapping(uint64 => address) public randomWordsProviders;

    // Events
    event RandomWordsRequested(uint64 indexed requestId, address indexed requester, uint32 dstEid);
    event MessageSent(uint64 indexed requestId, uint32 indexed dstEid, bytes message);
    event RandomWordsReceived(uint256[] randomWords, uint64 indexed sequence, address indexed provider);
    event CallbackFailed(uint64 indexed sequence, address indexed provider, string reason);
    event CallbackSucceeded(uint64 indexed sequence, address indexed provider);
    event RequestExpired(uint64 indexed sequence, address indexed provider);
    event GasLimitUpdated(uint32 oldLimit, uint32 newLimit);

    // Configuration
    uint256 public requestTimeout = 1 hours;

    /**
     * @notice Constructor
     * @param _endpoint LayerZero endpoint address
     * @param _owner Owner address
     * @param _hubEid Hub chain EID (e.g., Base = 30184)
     */
    constructor(
        address _endpoint,
        address _owner,
        uint32 _hubEid
    ) OApp(_endpoint, _owner) Ownable(_owner) {
        require(_endpoint != address(0), "Invalid endpoint");
        require(_owner != address(0), "Invalid owner");
        require(_hubEid != 0, "Invalid hub EID");
        hubEid = _hubEid;
    }

    /**
     * @dev Receives random words responses from Hub VRF Consumer
     */
    function _lzReceive(
        Origin calldata _origin,
        bytes32,
        bytes calldata _payload,
        address,
        bytes calldata
    ) internal override {
        require(peers[_origin.srcEid] == _origin.sender, "Unauthorized");
        
        uint64 sequence;
        uint256 randomWord;
        int256 aggregatedPrice;
        uint256 priceTimestamp;
        
        if (_payload.length == 128) {
            // New format with price piggybacking
            (sequence, randomWord, aggregatedPrice, priceTimestamp) = abi.decode(
                _payload, 
                (uint64, uint256, int256, uint256)
            );
            
            if (aggregatedPrice > 0) {
                lastAggregatedPrice = aggregatedPrice;
                lastPriceTimestamp = priceTimestamp;
                emit AggregatedPriceReceived(aggregatedPrice, priceTimestamp);
            }
        } else if (_payload.length == 64) {
            // Legacy format without price
            (sequence, randomWord) = abi.decode(_payload, (uint64, uint256));
        } else {
            revert("Invalid payload size");
        }

        RequestStatus storage request = s_requests[sequence];
        require(request.exists, "Request not found");
        require(!request.fulfilled, "Already fulfilled");
        require(block.timestamp <= request.timestamp + requestTimeout, "Expired");

        address provider = request.provider;
        require(provider != address(0), "Provider not found");

        request.fulfilled = true;
        request.randomWord = randomWord;
        delete randomWordsProviders[sequence];

        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = randomWord;

        emit RandomWordsReceived(randomWords, sequence, provider);

        if (request.isContract) {
            try IRandomWordsCallbackV2_5(provider).receiveRandomWords(randomWords, uint256(sequence)) {
                emit CallbackSucceeded(sequence, provider);
            } catch Error(string memory reason) {
                emit CallbackFailed(sequence, provider, reason);
            } catch {
                emit CallbackFailed(sequence, provider, "Low-level callback failure");
            }
        }
    }

    /**
     * @notice Check request status
     */
    function checkRequestStatus(uint64 requestId)
        external
        view
        returns (bool fulfilled, bool exists, address provider, uint256 randomWord, uint256 timestamp, bool expired)
    {
        RequestStatus memory request = s_requests[requestId];
        return (
            request.fulfilled,
            request.exists,
            request.provider,
            request.randomWord,
            request.timestamp,
            block.timestamp > request.timestamp + requestTimeout
        );
    }

    /**
     * @notice Get random word for fulfilled request
     */
    function getRandomWord(uint64 requestId) external view returns (uint256 randomWord, bool fulfilled) {
        RequestStatus memory request = s_requests[requestId];
        return (request.randomWord, request.fulfilled);
    }

    /**
     * @notice Quote fee for VRF request
     */
    function quoteFee() public view returns (MessagingFee memory fee) {
        bytes memory options = hex"000301001101000000000000000000000000000A88F4";
        bytes memory payload = abi.encode(uint64(requestCounter + 1), int256(0), uint256(0));
        return _quote(hubEid, payload, options, false);
    }

    /**
     * @notice Quote fee with custom gas limit
     */
    function quoteFeeWithGas(uint32 _gasLimit) public view returns (MessagingFee memory fee) {
        bytes memory options = OptionsBuilder.newOptions().addExecutorLzReceiveOption(_gasLimit, 0);
        bytes memory payload = abi.encode(uint64(requestCounter + 1), int256(0), uint256(0));
        return _quote(hubEid, payload, options, false);
    }

    /**
     * @notice Request random words (contract-sponsored fee)
     */
    function requestRandomWords()
        external
        returns (MessagingReceipt memory receipt, uint64 requestId)
    {
        return _requestRandomWords(hubEid, false);
    }

    /**
     * @notice Request random words with caller-provided fee
     */
    function requestRandomWordsPayable()
        external
        payable
        returns (MessagingReceipt memory receipt, uint64 requestId)
    {
        return _requestRandomWords(hubEid, true);
    }

    function _requestRandomWords(uint32 dstEid, bool payable_)
        internal
        returns (MessagingReceipt memory receipt, uint64 requestId)
    {
        require(dstEid == hubEid, "Invalid destination");
        bytes memory options = hex"000301001101000000000000000000000000000A88F4";

        bytes32 peer = peers[hubEid];
        require(peer != bytes32(0), "Hub peer not set");

        requestCounter++;
        requestId = requestCounter;

        bool isContract = msg.sender.code.length > 0;
        s_requests[requestId] = RequestStatus({
            fulfilled: false,
            exists: true,
            provider: msg.sender,
            randomWord: 0,
            timestamp: block.timestamp,
            isContract: isContract
        });
        randomWordsProviders[requestId] = msg.sender;

        bytes memory payload = abi.encode(requestId, int256(0), uint256(0));
        
        MessagingFee memory fee = quoteFee();
        
        if (payable_) {
            require(msg.value >= fee.nativeFee, "Insufficient fee");
        } else {
            require(address(this).balance >= fee.nativeFee, "NotEnoughNative");
        }

        receipt = _lzSend(
            hubEid,
            payload,
            options,
            fee,
            payable(payable_ ? msg.sender : address(this))
        );

        emit RandomWordsRequested(requestId, msg.sender, hubEid);
        emit MessageSent(requestId, hubEid, payload);
    }

    // ================================
    // ADMIN FUNCTIONS
    // ================================

    function setDefaultGasLimit(uint32 _gasLimit) external onlyOwner {
        uint32 oldLimit = defaultGasLimit;
        defaultGasLimit = _gasLimit;
        emit GasLimitUpdated(oldLimit, _gasLimit);
    }

    function setHubEid(uint32 _hubEid) external onlyOwner {
        require(_hubEid != 0, "Invalid hub EID");
        require(peers[_hubEid] != bytes32(0), "Peer not set");
        hubEid = _hubEid;
    }

    function setRequestTimeout(uint256 _timeout) external onlyOwner {
        requestTimeout = _timeout;
    }

    function setPriceOracle(address _oracle) external onlyOwner {
        priceOracle = _oracle;
        emit PriceOracleSet(_oracle);
    }

    /**
     * @notice Clean up expired requests
     */
    function cleanupExpiredRequests(uint64[] calldata requestIds) external {
        for (uint256 i = 0; i < requestIds.length; i++) {
            uint64 requestId = requestIds[i];
            RequestStatus storage request = s_requests[requestId];

            if (request.exists && !request.fulfilled && block.timestamp > request.timestamp + requestTimeout) {
                address provider = request.provider;
                delete s_requests[requestId];
                delete randomWordsProviders[requestId];
                emit RequestExpired(requestId, provider);
            }
        }
    }

    function _payNative(uint256 _nativeFee) internal override returns (uint256 nativeFee) {
        if (msg.value == 0) {
            require(address(this).balance >= _nativeFee, "NotEnoughNative");
            return _nativeFee;
        }
        if (msg.value != _nativeFee) revert NotEnoughNative(msg.value);
        return _nativeFee;
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}
