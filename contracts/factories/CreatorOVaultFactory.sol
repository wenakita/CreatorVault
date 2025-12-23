// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICreatorRegistry} from "../interfaces/core/ICreatorRegistry.sol";

/**
 * @title CreatorOVaultFactory
 * @author 0xakita.eth
 * @notice Registry for Creator Vault deployments (contracts deployed via script)
 * 
 * @dev DESIGN RATIONALE:
 *      Original factory exceeded EVM contract size limit (88KB > 24KB)
 *      because it embedded bytecode for 6 contracts.
 *      
 *      NEW APPROACH:
 *      - Contracts deployed directly via Foundry script (no size limit)
 *      - This contract just stores deployment info
 *      - Enables lookup, enumeration, and registry integration
 * 
 * @dev DEPLOYMENT FLOW:
 *      1. Deploy this factory (part of infrastructure)
 *      2. Run DeployCreatorVault.s.sol which:
 *         - Deploys all 6 contracts individually
 *         - Calls factory.registerDeployment() to store info
 *      3. Addresses stored here for lookup
 */
contract CreatorOVaultFactory is Ownable {
    
    // =================================
    // STATE
    // =================================
    
    ICreatorRegistry public registry;
    uint256 public deploymentCount;
    
    mapping(address => DeploymentInfo) public deployments;
    address[] public deployedTokens;
    
    /// @notice Authorized deployers (can register deployments)
    mapping(address => bool) public authorizedDeployers;
    
    struct DeploymentInfo {
        address creatorCoin;
        address vault;
        address wrapper;
        address shareOFT;
        address gaugeController;
        address ccaStrategy;
        address oracle;
        address creator;
        uint256 deployedAt;
        bool exists;
    }
    
    // =================================
    // EVENTS
    // =================================
    
    event DeploymentRegistered(
        address indexed creatorCoin,
        address indexed vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy,
        address oracle,
        address creator
    );
    
    event DeployerAuthorized(address indexed deployer, bool authorized);
    event RegistryUpdated(address indexed newRegistry);
    
    // =================================
    // ERRORS
    // =================================
    
    error ZeroAddress();
    error AlreadyDeployed();
    error NotAuthorized();
    
    // =================================
    // CONSTRUCTOR
    // =================================
    
    constructor(address _registry, address _owner) Ownable(_owner) {
        if (_owner == address(0)) revert ZeroAddress();
        if (_registry != address(0)) {
            registry = ICreatorRegistry(_registry);
        }
        // Owner is always authorized
        authorizedDeployers[_owner] = true;
    }
    
    // =================================
    // MODIFIERS
    // =================================
    
    modifier onlyAuthorizedDeployer() {
        if (!authorizedDeployers[msg.sender] && msg.sender != owner()) {
            revert NotAuthorized();
        }
        _;
    }
    
    // =================================
    // ADMIN FUNCTIONS
    // =================================
    
    /**
     * @notice Authorize/deauthorize a deployer
     */
    function setAuthorizedDeployer(address _deployer, bool _authorized) external onlyOwner {
        authorizedDeployers[_deployer] = _authorized;
        emit DeployerAuthorized(_deployer, _authorized);
    }
    
    /**
     * @notice Update registry address
     */
    function setRegistry(address _registry) external onlyOwner {
        registry = ICreatorRegistry(_registry);
        emit RegistryUpdated(_registry);
    }
    
    // =================================
    // REGISTRATION (Called by deployment script)
    // =================================
    
    /**
     * @notice Register a deployment (called by script after deploying contracts)
     * @dev Only authorized deployers can call this
     */
    function registerDeployment(
        address _creatorCoin,
        address _vault,
        address _wrapper,
        address _shareOFT,
        address _gaugeController,
        address _ccaStrategy,
        address _oracle,
        address _creator
    ) external onlyAuthorizedDeployer {
        if (_creatorCoin == address(0)) revert ZeroAddress();
        if (deployments[_creatorCoin].exists) revert AlreadyDeployed();
        
        DeploymentInfo memory info = DeploymentInfo({
            creatorCoin: _creatorCoin,
            vault: _vault,
            wrapper: _wrapper,
            shareOFT: _shareOFT,
            gaugeController: _gaugeController,
            ccaStrategy: _ccaStrategy,
            oracle: _oracle,
            creator: _creator,
            deployedAt: block.timestamp,
            exists: true
        });
        
        deployments[_creatorCoin] = info;
        deployedTokens.push(_creatorCoin);
        deploymentCount++;
        
        // Register with main registry if available
        if (address(registry) != address(0)) {
            _registerWithRegistry(_creatorCoin, _vault, _wrapper, _shareOFT, _oracle, _gaugeController, _creator);
        }
        
        emit DeploymentRegistered(
            _creatorCoin,
            _vault,
            _wrapper,
            _shareOFT,
            _gaugeController,
            _ccaStrategy,
            _oracle,
            _creator
        );
    }
    
    // =================================
    // INTERNAL
    // =================================
    
    function _registerWithRegistry(
        address _creatorCoin,
        address _vault,
        address _wrapper,
        address _shareOFT,
        address _oracle,
        address _gaugeController,
        address _creator
    ) internal {
        // Get token name/symbol for registry
        (bool success, bytes memory data) = _creatorCoin.staticcall(abi.encodeWithSignature("name()"));
        string memory name = success ? abi.decode(data, (string)) : "Unknown";
        
        (success, data) = _creatorCoin.staticcall(abi.encodeWithSignature("symbol()"));
        string memory symbol = success ? abi.decode(data, (string)) : "UNK";
        
        // Register with basic info (pool will be set later when launched)
        registry.registerCreatorCoin(
            _creatorCoin,
            name,
            symbol,
            _creator,
            address(0), // pool - set later after CCA graduation
            0           // poolFee - set later
        );
        
        // Set vault infrastructure addresses
        registry.setCreatorVault(_creatorCoin, _vault);
        registry.setCreatorWrapper(_creatorCoin, _wrapper);
        registry.setCreatorShareOFT(_creatorCoin, _shareOFT);
        registry.setCreatorOracle(_creatorCoin, _oracle);
        registry.setCreatorGaugeController(_creatorCoin, _gaugeController);
    }
    
    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    function getDeployment(address _token) external view returns (DeploymentInfo memory) {
        return deployments[_token];
    }
    
    function getAllDeployedTokens() external view returns (address[] memory) {
        return deployedTokens;
    }
    
    function isDeployed(address _token) external view returns (bool) {
        return deployments[_token].exists;
    }
    
    function isAuthorizedDeployer(address _deployer) external view returns (bool) {
        return authorizedDeployers[_deployer] || _deployer == owner();
    }
}
