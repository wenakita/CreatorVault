// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import {EagleOVault} from "../contracts/EagleOVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TryDeployIdle is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        EagleOVault vault = EagleOVault(payable(VAULT));
        
        uint256 balanceBefore = IERC20(WLFI).balanceOf(VAULT);
        console.log("Idle WLFI:", balanceBefore / 1e18);
        
        vm.startBroadcast(pk);
        
        try vault.forceDeployToStrategies() {
            console.log("Deploy succeeded");
        } catch Error(string memory reason) {
            console.log("Deploy failed:", reason);
        } catch {
            console.log("Deploy failed with unknown error");
        }
        
        vm.stopBroadcast();
        
        uint256 balanceAfter = IERC20(WLFI).balanceOf(VAULT);
        console.log("After:", balanceAfter / 1e18);
        console.log("Deployed:", (balanceBefore - balanceAfter) / 1e18);
    }
}

