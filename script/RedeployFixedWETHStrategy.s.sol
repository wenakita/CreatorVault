// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/strategies/CharmStrategyWETH.sol";

contract RedeployFixedWETHStrategy is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant CHARM_VAULT = 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(pk);
        
        console.log("=== Deploying Fixed WETH Strategy ===");
        console.log("");
        
        address owner = vm.addr(pk);
        
        CharmStrategyWETH strategy = new CharmStrategyWETH(
            VAULT,          // _vaultAddress
            CHARM_VAULT,    // _charmVault
            WLFI,           // _wlfi
            WETH,           // _weth
            USD1,           // _usd1
            UNISWAP_ROUTER, // _uniswapRouter
            owner           // _owner
        );
        
        console.log("Strategy deployed at:", address(strategy));
        console.log("");
        console.log("Safety features added:");
        console.log("- Max 500 WLFI per deposit");
        console.log("- Max 5% or 100 WLFI swap limit");
        console.log("- Returns excess to vault");
        console.log("");
        console.log("Next steps:");
        console.log("1. Initialize approvals: strategy.initializeApprovals()");
        console.log("2. Remove old WETH strategy");
        console.log("3. Add new strategy: vault.addStrategy(strategy, 5000)");
        console.log("4. Deploy funds");
        
        vm.stopBroadcast();
    }
}

