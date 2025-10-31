// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";

/**
 * @title DeployArbitrum
 * @notice Deploy EagleShareOFT (vEAGLE) on Arbitrum Mainnet
 * 
 * @dev USAGE:
 *      forge script script/DeployArbitrum.s.sol:DeployArbitrum \
 *        --rpc-url $ARBITRUM_RPC_URL \
 *        --broadcast \
 *        --verify \
 *        --etherscan-api-key $ARBISCAN_API_KEY \
 *        -vvvv
 */
contract DeployArbitrum is Script {
    // LayerZero V2 Arbitrum Mainnet Endpoint
    address constant LZ_ENDPOINT_ARBITRUM = 0x1a44076050125825900e736c501f859c50fE728c;
    
    // Deployed contract
    EagleShareOFT public shareOFT;
    
    address public deployer;
    address public owner;
    address public treasury;
    address public vaultBeneficiary;
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        deployer = vm.addr(deployerPrivateKey);
        
        // Use deployer as default for all roles (can be changed later)
        owner = deployer;
        treasury = deployer;
        vaultBeneficiary = deployer;
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("=================================================");
        console.log("DEPLOYING vEAGLE TO ARBITRUM MAINNET");
        console.log("=================================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Owner:", owner);
        console.log("Treasury:", treasury);
        console.log("Vault Beneficiary:", vaultBeneficiary);
        console.log("LayerZero Endpoint:", LZ_ENDPOINT_ARBITRUM);
        console.log("");
        
        // Deploy EagleShareOFT
        console.log("Step 1: Deploying EagleShareOFT (vEAGLE)...");
        
        shareOFT = new EagleShareOFT(
            "Eagle Vault Shares",
            "vEAGLE",
            LZ_ENDPOINT_ARBITRUM,
            owner
        );
        console.log("  vEAGLE deployed at:", address(shareOFT));
        console.log("");
        
        // Configure ShareOFT fees
        console.log("Step 2: Configuring vEAGLE swap fees...");
        
        // Fee configuration removed - EagleShareOFT is now a simple OFT with no fees
        console.log("  No fees - simple OFT mode");
        console.log("");
        
        // Mint initial supply to deployer for testing
        console.log("Step 3: Minting initial supply for testing...");
        uint256 initialSupply = 10000 ether; // 10,000 vEAGLE
        shareOFT.mint(deployer, initialSupply);
        console.log("  Minted:", initialSupply, "vEAGLE");
        console.log("  Recipient:", deployer);
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("=================================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("=================================================");
        console.log("");
        console.log("DEPLOYED CONTRACT:");
        console.log("-------------------");
        console.log("vEAGLE (EagleShareOFT):", address(shareOFT));
        console.log("");
        console.log("NEXT STEPS:");
        console.log("-----------");
        console.log("1. Create Uniswap V3 pool (vEAGLE/WETH or vEAGLE/USDC)");
        console.log("2. Set the pool address using: shareOFT.setV3Pool(poolAddress, true)");
        console.log("3. Add liquidity to the pool");
        console.log("4. Test buy/sell transactions");
        console.log("5. Monitor Treasury and Vault fee collection");
        console.log("");
        console.log("Uniswap V3 Factory (Arbitrum): 0x1F98431c8aD98523631AE4a59f267346ea31F984");
        console.log("Uniswap V3 Position Manager: 0xC36442b4a4522E871399CD717aBDD847Ab11FE88");
        console.log("WETH (Arbitrum): 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1");
        console.log("USDC (Arbitrum): 0xaf88d065e77c8cC2239327C5EDb3A432268e5831");
        console.log("");
        
        // Save deployment
        _saveDeployment();
    }
    
    function _saveDeployment() internal {
        string memory json = "deployment";
        
        vm.serializeAddress(json, "deployer", deployer);
        vm.serializeAddress(json, "owner", owner);
        vm.serializeAddress(json, "treasury", treasury);
        vm.serializeAddress(json, "vaultBeneficiary", vaultBeneficiary);
        string memory finalJson = vm.serializeAddress(json, "shareOFT", address(shareOFT));
        
        vm.writeJson(finalJson, "./deployments/arbitrum.json");
        console.log("Deployment saved to: deployments/arbitrum.json");
    }
}

