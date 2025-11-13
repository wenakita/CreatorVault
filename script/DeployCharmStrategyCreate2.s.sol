// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/strategies/CharmStrategyWETH.sol";

/**
 * @title DeployCharmStrategyCreate2
 * @notice Deploy CharmStrategyWETH using CREATE2 for vanity address 0x470d34fc97aa638cf181ee989b5a4b5b68192902
 * 
 * @dev CONFIGURATION:
 *      Salt: 0x000000000000000000000000000000000000000000000000000000000000015d
 *      Predicted Address: 0x470d34fc97aa638cf181ee989b5a4b5b68192902
 *      Charm Vault: 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF (WETH/WLFI 1%)
 * 
 * @dev USAGE:
 *      forge script script/DeployCharmStrategyCreate2.s.sol:DeployCharmStrategyCreate2 \
 *        --rpc-url $ETHEREUM_RPC_URL \
 *        --broadcast \
 *        --verify \
 *        -vvvv
 */
// CREATE2 Factory interface
interface ICREATE2Factory {
    function deploy(bytes memory bytecode, bytes32 salt) external returns (address);
}

contract DeployCharmStrategyCreate2 is Script {
    // CREATE2 Salt for vanity address 0x47...
    bytes32 constant SALT = 0x0000000000000000000000000000000000000000000000000000000000000009;
    
    // Ethereum Mainnet addresses
    address constant VAULT_ADDRESS = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953; // EagleOVault
    address constant CHARM_VAULT = 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF; // WETH/WLFI Charm vault
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant MULTISIG = 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3;
    
    // Predicted address (for verification)
    address constant PREDICTED_ADDRESS = 0x47dCe4Bd8262fe0E76733825A1Cac205905889c6;
    
    function run() external {
        console.log("===============================================");
        console.log("DEPLOY: CharmStrategyWETH (CREATE2)");
        console.log("===============================================");
        console.log("");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");
        
        console.log("CREATE2 Configuration:");
        console.log("  Salt:             ", vm.toString(SALT));
        console.log("  Predicted Address:", PREDICTED_ADDRESS);
        console.log("");
        
        console.log("Contract Configuration:");
        console.log("  Vault Address:     ", VAULT_ADDRESS);
        console.log("  Charm Vault:       ", CHARM_VAULT);
        console.log("  WLFI Token:        ", WLFI);
        console.log("  WETH Token:        ", WETH);
        console.log("  USD1 Token:        ", USD1);
        console.log("  Uniswap Router:    ", UNISWAP_ROUTER);
        console.log("  Owner (Deployer):  ", deployer);
        console.log("");
        
        require(block.chainid == 1, "SAFETY: Mainnet only");
        
        // Verify vault exists
        uint256 vaultCodeSize;
        assembly {
            vaultCodeSize := extcodesize(VAULT_ADDRESS)
        }
        require(vaultCodeSize > 0, "ERROR: Vault not deployed!");
        console.log("[OK] Vault verified");
        console.log("");
        
        // Check if address already deployed
        uint256 existingCodeSize;
        assembly {
            existingCodeSize := extcodesize(PREDICTED_ADDRESS)
        }
        if (existingCodeSize > 0) {
            console.log("[WARNING] Address already has code!");
            console.log("  Address:", PREDICTED_ADDRESS);
            revert("Address already deployed");
        }
        console.log("[OK] Target address available");
        console.log("");
        
        console.log("Deploying in 5 seconds...");
        vm.sleep(5000);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Prepare bytecode with constructor arguments
        bytes memory bytecode = abi.encodePacked(
            type(CharmStrategyWETH).creationCode,
            abi.encode(
                VAULT_ADDRESS,
                CHARM_VAULT,
                WLFI,
                WETH,
                USD1,
                UNISWAP_ROUTER,
                deployer
            )
        );
        
        console.log("Deploying via CREATE2 Factory...");
        
        // Deploy via CREATE2 Factory
        address deployed = ICREATE2Factory(CREATE2_FACTORY).deploy(bytecode, SALT);
        CharmStrategyWETH strategy = CharmStrategyWETH(deployed);
        
        console.log("[OK] Strategy deployed at:", address(strategy));
        console.log("");
        
        // Verify address matches prediction
        require(address(strategy) == PREDICTED_ADDRESS, "Address mismatch!");
        console.log("[OK] Address matches prediction!");
        console.log("");
        
        // Initialize approvals
        console.log("Initializing approvals...");
        strategy.initializeApprovals();
        console.log("[OK] Approvals initialized");
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("DEPLOYMENT COMPLETE!");
        console.log("===============================================");
        console.log("");
        console.log("Strategy Address: ", address(strategy));
        console.log("Vanity Achieved:   0x47...");
        console.log("");
        console.log("Next Steps:");
        console.log("1. Verify contract on Etherscan");
        console.log("2. Add strategy to vault:");
        console.log("   vault.addStrategy(", address(strategy), ", weight)");
        console.log("3. Test deposit/withdraw");
        console.log("4. (Optional) Transfer ownership to multisig:");
        console.log("   strategy.transferOwnership(", MULTISIG, ")");
        console.log("");
        
        console.log("Verification Command:");
        console.log("forge verify-contract", address(strategy));
        console.log("  contracts/strategies/CharmStrategyWETH.sol:CharmStrategyWETH");
        console.log("  --chain-id 1");
        console.log("  --constructor-args $(cast abi-encode");
        console.log("    \"constructor(address,address,address,address,address,address,address)\"");
        console.log("    ", VAULT_ADDRESS);
        console.log("    ", CHARM_VAULT);
        console.log("    ", WLFI);
        console.log("    ", WETH);
        console.log("    ", USD1);
        console.log("    ", UNISWAP_ROUTER);
        console.log("    ", deployer, ")");
        console.log("");
    }
}

