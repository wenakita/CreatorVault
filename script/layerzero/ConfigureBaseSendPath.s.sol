// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "forge-std/console.sol";

/**
 * @title ConfigureBaseSendPath
 * @notice Configure LayerZero send path from Base to Ethereum for EagleShareOFT
 * 
 * This sets up the DVN and Executor configuration required for bridging
 */
contract ConfigureBaseSendPath is Script {
    // Addresses
    address constant EAGLE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant SEND_ULN_302 = 0xB5320B0B3a13cC860893E2Bd79FCd7e13484Dda2; // Base Send Library
    address constant BASE_EXECUTOR = 0x2CCA08ae69E0C44b18a57Ab2A87644234dAebaE4;
    
    // DVNs for Base
    address constant LZ_DVN = 0x9e059a54699a285714207b43B055483E78FAac25; // LayerZero DVN
    address constant GOOGLE_DVN = 0xD56e4eAb23cb81f43168F9F45211Eb027b9aC7cc; // Google Cloud DVN
    
    // Chain config
    uint32 constant ETHEREUM_EID = 30101;
    uint32 constant CONFIG_TYPE_EXECUTOR = 1;
    uint32 constant CONFIG_TYPE_ULN = 2;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("  CONFIGURE: Base -> Ethereum Send Path");
        console.log("==============================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");
        
        require(block.chainid == 8453, "Must run on Base");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Step 1: Set Send Library
        console.log("Step 1: Setting send library...");
        (bool success1,) = LZ_ENDPOINT.call(
            abi.encodeWithSignature(
                "setSendLibrary(address,uint32,address)",
                EAGLE_OFT,
                ETHEREUM_EID,
                SEND_ULN_302
            )
        );
        console.log(success1 ? "  [OK] Send library set" : "  [SKIP] Already set or not delegate");
        console.log("");
        
        // Step 2: Configure DVNs
        console.log("Step 2: Configuring DVNs...");
        address[] memory requiredDVNs = new address[](2);
        requiredDVNs[0] = LZ_DVN;
        requiredDVNs[1] = GOOGLE_DVN;
        address[] memory optionalDVNs = new address[](0);
        
        bytes memory ulnConfig = abi.encode(
            15, // confirmations
            uint8(2), // requiredDVNCount
            uint8(0), // optionalDVNCount
            uint8(0), // optionalDVNThreshold
            requiredDVNs,
            optionalDVNs
        );
        
        (bool success2,) = LZ_ENDPOINT.call(
            abi.encodeWithSignature(
                "setConfig(address,address,uint32,uint32,bytes)",
                EAGLE_OFT,
                SEND_ULN_302,
                ETHEREUM_EID,
                CONFIG_TYPE_ULN,
                ulnConfig
            )
        );
        console.log(success2 ? "  [OK] DVNs configured" : "  [SKIP] Already set or not delegate");
        console.log("");
        
        // Step 3: Configure Executor
        console.log("Step 3: Configuring executor...");
        bytes memory executorConfig = abi.encode(
            uint32(10000), // maxMessageSize
            BASE_EXECUTOR
        );
        
        (bool success3,) = LZ_ENDPOINT.call(
            abi.encodeWithSignature(
                "setConfig(address,address,uint32,uint32,bytes)",
                EAGLE_OFT,
                SEND_ULN_302,
                ETHEREUM_EID,
                CONFIG_TYPE_EXECUTOR,
                executorConfig
            )
        );
        console.log(success3 ? "  [OK] Executor configured" : "  [SKIP] Already set or not delegate");
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("==============================================");
        console.log("  CONFIGURATION COMPLETE!");
        console.log("==============================================");
        console.log("");
        console.log("Now try bridging again:");
        console.log("  forge script script/BridgeEagleFromBase.s.sol --rpc-url $BASE_RPC_URL --broadcast");
        console.log("");
    }
}

