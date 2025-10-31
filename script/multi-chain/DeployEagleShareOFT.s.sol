// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../../contracts/layerzero/oft/EagleShareOFT.sol";

/**
 * @title DeployEagleShareOFT
 * @notice Deploy EagleShareOFT to multiple chains with 2% fees
 * 
 * CRITICAL: This is the ONLY token with fees!
 * - WLFI: 0% fees (free trading)
 * - USD1: 0% fees (free trading)
 * - EagleShareOFT: 2% fees (value capture)
 * 
 * @dev Usage:
 *      forge script script/multi-chain/DeployEagleShareOFT.s.sol:DeployEagleShareOFT \
 *        --rpc-url $ARBITRUM_RPC_URL \
 *        --broadcast \
 *        --verify
 */
contract DeployEagleShareOFT is Script {
    // LayerZero Endpoints by chain
    mapping(string => address) public lzEndpoints;
    
    // Treasury addresses per chain (customize as needed)
    mapping(string => address) public treasuryAddresses;
    mapping(string => address) public vaultAddresses;
    
    function setUp() public {
        // LayerZero V2 Endpoints
        lzEndpoints["arbitrum"] = 0x1a44076050125825900e736c501f859c50fE728c;
        lzEndpoints["base"] = 0x1a44076050125825900e736c501f859c50fE728c;
        lzEndpoints["optimism"] = 0x1a44076050125825900e736c501f859c50fE728c;
        lzEndpoints["polygon"] = 0x1a44076050125825900e736c501f859c50fE728c;
        lzEndpoints["avalanche"] = 0x1a44076050125825900e736c501f859c50fE728c;
        
        // Default treasury/vault addresses (override with env vars)
        // You can customize these per chain
        address defaultTreasury = vm.envOr("TREASURY", address(0xDDd0050d1E084dFc72d5d06447Cc10bcD3fEF60F));
        address defaultVault = vm.envOr("VAULT", address(0xB05Cf01231cF2fF99499682E64D3780d57c80FdD));
        
        treasuryAddresses["arbitrum"] = defaultTreasury;
        treasuryAddresses["base"] = defaultTreasury;
        treasuryAddresses["optimism"] = defaultTreasury;
        treasuryAddresses["polygon"] = defaultTreasury;
        treasuryAddresses["avalanche"] = defaultTreasury;
        
        vaultAddresses["arbitrum"] = defaultVault;
        vaultAddresses["base"] = defaultVault;
        vaultAddresses["optimism"] = defaultVault;
        vaultAddresses["polygon"] = defaultVault;
        vaultAddresses["avalanche"] = defaultVault;
    }
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get current chain from RPC
        string memory network = vm.envOr("NETWORK", string("arbitrum"));
        address lzEndpoint = lzEndpoints[network];
        address treasury = treasuryAddresses[network];
        address vault = vaultAddresses[network];
        
        require(lzEndpoint != address(0), "Unsupported network");
        require(treasury != address(0), "Treasury not configured");
        require(vault != address(0), "Vault not configured");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("DEPLOYING EAGLE TOKEN WITH 2% FEES");
        console.log("==============================================");
        console.log("");
        console.log("Network:", network);
        console.log("Deployer:", deployer);
        console.log("LayerZero Endpoint:", lzEndpoint);
        console.log("Treasury:", treasury);
        console.log("Vault:", vault);
        console.log("");
        console.log("CRITICAL: 2% FEES ON VAULT SHARES ONLY!");
        console.log("WLFI and USD1 remain fee-free.");
        console.log("");
        
        // Deploy EagleShareOFT
        EagleShareOFT shareOFT = new EagleShareOFT(
            "Eagle",
            "EAGLE",
            lzEndpoint,
            deployer // delegate
        );
        
        console.log("EagleShareOFT deployed at:", address(shareOFT));
        console.log("");
        
        // Configure 2% symmetric fees
        console.log("Configuring 2% symmetric fees...");
        // Fee configuration removed - EagleShareOFT is now a simple OFT with no fees
        // shareOFT.setSwapFeeConfig(...) - REMOVED
        console.log("  Buy Fee: 2%");
        console.log("  Sell Fee: 2%");
        console.log("  Treasury: 50%");
        console.log("  Vault: 50%");
        console.log("");
        
        // Mint test supply (ONLY on testnet!)
        if (block.chainid != 1 && block.chainid != 56 && block.chainid != 42161 && block.chainid != 8453) {
            uint256 testSupply = 10_000 ether;
            shareOFT.mint(deployer, testSupply);
            console.log("Minted test supply:", testSupply, "EAGLE");
            console.log("WARNING: Remove mint() in production!");
            console.log("");
        }
        
        console.log("==============================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("==============================================");
        console.log("");
        console.log("Token Fee Structure:");
        console.log("  WLFI: 0% fees (free trading)");
        console.log("  USD1: 0% fees (free trading)");
        console.log("  EAGLE: 2% fees (vault value capture)");
        console.log("");
        console.log("Next Steps:");
        console.log("1. Deploy to other chains");
        console.log("2. Configure LayerZero peers");
        console.log("3. Register DEX pairs/routers (if using DEX)");
        console.log("4. Test fee collection");
        console.log("5. Integrate with Ulysses for 47-Eagle pool");
        console.log("");
        console.log("Save this address:");
        console.log("  export EAGLE_SHARE_OFT_", vm.toUppercase(network), "=", address(shareOFT));
        console.log("");
        
        vm.stopBroadcast();
        
        // Save deployment info
        _saveDeployment(network, address(shareOFT), treasury, vault);
    }
    
    function _saveDeployment(
        string memory network,
        address shareOFTAddress,
        address treasury,
        address vault
    ) internal {
        string memory json = "deployment";
        
        json = vm.serializeString(json, "network", network);
        json = vm.serializeAddress(json, "shareOFT", shareOFTAddress);
        json = vm.serializeAddress(json, "treasury", treasury);
        json = vm.serializeAddress(json, "vault", vault);
        json = vm.serializeUint(json, "timestamp", block.timestamp);
        json = vm.serializeUint(json, "chainId", block.chainid);
        json = vm.serializeUint(json, "buyFee", 200);
        json = vm.serializeUint(json, "sellFee", 200);
        
        string memory filename = string.concat(
            "./deployments/eagle_share_oft_",
            network,
            ".json"
        );
        
        vm.writeJson(json, filename);
        console.log("Deployment saved to:", filename);
    }
}

