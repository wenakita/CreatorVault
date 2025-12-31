// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/charm/CharmAlphaVault.sol";
import "../contracts/charm/CharmAlphaStrategy.sol";
import "../contracts/helpers/V3PoolInitializer.sol";
import "../contracts/interfaces/v3/IUniswapV3Factory.sol";
import "../contracts/interfaces/v3/IUniswapV3Pool.sol";

/**
 * @title DeployCharmForAKITA
 * @notice Complete deployment script for Charm integration with AKITA vault
 * 
 * This script:
 * 1. Creates AKITA/USDC V3 pool (if needed)
 * 2. Initializes pool with starting price
 * 3. Deploys Charm Alpha Vault
 * 4. Deploys Charm Alpha Strategy
 * 5. Connects everything together
 */
contract DeployCharmForAKITA is Script {
    // Base Mainnet addresses
    address constant V3_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;
    address constant AKITA = 0x5b674196812451B7cEC024FE9d22D2c0b172fa75;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    
    // Pool parameters
    uint24 constant FEE_TIER = 3000; // 0.3%
    
    // Charm vault parameters
    uint256 constant PROTOCOL_FEE = 10000; // 1% (expressed as 1e-6)
    uint256 constant MAX_TOTAL_SUPPLY = type(uint256).max; // No cap initially
    
    // Strategy parameters
    int24 constant BASE_THRESHOLD = 3000; // ~30% price range
    int24 constant LIMIT_THRESHOLD = 6000; // ~60% for limit orders
    int24 constant MAX_TWAP_DEVIATION = 100; // Max 1% deviation from TWAP
    uint32 constant TWAP_DURATION = 1800; // 30 minutes
    
    // Initial price: $0.0001 per AKITA (in USDC)
    // sqrtPriceX96 = sqrt(price) * 2^96
    // For AKITA/USDC at $0.0001: sqrtPriceX96 ≈ 250541448375047931186413801569
    uint160 constant INITIAL_SQRT_PRICE_X96 = 250541448375047931186413801569;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("DEPLOYING CHARM FINANCE FOR AKITA VAULT");
        console.log("==============================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ===================================================
        // STEP 1: Deploy V3 Pool Initializer
        // ===================================================
        console.log("Step 1: Deploying V3PoolInitializer...");
        V3PoolInitializer poolInitializer = new V3PoolInitializer(
            V3_FACTORY,
            WETH,
            USDC
        );
        console.log("   V3PoolInitializer:", address(poolInitializer));
        console.log("");

        // ===================================================
        // STEP 2: Create and Initialize AKITA/USDC Pool
        // ===================================================
        console.log("Step 2: Creating AKITA/USDC V3 Pool...");
        
        // Check if pool exists
        IUniswapV3Factory factory = IUniswapV3Factory(V3_FACTORY);
        address existingPool = factory.getPool(AKITA, USDC, FEE_TIER);
        
        address poolAddress;
        if (existingPool == address(0)) {
            console.log("   Pool doesn't exist, creating...");
            poolAddress = poolInitializer.createAndInitialize(
                AKITA,
                USDC,
                FEE_TIER,
                INITIAL_SQRT_PRICE_X96
            );
            console.log("   Pool created:", poolAddress);
        } else {
            console.log("   Pool already exists:", existingPool);
            poolAddress = existingPool;
            
            // Try to initialize if not already initialized
            try IUniswapV3Pool(poolAddress).initialize(INITIAL_SQRT_PRICE_X96) {
                console.log("   Pool initialized");
            } catch {
                console.log("   Pool already initialized");
            }
        }
        console.log("");

        // ===================================================
        // STEP 3: Deploy Charm Alpha Vault
        // ===================================================
        console.log("Step 3: Deploying Charm Alpha Vault...");
        CharmAlphaVault vault = new CharmAlphaVault(
            poolAddress,
            PROTOCOL_FEE,
            MAX_TOTAL_SUPPLY,
            "Charm AKITA/USDC LP",
            "cAKITA-USDC"
        );
        console.log("   CharmAlphaVault:", address(vault));
        console.log("   Token0 (AKITA):", address(vault.token0()));
        console.log("   Token1 (USDC):", address(vault.token1()));
        console.log("   Tick Spacing:", uint256(uint24(vault.tickSpacing())));
        console.log("");

        // ===================================================
        // STEP 4: Deploy Charm Alpha Strategy
        // ===================================================
        console.log("Step 4: Deploying Charm Alpha Strategy...");
        CharmAlphaStrategy strategy = new CharmAlphaStrategy(
            address(vault),
            BASE_THRESHOLD,
            LIMIT_THRESHOLD,
            MAX_TWAP_DEVIATION,
            TWAP_DURATION,
            deployer // Deployer is initial keeper
        );
        console.log("   CharmAlphaStrategy:", address(strategy));
        console.log("   Base Threshold:", uint256(uint24(BASE_THRESHOLD)));
        console.log("   Limit Threshold:", uint256(uint24(LIMIT_THRESHOLD)));
        console.log("   Keeper:", deployer);
        console.log("");

        // ===================================================
        // STEP 5: Connect Strategy to Vault
        // ===================================================
        console.log("Step 5: Connecting strategy to vault...");
        vault.setStrategy(address(strategy));
        console.log("   Strategy connected");
        console.log("");

        vm.stopBroadcast();

        // ===================================================
        // DEPLOYMENT SUMMARY
        // ===================================================
        console.log("==============================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("==============================================");
        console.log("");
        console.log("CONTRACT ADDRESSES:");
        console.log("   V3PoolInitializer:", address(poolInitializer));
        console.log("   AKITA/USDC Pool:", poolAddress);
        console.log("   CharmAlphaVault:", address(vault));
        console.log("   CharmAlphaStrategy:", address(strategy));
        console.log("");
        console.log("NEXT STEPS:");
        console.log("   1. Add initial liquidity to Charm vault");
        console.log("   2. Call strategy.rebalance() to set initial positions");
        console.log("   3. Update CreatorCharmStrategy to use this vault");
        console.log("   4. Set up keeper bot for auto-rebalancing");
        console.log("");
        console.log("KEEPER COMMANDS:");
        console.log("   Rebalance: cast send", address(strategy), '"rebalance()"');
        console.log("   Check tick: cast call", poolAddress, '"slot0()"');
        console.log("");
        console.log("GOVERNANCE:");
        console.log("   Current governance:", deployer);
        console.log("   To transfer: vault.setGovernance(newAddress)");
        console.log("   Then: vault.acceptGovernance() from new address");
        console.log("");
        
        // Save addresses to file for later use
        string memory json = string(abi.encodePacked(
            '{\n',
            '  "v3PoolInitializer": "', vm.toString(address(poolInitializer)), '",\n',
            '  "akitaUsdcPool": "', vm.toString(poolAddress), '",\n',
            '  "charmAlphaVault": "', vm.toString(address(vault)), '",\n',
            '  "charmAlphaStrategy": "', vm.toString(address(strategy)), '",\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "timestamp": "', vm.toString(block.timestamp), '"\n',
            '}'
        ));
        
        vm.writeFile("deployments/charm-akita.json", json);
        console.log("Deployment addresses saved to: deployments/charm-akita.json");
        console.log("");
    }
}



import "forge-std/Script.sol";
import "../contracts/charm/CharmAlphaVault.sol";
import "../contracts/charm/CharmAlphaStrategy.sol";
import "../contracts/helpers/V3PoolInitializer.sol";
import "../contracts/interfaces/v3/IUniswapV3Factory.sol";
import "../contracts/interfaces/v3/IUniswapV3Pool.sol";

/**
 * @title DeployCharmForAKITA
 * @notice Complete deployment script for Charm integration with AKITA vault
 * 
 * This script:
 * 1. Creates AKITA/USDC V3 pool (if needed)
 * 2. Initializes pool with starting price
 * 3. Deploys Charm Alpha Vault
 * 4. Deploys Charm Alpha Strategy
 * 5. Connects everything together
 */
