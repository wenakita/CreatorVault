// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console} from "forge-std/Script.sol";
import {CharmStrategyWETH} from "../contracts/strategies/CharmStrategyWETH.sol";

interface ICREATE2Factory {
    function deploy(bytes memory bytecode, bytes32 salt) external returns (address);
}

contract DeployFixedWETHCreate2 is Script {
    bytes32 constant SALT = 0x0000000000000000000000000000000000000000000000000000000000000046;
    address constant PREDICTED_ADDRESS = 0x471123F077d8F3BD23B43e5440c23F59Fd0C59FB;
    
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant WETH_CHARM_VAULT = 0x3314e248F3F752Cd16939773D83bEb3a362F0AEF;
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    address constant UNISWAP_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address constant MULTISIG = 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("==============================================");
        console.log("DEPLOY FIXED WETH STRATEGY (CREATE2)");
        console.log("==============================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Factory:", CREATE2_FACTORY);  // From forge-std Base.sol
        console.log("Salt:", vm.toString(SALT));
        console.log("Predicted Address:", PREDICTED_ADDRESS);
        console.log("");
        
        vm.startBroadcast(pk);
        
        // Build bytecode with constructor args
        bytes memory bytecode = abi.encodePacked(
            type(CharmStrategyWETH).creationCode,
            abi.encode(
                VAULT,
                WETH_CHARM_VAULT,
                WLFI,
                WETH,
                USD1,
                UNISWAP_ROUTER,
                deployer  // Owner is deployer initially
            )
        );
        
        // Deploy via CREATE2
        address deployed = ICREATE2Factory(CREATE2_FACTORY).deploy(bytecode, SALT);
        
        require(deployed == PREDICTED_ADDRESS, "Address mismatch!");
        
        console.log("SUCCESS! Deployed at:", deployed);
        console.log("");
        
        // Initialize approvals
        CharmStrategyWETH(deployed).initializeApprovals();
        console.log("Approvals initialized!");
        
        // Transfer ownership to multisig
        CharmStrategyWETH(deployed).transferOwnership(MULTISIG);
        console.log("Ownership transferred to multisig");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("==============================================");
        console.log("NEXT STEPS (Multisig):");
        console.log("==============================================");
        console.log("1. Remove old broken WETH strategy:");
        console.log("   vault.removeStrategy(0x47dCe4Bd8262fe0E76733825A1Cac205905889c6)");
        console.log("2. Add new fixed WETH strategy:");
        console.log("   vault.addStrategy(", deployed, ", 5000)");
        console.log("3. Deploy funds!");
    }
}

