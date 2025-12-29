// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CharmAlphaVault.sol";

/**
 * @title CharmAlphaVaultSimple
 * @notice Simplified version of CharmAlphaVault with single-step governance transfer
 * @dev Extends CharmAlphaVault but allows immediate governance assignment
 * 
 * Changes from original:
 * - One-time initializer for atomic strategy setup + governance transfer
 * - Governance transferred in single step (no acceptance needed)
 * - Perfect for automated deployment flows
 */
contract CharmAlphaVaultSimple is CharmAlphaVault {
    
    bool private _initialized;
    
    /**
     * @notice Deploy a CharmAlphaVault (governance = deployer initially)
     * @param _pool Underlying Uniswap V3 pool
     * @param _protocolFee Protocol fee (e.g., 10000 = 1%)
     * @param _maxTotalSupply Maximum supply cap
     * @param _name Token name (e.g., "CreatorVault: akita/USDC")
     * @param _symbol Token symbol (e.g., "CV-akita-USDC")
     */
    constructor(
        address _pool,
        uint256 _protocolFee,
        uint256 _maxTotalSupply,
        string memory _name,
        string memory _symbol
    ) CharmAlphaVault(_pool, _protocolFee, _maxTotalSupply, _name, _symbol) {
        // governance = msg.sender (batcher) from parent constructor
    }
    
    /**
     * @notice Initialize strategy, rebalance, and transfer governance atomically
     * @dev Can only be called once by the deployer (governance)
     * @param _strategy The CharmAlphaStrategy address
     * @param _newGovernance The final governance address (creator)
     * @param _newKeeper The keeper for the strategy (usually same as _newGovernance)
     */
    function initializeAndTransfer(
        address _strategy,
        address _newGovernance,
        address _newKeeper
    ) external onlyGovernance {
        require(!_initialized, "Already initialized");
        require(_strategy != address(0), "Invalid strategy");
        require(_newGovernance != address(0), "Invalid governance");
        require(_newKeeper != address(0), "Invalid keeper");
        
        _initialized = true;
        
        // Set strategy
        strategy = _strategy;
        
        // Call rebalance (while we're still governance and before transferring keeper)
        // Note: Strategy must have been deployed with this contract as keeper initially
        ICharmAlphaStrategy(_strategy).rebalance();
        
        // Transfer keeper to creator
        ICharmAlphaStrategy(_strategy).setKeeper(_newKeeper);
        
        // Transfer governance in single step (no acceptance needed)
        governance = _newGovernance;
        pendingGovernance = address(0); // Clear pending
    }
}

interface ICharmAlphaStrategy {
    function rebalance() external;
    function setKeeper(address _keeper) external;
}


import "./CharmAlphaVault.sol";

/**
 * @title CharmAlphaVaultSimple
 * @notice Simplified version of CharmAlphaVault with single-step governance transfer
 * @dev Extends CharmAlphaVault but allows immediate governance assignment
 * 
 * Changes from original:
 * - One-time initializer for atomic strategy setup + governance transfer
 * - Governance transferred in single step (no acceptance needed)
 * - Perfect for automated deployment flows
 */
