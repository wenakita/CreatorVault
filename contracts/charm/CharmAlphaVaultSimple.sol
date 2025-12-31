// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CharmAlphaVaultAuto.sol";

/**
 * @title CharmAlphaVaultSimple
 * @notice DEPRECATED alias for `CharmAlphaVaultAuto`.
 * @dev Kept only to avoid breaking existing references. New deployments should use `CharmAlphaVaultAuto`.
 */
contract CharmAlphaVaultSimple is CharmAlphaVaultAuto {
    constructor(
        address _pool,
        uint256 _protocolFee,
        uint256 _maxTotalSupply,
        string memory _name,
        string memory _symbol
    ) CharmAlphaVaultAuto(_pool, _protocolFee, _maxTotalSupply, _name, _symbol) {}
}
