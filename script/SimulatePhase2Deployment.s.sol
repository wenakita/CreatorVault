// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

import {Create2Deployer} from "../contracts/helpers/Create2Deployer.sol";
import {CreatorOVault} from "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultWrapper} from "../contracts/vault/CreatorOVaultWrapper.sol";
import {CreatorShareOFT} from "../contracts/layerzero/CreatorShareOFT.sol";
import {CreatorGaugeController} from "../contracts/governance/CreatorGaugeController.sol";
import {CCALaunchStrategy} from "../contracts/strategies/CCALaunchStrategy.sol";
import {CreatorOracle} from "../contracts/oracles/CreatorOracle.sol";

/// @notice Fork simulation of the Phase 2 AA deployment sequence.
/// @dev Run (no broadcast):
///   forge script script/SimulatePhase2Deployment.s.sol:SimulatePhase2Deployment --rpc-url $BASE_RPC_URL
/// or:
///   forge script script/SimulatePhase2Deployment.s.sol:SimulatePhase2Deployment --fork-url $BASE_RPC_URL
contract SimulatePhase2Deployment is Script {
    // ===== Base mainnet known addresses (from frontend config) =====
    address constant CREATE2_DEPLOYER = 0xaBf645362104F34D9C3FE48440bE7c99aaDE58E7;
    address constant REGISTRY = 0x777e28d7617ADb6E2fE7b7C49864A173e36881EF;
    address constant VAULT_ACTIVATION_BATCHER = 0x6d796554698f5Ddd74Ff20d745304096aEf93CB6;
    address constant PROTOCOL_TREASURY = 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3;

    // Oracle config (optional)
    address constant CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address constant POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address constant TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;

    // AKITA (Base)
    address constant AKITA = 0x5b674196812451B7cEC024FE9d22D2c0b172fa75;

    function _derive(bytes32 baseSalt, string memory label) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(baseSalt, label));
    }

    function run() external {
        // If running without explicit --fork-url, you can use foundry.toml rpc_endpoints:
        // vm.createSelectFork(vm.rpcUrl("base"));

        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(pk);

        address creatorToken = AKITA;
        address creatorTreasury = owner;
        string memory creatorSymbol = "AKITA";

        // Mirror frontend naming defaults
        string memory vaultName = "CreatorVault: AKITA";
        string memory vaultSymbol = "sAKITA";
        string memory shareName = "Wrapped AKITA Share";
        string memory shareSymbol = "wsAKITA";

        // Mirror frontend salt derivation (includes chainId)
        bytes32 baseSalt = keccak256(abi.encodePacked(creatorToken, owner, uint256(block.chainid)));
        bytes32 saltVault = _derive(baseSalt, "CreatorOVault");
        bytes32 saltWrapper = _derive(baseSalt, "CreatorOVaultWrapper");
        bytes32 saltShare = _derive(baseSalt, "CreatorShareOFT");
        bytes32 saltGauge = _derive(baseSalt, "CreatorGaugeController");
        bytes32 saltCCA = _derive(baseSalt, "CCALaunchStrategy");
        bytes32 saltOracle = _derive(baseSalt, "CreatorOracle");

        // Build init code
        bytes memory initVault = abi.encodePacked(type(CreatorOVault).creationCode, abi.encode(creatorToken, owner, vaultName, vaultSymbol));
        bytes memory initWrapper = abi.encodePacked(type(CreatorOVaultWrapper).creationCode, abi.encode(creatorToken, address(0), owner)); // vault set later once computed
        bytes memory initShare = abi.encodePacked(type(CreatorShareOFT).creationCode, abi.encode(shareName, shareSymbol, REGISTRY, owner));
        bytes memory initGauge = abi.encodePacked(type(CreatorGaugeController).creationCode, abi.encode(address(0), creatorTreasury, PROTOCOL_TREASURY, owner)); // shareOFT set later once computed
        bytes memory initCCA = abi.encodePacked(type(CCALaunchStrategy).creationCode, abi.encode(address(0), address(0), address(0), address(0), owner)); // filled later
        bytes memory initOracle = abi.encodePacked(type(CreatorOracle).creationCode, abi.encode(REGISTRY, CHAINLINK_ETH_USD, creatorSymbol, owner));

        Create2Deployer d = Create2Deployer(CREATE2_DEPLOYER);

        // Predict addresses (need initCodeHash)
        address predictedVault = d.computeAddress(saltVault, keccak256(initVault));

        // Now that we know predictedVault, rebuild initWrapper/CCA with real args
        initWrapper = abi.encodePacked(type(CreatorOVaultWrapper).creationCode, abi.encode(creatorToken, predictedVault, owner));

        address predictedWrapper = d.computeAddress(saltWrapper, keccak256(initWrapper));
        address predictedShare = d.computeAddress(saltShare, keccak256(initShare));

        initGauge = abi.encodePacked(type(CreatorGaugeController).creationCode, abi.encode(predictedShare, creatorTreasury, PROTOCOL_TREASURY, owner));
        address predictedGauge = d.computeAddress(saltGauge, keccak256(initGauge));

        initCCA = abi.encodePacked(type(CCALaunchStrategy).creationCode, abi.encode(predictedShare, address(0), predictedVault, predictedVault, owner));
        address predictedCCA = d.computeAddress(saltCCA, keccak256(initCCA));

        address predictedOracle = d.computeAddress(saltOracle, keccak256(initOracle));

        vm.startBroadcast(pk);

        // Deploy contracts in the same order as the Phase 2 UI
        address deployedVault = d.deploy(saltVault, initVault);
        require(deployedVault == predictedVault, "vault addr mismatch");

        address deployedWrapper = d.deploy(saltWrapper, initWrapper);
        require(deployedWrapper == predictedWrapper, "wrapper addr mismatch");

        address deployedShare = d.deploy(saltShare, initShare);
        require(deployedShare == predictedShare, "share addr mismatch");

        address deployedGauge = d.deploy(saltGauge, initGauge);
        require(deployedGauge == predictedGauge, "gauge addr mismatch");

        address deployedCCA = d.deploy(saltCCA, initCCA);
        require(deployedCCA == predictedCCA, "cca addr mismatch");

        address deployedOracle = d.deploy(saltOracle, initOracle);
        require(deployedOracle == predictedOracle, "oracle addr mismatch");

        // Wire up
        CreatorOVaultWrapper(predictedWrapper).setShareOFT(predictedShare);

        CreatorOVault(payable(predictedVault)).setWhitelist(predictedWrapper, true);
        CreatorOVault(payable(predictedVault)).setGaugeController(predictedGauge);

        CreatorShareOFT(predictedShare).setVault(predictedVault);
        CreatorShareOFT(predictedShare).setMinter(predictedWrapper, true);
        CreatorShareOFT(predictedShare).setGaugeController(predictedGauge);

        CreatorGaugeController(payable(predictedGauge)).setVault(predictedVault);
        CreatorGaugeController(payable(predictedGauge)).setWrapper(predictedWrapper);
        CreatorGaugeController(payable(predictedGauge)).setCreatorCoin(creatorToken);
        CreatorGaugeController(payable(predictedGauge)).setOracle(predictedOracle);

        CCALaunchStrategy(payable(predictedCCA)).setApprovedLauncher(VAULT_ACTIVATION_BATCHER, true);
        CCALaunchStrategy(payable(predictedCCA)).setOracleConfig(predictedOracle, POOL_MANAGER, TAX_HOOK, creatorTreasury);

        vm.stopBroadcast();

        // Invariant checks (read-only)
        require(address(CreatorOVaultWrapper(predictedWrapper).shareOFT()) == predictedShare, "wrapper->shareOFT");
        require(CreatorShareOFT(predictedShare).vault() == predictedVault, "shareOFT->vault");
        require(CreatorShareOFT(predictedShare).isMinter(predictedWrapper), "wrapper not minter");
        require(CreatorOVault(payable(predictedVault)).gaugeController() == predictedGauge, "vault->gauge");
        require(CreatorOVault(payable(predictedVault)).whitelist(predictedWrapper), "wrapper not whitelisted");
        require(CCALaunchStrategy(payable(predictedCCA)).approvedLaunchers(VAULT_ACTIVATION_BATCHER), "launcher not approved");
    }
}




import "forge-std/Script.sol";

import {Create2Deployer} from "../contracts/helpers/Create2Deployer.sol";
import {CreatorOVault} from "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultWrapper} from "../contracts/vault/CreatorOVaultWrapper.sol";
import {CreatorShareOFT} from "../contracts/layerzero/CreatorShareOFT.sol";
import {CreatorGaugeController} from "../contracts/governance/CreatorGaugeController.sol";
import {CCALaunchStrategy} from "../contracts/strategies/CCALaunchStrategy.sol";
import {CreatorOracle} from "../contracts/oracles/CreatorOracle.sol";

/// @notice Fork simulation of the Phase 2 AA deployment sequence.
/// @dev Run (no broadcast):
///   forge script script/SimulatePhase2Deployment.s.sol:SimulatePhase2Deployment --rpc-url $BASE_RPC_URL
/// or:
///   forge script script/SimulatePhase2Deployment.s.sol:SimulatePhase2Deployment --fork-url $BASE_RPC_URL
