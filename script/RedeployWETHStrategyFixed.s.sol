// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {CharmStrategyWETH} from "../contracts/strategies/CharmStrategyWETH.sol";

contract RedeployWETHStrategyFixed is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant WETH_CHARM_VAULT = 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        vm.startBroadcast(pk);
        
        console.log("Deployer:", deployer);
        console.log("Deploying WETH strategy with direct USD1->WETH swap (0.3% pool)...");
        
        CharmStrategyWETH newStrategy = new CharmStrategyWETH(
            VAULT,
            WETH_CHARM_VAULT,
            WLFI,
            WETH,
            USD1,
            UNISWAP_ROUTER,
            deployer
        );
        
        console.log("New WETH Strategy:", address(newStrategy));
        
        // Initialize approvals
        newStrategy.initializeApprovals();
        console.log("Approvals initialized!");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== NEXT STEPS ===");
        console.log("1. Remove old WETH strategy: vault.removeStrategy(0xF46575F645603FdE115dffBa5493b297499b342A)");
        console.log("2. Add new WETH strategy: vault.addStrategy(", address(newStrategy), ", 5000)");
    }
}

