// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/helpers/OFTBootstrapRegistry.sol";

/// @notice Verifies the universal CREATE2 factory (0x4e59…) accepts calldata `bytes32 salt || initCode`
///         and deploys to the standard CREATE2-derived address.
///
/// Run (no broadcast, forked simulation):
///   forge script script/SimulateUniversalCreate2Factory.s.sol:SimulateUniversalCreate2Factory --fork-url $BASE_RPC_URL
contract SimulateUniversalCreate2Factory is Script {
    address constant UNIVERSAL_CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function _computeCreate2(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        // Use a unique salt so this simulation doesn't collide with anything that already exists on Base.
        bytes32 salt = keccak256(abi.encodePacked("CreatorVault:universal-create2-factory:bootstrap-test:v1", vm.addr(pk)));
        bytes memory initCode = type(OFTBootstrapRegistry).creationCode;
        address predicted = _computeCreate2(UNIVERSAL_CREATE2_FACTORY, salt, keccak256(initCode));

        // If it already exists, we still consider it a pass (same computation).
        if (predicted.code.length == 0) {
            vm.startBroadcast(pk);
            (bool ok, ) = UNIVERSAL_CREATE2_FACTORY.call(abi.encodePacked(salt, initCode));
            require(ok, "CREATE2_FACTORY deploy failed");
            vm.stopBroadcast();
        }

        require(predicted.code.length > 0, "deployment did not create code");

        // Sanity: ensure the deployed contract responds as expected.
        address ep = OFTBootstrapRegistry(predicted).getLayerZeroEndpoint(uint16(block.chainid));
        require(ep != address(0), "endpoint should not be zero");
    }
}
