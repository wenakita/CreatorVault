// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";

interface IEagleOVault {
    function removeStrategy(address strategy) external;
    function management() external view returns (address);
}

contract TemporarilyRemoveUSD1 is Script {
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    address constant USD1_STRATEGY = 0x47B2659747d6A7E00c8251c3C3f7e92625a8cf6f;
    
    function run() external view {
        console.log("Call this via multisig to temporarily remove USD1 strategy:");
        console.log("");
        console.log("Contract:", VAULT);
        console.log("Function: removeStrategy(address)");
        console.log("Parameter:", USD1_STRATEGY);
        console.log("");
        console.log("Calldata:");
        console.logBytes(abi.encodeWithSignature("removeStrategy(address)", USD1_STRATEGY));
    }
}

