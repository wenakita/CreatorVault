// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../../contracts/balancer/EagleBalancerPools.sol";

/**
 * @title DeployBalancerPools
 * @notice Deploy Eagle's two nested Balancer V2 Weighted Pools
 * 
 * @dev Architecture:
 *      Pool 1 (Base): WLFI/USD1 (50/50) -> BPT1
 *      Pool 2 (Vault): BPT1/EAGLE (60/40) -> BPT2
 * 
 * @dev Usage:
 *      # Arbitrum
 *      NETWORK=arbitrum forge script script/balancer/DeployBalancerPools.s.sol \
 *        --rpc-url $ARBITRUM_RPC_URL \
 *        --broadcast
 * 
 *      # Base
 *      NETWORK=base forge script script/balancer/DeployBalancerPools.s.sol \
 *        --rpc-url $BASE_RPC_URL \
 *        --broadcast
 */
contract DeployBalancerPools is Script {
    
    // Balancer V2 addresses (same on most chains)
    address constant BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    
    // Balancer Weighted Pool Factory addresses per chain
    mapping(string => address) public poolFactories;
    
    function setUp() public {
        // Arbitrum
        poolFactories["arbitrum"] = 0xc7E5ED1054A24Ef31D827E6F86caA58B3Bc168d7;
        
        // Base
        poolFactories["base"] = 0xc7E5ED1054A24Ef31D827E6F86caA58B3Bc168d7;
        
        // Optimism
        poolFactories["optimism"] = 0xc7E5ED1054A24Ef31D827E6F86caA58B3Bc168d7;
    }
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        string memory network = vm.envOr("NETWORK", string("arbitrum"));
        address poolFactory = poolFactories[network];
        
        require(poolFactory != address(0), "Unsupported network");
        
        // Get token addresses from environment
        address wlfi;
        address usd1;
        address eagle;
        
        if (keccak256(bytes(network)) == keccak256(bytes("arbitrum"))) {
            wlfi = vm.envAddress("WLFI_ARBITRUM");
            usd1 = vm.envAddress("USD1_ARBITRUM");
            eagle = vm.envAddress("EAGLE_ARBITRUM");
        } else if (keccak256(bytes(network)) == keccak256(bytes("base"))) {
            wlfi = vm.envAddress("WLFI_BASE");
            usd1 = vm.envAddress("USD1_BASE");
            eagle = vm.envAddress("EAGLE_BASE");
        } else {
            revert("Unsupported network");
        }
        
        require(wlfi != address(0), "WLFI address not set");
        require(usd1 != address(0), "USD1 address not set");
        require(eagle != address(0), "EAGLE address not set");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("DEPLOYING EAGLE BALANCER POOLS");
        console.log("==============================================");
        console.log("");
        console.log("Network:", network);
        console.log("Deployer:", deployer);
        console.log("");
        console.log("Balancer V2 Vault:", BALANCER_VAULT);
        console.log("Weighted Pool Factory:", poolFactory);
        console.log("");
        console.log("Token Addresses:");
        console.log("  WLFI:", wlfi);
        console.log("  USD1:", usd1);
        console.log("  EAGLE:", eagle);
        console.log("");
        
        // Deploy pool manager
        console.log("Deploying EagleBalancerPools...");
        EagleBalancerPools pools = new EagleBalancerPools(
            BALANCER_VAULT,
            poolFactory,
            wlfi,
            usd1,
            eagle,
            deployer
        );
        
        console.log("  EagleBalancerPools deployed at:", address(pools));
        console.log("");
        
        // Create Base Pool: WLFI/USD1 (50/50)
        console.log("Creating Base Pool (WLFI/USD1 50/50)...");
        uint256 basePoolSwapFee = 0.003e18; // 0.3% swap fee
        (address basePool, bytes32 basePoolId) = pools.createBasePool(basePoolSwapFee);
        
        console.log("  Base Pool (BPT1) created:");
        console.log("    Address:", basePool);
        console.log("    Pool ID:", vm.toString(basePoolId));
        console.log("    Composition: WLFI (50%) + USD1 (50%)");
        console.log("    Swap Fee: 0.3%");
        console.log("");
        
        // Create Vault Pool: BPT1/EAGLE (60/40)
        console.log("Creating Vault Pool (BPT1/EAGLE 60/40)...");
        uint256 vaultPoolSwapFee = 0.005e18; // 0.5% swap fee
        (address vaultPool, bytes32 vaultPoolId) = pools.createVaultPool(vaultPoolSwapFee);
        
        console.log("  Vault Pool (BPT2) created:");
        console.log("    Address:", vaultPool);
        console.log("    Pool ID:", vm.toString(vaultPoolId));
        console.log("    Composition: BPT1 (60%) + EAGLE (40%)");
        console.log("    Swap Fee: 0.5%");
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("==============================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("==============================================");
        console.log("");
        console.log("Pool Architecture:");
        console.log("  Layer 1: WLFI/USD1 -> BPT1 (0% token fees)");
        console.log("  Layer 2: BPT1/EAGLE -> BPT2 (2% EAGLE fees)");
        console.log("");
        console.log("Fee Structure:");
        console.log("  WLFI <-> USD1: 0.3% Balancer + 0% token = 0.3% total");
        console.log("  WLFI <-> EAGLE: 0.8% Balancer + 2% token = 2.8% total");
        console.log("  USD1 <-> EAGLE: 0.8% Balancer + 2% token = 2.8% total");
        console.log("");
        console.log("Deployed Contracts:");
        console.log("  EagleBalancerPools:", address(pools));
        console.log("  Base Pool (BPT1):", basePool);
        console.log("  Vault Pool (BPT2):", vaultPool);
        console.log("");
        console.log("Next Steps:");
        console.log("1. Add liquidity to Base Pool (WLFI/USD1)");
        console.log("2. Receive BPT1 tokens");
        console.log("3. Add liquidity to Vault Pool (BPT1/EAGLE)");
        console.log("4. Receive BPT2 tokens");
        console.log("5. BPT2 can be used in Uniswap V3 paired with ETH");
        console.log("");
        console.log("Save these addresses:");
        console.log("  export EAGLE_BALANCER_POOLS_", vm.toUppercase(network), "=", address(pools));
        console.log("  export BPT1_", vm.toUppercase(network), "=", basePool);
        console.log("  export BPT2_", vm.toUppercase(network), "=", vaultPool);
        console.log("");
        
        _saveDeployment(network, address(pools), basePool, vaultPool, basePoolId, vaultPoolId);
    }
    
    function _saveDeployment(
        string memory network,
        address poolsContract,
        address basePool,
        address vaultPool,
        bytes32 basePoolId,
        bytes32 vaultPoolId
    ) internal {
        string memory fileName = string.concat("./deployments/balancer_pools_", network, ".json");
        string memory json = "{}";
        json = vm.serializeAddress(json, "eagleBalancerPools", poolsContract);
        json = vm.serializeAddress(json, "basePool", basePool);
        json = vm.serializeAddress(json, "vaultPool", vaultPool);
        json = vm.serializeBytes32(json, "basePoolId", basePoolId);
        json = vm.serializeBytes32(json, "vaultPoolId", vaultPoolId);
        json = vm.serializeString(json, "network", network);
        json = vm.serializeUint(json, "chainId", block.chainid);
        vm.writeJson(json, fileName);
        console.log("Deployment saved to:", fileName);
    }
}

