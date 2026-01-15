// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title _SSTORE2
 * @author 0xakita.eth
 * @notice Minimal bytecode storage helper.
 * @dev Internal library used by UniversalBytecodeStore.
 */
library _SSTORE2 {
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
 * @title UniversalBytecodeStore
 * @author 0xakita.eth
 * @notice Append-only storage for contract creation bytecode.
 * @dev Used by CREATE2 deployers to keep calldata small.
 */
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
