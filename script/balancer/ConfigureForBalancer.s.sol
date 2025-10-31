// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";

interface IEagleShareOFT {
    function setSwapFeeConfig(
        uint16 buyFee,
        uint16 sellFee,
        uint16 treasuryShare,
        uint16 vaultShare,
        address treasury,
        address vaultBeneficiary,
        bool feesEnabled
    ) external;
    
    function setV3Pool(address pool, bool isV3) external;
    function setSwapRouter(address router, bool isRouter) external;
    function setPair(address pair, bool isPairStatus) external;
    function setFeeExempt(address account, bool exempt) external;
}

/**
 * @title ConfigureForBalancer
 * @notice Configure EagleShareOFT for Balancer pool integration
 * 
 * This script:
 * 1. Sets symmetric 2% fees (buy and sell)
 * 2. Splits fees: 50% protocol, 50% vault injection
 * 3. Registers Balancer pool as a DEX pair
 * 4. Enables fees
 */
contract ConfigureForBalancer is Script {
    // Arbitrum addresses
    address constant EAGLE_SHARE_OFT = 0xf83922BcD5a80C07ccb61dbA5E7f7A02cC05a1fD;
    
    // These will be set after Balancer pool deployment
    address balancerPool; // To be provided
    address balancerVault = 0xBA12222222228d8Ba445958a75a0704d566BF2C8; // Balancer V2 Vault on Arbitrum
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get Balancer pool address from environment or use placeholder
        balancerPool = vm.envOr("BALANCER_POOL", address(0));
        
        require(balancerPool != address(0), "Set BALANCER_POOL env variable");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("CONFIGURING EAGLESHAREOF FOR BALANCER");
        console.log("==============================================");
        console.log("");
        console.log("EagleShareOFT:", EAGLE_SHARE_OFT);
        console.log("Balancer Pool:", balancerPool);
        console.log("Balancer Vault:", balancerVault);
        console.log("Deployer:", deployer);
        console.log("");
        
        IEagleShareOFT shareOFT = IEagleShareOFT(EAGLE_SHARE_OFT);
        
        // Step 1: Configure 2% symmetric fees
        console.log("Step 1: Setting 2% symmetric fees...");
        console.log("  Buy Fee: 2% (200 bps)");
        console.log("  Sell Fee: 2% (200 bps)");
        console.log("  Protocol Share: 50%");
        console.log("  Vault Share: 50%");
        
        shareOFT.setSwapFeeConfig(
            200,  // 2% buy fee
            200,  // 2% sell fee
            5000, // 50% to treasury/protocol
            5000, // 50% to vault injection
            deployer, // Treasury (replace with actual)
            deployer, // Vault beneficiary (replace with actual)
            true  // Fees enabled
        );
        console.log("  SUCCESS");
        console.log("");
        
        // Step 2: Register Balancer pool as DEX pair
        console.log("Step 2: Registering Balancer pool...");
        shareOFT.setPair(balancerPool, true);
        console.log("  Balancer pool registered as DEX pair");
        console.log("");
        
        // Step 3: Register Balancer Vault as swap router
        console.log("Step 3: Registering Balancer Vault...");
        shareOFT.setSwapRouter(balancerVault, true);
        console.log("  Balancer Vault registered as swap router");
        console.log("");
        
        // Step 4: Ensure pool is NOT exempt (we want to collect fees)
        console.log("Step 4: Ensuring pool is not fee-exempt...");
        shareOFT.setFeeExempt(balancerPool, false);
        shareOFT.setFeeExempt(balancerVault, false);
        console.log("  Pool is NOT exempt (fees will be collected)");
        console.log("");
        
        console.log("==============================================");
        console.log("CONFIGURATION COMPLETE!");
        console.log("==============================================");
        console.log("");
        console.log("Fee Structure:");
        console.log("  Wrapping (vEAGLE -> EagleShareOFT): 2%");
        console.log("  Unwrapping (EagleShareOFT -> vEAGLE): 2%");
        console.log("  Protocol Fee: 1%");
        console.log("  Vault Injection: 1%");
        console.log("");
        console.log("Next Steps:");
        console.log("  1. Deploy Balancer Composable Stable Pool");
        console.log("  2. Add initial liquidity (vEAGLE + EagleShareOFT)");
        console.log("  3. Test swaps with fee collection");
        console.log("");
        
        vm.stopBroadcast();
    }
}

