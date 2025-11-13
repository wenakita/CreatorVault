// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IStrategy {
    function deposit(uint256 wlfiAmount, uint256 usd1Amount) external returns (uint256);
}

contract ForceDeployDirect is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant USD1_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(pk);
        
        uint256 amount = IERC20(WLFI).balanceOf(VAULT);
        console.log("Vault WLFI balance:", amount);
        
        // Transfer WLFI from vault to strategy
        console.log("Transferring WLFI to strategy...");
        bytes memory transferData = abi.encodeWithSelector(
            IERC20.transferFrom.selector,
            VAULT,
            USD1_STRATEGY,
            amount
        );
        (bool success, ) = WLFI.call(transferData);
        require(success, "Transfer failed");
        
        console.log("Calling strategy deposit...");
        uint256 shares = IStrategy(USD1_STRATEGY).deposit(amount, 0);
        
        console.log("SUCCESS! Shares received:", shares);
        
        vm.stopBroadcast();
    }
}

