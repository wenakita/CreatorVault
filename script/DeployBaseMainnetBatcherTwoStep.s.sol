// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import "../contracts/helpers/batchers/CreatorVaultBatcherTwoStep.sol";
import "../contracts/helpers/infra/UniversalBytecodeStoreV2.sol";
import "../contracts/factories/UniversalCreate2DeployerFromStore.sol";

/// @notice Deploys a 3-step CreatorVault batcher (Phase1 + Phase2 + Phase3 strategies) on Base mainnet.
///
/// Why:
/// - The one-tx deploy+launch flow no longer fits in a single Base tx due to code-deposit gas limits.
/// - This batcher splits deployment into multiple transactions while keeping the same infra (v2 store + deployer).
///
/// Run (broadcast):
///   export BASE_RPC_URL="https://mainnet.base.org"
///   forge script script/DeployBaseMainnetBatcherTwoStep.s.sol:DeployBaseMainnetBatcherTwoStep --rpc-url "$BASE_RPC_URL" --broadcast
///
/// Env:
///   PRIVATE_KEY=...
///   REGISTRY=...
///   PROTOCOL_TREASURY=...
///   POOL_MANAGER=...
///   TAX_HOOK=...
///   CHAINLINK_ETH_USD=...
///   VAULT_ACTIVATION_BATCHER=...
///   LOTTERY_MANAGER=...
///   PERMIT2=...
///   USDC=...
///   UNISWAP_V3_FACTORY=...
///   UNISWAP_ROUTER=...
///   AJNA_FACTORY=...
contract DeployBaseMainnetBatcherTwoStep is Script {
    // EIP-2470 universal CREATE2 factory.
    address constant CREATE2_FACTORY_ADDR = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // Reuse v2 infra salts (store + deployer).
    bytes32 constant STORE_SALT_V2 = keccak256("CreatorVault:UniversalBytecodeStore:v2");
    bytes32 constant DEPLOYER_SALT_V2 = keccak256("CreatorVault:UniversalCreate2DeployerFromStore:v2");

    // New batcher salt (constructor args are chain-specific ⇒ address is chain-specific).
    bytes32 constant BATCHER_SALT_TWO_STEP = keccak256("CreatorVault:CreatorVaultBatcherTwoStep:v3");

    // Defaults (Base mainnet) — can be overridden via env.
    address constant DEFAULT_REGISTRY = 0x02c8031c39E10832A831b954Df7a2c1bf9Df052D;
    address constant DEFAULT_PROTOCOL_TREASURY = 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3;
    address constant DEFAULT_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address constant DEFAULT_TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;
    address constant DEFAULT_CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address constant DEFAULT_VAULT_ACTIVATION_BATCHER = 0x4b67e3a4284090e5191c27B8F24248eC82DF055D;
    address constant DEFAULT_LOTTERY_MANAGER = 0xA02A858E67c98320dCFB218831B645692E8f3483;
    address constant DEFAULT_PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant DEFAULT_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant DEFAULT_UNISWAP_V3_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;
    address constant DEFAULT_UNISWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address constant DEFAULT_AJNA_FACTORY = 0x214f62B5836D83f3D6c4f71F174209097B1A779C;

    struct Config {
        address registry;
        address protocolTreasury;
        address poolManager;
        address taxHook;
        address chainlinkEthUsd;
        address vaultActivationBatcher;
        address lotteryManager;
        address permit2;
        address usdc;
        address uniswapV3Factory;
        address uniswapRouter;
        address ajnaFactory;
    }

    function _create2(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address broadcaster = vm.addr(pk);

        Config memory cfg;
        cfg.registry = vm.envOr("REGISTRY", DEFAULT_REGISTRY);
        cfg.protocolTreasury = vm.envOr("PROTOCOL_TREASURY", DEFAULT_PROTOCOL_TREASURY);
        cfg.poolManager = vm.envOr("POOL_MANAGER", DEFAULT_POOL_MANAGER);
        cfg.taxHook = vm.envOr("TAX_HOOK", DEFAULT_TAX_HOOK);
        cfg.chainlinkEthUsd = vm.envOr("CHAINLINK_ETH_USD", DEFAULT_CHAINLINK_ETH_USD);
        cfg.vaultActivationBatcher = vm.envOr("VAULT_ACTIVATION_BATCHER", DEFAULT_VAULT_ACTIVATION_BATCHER);
        cfg.lotteryManager = vm.envOr("LOTTERY_MANAGER", DEFAULT_LOTTERY_MANAGER);
        cfg.permit2 = vm.envOr("PERMIT2", DEFAULT_PERMIT2);
        cfg.usdc = vm.envOr("USDC", DEFAULT_USDC);
        cfg.uniswapV3Factory = vm.envOr("UNISWAP_V3_FACTORY", DEFAULT_UNISWAP_V3_FACTORY);
        cfg.uniswapRouter = vm.envOr("UNISWAP_ROUTER", DEFAULT_UNISWAP_ROUTER);
        cfg.ajnaFactory = vm.envOr("AJNA_FACTORY", DEFAULT_AJNA_FACTORY);

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

        // Predict deterministic address for the two-step batcher.
        bytes memory batcherArgs = abi.encode(
            cfg.registry,
            storeAddr,
            deployerAddr,
            cfg.protocolTreasury,
            cfg.poolManager,
            cfg.taxHook,
            cfg.chainlinkEthUsd,
            cfg.vaultActivationBatcher,
            cfg.lotteryManager,
            cfg.permit2,
            cfg.usdc,
            cfg.uniswapV3Factory,
            cfg.uniswapRouter,
            cfg.ajnaFactory
        );
        bytes memory batcherInit = abi.encodePacked(type(CreatorVaultBatcherTwoStep).creationCode, batcherArgs);
        address batcherAddr = _create2(CREATE2_FACTORY_ADDR, BATCHER_SALT_TWO_STEP, keccak256(batcherInit));
        console2.log("CreatorVaultBatcherTwoStep (predicted):", batcherAddr);

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

        // Deploy two-step batcher (if missing).
        if (batcherAddr.code.length == 0) {
            (bool ok, ) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(BATCHER_SALT_TWO_STEP, batcherInit));
            require(ok, "BATCHER_TWO_STEP deploy failed");
        }

        vm.stopBroadcast();

        // Minimal sanity checks (read-only).
        CreatorVaultBatcherTwoStep batcher = CreatorVaultBatcherTwoStep(batcherAddr);
        require(address(batcher.bytecodeStore()) == storeAddr, "Batcher store mismatch");
        require(address(batcher.create2Deployer()) == deployerAddr, "Batcher deployer mismatch");
        require(address(batcher.registry()) == cfg.registry, "Batcher registry mismatch");
        require(address(batcher.usdc()) == cfg.usdc, "Batcher USDC mismatch");
        require(address(batcher.uniswapV3Factory()) == cfg.uniswapV3Factory, "Batcher V3 factory mismatch");
        require(address(batcher.uniswapRouter()) == cfg.uniswapRouter, "Batcher router mismatch");
        require(address(batcher.ajnaFactory()) == cfg.ajnaFactory, "Batcher Ajna factory mismatch");
        console2.log("CreatorVaultBatcherTwoStep:", address(batcher));
    }
}

