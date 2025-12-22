// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CreatorCreate2Deployer
 * @author 0xakita.eth (CreatorVault)
 * @notice Deploy contracts with deterministic (CREATE2) addresses
 * 
 * @dev USE CASES:
 *      - Deploy same contracts to same addresses on multiple chains
 *      - Find vanity addresses (e.g., starting with creator-specific prefix)
 *      - Predict addresses before deployment
 * 
 * @dev USAGE:
 *      1. Deploy this contract on all target chains
 *      2. Call predictAddress() to see where contract will deploy
 *      3. Call deploy() with bytecode + salt on each chain
 * 
 * @dev VANITY ADDRESSES:
 *      Use findSaltWithPrefix() to find salts producing addresses with
 *      specific prefixes. For production, use off-chain scripts (faster).
 */
contract CreatorCreate2Deployer is Ownable {
    
    // =================================
    // EVENTS
    // =================================
    
    event Deployed(address indexed deployed, bytes32 indexed salt, string contractName);
    event BatchDeployed(address[] deployed, bytes32[] salts);
    
    // =================================
    // ERRORS  
    // =================================
    
    error DeploymentFailed();
    error InvalidPrefix();
    error ArrayLengthMismatch();
    
    // =================================
    // STATE
    // =================================
    
    /// @notice Track deployed contracts
    mapping(bytes32 => address) public deployedAt;
    
    /// @notice Deployment history
    address[] public deployedContracts;
    
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
        
        deployedAt[salt] = deployed;
        deployedContracts.push(deployed);
        
        emit Deployed(deployed, salt, "");
    }
    
    /**
     * @notice Deploy with a named log entry
     * @param bytecode Contract creation bytecode
     * @param salt Salt for CREATE2
     * @param contractName Name for logging
     */
    function deployNamed(
        bytes memory bytecode, 
        bytes32 salt,
        string calldata contractName
    ) external onlyOwner returns (address deployed) {
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        
        if (deployed == address(0)) revert DeploymentFailed();
        
        deployedAt[salt] = deployed;
        deployedContracts.push(deployed);
        
        emit Deployed(deployed, salt, contractName);
    }
    
    /**
     * @notice Deploy and verify address starts with expected prefix
     * @param bytecode Contract creation bytecode
     * @param salt Salt for CREATE2
     * @param expectedPrefix Expected address prefix (e.g., 0x47 for "G")
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
        
        deployedAt[salt] = deployed;
        deployedContracts.push(deployed);
        
        emit Deployed(deployed, salt, "");
    }
    
    /**
     * @notice Deploy multiple contracts in a single transaction
     * @param bytecodes Array of bytecodes
     * @param salts Array of salts
     */
    function batchDeploy(
        bytes[] calldata bytecodes,
        bytes32[] calldata salts
    ) external onlyOwner returns (address[] memory deployed) {
        if (bytecodes.length != salts.length) revert ArrayLengthMismatch();
        
        deployed = new address[](bytecodes.length);
        
        for (uint256 i = 0; i < bytecodes.length; i++) {
            bytes memory bytecode = bytecodes[i];
            bytes32 salt = salts[i];
            
            address addr;
            assembly {
                addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            }
            
            if (addr == address(0)) revert DeploymentFailed();
            
            deployed[i] = addr;
            deployedAt[salt] = addr;
            deployedContracts.push(addr);
        }
        
        emit BatchDeployed(deployed, salts);
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
     * @notice Predict address with pre-computed bytecode hash
     * @dev More efficient for repeated predictions with same bytecode
     */
    function predictAddressWithHash(bytes32 bytecodeHash, bytes32 salt) 
        external 
        view 
        returns (address predicted) 
    {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                bytecodeHash
            )
        );
        
        predicted = address(uint160(uint256(hash)));
    }
    
    /**
     * @notice Check if predicted address starts with given prefix
     * @param bytecode Contract creation bytecode
     * @param salt Salt to test
     * @param prefix Desired prefix byte
     */
    function checkPrefix(bytes memory bytecode, bytes32 salt, bytes1 prefix) 
        public 
        view 
        returns (bool matches, address predicted) 
    {
        predicted = predictAddress(bytecode, salt);
        matches = bytes1(bytes20(predicted)) == prefix;
    }
    
    // =================================
    // SALT FINDING (On-chain - use off-chain for production)
    // =================================
    
    /**
     * @notice Find a salt for a specific prefix
     * @dev GAS INTENSIVE - use off-chain script for production
     * @param bytecode Contract creation bytecode  
     * @param prefix Desired prefix (e.g., 0xAC for "akita" style)
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
    
    /**
     * @notice Find a salt that produces an address starting with 0xAC (for "akita" vibes)
     */
    function findSaltAC(
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
            
            // Check if starts with 0xAC
            if (uint8(bytes1(bytes20(predicted))) == 0xAC) {
                return (salt, predicted);
            }
        }
        
        return (bytes32(0), address(0));
    }
    
    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    /**
     * @notice Get all deployed contracts
     */
    function getDeployedContracts() external view returns (address[] memory) {
        return deployedContracts;
    }
    
    /**
     * @notice Get deployment count
     */
    function deploymentCount() external view returns (uint256) {
        return deployedContracts.length;
    }
    
    /**
     * @notice Check if a salt was already used
     */
    function isSaltUsed(bytes32 salt) external view returns (bool) {
        return deployedAt[salt] != address(0);
    }
}


