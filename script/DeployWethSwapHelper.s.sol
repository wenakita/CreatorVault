// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/helpers/WethSwapHelper.sol";

contract DeployWethSwapHelper is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(pk);
        
        console.log("=== Deploying WETH Swap Helper ===");
        console.log("");
        
        WethSwapHelper helper = new WethSwapHelper(
            VAULT,
            WETH,
            WLFI,
            UNISWAP_ROUTER
        );
        
        console.log("Helper deployed at:", address(helper));
        console.log("");
        console.log("Next steps:");
        console.log("1. Add helper as strategy: vault.addStrategy(helper, 10000)");
        console.log("2. Sync vault: vault.syncBalances()");
        console.log("3. Deploy: vault.forceDeployToStrategies()");
        console.log("4. Remove helper: vault.removeStrategy(helper)");
        console.log("5. Add real strategies back");
        
        vm.stopBroadcast();
    }
}

