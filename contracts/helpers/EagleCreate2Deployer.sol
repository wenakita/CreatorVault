// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EagleCreate2Deployer
 * @notice Deploy contracts with vanity addresses (e.g., starting with 0x47)
 * 
 * @dev Usage:
 *      1. Deploy this contract
 *      2. Call findSalt() off-chain to find a salt that produces desired prefix
 *      3. Call deploy() with the salt and bytecode
 * 
 *      Or use the off-chain script to find salts faster (recommended)
 */
contract EagleCreate2Deployer is Ownable {
    
    // =================================
    // EVENTS
    // =================================
    
    event Deployed(address indexed deployed, bytes32 salt);
    
    // =================================
    // ERRORS  
    // =================================
    
    error DeploymentFailed();
    error InvalidPrefix();
    
    // =================================
    // CONSTRUCTOR
    // =================================
    
    constructor(address _owner) Ownable(_owner) {}
    
    // =================================
    // DEPLOYMENT
    // =================================
    
    /**
     * @notice Deploy contract with CREATE2 using provided salt
     * @param bytecode Contract creation bytecode (including constructor args)
     * @param salt Salt for CREATE2 address derivation
     * @return deployed The deployed contract address
     */
    function deploy(bytes memory bytecode, bytes32 salt) 
        external 
        onlyOwner 
        returns (address deployed) 
    {
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        
        if (deployed == address(0)) revert DeploymentFailed();
        
        emit Deployed(deployed, salt);
    }
    
    /**
     * @notice Deploy and verify address starts with expected prefix
     * @param bytecode Contract creation bytecode
     * @param salt Salt for CREATE2
     * @param expectedPrefix Expected address prefix (e.g., 0x47)
     */
    function deployWithPrefix(
        bytes memory bytecode, 
        bytes32 salt,
        bytes1 expectedPrefix
    ) external onlyOwner returns (address deployed) {
        // Predict address first
        address predicted = predictAddress(bytecode, salt);
        
        // Verify prefix
        if (bytes1(bytes20(predicted)) != expectedPrefix) {
            revert InvalidPrefix();
        }
        
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        
        if (deployed == address(0)) revert DeploymentFailed();
        
        emit Deployed(deployed, salt);
    }
    
    // =================================
    // ADDRESS PREDICTION
    // =================================
    
    /**
     * @notice Predict the address that would be created with given bytecode and salt
     * @param bytecode Contract creation bytecode
     * @param salt Salt for CREATE2
     * @return predicted The predicted address
     */
    function predictAddress(bytes memory bytecode, bytes32 salt) 
        public 
        view 
        returns (address predicted) 
    {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );
        
        predicted = address(uint160(uint256(hash)));
    }
    
    /**
     * @notice Check if predicted address starts with given prefix
     * @param bytecode Contract creation bytecode
     * @param salt Salt to test
     * @param prefix Desired prefix byte (e.g., 0x47)
     */
    function checkPrefix(bytes memory bytecode, bytes32 salt, bytes1 prefix) 
        public 
        view 
        returns (bool matches, address predicted) 
    {
        predicted = predictAddress(bytecode, salt);
        matches = bytes1(bytes20(predicted)) == prefix;
    }
    
    /**
     * @notice Find a salt that produces an address starting with 0x47
     * @dev This is GAS INTENSIVE - use off-chain script for production
     * @param bytecode Contract creation bytecode
     * @param startSalt Starting salt to search from
     * @param maxIterations Maximum iterations to try
     * @return salt The found salt (or 0 if not found)
     * @return predicted The predicted address
     */
    function findSalt47(
        bytes memory bytecode,
        uint256 startSalt,
        uint256 maxIterations
    ) external view returns (bytes32 salt, address predicted) {
        bytes32 bytecodeHash = keccak256(bytecode);
        
        for (uint256 i = 0; i < maxIterations; i++) {
            salt = bytes32(startSalt + i);
            
            bytes32 hash = keccak256(
                abi.encodePacked(
                    bytes1(0xff),
                    address(this),
                    salt,
                    bytecodeHash
                )
            );
            
            predicted = address(uint160(uint256(hash)));
            
            // Check if starts with 0x47
            if (uint8(bytes1(bytes20(predicted))) == 0x47) {
                return (salt, predicted);
            }
        }
        
        // Not found
        return (bytes32(0), address(0));
    }
    
    /**
     * @notice Find a salt for a specific prefix
     * @param bytecode Contract creation bytecode  
     * @param prefix Desired prefix (e.g., 0x47)
     * @param startSalt Starting point
     * @param maxIterations Max iterations
     */
    function findSaltWithPrefix(
        bytes memory bytecode,
        bytes1 prefix,
        uint256 startSalt,
        uint256 maxIterations
    ) external view returns (bytes32 salt, address predicted) {
        bytes32 bytecodeHash = keccak256(bytecode);
        
        for (uint256 i = 0; i < maxIterations; i++) {
            salt = bytes32(startSalt + i);
            
            bytes32 hash = keccak256(
                abi.encodePacked(
                    bytes1(0xff),
                    address(this),
                    salt,
                    bytecodeHash
                )
            );
            
            predicted = address(uint160(uint256(hash)));
            
            if (bytes1(bytes20(predicted)) == prefix) {
                return (salt, predicted);
            }
        }
        
        return (bytes32(0), address(0));
    }
}
