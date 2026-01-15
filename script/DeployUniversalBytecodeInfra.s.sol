// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import "../contracts/helpers/infra/OFTBootstrapRegistry.sol";
import "../contracts/helpers/infra/UniversalBytecodeStore.sol";
import "../contracts/factories/UniversalCreate2DeployerFromStore.sol";
import "../contracts/services/messaging/CreatorShareOFT.sol";

/// @notice Deploys (and seeds) the universal bytecode infra via the universal CREATE2 factory (0x4e59…).
///
/// What this enables:
/// - Creators can deploy large-bytecode contracts (e.g. LayerZero OFT) in Smart Wallet AA batches
///   without sending huge initcode in calldata.
/// - Cross-chain identical deployments are preserved when deploying through the universal factory.
///
/// Run (broadcast):
///   forge script script/DeployUniversalBytecodeInfra.s.sol:DeployUniversalBytecodeInfra --rpc-url $BASE_RPC_URL --broadcast --verify
/// Env:
///   PRIVATE_KEY=...
contract DeployUniversalBytecodeInfra is Script {
    address constant UNIVERSAL_CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // Chain-agnostic salts: same on every chain → same deployed addresses.
    bytes32 constant STORE_SALT = keccak256("CreatorVault:UniversalBytecodeStore:v1");
    bytes32 constant DEPLOYER_SALT = keccak256("CreatorVault:UniversalCreate2DeployerFromStore:v1");

    function _computeCreate2(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        bytes memory storeInit = type(UniversalBytecodeStore).creationCode;
        address storeAddr = _computeCreate2(UNIVERSAL_CREATE2_FACTORY, STORE_SALT, keccak256(storeInit));

        bytes memory deployerInit = abi.encodePacked(type(UniversalCreate2DeployerFromStore).creationCode, abi.encode(storeAddr));
        address deployerAddr = _computeCreate2(UNIVERSAL_CREATE2_FACTORY, DEPLOYER_SALT, keccak256(deployerInit));

        console2.log("UniversalBytecodeStore (predicted):", storeAddr);
        console2.log("UniversalCreate2DeployerFromStore (predicted):", deployerAddr);

        vm.startBroadcast(pk);

        // Deploy the store (if missing)
        if (storeAddr.code.length == 0) {
            (bool ok, ) = UNIVERSAL_CREATE2_FACTORY.call(abi.encodePacked(STORE_SALT, storeInit));
            require(ok, "STORE deploy failed");
        }

        // Deploy the deployer (if missing)
        if (deployerAddr.code.length == 0) {
            (bool ok, ) = UNIVERSAL_CREATE2_FACTORY.call(abi.encodePacked(DEPLOYER_SALT, deployerInit));
            require(ok, "DEPLOYER deploy failed");
        }

        UniversalBytecodeStore store = UniversalBytecodeStore(storeAddr);

        // Seed OFTBootstrapRegistry creation code (small, but included for completeness)
        bytes memory bootstrapCreation = type(OFTBootstrapRegistry).creationCode;
        bytes32 bootstrapId = keccak256(bootstrapCreation);
        if (store.pointers(bootstrapId) == address(0)) {
            store.store(bootstrapCreation);
        }

        // Seed CreatorShareOFT creation code (large; the main motivation for this infra)
        bytes memory shareOftCreation = type(CreatorShareOFT).creationCode;
        bytes32 shareOftId = keccak256(shareOftCreation);
        if (store.pointers(shareOftId) == address(0)) {
            store.store(shareOftCreation);
        }

        console2.logBytes32(bootstrapId);
        console2.logBytes32(shareOftId);

        vm.stopBroadcast();
    }
}


