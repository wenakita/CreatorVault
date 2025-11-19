// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title BurnEagleToSolana
 * @notice Burn EAGLE tokens (send to 0x0) to trigger Solana mint via relayer
 * @dev The relayer watches Transfer events to address(0) and mints on Solana
 */
contract BurnEagleToSolana is Script {
    address constant EAGLE_SHARE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    address constant SAFE_MULTISIG = 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3;
    address constant BURN_ADDRESS = address(0);
    
    function run() external view {
        console.log("=================================");
        console.log("Burn 1 EAGLE for Solana Bridge");
        console.log("=================================");
        console.log("");
        
        IERC20 eagle = IERC20(EAGLE_SHARE_OFT);
        
        // Check current balance
        uint256 balance = eagle.balanceOf(SAFE_MULTISIG);
        console.log("Safe EAGLE Balance:", balance / 1e18, "EAGLE");
        console.log("");
        
        // Amount to burn (1 EAGLE)
        uint256 burnAmount = 1 ether;
        
        // Generate transaction calldata
        bytes memory calldata_ = abi.encodeWithSignature(
            "transfer(address,uint256)",
            BURN_ADDRESS,
            burnAmount
        );
        
        console.log("=================================");
        console.log("Safe Transaction (Burn)");
        console.log("=================================");
        console.log("");
        console.log("To:", EAGLE_SHARE_OFT);
        console.log("Value: 0 ETH");
        console.log("Data:", vm.toString(calldata_));
        console.log("");
        
        console.log("=================================");
        console.log("What Happens Next");
        console.log("=================================");
        console.log("");
        console.log("1. Execute this transaction in Safe");
        console.log("2. The relayer detects the burn (Transfer to 0x0)");
        console.log("3. The relayer mints 1 EAGLE on Solana to:");
        console.log("   7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY");
        console.log("");
        console.log("=================================");
        console.log("Manual Safe Execution");
        console.log("=================================");
        console.log("");
        console.log("Go to: https://app.safe.global/transactions/queue?safe=eth:0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3");
        console.log("");
        console.log("Create 'New Transaction' > 'Contract Interaction':");
        console.log("  Contract Address:", EAGLE_SHARE_OFT);
        console.log("  Value: 0");
        console.log("  ABI: transfer(address,uint256)");
        console.log("  to:", BURN_ADDRESS);
        console.log("  amount:", burnAmount);
        console.log("");
        console.log("Cost: ~$0.50 (just gas for transfer)");
    }
}

