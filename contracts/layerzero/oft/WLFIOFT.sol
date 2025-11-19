// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IEagleRegistry } from "../../interfaces/IEagleRegistry.sol";

/**
 * @title WLFIOFT
 * @notice LayerZero OFT for WLFI on remote chains (Base, etc.)
 * 
 * @dev ARCHITECTURE:
 *      - Standard ERC20 functionality
 *      - LayerZero OFT cross-chain transfers
 *      - Uses EagleRegistry for dynamic endpoint resolution
 *      - Minted when WLFI locked on Ethereum
 *      - Burned when WLFI unlocked on Ethereum
 * 
 * @dev DEPLOYMENT:
 *      Deploy on Base and other remote chains
 *      NOT deployed on Ethereum (use WLFIOFTAdapter there)
 * 
 * https://keybase.io/47eagle
 */
contract WLFIOFT is OFT {
    
    // =================================
    // IMMUTABLE REFERENCES (For Verification)
    // =================================
    
    /// @notice Official WLFI token on Ethereum (source chain for this OFT)
    address public constant OFFICIAL_WLFI_TOKEN = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    
    /// @notice WLFI OFT Adapter on Ethereum (bridges WLFI to this OFT)
    address public constant WLFI_ADAPTER_ETHEREUM = 0x2437F6555350c131647daA0C655c4B49A7aF3621;
    
    /// @notice Native WLFI on BNB Chain (wrapped by BNB Chain adapter)
    address public constant WLFI_BNB_CHAIN = 0x47474747477b199288bF72a1D702f7Fe0Fb1DEeA;
    
    /// @notice WLFI OFT Adapter on BNB Chain (bridges WLFI to this OFT)
    /// @dev This address will be set after deployment on BNB Chain
    /// @dev Update this constant before deploying Base OFT with BNB support
    address public constant WLFI_ADAPTER_BNB = address(0); // TO BE DEPLOYED
    
    /// @notice Native WLFI SPL token on Solana
    /// @dev Solana address (base58): WLFinEv6ypjkczcS83FZqFpgFZYwQXutRbxGe7oC16g
    /// @dev This is the native SPL token, NOT an OFT
    string public constant WLFI_SOLANA_SPL = "WLFinEv6ypjkczcS83FZqFpgFZYwQXutRbxGe7oC16g";
    
    /// @notice WLFI OFT Adapter on Solana (bridges native Solana WLFI to Base)
    /// @dev This is an ADAPTER (locks native WLFI), not an OFT
    /// @dev Solana addresses are 32 bytes, stored as bytes32 for LayerZero peers
    /// @dev This will be set after Solana adapter deployment
    bytes32 public constant WLFI_ADAPTER_SOLANA = bytes32(0); // TO BE DEPLOYED
    
    /// @notice EagleRegistry (shared across all Eagle contracts)
    address public constant EAGLE_REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e;
    
    /// @notice EagleShareOFT (EAGLE token) - for cross-reference
    address public constant EAGLE_SHARE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    
    // =================================
    // CHAIN IDENTIFIERS
    // =================================
    
    /// @notice Ethereum mainnet chain ID
    uint256 public constant ETHEREUM_CHAIN_ID = 1;
    
    /// @notice Ethereum LayerZero EID
    uint32 public constant ETHEREUM_EID = 30101;
    
    /// @notice BNB Chain LayerZero EID
    uint32 public constant BNB_CHAIN_EID = 30102;
    
    /// @notice Solana LayerZero EID
    uint32 public constant SOLANA_EID = 30168;
    
    // =================================
    // IMPORTANT NOTE ABOUT OTHER CHAINS
    // =================================
    
    /// @notice MULTI-HUB ARCHITECTURE: Base WLFI OFT connects to THREE chains
    /// @dev This OFT has multiple peers (all ADAPTERS that lock native WLFI):
    ///      1. Ethereum Adapter (EID 30101) - locks native Ethereum WLFI
    ///      2. BNB Chain Adapter (EID 30102) - locks native BNB Chain WLFI
    ///      3. Solana Adapter (EID 30168) - locks native Solana WLFI (SPL token)
    /// @dev WLFI Token Addresses by Chain:
    ///      - Ethereum: Native ERC20 (0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6)
    ///      - Base: LayerZero OFT (this contract, accepts from ALL chains)
    ///      - BNB Chain: Native BEP20 (0x47474747477b199288bF72a1D702f7Fe0Fb1DEeA)
    ///      - Solana: Native SPL (WLFinEv6ypjkczcS83FZqFpgFZYwQXutRbxGe7oC16g)
    /// @dev All WLFI on Base is fungible regardless of source chain
    /// @dev Supply invariant: Base Supply = Ethereum Locked + BNB Locked + Solana Locked
    
    // =================================
    // STATE VARIABLES
    // =================================
    
    /// @notice EagleRegistry for dynamic LayerZero endpoint retrieval
    IEagleRegistry public immutable registry;
    
    // =================================
    // ERRORS
    // =================================
    
    error ZeroAddress();
    
    // =================================
    // CONSTRUCTOR
    // =================================
    
    /**
     * @notice Creates WLFI OFT for remote chains
     * @param _name Token name ("WLFI")
     * @param _symbol Token symbol ("WLFI")
     * @param _registry EagleRegistry for dynamic LayerZero endpoint retrieval
     * @param _owner Owner address (multisig)
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _registry,
        address _owner
    ) OFT(_name, _symbol, _getLzEndpoint(_registry), _owner) Ownable(_owner) {
        if (_owner == address(0)) revert ZeroAddress();
        if (_registry == address(0)) revert ZeroAddress();
        
        registry = IEagleRegistry(_registry);
    }
    
    /**
     * @notice Helper to get LayerZero endpoint from registry
     * @dev Used during construction to retrieve the endpoint
     */
    function _getLzEndpoint(address _registry) private view returns (address) {
        if (_registry == address(0)) revert ZeroAddress();
        address endpoint = IEagleRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid));
        if (endpoint == address(0)) revert ZeroAddress();
        return endpoint;
    }
    
    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    /**
     * @notice Get contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0-mainnet-registry";
    }
    
    /**
     * @notice Verify all critical addresses match official deployments
     * @dev Returns true if all checks pass, users should verify this returns true
     * @dev MULTI-HUB: Checks Ethereum, BNB Chain, and Solana peers
     * @return isAuthentic True if registry and all configured peers are correct
     * @return checks Array of boolean checks in order:
     *         [0] Registry matches EAGLE_REGISTRY
     *         [1] Ethereum peer matches WLFI_ADAPTER_ETHEREUM
     *         [2] BNB Chain peer matches WLFI_ADAPTER_BNB (if deployed)
     *         [3] Solana peer matches WLFI_OFT_SOLANA (if deployed)
     *         [4] Has code at EAGLE_SHARE_OFT (sanity check)
     */
    function verifyAuthenticity() external view returns (bool isAuthentic, bool[5] memory checks) {
        checks[0] = address(registry) == EAGLE_REGISTRY;
        checks[1] = this.peers(ETHEREUM_EID) == bytes32(uint256(uint160(WLFI_ADAPTER_ETHEREUM)));
        
        // BNB peer check: only fail if adapter is deployed but peer is wrong
        if (WLFI_ADAPTER_BNB != address(0)) {
            checks[2] = this.peers(BNB_CHAIN_EID) == bytes32(uint256(uint160(WLFI_ADAPTER_BNB)));
        } else {
            checks[2] = true; // Pass check if BNB not configured yet
        }
        
        // Solana peer check: only fail if adapter is deployed but peer is wrong
        if (WLFI_ADAPTER_SOLANA != bytes32(0)) {
            checks[3] = this.peers(SOLANA_EID) == WLFI_ADAPTER_SOLANA;
        } else {
            checks[3] = true; // Pass check if Solana not configured yet
        }
        
        checks[4] = EAGLE_SHARE_OFT.code.length > 0; // Sanity: EAGLE should exist
        
        isAuthentic = checks[0] && checks[1] && checks[2] && checks[3] && checks[4];
    }
    
    /**
     * @notice Returns all official contract addresses for verification
     * @dev Users can verify this OFT is connected to the correct contracts
     * @dev MULTI-HUB: Returns addresses for Ethereum, BNB Chain, and Solana
     */
    function getOfficialAddresses() external view returns (
        address wlfiTokenEthereum,
        address wlfiAdapterEthereum,
        address wlfiTokenBNB,
        address wlfiAdapterBNB,
        string memory wlfiTokenSolana,
        bytes32 wlfiAdapterSolana,
        address eagleRegistry,
        address eagleShareOFT,
        address currentOwner
    ) {
        return (
            OFFICIAL_WLFI_TOKEN,
            WLFI_ADAPTER_ETHEREUM,
            WLFI_BNB_CHAIN,
            WLFI_ADAPTER_BNB,
            WLFI_SOLANA_SPL,
            WLFI_ADAPTER_SOLANA,
            EAGLE_REGISTRY,
            EAGLE_SHARE_OFT,
            owner()
        );
    }
    
    /**
     * @notice Returns information about WLFI multi-hub architecture
     * @dev Helps users understand this OFT accepts bridges from THREE chains
     * @return connectedChains Description of all connected chains
     */
    function getChainInfo() external pure returns (string memory connectedChains) {
        return "Multi-hub: Ethereum (EID 30101), BNB Chain (EID 30102), Solana (EID 30168)";
    }
    
    /**
     * @notice Get all hub chain information
     * @dev Returns EIDs and adapter addresses for all supported chains
     * @dev NOTE: All three chains use ADAPTERS (lock native WLFI), not OFTs
     * @return ethereumEID Ethereum LayerZero endpoint ID
     * @return ethereumAdapter Ethereum WLFI adapter address
     * @return bnbEID BNB Chain LayerZero endpoint ID
     * @return bnbAdapter BNB Chain WLFI adapter address
     * @return solanaEID Solana LayerZero endpoint ID
     * @return solanaAdapter Solana WLFI adapter address (bytes32)
     */
    function getAllHubs() external pure returns (
        uint32 ethereumEID,
        address ethereumAdapter,
        uint32 bnbEID,
        address bnbAdapter,
        uint32 solanaEID,
        bytes32 solanaAdapter
    ) {
        return (
            ETHEREUM_EID,
            WLFI_ADAPTER_ETHEREUM,
            BNB_CHAIN_EID,
            WLFI_ADAPTER_BNB,
            SOLANA_EID,
            WLFI_ADAPTER_SOLANA
        );
    }
    
    /**
     * @notice Check if a specific chain's bridge is configured
     * @param _eid Chain EID to check (30101=Ethereum, 30102=BNB, 30168=Solana)
     * @return isConfigured True if peer is set for this chain
     * @return peerAddress The peer address (or zero if not set)
     * @return chainName Human-readable chain name
     */
    function isBridgeConfigured(uint32 _eid) external view returns (
        bool isConfigured,
        bytes32 peerAddress,
        string memory chainName
    ) {
        peerAddress = this.peers(_eid);
        isConfigured = peerAddress != bytes32(0);
        
        if (_eid == ETHEREUM_EID) chainName = "Ethereum";
        else if (_eid == BNB_CHAIN_EID) chainName = "BNB Chain";
        else if (_eid == SOLANA_EID) chainName = "Solana";
        else chainName = "Unknown";
    }
    
    /**
     * @notice Returns verification links
     * @dev For additional authenticity verification
     * @return keybaseProof Cryptographic proof for this bridge infrastructure
     * @return officialWLFI Official WLFI token website (the underlying asset)
     * @return bridgeDocs Documentation for this LayerZero bridge
     */
    function verificationInfo() external pure returns (
        string memory keybaseProof,
        string memory officialWLFI,
        string memory bridgeDocs
    ) {
        return (
            "https://keybase.io/47eagle",
            "https://worldlibertyfinancial.com/",
            "https://docs.47eagle.com"
        );
    }
    
    /**
     * @notice Check if this contract's peer on a given chain matches expected address
     * @dev Users can verify the Ethereum peer matches the official WLFI Adapter
     * @param _eid Chain EID to check
     * @return peerAddress The peer address for that chain
     * @return isEthereum True if checking Ethereum peer
     */
    function verifyPeer(uint32 _eid) external view returns (bytes32 peerAddress, bool isEthereum) {
        peerAddress = this.peers(_eid);
        isEthereum = (_eid == 30101); // Ethereum mainnet EID
    }
}

