// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title ICREATE2Factory
 * @author 0xakita.eth
 * @notice Interface for a CREATE2 factory with access control.
 * @dev Used by deployment helpers to deterministically deploy contracts.
 */
interface ICREATE2Factory {
    /**
     * @notice Deploy a contract using CREATE2
     * @param salt Deterministic salt for address generation
     * @param bytecode Contract bytecode including constructor parameters
     * @return addr Address of the deployed contract
     */
    function deploy(bytes32 salt, bytes memory bytecode) external returns (address addr);

    /**
     * @notice Compute the address of a contract before deployment
     * @param salt Deterministic salt
     * @param bytecodeHash Keccak256 hash of the bytecode
     * @return addr Predicted address of the contract
     */
    function computeAddress(bytes32 salt, bytes32 bytecodeHash) external view returns (address addr);

    /**
     * @notice Check if an address is authorized to deploy
     * @param deployer Address to check
     * @return True if authorized
     */
    function isAuthorized(address deployer) external view returns (bool);

    /**
     * @notice Get the owner of the factory
     * @return Owner address
     */
    function owner() external view returns (address);
}
