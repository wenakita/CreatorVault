// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OFTAdapter } from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";

/**
 * @title EagleShareAdapter  
 * @notice LayerZero OFT Adapter for Eagle Vault shares
 * 
 * @dev Wraps EagleOVault's ERC20 shares for cross-chain transfers
 *      Deployed on hub chain (Ethereum) only
 * 
 * NOTE: This adapter does NOT have fee-on-swap.
 *       Fee-on-swap is only on spoke chains (EagleShareOFT).
 *       This keeps the hub chain simple and vault-focused.
 */
contract EagleShareAdapter is OFTAdapter {
    constructor(
        address _token,        // EagleOVault address (the vault shares)
        address _lzEndpoint,   // LayerZero endpoint
        address _delegate      // Contract owner/delegate
    ) OFTAdapter(_token, _lzEndpoint, _delegate) Ownable(_delegate) {
        require(_token != address(0), "EagleShareAdapter: token cannot be zero address");
        require(_lzEndpoint != address(0), "EagleShareAdapter: endpoint cannot be zero address");
        require(_delegate != address(0), "EagleShareAdapter: delegate cannot be zero address");
    }
}
