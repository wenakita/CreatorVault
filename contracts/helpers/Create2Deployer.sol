// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Create2Deployer
 * @notice Minimal CREATE2 deployer to support “full AA deployment” without embedding large bytecode on-chain.
 * @dev This contract is intentionally tiny (<24KB). Callers provide init code in calldata.
 *
 * SECURITY MODEL:
 * - Permissionless: anyone can deploy with any salt + initCode.
 * - Address determinism: address depends on (this contract, salt, keccak256(initCode)).
 */
contract Create2Deployer {
    event Deployed(address indexed addr, bytes32 indexed salt, bytes32 indexed initCodeHash);

    error DeployFailed();

    function deploy(bytes32 salt, bytes memory initCode) external returns (address addr) {
        bytes32 initCodeHash = keccak256(initCode);
        assembly {
            addr := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        if (addr == address(0)) revert DeployFailed();
        emit Deployed(addr, salt, initCodeHash);
    }

    function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)))));
    }
}
