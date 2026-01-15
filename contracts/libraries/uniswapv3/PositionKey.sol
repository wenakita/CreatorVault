// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PositionKey
/// @author 0xakita.eth
/// @notice Helper for Uniswap v3 position key derivation.
/// @dev Local implementation to avoid v3-periphery dependency.
library PositionKey {
    function compute(address owner, int24 tickLower, int24 tickUpper) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(owner, tickLower, tickUpper));
    }
}
