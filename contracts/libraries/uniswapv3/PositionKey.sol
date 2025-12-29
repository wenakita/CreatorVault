// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal PositionKey helper (Uniswap V3 position key derivation).
/// @dev Implemented locally to avoid importing v3-periphery (which pulls in v3-core <0.8.0 FullMath).
library PositionKey {
    function compute(address owner, int24 tickLower, int24 tickUpper) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(owner, tickLower, tickUpper));
    }
}


pragma solidity ^0.8.20;

/// @notice Minimal PositionKey helper (Uniswap V3 position key derivation).
/// @dev Implemented locally to avoid importing v3-periphery (which pulls in v3-core <0.8.0 FullMath).
