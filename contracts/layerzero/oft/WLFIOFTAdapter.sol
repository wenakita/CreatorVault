// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { OFTAdapter } from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WLFIOFTAdapter
 * @notice LayerZero OFT Adapter for WLFI token on Ethereum
 * 
 * @dev ARCHITECTURE:
 *      - Locks native WLFI on Ethereum
 *      - Mints WLFI OFT on remote chains (Base, etc.)
 *      - Standard LayerZero OFT Adapter pattern
 * 
 * @dev DEPLOYMENT:
 *      Deploy on Ethereum mainnet only
 *      Connects to WLFI token: 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6
 * 
 * https://keybase.io/47eagle
 */
contract WLFIOFTAdapter is OFTAdapter {
    
    // =================================
    // IMMUTABLE REFERENCES (For Verification)
    // =================================
    
    /// @notice Official WLFI token on Ethereum (native on this chain)
    address public constant OFFICIAL_WLFI_TOKEN = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    
    /// @notice WLFI OFT on Base (primary spoke chain via LayerZero)
    address public constant WLFI_OFT_BASE = 0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e;
    
    /// @notice EagleRegistry (shared across all Eagle contracts)
    address public constant EAGLE_REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e;
    
    /// @notice EagleShareOFT (EAGLE token) - for cross-reference
    address public constant EAGLE_SHARE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    
    /// @notice Base chain LayerZero EID
    uint32 public constant BASE_EID = 30184;
    
    // =================================
    // IMPORTANT NOTE ABOUT OTHER CHAINS
    // =================================
    
    /// @notice WLFI also exists natively on BNB Chain (NOT bridged via this adapter)
    /// @dev This adapter ONLY bridges Ethereum WLFI to Base via LayerZero
    /// @dev BNB Chain WLFI is a separate native deployment
    /// @dev For BNB Chain WLFI address, check official WLFI documentation
    
    // =================================
    // CONSTRUCTOR
    // =================================
    
    /**
     * @notice Creates WLFI OFT Adapter
     * @param _wlfiToken WLFI token address (0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6)
     * @param _layerZeroEndpoint LayerZero V2 endpoint (0x1a44076050125825900e736c501f859c50fE728c)
     * @param _owner Owner address (multisig)
     */
    constructor(
        address _wlfiToken,
        address _layerZeroEndpoint,
        address _owner
    ) OFTAdapter(_wlfiToken, _layerZeroEndpoint, _owner) Ownable(_owner) {
        require(_wlfiToken == OFFICIAL_WLFI_TOKEN, "WLFIOFTAdapter: Invalid WLFI token");
    }
    
    // =================================
    // VIEW FUNCTIONS (For Verification)
    // =================================
    
    /**
     * @notice Get contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0-mainnet";
    }
    
    /**
     * @notice Verify all critical addresses match official deployments
     * @dev Returns true if all checks pass
     * @return isAuthentic True if token and peer are correct
     * @return checks Array of boolean checks in order:
     *         [0] Token is OFFICIAL_WLFI_TOKEN
     *         [1] Base peer matches WLFI_OFT_BASE
     *         [2] Has code at EAGLE_SHARE_OFT (sanity check)
     */
    function verifyAuthenticity() external view returns (bool isAuthentic, bool[3] memory checks) {
        checks[0] = address(token()) == OFFICIAL_WLFI_TOKEN;
        checks[1] = this.peers(BASE_EID) == bytes32(uint256(uint160(WLFI_OFT_BASE)));
        checks[2] = EAGLE_SHARE_OFT.code.length > 0; // Sanity: EAGLE should exist
        
        isAuthentic = checks[0] && checks[1] && checks[2];
    }
    
    /**
     * @notice Returns all official contract addresses for verification
     * @dev IMPORTANT: This adapter only bridges Ethereum WLFI to Base.
     *      WLFI also exists natively on BNB Chain (not managed by this adapter).
     */
    function getOfficialAddresses() external view returns (
        address wlfiToken,
        address wlfiOFTBase,
        address eagleRegistry,
        address eagleShareOFT,
        address currentOwner
    ) {
        return (
            OFFICIAL_WLFI_TOKEN,
            WLFI_OFT_BASE,
            EAGLE_REGISTRY,
            EAGLE_SHARE_OFT,
            owner()
        );
    }
    
    /**
     * @notice Get information about this bridge
     * @dev Shows which chains are supported and links to official resources
     * @return bridgedChains Chains this adapter bridges to
     * @return officialWLFI Official WLFI website
     * @return bridgeDocs Documentation for this bridge
     */
    function getBridgeInfo() external pure returns (
        string memory bridgedChains,
        string memory officialWLFI,
        string memory bridgeDocs
    ) {
        return (
            "Base via LayerZero OFT (Note: WLFI also exists natively on BNB Chain and Solana)",
            "https://worldlibertyfinancial.com/",
            "https://docs.47eagle.com"
        );
    }
    
    /**
     * @notice Returns verification links
     */
    function verificationInfo() external pure returns (
        string memory keybaseProof,
        string memory officialWebsite,
        string memory documentation
    ) {
        return (
            "https://keybase.io/47eagle",
            "https://wlfi.com", // Update with official WLFI website
            "https://docs.eagle-vault.com" // Update with your docs site
        );
    }
}

