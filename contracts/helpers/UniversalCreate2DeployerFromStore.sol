// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {UniversalBytecodeStore} from "./UniversalBytecodeStore.sol";

/**
 * @title UniversalCreate2DeployerFromStore
 * @notice CREATE2 deployer that builds initcode from (creationCode stored on-chain) + (constructor args in calldata).
 *
 * Goal:
 * - Keep user calldata small for AA / Smart Wallet batching.
 * - Preserve deterministic (CREATE2) addresses, including cross-chain identical deployments when:
 *   - this deployer is deployed at the same address on all target chains (via 0x4e59…)
 *   - the creation code + constructor args are identical across chains
 */
contract UniversalCreate2DeployerFromStore {
    UniversalBytecodeStore public immutable store;

    event Deployed(address indexed addr, bytes32 indexed salt, bytes32 indexed codeId, bytes32 initCodeHash);

    error CodeNotFound(bytes32 codeId);
    error DeployFailed();

    constructor(address _store) {
        require(_store != address(0), "Zero store");
        store = UniversalBytecodeStore(_store);
    }

    function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr) {
        address pointer = store.pointers(codeId);
        if (pointer == address(0)) revert CodeNotFound(codeId);

        bytes memory creationCode = store.get(codeId);
        bytes memory initCode = bytes.concat(creationCode, constructorArgs);
        bytes32 initCodeHash = keccak256(initCode);

        /// @solidity memory-safe-assembly
        assembly {
            addr := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        if (addr == address(0)) revert DeployFailed();

        emit Deployed(addr, salt, codeId, initCodeHash);
    }

    function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash)))));
    }
}


