// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title UniversalBytecodeStore
 * @notice Permissionless, append-only storage for contract creation bytecode.
 *
 * Why this exists:
 * - Wallets (especially Smart Wallet batching) can reject very large calldata payloads.
 * - Phase-2 AA deployments currently pass full initcode in calldata (huge for LayerZero OFT).
 * - By storing creation bytecode on-chain once, creators can later deploy via CREATE2 by
 *   referencing a `codeId` (keccak256(creationCode)) and providing only constructor args.
 *
 * Security model:
 * - Permissionless: anyone can store bytecode (they pay the gas).
 * - Append-only: once a `codeId` is set, it cannot be overwritten.
 * - Integrity: the key is `keccak256(creationCode)`, so callers cannot "poison" an id.
 *
 * Storage strategy:
 * - Uses an SSTORE2-style pointer contract whose runtime code contains the bytes.
 *   This is dramatically cheaper than storing large byte arrays in contract storage.
 */
library _SSTORE2 {
    uint256 internal constant DATA_OFFSET = 1; // 0x00 STOP prefix.

    function write(bytes memory data) internal returns (address pointer) {
        bytes memory runtimeCode = abi.encodePacked(bytes1(0x00), data);
        // Minimal init code that returns `runtimeCode` as the deployed runtime.
        // This is a common SSTORE2 pattern (independent implementation).
        bytes memory creationCode = abi.encodePacked(hex"600B5981380380925939F3", runtimeCode);
        /// @solidity memory-safe-assembly
        assembly {
            pointer := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(pointer != address(0), "SSTORE2_WRITE_FAILED");
    }

    function read(address pointer) internal view returns (bytes memory data) {
        uint256 size = pointer.code.length;
        require(size > DATA_OFFSET, "SSTORE2_EMPTY");
        unchecked {
            size -= DATA_OFFSET;
        }
        data = new bytes(size);
        /// @solidity memory-safe-assembly
        assembly {
            extcodecopy(pointer, add(data, 0x20), DATA_OFFSET, size)
        }
    }
}

contract UniversalBytecodeStore {
    /// @notice codeId => pointer contract (runtime contains the creation bytecode).
    mapping(bytes32 => address) public pointers;

    event Stored(bytes32 indexed codeId, address indexed pointer, uint256 size);

    error EmptyBytecode();
    error AlreadyStored(bytes32 codeId);

    /// @notice Store a creation bytecode blob. Key is `keccak256(creationCode)`.
    /// @dev Append-only: cannot overwrite an existing id.
    function store(bytes calldata creationCode) external returns (bytes32 codeId, address pointer) {
        if (creationCode.length == 0) revert EmptyBytecode();

        codeId = keccak256(creationCode);
        if (pointers[codeId] != address(0)) revert AlreadyStored(codeId);

        pointer = _SSTORE2.write(creationCode);
        pointers[codeId] = pointer;
        emit Stored(codeId, pointer, creationCode.length);
    }

    /// @notice Read the creation bytecode for a codeId.
    function get(bytes32 codeId) external view returns (bytes memory creationCode) {
        address pointer = pointers[codeId];
        require(pointer != address(0), "CODE_NOT_FOUND");
        return _SSTORE2.read(pointer);
    }
}


