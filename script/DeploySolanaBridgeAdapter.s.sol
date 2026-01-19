// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import {SolanaBridgeAdapter} from "../contracts/services/bridge/SolanaBridgeAdapter.sol";

/**
 * DeploySolanaBridgeAdapter
 *
 * Base mainnet usage:
 *   forge script script/DeploySolanaBridgeAdapter.s.sol:DeploySolanaBridgeAdapter \\
 *     --rpc-url https://mainnet.base.org --broadcast --non-interactive
 *
 * Env:
 * - PRIVATE_KEY (required)
 * - CREATOR_REGISTRY (optional; defaults to Base mainnet registry from deployments/)
 * - SOLANA_BRIDGE_ADAPTER_OWNER (optional; defaults to broadcaster)
 *
 * Optional post-deploy config:
 * - CCA_AUCTION (optional; if set, will be allowlisted via setCcaAuctionAllowed)
 */
contract DeploySolanaBridgeAdapter is Script {
    // Base mainnet CreatorRegistry (see deployments/base/contracts/core/CreatorRegistry.json)
    address constant DEFAULT_CREATOR_REGISTRY = 0x02c8031c39E10832A831b954Df7a2c1bf9Df052D;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        address registry = vm.envOr("CREATOR_REGISTRY", DEFAULT_CREATOR_REGISTRY);
        address owner = vm.envOr("SOLANA_BRIDGE_ADAPTER_OWNER", broadcaster);

        console2.log("Broadcaster:", broadcaster);
        console2.log("CreatorRegistry:", registry);
        console2.log("Adapter owner:", owner);

        vm.startBroadcast(pk);

        SolanaBridgeAdapter adapter = new SolanaBridgeAdapter(registry, owner);
        console2.log("SolanaBridgeAdapter:", address(adapter));

        address ccaAuction = vm.envOr("CCA_AUCTION", address(0));
        if (ccaAuction != address(0)) {
            adapter.setCcaAuctionAllowed(ccaAuction, true);
            console2.log("Allowlisted CCA auction:", ccaAuction);
        }

        vm.stopBroadcast();
    }
}

