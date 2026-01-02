// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title BribesFactory
 * @author CreatorVault
 * @notice Deterministically deploys (CREATE2) a BribeDepot per vault gauge.
 *
 * Vault address is treated as the gauge id.
 */

import {BribeDepot} from "./BribeDepot.sol";

interface IVaultGaugeVotingForBribesFactory {
    function canReceiveVotes(address vault) external view returns (bool);
}

contract BribesFactory {
    // ================================
    // IMMUTABLES
    // ================================

    address public immutable gaugeVoting;

    // ================================
    // STATE
    // ================================

    mapping(address vault => address depot) public bribeDepotOf;

    // ================================
    // EVENTS
    // ================================

    event BribeDepotCreated(address indexed vault, address indexed depot);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error DepotAlreadyExists(address vault, address depot);
    error VaultNotWhitelisted(address vault);

    constructor(address _gaugeVoting) {
        if (_gaugeVoting == address(0)) revert ZeroAddress();
        gaugeVoting = _gaugeVoting;
    }

    function createBribeDepot(address vault) public returns (address depot) {
        if (vault == address(0)) revert ZeroAddress();

        address existing = bribeDepotOf[vault];
        if (existing != address(0)) revert DepotAlreadyExists(vault, existing);

        if (!IVaultGaugeVotingForBribesFactory(gaugeVoting).canReceiveVotes(vault)) revert VaultNotWhitelisted(vault);

        bytes32 salt = bytes32(uint256(uint160(vault)));
        depot = address(new BribeDepot{salt: salt}(vault, gaugeVoting));

        bribeDepotOf[vault] = depot;
        emit BribeDepotCreated(vault, depot);
    }

    function getOrCreateBribeDepot(address vault) external returns (address depot) {
        depot = bribeDepotOf[vault];
        if (depot != address(0)) return depot;
        return createBribeDepot(vault);
    }
}



