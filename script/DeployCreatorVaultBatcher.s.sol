// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/helpers/CreatorVaultBatcher.sol";

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
    address constant DEFAULT_REGISTRY = 0x777e28d7617ADb6E2fE7b7C49864A173e36881EF;
    address constant DEFAULT_BYTECODE_STORE = 0xbec0c922835136949032223860C021484b0Cbdfa;
    address constant DEFAULT_CREATE2_FROM_STORE = 0x6E01e598e450F07551200e7b2db333BEcC66b35e;
    address constant DEFAULT_PROTOCOL_TREASURY = 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3;
    address constant DEFAULT_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address constant DEFAULT_TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;
    address constant DEFAULT_CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address constant DEFAULT_VAULT_ACTIVATION_BATCHER = 0x6d796554698f5Ddd74Ff20d745304096aEf93CB6;
    address constant DEFAULT_LOTTERY_MANAGER = 0xe2C39D39FF92c0cF7A0e9eD16FcE1d6F14bB38fD;
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
