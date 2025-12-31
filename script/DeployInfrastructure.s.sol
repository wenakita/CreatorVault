// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

// Core Infrastructure
import {CreatorRegistry} from "../contracts/core/CreatorRegistry.sol";
import {CreatorOVaultFactory} from "../contracts/factories/CreatorOVaultFactory.sol";
import {PayoutRouterFactory} from "../contracts/factories/PayoutRouterFactory.sol";

// Shared Services
import {CreatorLotteryManager} from "../contracts/lottery/CreatorLotteryManager.sol";
import {CreatorVRFConsumerV2_5} from "../contracts/vrf/CreatorVRFConsumerV2_5.sol";

// Per-Creator Contracts (deployed by DeployCreatorVault)
import {CreatorOVault} from "../contracts/vault/CreatorOVault.sol";
import {CreatorOVaultWrapper} from "../contracts/vault/CreatorOVaultWrapper.sol";
import {CreatorShareOFT} from "../contracts/layerzero/CreatorShareOFT.sol";
import {CreatorGaugeController} from "../contracts/governance/CreatorGaugeController.sol";
import {CCALaunchStrategy} from "../contracts/strategies/CCALaunchStrategy.sol";
import {CreatorOracle} from "../contracts/oracles/CreatorOracle.sol";

/**
 * @title DeployInfrastructure
 * @author 0xakita.eth (CreatorVault)
 * @notice Deploys ALL CreatorVault infrastructure contracts on Base
 * 
 * @dev DEPLOYMENT ORDER:
 *      ┌─────────────────────────────────────────────────────────────────┐
 *      │  PHASE 1: Core Infrastructure (One-time deployment)             │
 *      │  ────────────────────────────────────────────────────────────   │
 *      │  1. CreatorRegistry         - Central registry for all data    │
 *      │  2. CreatorOVaultFactory    - Deploys per-creator contracts    │
 *      │  3. PayoutRouterFactory     - Deploys PayoutRouters            │
 *      │  4. CreatorLotteryManager   - Shared lottery service           │
 *      │  5. CreatorVRFConsumerV2_5  - Chainlink VRF hub                │
 *      └─────────────────────────────────────────────────────────────────┘
 *      
 *      ┌─────────────────────────────────────────────────────────────────┐
 *      │  PHASE 2: Configuration                                         │
 *      │  ────────────────────────────────────────────────────────────   │
 *      │  - Register Base chain in registry                              │
 *      │  - Set LayerZero endpoints                                      │
 *      │  - Authorize factories                                          │
 *      │  - Configure VRF subscription                                   │
 *      └─────────────────────────────────────────────────────────────────┘
 * 
 * @dev RUN COMMAND:
 *      forge script script/DeployInfrastructure.s.sol:DeployInfrastructure \
 *          --rpc-url base \
 *          --broadcast \
 *          --verify \
 *          -vvvv
 * 
 * @dev ENVIRONMENT VARIABLES:
 *      PRIVATE_KEY           - Deployer private key
 *      ETHERSCAN_API_KEY     - For contract verification
 *      VRF_SUBSCRIPTION_ID   - Chainlink VRF subscription (optional)
 */
contract DeployInfrastructure is Script {
    
    // ═══════════════════════════════════════════════════════════════════
    //                         BASE MAINNET CONFIG
    // ═══════════════════════════════════════════════════════════════════
    
    /// @notice LayerZero V2 Endpoint on Base
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    
    /// @notice Chainlink ETH/USD Price Feed on Base
    address constant CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    
    /// @notice Chainlink VRF Coordinator V2.5 on Base
    address constant VRF_COORDINATOR = 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634;
    
    /// @notice Existing Tax Hook on Base (6.9% sell fees)
    address constant TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;
    
    /// @notice WETH on Base
    address constant WETH = 0x4200000000000000000000000000000000000006;
    
    /// @notice Base Chain ID
    uint16 constant BASE_CHAIN_ID = 8453;
    
    /// @notice Base LayerZero EID
    uint32 constant BASE_EID = 30184;
    
    /// @notice EntryPoint v0.6 (ERC-4337)
    address constant ENTRY_POINT = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789;
    
    // ═══════════════════════════════════════════════════════════════════
    //                         DEPLOYED CONTRACTS
    // ═══════════════════════════════════════════════════════════════════
    
    CreatorRegistry public registry;
    CreatorOVaultFactory public vaultFactory;
    PayoutRouterFactory public payoutRouterFactory;
    CreatorLotteryManager public lotteryManager;
    CreatorVRFConsumerV2_5 public vrfConsumer;
    
    // ═══════════════════════════════════════════════════════════════════
    //                              MAIN
    // ═══════════════════════════════════════════════════════════════════
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        _printHeader(deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // ═══════════════════════════════════════════════════════════════
        //                    PHASE 1: CORE CONTRACTS
        // ═══════════════════════════════════════════════════════════════
        
        console.log("\n");
        console.log(unicode"╔════════════════════════════════════════════════════════════════╗");
        console.log(unicode"║              PHASE 1: Core Infrastructure                      ║");
        console.log(unicode"╚════════════════════════════════════════════════════════════════╝");
        
        // 1. CreatorRegistry
        console.log("\n[1/5] Deploying CreatorRegistry...");
        registry = new CreatorRegistry(deployer);
        console.log("       Address:", address(registry));
        
        // 2. CreatorOVaultFactory
        console.log("\n[2/5] Deploying CreatorOVaultFactory...");
        vaultFactory = new CreatorOVaultFactory(address(registry), deployer);
        console.log("       Address:", address(vaultFactory));
        
        // 3. PayoutRouterFactory
        console.log("\n[3/5] Deploying PayoutRouterFactory...");
        payoutRouterFactory = new PayoutRouterFactory(deployer);
        console.log("       Address:", address(payoutRouterFactory));
        
        // 4. CreatorLotteryManager (shared service)
        console.log("\n[4/5] Deploying CreatorLotteryManager...");
        lotteryManager = new CreatorLotteryManager(
            address(registry),
            deployer
        );
        console.log("       Address:", address(lotteryManager));
        
        // 5. CreatorVRFConsumerV2_5 (VRF hub)
        console.log("\n[5/5] Deploying CreatorVRFConsumerV2_5...");
        vrfConsumer = new CreatorVRFConsumerV2_5(
            address(registry),
            deployer
        );
        console.log("       Address:", address(vrfConsumer));
        
        // ═══════════════════════════════════════════════════════════════
        //                    PHASE 2: CONFIGURATION
        // ═══════════════════════════════════════════════════════════════
        
        console.log("\n");
        console.log(unicode"╔════════════════════════════════════════════════════════════════╗");
        console.log(unicode"║              PHASE 2: Configuration                            ║");
        console.log(unicode"╚════════════════════════════════════════════════════════════════╝");
        
        // Register Base chain
        console.log("\n[Config] Registering Base chain...");
        registry.registerChain(BASE_CHAIN_ID, "Base", WETH, true);
        
        // Set LayerZero endpoint
        console.log("[Config] Setting LayerZero endpoint...");
        registry.setLayerZeroEndpoint(BASE_CHAIN_ID, LZ_ENDPOINT);
        
        // Set chain ID to EID mapping
        console.log("[Config] Setting chain ID to EID mapping...");
        registry.setChainIdToEid(BASE_CHAIN_ID, BASE_EID);
        
        // Authorize factories
        console.log("[Config] Authorizing vault factory...");
        registry.setAuthorizedFactory(address(vaultFactory), true);
        
        // Set hub chain (Base is the hub)
        console.log("[Config] Setting Base as hub chain...");
        registry.setHubChain(BASE_CHAIN_ID, BASE_EID);
        
        // Set VRF coordinator in VRF consumer
        console.log("[Config] Setting VRF coordinator...");
        vrfConsumer.setVRFCoordinator(VRF_COORDINATOR);
        
        vm.stopBroadcast();
        
        // ═══════════════════════════════════════════════════════════════
        //                         SUMMARY
        // ═══════════════════════════════════════════════════════════════
        
        _printSummary(deployer);
    }
    
    // ═══════════════════════════════════════════════════════════════════
    //                         HELPERS
    // ═══════════════════════════════════════════════════════════════════
    
    function _printHeader(address deployer) internal view {
        console.log("\n");
        console.log(unicode"╔════════════════════════════════════════════════════════════════╗");
        console.log(unicode"║                                                                ║");
        console.log(unicode"║     ██████╗██████╗ ███████╗ █████╗ ████████╗ ██████╗ ██████╗   ║");
        console.log(unicode"║    ██╔════╝██╔══██╗██╔════╝██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗  ║");
        console.log(unicode"║    ██║     ██████╔╝█████╗  ███████║   ██║   ██║   ██║██████╔╝  ║");
        console.log(unicode"║    ██║     ██╔══██╗██╔══╝  ██╔══██║   ██║   ██║   ██║██╔══██╗  ║");
        console.log(unicode"║    ╚██████╗██║  ██║███████╗██║  ██║   ██║   ╚██████╔╝██║  ██║  ║");
        console.log(unicode"║     ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝  ║");
        console.log(unicode"║                         VAULT                                  ║");
        console.log(unicode"║                                                                ║");
        console.log(unicode"║            Infrastructure Deployment on Base                   ║");
        console.log(unicode"║                                                                ║");
        console.log(unicode"╚════════════════════════════════════════════════════════════════╝");
        console.log("\n");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("Network:  Base Mainnet");
    }
    
    function _printSummary(address deployer) internal view {
        console.log("\n");
        console.log(unicode"╔════════════════════════════════════════════════════════════════╗");
        console.log(unicode"║                    DEPLOYMENT COMPLETE                         ║");
        console.log(unicode"╚════════════════════════════════════════════════════════════════╝");
        console.log("\n");
        console.log(unicode"┌─────────────────────────────────────────────────────────────────┐");
        console.log(unicode"│  DEPLOYED CONTRACTS                                             │");
        console.log(unicode"├─────────────────────────────────────────────────────────────────┤");
        console.log(unicode"│                                                                 │");
        console.log("   CreatorRegistry:        ", address(registry));
        console.log("   CreatorOVaultFactory:   ", address(vaultFactory));
        console.log("   PayoutRouterFactory:    ", address(payoutRouterFactory));
        console.log("   CreatorLotteryManager:  ", address(lotteryManager));
        console.log("   CreatorVRFConsumerV2_5: ", address(vrfConsumer));
        console.log(unicode"│                                                                 │");
        console.log(unicode"└─────────────────────────────────────────────────────────────────┘");
        
        console.log("\n");
        console.log(unicode"┌─────────────────────────────────────────────────────────────────┐");
        console.log(unicode"│  EXTERNAL CONTRACTS (Pre-deployed)                              │");
        console.log(unicode"├─────────────────────────────────────────────────────────────────┤");
        console.log("   Tax Hook (6.9%):        ", TAX_HOOK);
        console.log("   EntryPoint v0.6:        ", ENTRY_POINT);
        console.log("   LayerZero Endpoint:     ", LZ_ENDPOINT);
        console.log("   VRF Coordinator:        ", VRF_COORDINATOR);
        console.log(unicode"└─────────────────────────────────────────────────────────────────┘");
        
        console.log("\n");
        console.log(unicode"┌─────────────────────────────────────────────────────────────────┐");
        console.log(unicode"│  ENVIRONMENT VARIABLES FOR AA DEPLOYMENT                        │");
        console.log(unicode"├─────────────────────────────────────────────────────────────────┤");
        console.log(unicode"│                                                                 │");
        console.log("   # Add to your .env file:");
        console.log("   CREATOR_FACTORY=", address(vaultFactory));
        console.log("   PAYOUT_ROUTER_FACTORY=", address(payoutRouterFactory));
        console.log("   CREATOR_REGISTRY=", address(registry));
        console.log("   LOTTERY_MANAGER=", address(lotteryManager));
        console.log(unicode"│                                                                 │");
        console.log(unicode"└─────────────────────────────────────────────────────────────────┘");
        
        console.log("\n");
        console.log(unicode"┌─────────────────────────────────────────────────────────────────┐");
        console.log(unicode"│  COINBASE PAYMASTER - CONTRACT ALLOWLIST                        │");
        console.log(unicode"├─────────────────────────────────────────────────────────────────┤");
        console.log(unicode"│  Add these contracts to your Coinbase Developer Portal:         │");
        console.log(unicode"│                                                                 │");
        console.log("   1. CreatorOVaultFactory:    ", address(vaultFactory));
        console.log("      Function: deploy(address)");
        console.log(unicode"│                                                                 │");
        console.log("   2. PayoutRouterFactory:     ", address(payoutRouterFactory));
        console.log("      Function: deploy(address,address)");
        console.log(unicode"│                                                                 │");
        console.log(unicode"└─────────────────────────────────────────────────────────────────┘");
        
        console.log("\n");
        console.log(unicode"╔════════════════════════════════════════════════════════════════╗");
        console.log(unicode"║                        NEXT STEPS                              ║");
        console.log(unicode"╠════════════════════════════════════════════════════════════════╣");
        console.log(unicode"║                                                                ║");
        console.log(unicode"║  1. Copy contract addresses to .env file                       ║");
        console.log(unicode"║  2. Add contracts to Coinbase Paymaster allowlist              ║");
        console.log(unicode"║  3. Create & fund VRF subscription on Chainlink                ║");
        console.log(unicode"║  4. Deploy creator vaults:                                     ║");
        console.log(unicode"║     - Via AA: npx ts-node script/deploy-with-aa.ts --gasless   ║");
        console.log(unicode"║     - Via EOA: forge script DeployCreatorVault                 ║");
        console.log(unicode"║                                                                ║");
        console.log(unicode"╚════════════════════════════════════════════════════════════════╝");
    }
}

/**
 * @title DeployCreatorVault
 * @notice Deploy infrastructure for a specific Creator Coin (deploys contracts directly)
 * @dev Run with: 
 *      CREATOR_COIN_ADDRESS=0x... forge script script/DeployInfrastructure.s.sol:DeployCreatorVault \
 *          --rpc-url base --broadcast -vvvv
 * 
 * @dev DEPLOYS 6 CONTRACTS DIRECTLY:
 *      1. CreatorOVault - ERC-4626 vault
 *      2. CreatorOVaultWrapper - Stake/wrap interface
 *      3. CreatorShareOFT - Cross-chain OFT
 *      4. CreatorGaugeController - Fee distribution
 *      5. CCALaunchStrategy - Fair launch
 *      6. CreatorOracle - Price oracle
 */
contract DeployCreatorVault is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Load addresses from environment
        address registryAddr = vm.envAddress("CREATOR_REGISTRY");
        address factoryAddr = vm.envAddress("CREATOR_FACTORY");
        address creatorCoin = vm.envAddress("CREATOR_COIN_ADDRESS");
        
        console.log("\n");
        console.log(unicode"╔════════════════════════════════════════════════════════════════╗");
        console.log(unicode"║              Deploy Creator Vault Infrastructure               ║");
        console.log(unicode"╚════════════════════════════════════════════════════════════════╝");
        console.log("\n");
        console.log("Registry:     ", registryAddr);
        console.log("Factory:      ", factoryAddr);
        console.log("Creator Coin: ", creatorCoin);
        console.log("Creator:      ", deployer);
        
        // Get token symbol for naming (UPPERCASE for consistency)
        string memory symbol = _toUpperCase(IERC20Metadata(creatorCoin).symbol());
        string memory vaultName = string(abi.encodePacked(symbol, " Shares"));
        string memory vaultSymbol = string(abi.encodePacked("s", symbol));
        string memory oftName = string(abi.encodePacked("Wrapped ", symbol, " Shares"));
        string memory oftSymbol = string(abi.encodePacked("ws", symbol));
        
        console.log("\n");
        console.log("Vault Name:   ", vaultName);
        console.log("Vault Symbol: ", vaultSymbol);
        console.log("OFT Name:     ", oftName);
        console.log("OFT Symbol:   ", oftSymbol);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // ============ DEPLOY CONTRACTS DIRECTLY ============
        
        // 1. Deploy Vault
        console.log("\n[1/6] Deploying CreatorOVault...");
        CreatorOVault vault = new CreatorOVault(
            creatorCoin,
            deployer,
            vaultName,
            vaultSymbol
        );
        console.log("       Address:", address(vault));
        
        // 2. Deploy Wrapper
        console.log("\n[2/6] Deploying CreatorOVaultWrapper...");
        CreatorOVaultWrapper wrapper = new CreatorOVaultWrapper(
            creatorCoin,
            address(vault),
            deployer
        );
        console.log("       Address:", address(wrapper));
        
        // 3. Deploy ShareOFT (uses registry for LZ endpoint lookup)
        console.log("\n[3/6] Deploying CreatorShareOFT...");
        CreatorShareOFT shareOFT = new CreatorShareOFT(
            oftName,
            oftSymbol,
            registryAddr,  // Registry looks up LZ endpoint for this chain
            deployer
        );
        console.log("       Address:", address(shareOFT));
        
        // 4. Deploy GaugeController
        console.log("\n[4/6] Deploying CreatorGaugeController...");
        CreatorGaugeController gaugeController = new CreatorGaugeController(
            address(shareOFT),
            deployer,  // creator treasury
            deployer,  // protocol treasury
            deployer   // owner
        );
        gaugeController.setVault(address(vault));
        gaugeController.setWrapper(address(wrapper));
        console.log("       Address:", address(gaugeController));
        
        // 5. Deploy CCA Strategy
        // CCA = Continuous Clearing Auction for fair token distribution
        console.log("\n[5/6] Deploying CCALaunchStrategy...");
        CCALaunchStrategy ccaStrategy = new CCALaunchStrategy(
            address(shareOFT),   // auctionToken - what we're selling
            address(0),          // currency - native ETH
            address(vault),      // fundsRecipient - raised ETH goes to vault
            address(vault),      // tokensRecipient - unsold tokens return to vault
            deployer             // owner
        );
        console.log("       Address:", address(ccaStrategy));
        
        // 6. Deploy Oracle (uses registry for LZ endpoint lookup)
        console.log("\n[6/6] Deploying CreatorOracle...");
        CreatorOracle oracle = new CreatorOracle(
            registryAddr,  // Registry looks up LZ endpoint for this chain
            address(0),    // chainlinkFeed - configure after deployment
            oftSymbol,
            deployer
        );
        console.log("       Address:", address(oracle));
        
        // ============ CONFIGURE PERMISSIONS ============
        
        console.log("\n=== Configuring Permissions ===");
        
        // Set gauge controller on vault
        vault.setGaugeController(address(gaugeController));
        console.log("       Vault: setGaugeController");
        
        // Whitelist wrapper on vault
        vault.setWhitelist(address(wrapper), true);
        console.log("       Vault: whitelist wrapper");
        
        // Set ShareOFT on wrapper
        wrapper.setShareOFT(address(shareOFT));
        console.log("       Wrapper: setShareOFT");
        
        // Grant minter role to wrapper on ShareOFT (minters can also burn)
        shareOFT.setMinter(address(wrapper), true);
        console.log("       ShareOFT: setMinter(wrapper)");
        
        // ============ CONFIGURE CCA STRATEGY ============
        
        console.log("\n=== Configuring CCA Strategy ===");
        
        // V4 PoolManager on Base
        address V4_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
        // Tax Hook (6.9% sell fees)
        address TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;
        
        // Configure oracle settings for automatic V4 pool setup on CCA graduation
        // Also sets up the 6.9% tax hook to send fees to GaugeController
        ccaStrategy.setOracleConfig(
            address(oracle),
            V4_POOL_MANAGER,
            TAX_HOOK,
            address(gaugeController)  // GaugeController receives 6.9% trade fees
        );
        console.log("       CCA: setOracleConfig (oracle, poolManager, taxHook, feeRecipient)");
        
        // ============ CONFIGURE ORACLE ============
        
        console.log("\n=== Configuring Oracle ===");
        
        // Set Chainlink ETH/USD feed (Base Mainnet)
        address CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
        oracle.setChainlinkFeed(CHAINLINK_ETH_USD);
        console.log("       Oracle: setChainlinkFeed (ETH/USD)");
        
        // Note: V4 Pool configuration must be done AFTER pool creation
        // oracle.setV4Pool(poolManager, poolKey) - call separately after creating V4 pool
        
        // ============ CONFIGURE GAUGE CONTROLLER ============
        
        console.log("\n=== Configuring GaugeController ===");
        
        // Set the creator coin for swaps
        gaugeController.setCreatorCoin(creatorCoin);
        console.log("       GaugeController: setCreatorCoin");
        
        // Set the oracle for price lookups
        gaugeController.setOracle(address(oracle));
        console.log("       GaugeController: setOracle");
        
        // Connect to shared lottery manager (from infrastructure deployment)
        address lotteryManager = vm.envOr("CREATOR_LOTTERY_MANAGER", address(0));
        if (lotteryManager != address(0)) {
            gaugeController.setLotteryManager(lotteryManager);
            console.log("       GaugeController: setLotteryManager");
        } else {
            console.log("       GaugeController: SKIPPED setLotteryManager (not in env)");
        }
        
        // ============ REGISTER WITH MAIN REGISTRY ============
        
        console.log("\n=== Registering with CreatorRegistry ===");
        
        CreatorRegistry registry = CreatorRegistry(registryAddr);
        
        // Register oracle and gauge controller for this creator coin
        registry.setCreatorOracle(creatorCoin, address(oracle));
        console.log("       Registry: setCreatorOracle");
        
        registry.setCreatorGaugeController(creatorCoin, address(gaugeController));
        console.log("       Registry: setCreatorGaugeController");
        
        // ============ REGISTER WITH FACTORY ============
        
        console.log("\n=== Registering with Factory ===");
        
        CreatorOVaultFactory factory = CreatorOVaultFactory(factoryAddr);
        
        // Skip registration if already deployed (allows redeployment with new params)
        if (!factory.isDeployed(creatorCoin)) {
            factory.registerDeployment(
                creatorCoin,
                address(vault),
                address(wrapper),
                address(shareOFT),
                address(gaugeController),
                address(ccaStrategy),
                address(oracle),
                deployer
            );
            console.log("       Factory: registerDeployment");
        } else {
            console.log("       Factory: SKIPPED (already registered)");
        }
        
        vm.stopBroadcast();
        
        console.log("\n");
        console.log(unicode"┌─────────────────────────────────────────────────────────────────┐");
        console.log(unicode"│  DEPLOYED CONTRACTS                                             │");
        console.log(unicode"├─────────────────────────────────────────────────────────────────┤");
        console.log("   Vault:           ", address(vault));
        console.log("   Wrapper:         ", address(wrapper));
        console.log("   ShareOFT:        ", address(shareOFT));
        console.log("   GaugeController: ", address(gaugeController));
        console.log("   CCAStrategy:     ", address(ccaStrategy));
        console.log("   Oracle:          ", address(oracle));
        console.log(unicode"└─────────────────────────────────────────────────────────────────┘");
        
        console.log("\n");
        console.log(unicode"┌─────────────────────────────────────────────────────────────────┐");
        console.log(unicode"│  TOKEN FLOW                                                     │");
        console.log(unicode"├─────────────────────────────────────────────────────────────────┤");
        console.log(unicode"│                                                                 │");
        console.log(unicode"│  CreatorCoin (AKITA)                                            │");
        console.log(unicode"│       │                                                         │");
        console.log(unicode"│       ▼ stake                                                   │");
        console.log(unicode"│  Vault Shares (sAKITA)                                          │");
        console.log(unicode"│       │                                                         │");
        console.log(unicode"│       ▼ wrap                                                    │");
        console.log(unicode"│  Wrapped Shares (wsAKITA) ← Trades on DEX with 6.9% fees        │");
        console.log(unicode"│                                                                 │");
        console.log(unicode"└─────────────────────────────────────────────────────────────────┘");
    }
    
    /// @dev Convert string to uppercase
    function _toUpperCase(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bUpper = new bytes(bStr.length);
        for (uint i = 0; i < bStr.length; i++) {
            // If lowercase letter (a-z), convert to uppercase
            if (bStr[i] >= 0x61 && bStr[i] <= 0x7A) {
                bUpper[i] = bytes1(uint8(bStr[i]) - 32);
            } else {
                bUpper[i] = bStr[i];
            }
        }
        return string(bUpper);
    }
}

/**
 * @title DeployPayoutRouter
 * @notice Deploy PayoutRouter for a specific Creator Vault
 * @dev Run with:
 *      WRAPPER_ADDRESS=0x... forge script script/DeployInfrastructure.s.sol:DeployPayoutRouter \
 *          --rpc-url base --broadcast -vvvv
 */
contract DeployPayoutRouter is Script {
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        address payoutRouterFactoryAddr = vm.envAddress("PAYOUT_ROUTER_FACTORY");
        address wrapperAddr = vm.envAddress("WRAPPER_ADDRESS");
        
        console.log("\n");
        console.log(unicode"╔════════════════════════════════════════════════════════════════╗");
        console.log(unicode"║              Deploy PayoutRouter                               ║");
        console.log(unicode"╚════════════════════════════════════════════════════════════════╝");
        console.log("\n");
        console.log("Factory: ", payoutRouterFactoryAddr);
        console.log("Wrapper: ", wrapperAddr);
        console.log("Owner:   ", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        PayoutRouterFactory factory = PayoutRouterFactory(payoutRouterFactoryAddr);
        
        address payoutRouter = factory.deploy(wrapperAddr, deployer);
        
        vm.stopBroadcast();
        
        console.log("\n");
        console.log(unicode"┌─────────────────────────────────────────────────────────────────┐");
        console.log(unicode"│  DEPLOYED                                                       │");
        console.log(unicode"├─────────────────────────────────────────────────────────────────┤");
        console.log("   PayoutRouter: ", payoutRouter);
        console.log(unicode"└─────────────────────────────────────────────────────────────────┘");
        
        console.log("\n");
        console.log(unicode"┌─────────────────────────────────────────────────────────────────┐");
        console.log(unicode"│  NEXT STEP                                                      │");
        console.log(unicode"├─────────────────────────────────────────────────────────────────┤");
        console.log(unicode"│  Change your Zora token's payoutRecipient to:                   │");
        console.log("   ", payoutRouter);
        console.log(unicode"│                                                                 │");
        console.log(unicode"│  This will redirect Zora trading fees to:                       │");
        console.log(unicode"│  Vault → Wrap → Weekly Burn                                     │");
        console.log(unicode"└─────────────────────────────────────────────────────────────────┘");
    }
}