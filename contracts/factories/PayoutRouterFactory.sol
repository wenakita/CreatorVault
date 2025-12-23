// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PayoutRouter} from "../helpers/PayoutRouter.sol";

/**
 * @title PayoutRouterFactory
 * @author 0xakita.eth (CreatorVault)
 * @notice Factory for deploying PayoutRouter contracts with CREATE2
 * 
 * @dev DETERMINISTIC ADDRESSES:
 *      Using CREATE2 allows us to compute the PayoutRouter address BEFORE deployment.
 *      This is useful for:
 *      - Pre-approving the address
 *      - Setting up permissions in advance
 *      - ERC-4337 batching where we need to know addresses upfront
 * 
 * @dev SECURITY:
 *      Each PayoutRouter is immutably tied to a specific wrapper.
 *      This factory just provides convenient deployment with predictable addresses.
 */
contract PayoutRouterFactory is Ownable {
    
    // =================================
    // STATE
    // =================================
    
    /// @notice Deployed PayoutRouters by (wrapper, owner) pair
    mapping(bytes32 => address) public deployedRouters;
    
    /// @notice All deployed routers
    address[] public allRouters;
    
    /// @notice Deployment counter
    uint256 public deploymentCount;
    
    // =================================
    // EVENTS
    // =================================
    
    event PayoutRouterDeployed(
        address indexed wrapper,
        address indexed owner,
        address indexed router,
        bytes32 salt
    );
    
    // =================================
    // ERRORS
    // =================================
    
    error ZeroAddress();
    error AlreadyDeployed();
    error DeploymentFailed();
    
    // =================================
    // CONSTRUCTOR
    // =================================
    
    constructor(address _owner) Ownable(_owner) {}
    
    // =================================
    // DEPLOYMENT
    // =================================
    
    /**
     * @notice Deploy a PayoutRouter for a specific wrapper
     * @param _wrapper The CreatorOVaultWrapper address
     * @param _owner The creator who will own the PayoutRouter
     * @return router The deployed PayoutRouter address
     */
    function deploy(address _wrapper, address _owner) external returns (address router) {
        if (_wrapper == address(0) || _owner == address(0)) revert ZeroAddress();
        
        bytes32 salt = _computeSalt(_wrapper, _owner);
        
        if (deployedRouters[salt] != address(0)) revert AlreadyDeployed();
        
        // Deploy with CREATE2
        router = address(new PayoutRouter{salt: salt}(_wrapper, _owner));
        
        if (router == address(0)) revert DeploymentFailed();
        
        deployedRouters[salt] = router;
        allRouters.push(router);
        deploymentCount++;
        
        emit PayoutRouterDeployed(_wrapper, _owner, router, salt);
    }
    
    /**
     * @notice Compute the address a PayoutRouter would be deployed to
     * @param _wrapper The CreatorOVaultWrapper address
     * @param _owner The creator who will own the PayoutRouter
     * @return The predicted address
     */
    function computeAddress(address _wrapper, address _owner) external view returns (address) {
        bytes32 salt = _computeSalt(_wrapper, _owner);
        
        bytes memory bytecode = abi.encodePacked(
            type(PayoutRouter).creationCode,
            abi.encode(_wrapper, _owner)
        );
        
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
    
    /**
     * @notice Check if a PayoutRouter is already deployed for wrapper/owner
     * @param _wrapper The wrapper address
     * @param _owner The owner address
     * @return deployed Whether it's deployed
     * @return router The router address (or zero if not deployed)
     */
    function isDeployed(address _wrapper, address _owner) 
        external 
        view 
        returns (bool deployed, address router) 
    {
        bytes32 salt = _computeSalt(_wrapper, _owner);
        router = deployedRouters[salt];
        deployed = router != address(0);
    }
    
    /**
     * @notice Get router by wrapper and owner
     */
    function getRouter(address _wrapper, address _owner) external view returns (address) {
        return deployedRouters[_computeSalt(_wrapper, _owner)];
    }
    
    /**
     * @dev Compute salt from wrapper and owner
     */
    function _computeSalt(address _wrapper, address _owner) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_wrapper, _owner));
    }
    
    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    /**
     * @notice Get all deployed routers
     */
    function getAllRouters() external view returns (address[] memory) {
        return allRouters;
    }
    
    /**
     * @notice Get router count
     */
    function getRouterCount() external view returns (uint256) {
        return allRouters.length;
    }
}

