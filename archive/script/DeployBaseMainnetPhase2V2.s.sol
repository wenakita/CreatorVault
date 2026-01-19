// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ARCHIVED (legacy):
 * Phase-2 AA infra deployment script that deploys the legacy `CreatorVaultBatcher`.
 * Superseded by `script/DeployBaseMainnetDeployer.s.sol` and the phased deploy flow.
 */

import "forge-std/Script.sol";

import "../contracts/helpers/batchers/CreatorVaultBatcher.sol";
import "../../contracts/helpers/infra/UniversalBytecodeStoreV2.sol";
import "../../contracts/factories/UniversalCreate2DeployerFromStore.sol";

/// @notice Deploys Phase-2 AA infra (v2 bytecode store + v2 CREATE2 deployer + new CreatorVaultBatcher) on Base mainnet.
contract DeployBaseMainnetPhase2V2 is Script {
    // EIP-2470 universal CREATE2 factory.
    address constant CREATE2_FACTORY_ADDR = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // Chain-agnostic salts: same on every chain → same deployed addresses (for store + deployer).
    bytes32 constant STORE_SALT_V2 = keccak256("CreatorVault:UniversalBytecodeStore:v2");
    bytes32 constant DEPLOYER_SALT_V2 = keccak256("CreatorVault:UniversalCreate2DeployerFromStore:v2");
    // Deterministic Base mainnet batcher (constructor args are chain-specific, so address is chain-specific too).
    bytes32 constant BATCHER_SALT_V2 = keccak256("CreatorVault:CreatorVaultBatcher:v2-infra");

    // Defaults (Base mainnet) — can be overridden via env.
    address constant DEFAULT_REGISTRY = 0x02c8031c39E10832A831b954Df7a2c1bf9Df052D;
    address constant DEFAULT_PROTOCOL_TREASURY = 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3;
    address constant DEFAULT_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address constant DEFAULT_TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;
    address constant DEFAULT_CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address constant DEFAULT_VAULT_ACTIVATION_BATCHER = 0x4b67e3a4284090e5191c27B8F24248eC82DF055D;
    address constant DEFAULT_LOTTERY_MANAGER = 0xA02A858E67c98320dCFB218831B645692E8f3483;
    address constant DEFAULT_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    function _create2(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        address registry = vm.envOr("REGISTRY", DEFAULT_REGISTRY);
        address protocolTreasury = vm.envOr("PROTOCOL_TREASURY", DEFAULT_PROTOCOL_TREASURY);
        address poolManager = vm.envOr("POOL_MANAGER", DEFAULT_POOL_MANAGER);
        address taxHook = vm.envOr("TAX_HOOK", DEFAULT_TAX_HOOK);
        address chainlinkEthUsd = vm.envOr("CHAINLINK_ETH_USD", DEFAULT_CHAINLINK_ETH_USD);
        address vaultActivationBatcher = vm.envOr("VAULT_ACTIVATION_BATCHER", DEFAULT_VAULT_ACTIVATION_BATCHER);
        address lotteryManager = vm.envOr("LOTTERY_MANAGER", DEFAULT_LOTTERY_MANAGER);
        address permit2 = vm.envOr("PERMIT2", DEFAULT_PERMIT2);

        console2.log("Broadcaster:", broadcaster);
        console2.log("Broadcaster balance (ETH):", broadcaster.balance);

        // Predict deterministic addresses for v2 store + v2 deployer.
        bytes memory storeInit = type(UniversalBytecodeStoreV2).creationCode;
        address storeAddr = _create2(CREATE2_FACTORY_ADDR, STORE_SALT_V2, keccak256(storeInit));

        bytes memory deployerInit = abi.encodePacked(
            type(UniversalCreate2DeployerFromStore).creationCode,
            abi.encode(storeAddr)
        );
        address deployerAddr = _create2(CREATE2_FACTORY_ADDR, DEPLOYER_SALT_V2, keccak256(deployerInit));

        console2.log("UniversalBytecodeStoreV2 (predicted):", storeAddr);
        console2.log("UniversalCreate2DeployerFromStoreV2 (predicted):", deployerAddr);

        // Predict deterministic address for the new CreatorVaultBatcher wired to v2 infra.
        bytes memory batcherInit = abi.encodePacked(
            type(CreatorVaultBatcher).creationCode,
            abi.encode(
                registry,
                storeAddr,
                deployerAddr,
                protocolTreasury,
                poolManager,
                taxHook,
                chainlinkEthUsd,
                vaultActivationBatcher,
                lotteryManager,
                permit2
            )
        );
        address batcherAddr = _create2(CREATE2_FACTORY_ADDR, BATCHER_SALT_V2, keccak256(batcherInit));
        console2.log("CreatorVaultBatcher (v2-infra, predicted):", batcherAddr);

        vm.startBroadcast(pk);

        // Deploy v2 store (if missing).
        if (storeAddr.code.length == 0) {
            (bool ok, ) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(STORE_SALT_V2, storeInit));
            require(ok, "STORE_V2 deploy failed");
        }

        // Deploy v2 deployer (if missing).
        if (deployerAddr.code.length == 0) {
            (bool ok, ) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(DEPLOYER_SALT_V2, deployerInit));
            require(ok, "DEPLOYER_V2 deploy failed");
        }

        // Deploy a new CreatorVaultBatcher wired to v2 infra (deterministic via CREATE2 factory).
        if (batcherAddr.code.length == 0) {
            (bool ok, ) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(BATCHER_SALT_V2, batcherInit));
            require(ok, "BATCHER_V2 deploy failed");
        }

        vm.stopBroadcast();

        CreatorVaultBatcher batcher = CreatorVaultBatcher(batcherAddr);
        console2.log("CreatorVaultBatcher (v2-infra):", address(batcher));

        // Minimal sanity checks (read-only).
        require(address(batcher.bytecodeStore()) == storeAddr, "Batcher store mismatch");
        require(address(batcher.create2Deployer()) == deployerAddr, "Batcher deployer mismatch");
    }
}

