// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import "../contracts/core/CreatorRegistry.sol";
import "../contracts/factories/CreatorOVaultFactory.sol";
import "../contracts/helpers/batchers/VaultActivationBatcher.sol";
import "../contracts/helpers/batchers/CreatorVaultBatcher.sol";
import "../contracts/helpers/infra/UniversalBytecodeStore.sol";
import "../contracts/factories/UniversalCreate2DeployerFromStore.sol";
import "../contracts/helpers/infra/OFTBootstrapRegistry.sol";
import "../contracts/services/messaging/CreatorShareOFT.sol";
import "../contracts/services/lottery/CreatorLotteryManager.sol";

/// @notice Base mainnet deployment script for CreatorVault MVP core infra.
contract DeployBaseMainnet is Script {
    address constant CREATE2_FACTORY_ADDR = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    bytes32 constant STORE_SALT = keccak256("CreatorVault:UniversalBytecodeStore:v1");
    bytes32 constant DEPLOYER_SALT = keccak256("CreatorVault:UniversalCreate2DeployerFromStore:v1");
    // Salt for vanity registry address (0x777...4626).
    bytes32 constant REGISTRY_SALT = 0x0000000000000000000000000000000000000000000000000000000010b8c3cd;

    function _create2(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        address owner = vm.envAddress("PROTOCOL_OWNER");
        address treasury = vm.envAddress("PROTOCOL_TREASURY");

        address lzEndpoint = vm.envAddress("LZ_ENDPOINT");
        address chainlinkEthUsd = vm.envAddress("CHAINLINK_ETH_USD");
        address poolManager = vm.envAddress("POOL_MANAGER");
        address taxHook = vm.envAddress("TAX_HOOK");
        address permit2 = vm.envAddress("PERMIT2");

        address vaultActivationBatcher = vm.envOr("VAULT_ACTIVATION_BATCHER", address(0));
        address lotteryManager = vm.envOr("LOTTERY_MANAGER", address(0));

        console2.log("Deployer:", deployer);
        console2.log("Owner:", owner);
        console2.log("Treasury:", treasury);

        vm.startBroadcast(pk);

        // 1) Universal Bytecode Infra (CREATE2)
        bytes memory storeInit = type(UniversalBytecodeStore).creationCode;
        address storeAddr = _create2(CREATE2_FACTORY_ADDR, STORE_SALT, keccak256(storeInit));
        if (storeAddr.code.length == 0) {
            (bool ok, ) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(STORE_SALT, storeInit));
            require(ok, "STORE deploy failed");
        }
        console2.log("UniversalBytecodeStore:", storeAddr);

        bytes memory deployerInit = abi.encodePacked(
            type(UniversalCreate2DeployerFromStore).creationCode,
            abi.encode(storeAddr)
        );
        address deployerAddr = _create2(CREATE2_FACTORY_ADDR, DEPLOYER_SALT, keccak256(deployerInit));
        if (deployerAddr.code.length == 0) {
            (bool ok, ) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(DEPLOYER_SALT, deployerInit));
            require(ok, "DEPLOYER deploy failed");
        }
        console2.log("UniversalCreate2DeployerFromStore:", deployerAddr);

        UniversalBytecodeStore store = UniversalBytecodeStore(storeAddr);

        // Seed OFTBootstrapRegistry + CreatorShareOFT creation codes
        bytes32 bootstrapId = keccak256(type(OFTBootstrapRegistry).creationCode);
        if (store.pointers(bootstrapId) == address(0)) {
            store.store(type(OFTBootstrapRegistry).creationCode);
        }
        console2.log("OFTBootstrapRegistry codeId:", uint256(bootstrapId));

        bytes32 shareOftId = keccak256(type(CreatorShareOFT).creationCode);
        if (store.pointers(shareOftId) == address(0)) {
            store.store(type(CreatorShareOFT).creationCode);
        }
        console2.log("CreatorShareOFT codeId:", uint256(shareOftId));

        // 2) CreatorRegistry (CREATE2 via EIP-2470 factory)
        bytes memory registryInit = abi.encodePacked(type(CreatorRegistry).creationCode, abi.encode(owner));
        address registryAddr = _create2(CREATE2_FACTORY_ADDR, REGISTRY_SALT, keccak256(registryInit));
        if (registryAddr.code.length == 0) {
            (bool ok, ) = CREATE2_FACTORY_ADDR.call(abi.encodePacked(REGISTRY_SALT, registryInit));
            require(ok, "REGISTRY deploy failed");
        }
        CreatorRegistry registry = CreatorRegistry(registryAddr);
        console2.log("CreatorRegistry:", registryAddr);

        // 3) CreatorOVaultFactory
        CreatorOVaultFactory factory = new CreatorOVaultFactory(address(registry), owner);
        console2.log("CreatorOVaultFactory:", address(factory));

        // 4) VaultActivationBatcher (deploy if not provided)
        if (vaultActivationBatcher == address(0)) {
            VaultActivationBatcher activation = new VaultActivationBatcher(permit2);
            vaultActivationBatcher = address(activation);
        }
        console2.log("VaultActivationBatcher:", vaultActivationBatcher);

        // 5) CreatorLotteryManager (deploy if not provided)
        if (lotteryManager == address(0)) {
            CreatorLotteryManager manager = new CreatorLotteryManager(address(registry), owner);
            lotteryManager = address(manager);
        }
        console2.log("CreatorLotteryManager:", lotteryManager);

        // 6) CreatorVaultBatcher
        CreatorVaultBatcher batcher = new CreatorVaultBatcher(
            address(registry),
            storeAddr,
            deployerAddr,
            treasury,
            poolManager,
            taxHook,
            chainlinkEthUsd,
            vaultActivationBatcher,
            lotteryManager,
            permit2
        );
        console2.log("CreatorVaultBatcher:", address(batcher));

        // Registry wiring
        CreatorRegistry.ChainConfig memory chainConfig = registry.getChainConfig(8453);
        if (chainConfig.chainId == 0) {
            registry.registerChain(8453, "Base", 0x4200000000000000000000000000000000000006, true);
        }
        registry.setDexInfrastructure(8453, poolManager, address(0), address(0), address(0));
        registry.setLayerZeroEndpoint(8453, lzEndpoint);
        registry.setChainIdToEid(8453, 30184);
        registry.setHubChain(8453, 30184);
        registry.setAuthorizedFactory(address(factory), true);

        vm.stopBroadcast();

        // Validation
        require(registry.getLayerZeroEndpoint(8453) == lzEndpoint, "LZ endpoint mismatch");
        require(registry.chainIdToEid(8453) == 30184, "EID mismatch");
        require(registry.authorizedFactories(address(factory)), "Factory not authorized");
        require(batcher.permit2() == permit2, "Permit2 mismatch");
        require(address(store.pointers(shareOftId)) != address(0), "ShareOFT codeId missing");

        console2.log("Validation passed");
    }
}
