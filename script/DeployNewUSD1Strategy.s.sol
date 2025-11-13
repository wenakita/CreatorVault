// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/strategies/CharmStrategyUSD1.sol";

interface ICREATE2Factory {
    function deploy(bytes memory bytecode, bytes32 salt) external returns (address);
}

contract DeployNewUSD1Strategy is Script {
    bytes32 constant SALT = 0x000000000000000000000000000000000000000000000000000000000000003f;
    
    address constant VAULT_ADDRESS = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant USD1_CHARM_VAULT = 0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant PREDICTED_ADDRESS = 0x47C25b36604059c9c2C03bA09fdD2dD07fD95a95;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("==============================================");
        console.log("DEPLOY NEW USD1 STRATEGY (CREATE2)");
        console.log("==============================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Factory:", CREATE2_FACTORY);
        console.log("Salt:", vm.toString(SALT));
        console.log("Predicted Address:", PREDICTED_ADDRESS);
        console.log("");
        
        // Safety check: mainnet only
        require(block.chainid == 1, "SAFETY: Mainnet only");
        
        // Build bytecode
        bytes memory bytecode = abi.encodePacked(
            type(CharmStrategyUSD1).creationCode,
            abi.encode(
                VAULT_ADDRESS,
                USD1_CHARM_VAULT,
                WLFI,
                USD1,
                UNISWAP_ROUTER,
                deployer  // Owner = deployer (YOU)
            )
        );
        
        console.log("Deploying via CREATE2...");
        console.log("");
        
        vm.startBroadcast(pk);
        
        address deployed = ICREATE2Factory(CREATE2_FACTORY).deploy(bytecode, SALT);
        
        require(deployed == PREDICTED_ADDRESS, "Address mismatch!");
        
        console.log("SUCCESS!");
        console.log("Deployed at:", deployed);
        console.log("");
        
        // Initialize approvals immediately
        console.log("Initializing approvals...");
        CharmStrategyUSD1(deployed).initializeApprovals();
        
        vm.stopBroadcast();
        
        console.log("Approvals initialized!");
        console.log("");
        console.log("==============================================");
        console.log("NEXT STEPS:");
        console.log("==============================================");
        console.log("1. Remove old USD1 strategy from vault");
        console.log("   Old: 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f");
        console.log("2. Add new USD1 strategy to vault");
        console.log("   New:", deployed);
        console.log("3. Deploy funds with forceDeployToStrategies()");
        console.log("");
    }
}

