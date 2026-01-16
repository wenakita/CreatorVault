// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title _SSTORE2
 * @author 0xakita.eth
 * @notice Minimal bytecode storage helper.
 * @dev Internal library used by UniversalBytecodeStoreV2.
 *
 * NOTE: This pattern stores data in the deployed contract's runtime bytecode and
 * is therefore limited by EIP-170 (max contract code size ~24KB).
 */
library _SSTORE2V2 {
    uint256 internal constant DATA_OFFSET = 1; // 0x00 STOP prefix.

    function write(bytes memory data) internal returns (address pointer) {
        bytes memory runtimeCode = abi.encodePacked(bytes1(0x00), data);
        // Minimal init code that returns `runtimeCode` as the deployed runtime.
        // This is a common SSTORE2 pattern (independent implementation).
        bytes memory creationCode = abi.encodePacked(hex"600B5981380380925939F3", runtimeCode);
        assembly ("memory-safe") {
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
        assembly ("memory-safe") {
            extcodecopy(pointer, add(data, 0x20), DATA_OFFSET, size)
        }
    }
}

/**
 * @title UniversalBytecodeStoreV2
 * @author 0xakita.eth
 * @notice Append-only storage for contract creation bytecode (supports >24KB via chunking).
 * @dev Compatible with v1 selectors for `store(bytes)`, `get(bytes32)`, and `pointers(bytes32)`.
 *
 * Why v2 exists:
 * - v1 stored the entire creation bytecode in a single SSTORE2 pointer contract.
 * - EIP-170 limits contract runtime bytecode to ~24KB, so storing >24KB creation bytecode reverts.
 * - v2 splits large bytecode into multiple SSTORE2 pointers and reconstructs it on read.
 */
contract UniversalBytecodeStoreV2 {
    /// @dev Safe chunk size under EIP-170 (leaves headroom for STOP prefix).
    uint256 internal constant CHUNK_SIZE = 24_000;

    /// @notice codeId => "exists" pointer (first chunk pointer).
    /// @dev Kept for compatibility with v1 callers that check `pointers(codeId) != address(0)`.
    mapping(bytes32 => address) public pointers;

    /// @dev codeId => total creation bytecode size.
    mapping(bytes32 => uint256) public sizes;

    /// @dev codeId => chunk pointers (each chunk pointer's runtime contains the chunk bytes).
    mapping(bytes32 => address[]) internal chunkPointers;

    event Stored(bytes32 indexed codeId, address indexed pointer, uint256 size);

    error EmptyBytecode();
    error AlreadyStored(bytes32 codeId);

    /// @notice Store a creation bytecode blob. Key is `keccak256(creationCode)`.
    /// @dev Append-only: cannot overwrite an existing id.
    /// @return codeId keccak256(creationCode)
    /// @return pointer first chunk pointer (for existence checks)
    function store(bytes calldata creationCode) external returns (bytes32 codeId, address pointer) {
        if (creationCode.length == 0) revert EmptyBytecode();

        codeId = keccak256(creationCode);
        if (pointers[codeId] != address(0)) revert AlreadyStored(codeId);

        sizes[codeId] = creationCode.length;

        // Chunk + store.
        uint256 remaining = creationCode.length;
        uint256 offset = 0;
        address[] storage chunks = chunkPointers[codeId];
        while (remaining != 0) {
            uint256 take = remaining > CHUNK_SIZE ? CHUNK_SIZE : remaining;
            bytes memory chunk = _sliceCalldata(creationCode, offset, take);
            address chunkPtr = _SSTORE2V2.write(chunk);
            chunks.push(chunkPtr);
            if (pointer == address(0)) {
                pointer = chunkPtr;
            }
            offset += take;
            unchecked {
                remaining -= take;
            }
        }

        pointers[codeId] = pointer;
        emit Stored(codeId, pointer, creationCode.length);
    }

    /// @notice Read the full creation bytecode for a codeId.
    function get(bytes32 codeId) external view returns (bytes memory creationCode) {
        address first = pointers[codeId];
        require(first != address(0), "CODE_NOT_FOUND");

        uint256 total = sizes[codeId];
        uint256 n = chunkPointers[codeId].length;
        // Defensive: should never happen for stored ids.
        require(total != 0 && n != 0, "CODE_NOT_FOUND");

        creationCode = new bytes(total);

        uint256 copied = 0;
        for (uint256 i = 0; i < n; i++) {
            address ptr = chunkPointers[codeId][i];
            uint256 take = (i + 1 == n) ? (total - copied) : CHUNK_SIZE;
            // Chunk pointer runtime is: 0x00 (STOP) + chunk bytes.
            assembly ("memory-safe") {
                extcodecopy(ptr, add(add(creationCode, 0x20), copied), 1, take)
            }
            copied += take;
        }
    }

    /// @notice Number of stored chunks for `codeId`.
    function chunkCount(bytes32 codeId) external view returns (uint256) {
        return chunkPointers[codeId].length;
    }

    /// @notice Get a chunk pointer by index (for debugging/inspection).
    function chunkPointerAt(bytes32 codeId, uint256 index) external view returns (address) {
        return chunkPointers[codeId][index];
    }

    function _sliceCalldata(bytes calldata data, uint256 start, uint256 len) internal pure returns (bytes memory out) {
        out = new bytes(len);
        assembly ("memory-safe") {
            calldatacopy(add(out, 0x20), add(data.offset, start), len)
        }
    }
}

