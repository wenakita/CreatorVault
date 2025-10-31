// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/strategies/CharmStrategyUSD1.sol";

/**
 * @title DeploySimple_Strategy
 * @notice Deploy CharmStrategyUSD1 WITHOUT vanity address
 */
contract DeploySimple_Strategy is Script {
    address constant VAULT_ADDRESS = 0xAb2BBa11C00baFe6e3be241Ca0765Ce150e9361F;
    address constant CHARM_VAULT = 0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    
    function run() external {
        console.log("===============================================");
        console.log("DEPLOY: CharmStrategyUSD1 (No Vanity)");
        console.log("===============================================");
        console.log("");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("Vault:", VAULT_ADDRESS);
        console.log("");
        
        require(block.chainid == 1, "SAFETY: Mainnet only");
        
        console.log("Deploying in 5 seconds...");
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        CharmStrategyUSD1 strategy = new CharmStrategyUSD1(
            VAULT_ADDRESS,
            CHARM_VAULT,
            WLFI,
            USD1,
            UNISWAP_ROUTER,
            deployer
        );
        
        vm.stopBroadcast();
        
        console.log("===============================================");
        console.log("STRATEGY DEPLOYED!");
        console.log("===============================================");
        console.log("");
        console.log("Address:", address(strategy));
        console.log("");
        console.log("ALL DONE! Transfer ownership to multisig:");
        console.log("0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3");
        console.log("");
    }
}

