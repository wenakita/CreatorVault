// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/helpers/infra/UniversalBytecodeStore.sol";
import "../contracts/helpers/infra/OFTBootstrapRegistry.sol";
import "../contracts/vault/CreatorOVault.sol";
import "../contracts/vault/CreatorOVaultWrapper.sol";
import "../contracts/services/messaging/CreatorShareOFT.sol";
import "../contracts/governance/CreatorGaugeController.sol";
import "../contracts/vault/strategies/CCALaunchStrategy.sol";
import "../contracts/services/oracles/CreatorOracle.sol";

/**
 * @dev Seed UniversalBytecodeStore with all creation codes used by CreatorVaultBatcher.
 *
 * Run:
 *  forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore --rpc-url $BASE_RPC_URL --broadcast
 *
 * Env overrides:
 *  PRIVATE_KEY (required)
 *  UNIVERSAL_BYTECODE_STORE (optional; defaults to Base mainnet store)
 */
contract SeedUniversalBytecodeStore is Script {
    address constant DEFAULT_BYTECODE_STORE = 0xCDf45B94348DBBABba4bE6f4a5341badb83D4dC4;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address storeAddr = vm.envOr("UNIVERSAL_BYTECODE_STORE", DEFAULT_BYTECODE_STORE);

        console2.log("UniversalBytecodeStore:", storeAddr);
        UniversalBytecodeStore store = UniversalBytecodeStore(storeAddr);

        vm.startBroadcast(pk);
        _storeIfMissing(store, type(OFTBootstrapRegistry).creationCode, "OFTBootstrapRegistry");
        _storeIfMissing(store, type(CreatorShareOFT).creationCode, "CreatorShareOFT");
        _storeIfMissing(store, type(CreatorOVault).creationCode, "CreatorOVault");
        _storeIfMissing(store, type(CreatorOVaultWrapper).creationCode, "CreatorOVaultWrapper");
        _storeIfMissing(store, type(CreatorGaugeController).creationCode, "CreatorGaugeController");
        _storeIfMissing(store, type(CCALaunchStrategy).creationCode, "CCALaunchStrategy");
        _storeIfMissing(store, type(CreatorOracle).creationCode, "CreatorOracle");
        vm.stopBroadcast();
    }

    function _storeIfMissing(UniversalBytecodeStore store, bytes memory creationCode, string memory label) internal {
        bytes32 codeId = keccak256(creationCode);
        address pointer = store.pointers(codeId);
        if (pointer == address(0)) {
            (bytes32 storedId, address storedPointer) = store.store(creationCode);
            console2.log(label, "stored codeId:", uint256(storedId));
            console2.log(label, "pointer:", storedPointer);
        } else {
            console2.log(label, "already stored codeId:", uint256(codeId));
            console2.log(label, "pointer:", pointer);
        }
    }
}
