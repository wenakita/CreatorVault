// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../contracts/EagleOVault.sol";

interface ICharmVault {
    function rebalance() external;
    function owner() external view returns (address);
    function getTotalAmounts() external view returns (uint256, uint256);
}

/**
 * @title RebalanceCharmAndDeploy
 * @notice Rebalance Charm vaults as owner, then deploy funds
 */
contract RebalanceCharmAndDeploy is Script {
    address payable constant VAULT = payable(0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953);
    address constant WETH_CHARM_VAULT = 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF;
    address constant USD1_CHARM_VAULT = 0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        EagleOVault vault = EagleOVault(VAULT);
        
        console.log("===============================================");
        console.log("REBALANCE CHARM VAULTS & DEPLOY FUNDS");
        console.log("===============================================");
        console.log("Deployer:", deployer);
        console.log("");
        
        // Check ownership of Charm vaults
        console.log("Checking Charm vault ownership...");
        try ICharmVault(WETH_CHARM_VAULT).owner() returns (address wethOwner) {
            console.log("WETH Charm owner:", wethOwner);
            console.log("  Match:", wethOwner == deployer ? "YES" : "NO");
        } catch {
            console.log("WETH Charm: Cannot read owner (might not exist)");
        }
        
        try ICharmVault(USD1_CHARM_VAULT).owner() returns (address usd1Owner) {
            console.log("USD1 Charm owner:", usd1Owner);
            console.log("  Match:", usd1Owner == deployer ? "YES" : "NO");
        } catch {
            console.log("USD1 Charm: Cannot read owner (might not exist)");
        }
        console.log("");
        
        // Check Charm vault balances BEFORE
        console.log("Charm vaults BEFORE rebalance:");
        (uint256 wethAmount, uint256 wlfiAmount) = ICharmVault(WETH_CHARM_VAULT).getTotalAmounts();
        console.log("  WETH Vault: WETH =", wethAmount / 1e15, "milli, WLFI =", wlfiAmount / 1e18);
        
        (uint256 usd1Amount, uint256 wlfiAmount2) = ICharmVault(USD1_CHARM_VAULT).getTotalAmounts();
        console.log("  USD1 Vault: USD1 =", usd1Amount / 1e6, ", WLFI =", wlfiAmount2 / 1e18);
        console.log("");
        
        vm.startBroadcast(pk);
        
        // Try to rebalance WETH Charm vault
        console.log("Step 1: Rebalancing WETH Charm vault...");
        try ICharmVault(WETH_CHARM_VAULT).rebalance() {
            console.log("[OK] WETH Charm rebalanced");
        } catch Error(string memory reason) {
            console.log("[SKIP] WETH rebalance failed:", reason);
            console.log("      (This is OK if 'OLD' - means recently rebalanced)");
        } catch {
            console.log("[SKIP] WETH rebalance failed (no reason)");
        }
        console.log("");
        
        // Try to rebalance USD1 Charm vault
        console.log("Step 2: Rebalancing USD1 Charm vault...");
        try ICharmVault(USD1_CHARM_VAULT).rebalance() {
            console.log("[OK] USD1 Charm rebalanced");
        } catch Error(string memory reason) {
            console.log("[SKIP] USD1 rebalance failed:", reason);
            console.log("      (Check if you're the owner/delegate)");
        } catch {
            console.log("[SKIP] USD1 rebalance failed (no reason)");
        }
        console.log("");
        
        // Now try to deploy funds
        console.log("Step 3: Deploying funds to strategies...");
        uint256 wlfiBalance = IERC20(WLFI).balanceOf(VAULT);
        console.log("  Idle WLFI:", wlfiBalance / 1e18, "tokens");
        
        try vault.forceDeployToStrategies() {
            console.log("[OK] Funds deployed!");
        } catch Error(string memory reason) {
            console.log("[ERROR] Deployment failed:", reason);
        } catch {
            console.log("[ERROR] Deployment failed (no reason)");
        }
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("===============================================");
        console.log("COMPLETE");
        console.log("===============================================");
        console.log("");
        console.log("Check results:");
        console.log("  Idle funds: cast call", VAULT, '"balanceOf(address)" <WLFI_ADDRESS>');
        console.log("  Strategy holdings: cast call <strategy> 'getTotalAmounts()(uint256,uint256)'");
        console.log("");
    }
}

