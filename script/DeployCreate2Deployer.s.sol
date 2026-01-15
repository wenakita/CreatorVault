// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/factories/Create2Deployer.sol";

/**
 * @notice Deploy the Create2Deployer (one-time infra).
 *
 * Usage:
 *   forge script script/DeployCreate2Deployer.s.sol:DeployCreate2DeployerScript \
 *     --rpc-url $BASE_RPC_URL \
 *     --broadcast
 */
contract DeployCreate2DeployerScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        Create2Deployer deployer = new Create2Deployer();
        vm.stopBroadcast();

        console.log("Create2Deployer deployed at:", address(deployer));
    }
}
