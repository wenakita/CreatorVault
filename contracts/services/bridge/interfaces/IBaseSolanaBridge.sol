// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @notice Minimal interface for Base's Solana Bridge contract on Base mainnet.
 *
 * References:
 * - Base docs: `https://docs.base.org/base-chain/quickstart/base-solana-bridge`
 * - Bridge address (Base mainnet): 0x3eff766C76a1be2Ce1aCF2B69c78bCae257D5188
 *
 * Notes:
 * - The bridge uses Solana pubkeys in the ABI; onchain this is encoded as `bytes32`.
 * - Amounts for Base→Solana transfers are expressed in *remote* token units and fit in `uint64`.
 */
interface IBaseSolanaBridge {
    /**
     * @notice Solana instruction structure (serialized and relayed to Solana).
     * @dev Field names align with Base docs / verified sources.
     */
    struct Ix {
        bytes32 programId;
        bytes[] serializedAccounts;
        bytes data;
    }

    /**
     * @notice Base↔Solana transfer descriptor.
     */
    struct Transfer {
        address localToken;
        bytes32 remoteToken;
        bytes32 to;
        uint64 remoteAmount;
    }

    /**
     * @notice Predict the deterministic Twin contract for a Solana sender pubkey.
     * @dev ABI uses `bytes32` for the Solana pubkey.
     */
    function getPredictedTwinAddress(bytes32 sender) external view returns (address);

    /**
     * @notice Bridge a token to Solana, optionally with Solana instructions.
     * @dev This method is `payable` (bridge fees may be required).
     */
    function bridgeToken(Transfer calldata transfer, Ix[] calldata ixs) external payable;

    /**
     * @notice Bridge a pure Solana call (no token transfer).
     * @dev This method is `payable` (bridge fees may be required).
     */
    function bridgeCall(Ix[] calldata ixs) external payable;
}

