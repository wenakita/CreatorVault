// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/helpers/batchers/CreatorVaultBatcher.sol";

/**
 * @dev Deploy CreatorVaultBatcher on Base mainnet.
 *
 * Run:
 *  forge script script/DeployCreatorVaultBatcher.s.sol:DeployCreatorVaultBatcher --rpc-url $BASE_RPC_URL --broadcast --verify
 *
 * Env overrides (optional):
 *  CREATOR_REGISTRY
 *  UNIVERSAL_BYTECODE_STORE
 *  UNIVERSAL_CREATE2_FROM_STORE
 *  PROTOCOL_TREASURY
 *  POOL_MANAGER
 *  TAX_HOOK
 *  CHAINLINK_ETH_USD
 *  VAULT_ACTIVATION_BATCHER
 *  LOTTERY_MANAGER
 *  PERMIT2
 */
contract DeployCreatorVaultBatcher is Script {
    // NOTE: Defaults must match the currently deployed Base infra.
    // Keep these aligned with `frontend/src/config/contracts.defaults.ts` (BASE_DEFAULTS).
    address constant DEFAULT_REGISTRY = 0x02c8031c39E10832A831b954Df7a2c1bf9Df052D;
    address constant DEFAULT_BYTECODE_STORE = 0x35c189aBcb7289AB87A54b5067538668662e0702;
    address constant DEFAULT_CREATE2_FROM_STORE = 0x24a2137950257a227A28663C76515FBFfD2475c3;
    address constant DEFAULT_PROTOCOL_TREASURY = 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3;
    address constant DEFAULT_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address constant DEFAULT_TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;
    address constant DEFAULT_CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address constant DEFAULT_VAULT_ACTIVATION_BATCHER = 0x4b67e3a4284090e5191c27B8F24248eC82DF055D;
    address constant DEFAULT_LOTTERY_MANAGER = 0xA02A858E67c98320dCFB218831B645692E8f3483;
    address constant DEFAULT_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        address registry = vm.envOr("CREATOR_REGISTRY", DEFAULT_REGISTRY);
        address bytecodeStore = vm.envOr("UNIVERSAL_BYTECODE_STORE", DEFAULT_BYTECODE_STORE);
        address create2FromStore = vm.envOr("UNIVERSAL_CREATE2_FROM_STORE", DEFAULT_CREATE2_FROM_STORE);
        address protocolTreasury = vm.envOr("PROTOCOL_TREASURY", DEFAULT_PROTOCOL_TREASURY);
        address poolManager = vm.envOr("POOL_MANAGER", DEFAULT_POOL_MANAGER);
        address taxHook = vm.envOr("TAX_HOOK", DEFAULT_TAX_HOOK);
        address chainlinkEthUsd = vm.envOr("CHAINLINK_ETH_USD", DEFAULT_CHAINLINK_ETH_USD);
        address vaultActivationBatcher = vm.envOr("VAULT_ACTIVATION_BATCHER", DEFAULT_VAULT_ACTIVATION_BATCHER);
        address lotteryManager = vm.envOr("LOTTERY_MANAGER", DEFAULT_LOTTERY_MANAGER);
        address permit2 = vm.envOr("PERMIT2", DEFAULT_PERMIT2);

        console2.log("Registry:", registry);
        console2.log("Bytecode store:", bytecodeStore);
        console2.log("Create2 from store:", create2FromStore);
        console2.log("Protocol treasury:", protocolTreasury);
        console2.log("Pool manager:", poolManager);
        console2.log("Tax hook:", taxHook);
        console2.log("Chainlink ETH/USD:", chainlinkEthUsd);
        console2.log("VaultActivationBatcher:", vaultActivationBatcher);
        console2.log("Lottery manager:", lotteryManager);
        console2.log("Permit2:", permit2);

        vm.startBroadcast(pk);
        CreatorVaultBatcher batcher = new CreatorVaultBatcher(
            registry,
            bytecodeStore,
            create2FromStore,
            protocolTreasury,
            poolManager,
            taxHook,
            chainlinkEthUsd,
            vaultActivationBatcher,
            lotteryManager,
            permit2
        );
        vm.stopBroadcast();

        console2.log("CreatorVaultBatcher deployed:", address(batcher));
    }
}
