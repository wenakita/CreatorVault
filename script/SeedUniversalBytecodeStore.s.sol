// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/helpers/infra/UniversalBytecodeStore.sol";

/**
 * @dev Seed UniversalBytecodeStore with all creation codes used by the phased deploy flow
 * (`CreatorVaultDeployer`, Phases 1–3).
 *
 * Run:
 *  forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore --rpc-url $BASE_RPC_URL --broadcast
 *
 * Env overrides:
 *  PRIVATE_KEY (required)
 *  UNIVERSAL_BYTECODE_STORE (optional; defaults to Base mainnet store)
 */
contract SeedUniversalBytecodeStore is Script {
    // Base mainnet: v2 chunked store (see `frontend/src/config/contracts.defaults.ts`).
    address constant DEFAULT_BYTECODE_STORE = 0x35c189aBcb7289AB87A54b5067538668662e0702;
    uint256 constant MAX_SSTORE2_BYTES = 24_575; // EIP-170 runtime limit (24,576) minus STOP prefix.

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address storeAddr = vm.envOr("UNIVERSAL_BYTECODE_STORE", DEFAULT_BYTECODE_STORE);
        address broadcaster = vm.addr(pk);

        console2.log("Broadcaster:", broadcaster);
        console2.log("Broadcaster balance (ETH):", broadcaster.balance);

        console2.log("UniversalBytecodeStore:", storeAddr);
        UniversalBytecodeStore store = UniversalBytecodeStore(storeAddr);

        bool supportsChunking = _supportsChunking(storeAddr);
        console2.log("Store supports chunking:", supportsChunking);

        // Foundry will happily simulate these calls even if the broadcaster can't pay gas,
        // which is confusing because you'll see "stored" logs but nothing is actually mined.
        // Fail fast for the common case: 0 balance.
        if (broadcaster.balance == 0) {
            console2.log("ERROR: broadcaster has 0 ETH on this chain. Fund it and rerun.");
            return;
        }

        vm.startBroadcast(pk);
        _storeIfMissing(
            store,
            vm.getCode("out/OFTBootstrapRegistry.sol/OFTBootstrapRegistry.json"),
            "OFTBootstrapRegistry",
            supportsChunking
        );
        _storeIfMissing(store, vm.getCode("out/CreatorShareOFT.sol/CreatorShareOFT.json"), "CreatorShareOFT", supportsChunking);
        _storeIfMissing(store, vm.getCode("out/CreatorOVault.sol/CreatorOVault.json"), "CreatorOVault", supportsChunking);
        _storeIfMissing(
            store,
            vm.getCode("out/CreatorOVaultWrapper.sol/CreatorOVaultWrapper.json"),
            "CreatorOVaultWrapper",
            supportsChunking
        );
        _storeIfMissing(
            store,
            vm.getCode("out/CreatorGaugeController.sol/CreatorGaugeController.json"),
            "CreatorGaugeController",
            supportsChunking
        );
        _storeIfMissing(store, vm.getCode("out/CCALaunchStrategy.sol/CCALaunchStrategy.json"), "CCALaunchStrategy", supportsChunking);
        _storeIfMissing(store, vm.getCode("out/CreatorOracle.sol/CreatorOracle.json"), "CreatorOracle", supportsChunking);
        _storeIfMissing(store, vm.getCode("out/PayoutRouter.sol/PayoutRouter.json"), "PayoutRouter", supportsChunking);
        _storeIfMissing(
            store,
            vm.getCode("out/VaultShareBurnStream.sol/VaultShareBurnStream.json"),
            "VaultShareBurnStream",
            supportsChunking
        );
        _storeIfMissing(
            store,
            vm.getCode("out/CharmAlphaVaultDeploy.sol/CharmAlphaVaultDeploy.json"),
            "CharmAlphaVaultDeploy",
            supportsChunking
        );
        _storeIfMissing(
            store,
            vm.getCode("out/CreatorCharmStrategy.sol/CreatorCharmStrategy.json"),
            "CreatorCharmStrategy",
            supportsChunking
        );
        _storeIfMissing(store, vm.getCode("out/AjnaStrategy.sol/AjnaStrategy.json"), "AjnaStrategy", supportsChunking);
        vm.stopBroadcast();
    }

    function _storeIfMissing(
        UniversalBytecodeStore store,
        bytes memory creationCode,
        string memory label,
        bool supportsChunking
    ) internal {
        bytes32 codeId = keccak256(creationCode);
        address pointer = store.pointers(codeId);
        if (pointer == address(0)) {
            if (!supportsChunking && creationCode.length > MAX_SSTORE2_BYTES) {
                console2.log("ERROR:", label, "creation bytecode too large for v1 store:", creationCode.length);
                console2.log("       Deploy UniversalBytecodeStoreV2 and rerun with:");
                console2.log("       UNIVERSAL_BYTECODE_STORE=<v2_store_address>");
                return;
            }

            try store.store(creationCode) returns (bytes32 storedId, address storedPointer) {
                console2.log(label, "stored codeId:", uint256(storedId));
                console2.log(label, "pointer:", storedPointer);
            } catch (bytes memory err) {
                console2.log("ERROR:", label, "store() reverted");
                console2.logBytes(err);
            }
        } else {
            console2.log(label, "already stored codeId:", uint256(codeId));
            console2.log(label, "pointer:", pointer);
        }
    }

    function _supportsChunking(address storeAddr) internal view returns (bool ok) {
        // `UniversalBytecodeStoreV2` exposes `chunkCount(bytes32)` for debugging.
        // v1 stores will not recognize the selector, causing the call to fail.
        (ok, ) = storeAddr.staticcall(abi.encodeWithSignature("chunkCount(bytes32)", bytes32(0)));
    }
}
