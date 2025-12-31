// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {CreatorOVault} from "../vault/CreatorOVault.sol";
import {CreatorOVaultWrapper} from "../vault/CreatorOVaultWrapper.sol";
import {CreatorShareOFT} from "../layerzero/CreatorShareOFT.sol";

/**
 * @title MinimalVaultFactory
 * @notice Lightweight factory for deploying Creator Vaults with CREATE2
 * @dev Deploys only core contracts: Vault, Wrapper, ShareOFT
 *      Gauge and CCA can be deployed separately
 * 
 * FEATURES:
 * - CREATE2 deployment (deterministic addresses across chains)
 * - Auto-configuration of permissions
 * - Same addresses on all EVM chains
 * - Under 24KB contract size limit
 * 
 * SIZE OPTIMIZATION:
 * - No Gauge deployment (deploy separately)
 * - No CCA deployment (deploy separately)
 * - Minimal storage
 * - Essential functions only
 */
contract MinimalVaultFactory {
    
    // =================================
    // CONSTANTS
    // =================================
    
    /// @notice LayerZero endpoint (Base mainnet)
    address public constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    
    /// @notice VaultActivationBatcher (for CCA launching)
    address public constant VAULT_ACTIVATION_BATCHER = 0x6d796554698f5Ddd74Ff20d745304096aEf93CB6;
    
    // =================================
    // EVENTS
    // =================================
    
    event VaultDeployed(
        address indexed creatorToken,
        address indexed vault,
        address wrapper,
        address shareOFT,
        address creator
    );
    
    // =================================
    // ERRORS
    // =================================
    
    error ZeroAddress();
    error DeploymentFailed();
    
    // =================================
    // MAIN DEPLOYMENT FUNCTION
    // =================================
    
    /**
     * @notice Deploy vault infrastructure with auto-generated names
     * @param creatorToken The underlying token (e.g., AKITA)
     * @param creator The owner of the deployed contracts
     * @return vault CreatorOVault address
     * @return wrapper CreatorOVaultWrapper address
     * @return shareOFT CreatorShareOFT address (wsToken)
     * 
     * @dev USES CREATE2 FOR DETERMINISTIC ADDRESSES
     *      Same creatorToken = Same addresses on all chains!
     * 
     * @dev NAMING:
     *      Token: AKITA → Vault: "AKITA Vault" (vAKITA) → wsToken: "Wrapped AKITA Share" (wsAKITA)
     */
    function deployVault(
        address creatorToken,
        address creator
    ) external returns (
        address vault,
        address wrapper,
        address shareOFT
    ) {
        if (creatorToken == address(0)) revert ZeroAddress();
        if (creator == address(0)) revert ZeroAddress();
        
        // Get token symbol and generate names
        string memory symbol = _toUpper(IERC20Metadata(creatorToken).symbol());
        string memory vaultName = string(abi.encodePacked(symbol, " Vault"));
        string memory vaultSymbol = string(abi.encodePacked("v", symbol));
        string memory oftName = string(abi.encodePacked("Wrapped ", symbol, " Share"));
        string memory oftSymbol = string(abi.encodePacked("ws", symbol));
        
        // Generate deterministic salt
        bytes32 baseSalt = keccak256(abi.encodePacked("CREATORVAULT_V1_", creatorToken, symbol));
        
        // Deploy with CREATE2
        vault = _deployVault(creatorToken, vaultName, vaultSymbol, creator, baseSalt);
        wrapper = _deployWrapper(creatorToken, vault, creator, baseSalt);
        shareOFT = _deployShareOFT(oftName, oftSymbol, creator, baseSalt);
        
        // Configure permissions
        _configure(vault, wrapper, shareOFT);
        
        emit VaultDeployed(creatorToken, vault, wrapper, shareOFT, creator);
    }
    
    // =================================
    // INTERNAL DEPLOYMENT
    // =================================
    
    function _deployVault(
        address token,
        string memory name,
        string memory symbol,
        address owner,
        bytes32 baseSalt
    ) internal returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(baseSalt, "vault"));
        bytes memory bytecode = abi.encodePacked(
            type(CreatorOVault).creationCode,
            abi.encode(token, owner, name, symbol)
        );
        return _create2(bytecode, salt);
    }
    
    function _deployWrapper(
        address token,
        address vault,
        address owner,
        bytes32 baseSalt
    ) internal returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(baseSalt, "wrapper"));
        bytes memory bytecode = abi.encodePacked(
            type(CreatorOVaultWrapper).creationCode,
            abi.encode(token, vault, owner)
        );
        return _create2(bytecode, salt);
    }
    
    function _deployShareOFT(
        string memory name,
        string memory symbol,
        address owner,
        bytes32 baseSalt
    ) internal returns (address) {
        bytes32 salt = keccak256(abi.encodePacked(baseSalt, "oft"));
        bytes memory bytecode = abi.encodePacked(
            type(CreatorShareOFT).creationCode,
            abi.encode(name, symbol, LZ_ENDPOINT, owner)
        );
        return _create2(bytecode, salt);
    }
    
    function _create2(bytes memory bytecode, bytes32 salt) internal returns (address addr) {
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        if (addr == address(0)) revert DeploymentFailed();
    }
    
    // =================================
    // CONFIGURATION
    // =================================
    
    function _configure(address vault, address wrapper, address shareOFT) internal {
        // Set wrapper's ShareOFT
        CreatorOVaultWrapper(wrapper).setShareOFT(shareOFT);
        
        // Set ShareOFT's vault
        CreatorShareOFT(shareOFT).setVault(vault);
        
        // Give wrapper minter rights on ShareOFT
        CreatorShareOFT(shareOFT).setMinter(wrapper, true);
        
        // Whitelist wrapper on vault
        CreatorOVault(payable(vault)).setWhitelist(wrapper, true);
    }
    
    // =================================
    // UTILITIES
    // =================================
    
    function _toUpper(string memory str) internal pure returns (string memory) {
        bytes memory b = bytes(str);
        bytes memory upper = new bytes(b.length);
        for (uint i = 0; i < b.length; i++) {
            if (b[i] >= 0x61 && b[i] <= 0x7A) {
                upper[i] = bytes1(uint8(b[i]) - 32);
            } else {
                upper[i] = b[i];
            }
        }
        return string(upper);
    }
    
    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    /**
     * @notice Predict addresses before deployment
     * @param creatorToken The underlying token
     * @return vault Predicted vault address
     * @return wrapper Predicted wrapper address
     * @return shareOFT Predicted shareOFT address
     */
    function predictAddresses(
        address creatorToken
    ) external view returns (
        address vault,
        address wrapper,
        address shareOFT
    ) {
        string memory symbol = _toUpper(IERC20Metadata(creatorToken).symbol());
        string memory vaultName = string(abi.encodePacked(symbol, " Vault"));
        string memory vaultSymbol = string(abi.encodePacked("v", symbol));
        string memory oftName = string(abi.encodePacked("Wrapped ", symbol, " Share"));
        string memory oftSymbol = string(abi.encodePacked("ws", symbol));
        
        bytes32 baseSalt = keccak256(abi.encodePacked("CREATORVAULT_V1_", creatorToken, symbol));
        
        // Note: Creator address is needed for accurate prediction
        // This returns approximate addresses (owner-dependent)
        address predictedCreator = msg.sender;
        
        vault = _predictCreate2(
            abi.encodePacked(
                type(CreatorOVault).creationCode,
                abi.encode(creatorToken, predictedCreator, vaultName, vaultSymbol)
            ),
            keccak256(abi.encodePacked(baseSalt, "vault"))
        );
        
        wrapper = _predictCreate2(
            abi.encodePacked(
                type(CreatorOVaultWrapper).creationCode,
                abi.encode(creatorToken, vault, predictedCreator)
            ),
            keccak256(abi.encodePacked(baseSalt, "wrapper"))
        );
        
        shareOFT = _predictCreate2(
            abi.encodePacked(
                type(CreatorShareOFT).creationCode,
                abi.encode(oftName, oftSymbol, LZ_ENDPOINT, predictedCreator)
            ),
            keccak256(abi.encodePacked(baseSalt, "oft"))
        );
    }
    
    function _predictCreate2(bytes memory bytecode, bytes32 salt) internal view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );
        return address(uint160(uint256(hash)));
    }
}
