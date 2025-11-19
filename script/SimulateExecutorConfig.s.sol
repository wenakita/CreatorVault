// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import { ILayerZeroEndpointV2 } from "../contracts/interfaces/ILayerZeroEndpointV2.sol";

contract SimulateExecutorConfig is Script {
    address constant EAGLE_SHARE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    address constant SAFE_MULTISIG = 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3;
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant SEND_ULN_302 = 0xbB2Ea70C9E858123480642Cf96acbcCE1372dCe1;
    address constant LZ_EXECUTOR = 0x173272739Bd7Aa6e4e214714048a9fE699453059;
    
    uint32 constant SOLANA_EID = 30168;
    uint32 constant CONFIG_TYPE_EXECUTOR = 1;
    
    struct ExecutorConfig {
        uint32 maxMessageSize;
        address executor;
    }
    
    function run() external {
        // Fork mainnet
        vm.createSelectFork("https://eth.llamarpc.com");
        
        console.log("Simulating setConfig call from Safe...");
        console.log("Safe:", SAFE_MULTISIG);
        console.log("OApp:", EAGLE_SHARE_OFT);
        console.log("");
        
        // Check delegate
        ILayerZeroEndpointV2 endpoint = ILayerZeroEndpointV2(LZ_ENDPOINT);
        address currentDelegate = endpoint.delegates(EAGLE_SHARE_OFT);
        console.log("Current delegate:", currentDelegate);
        console.log("Expected (Safe):", SAFE_MULTISIG);
        console.log("Match:", currentDelegate == SAFE_MULTISIG);
        console.log("");
        
        // Prepare executor config
        ExecutorConfig memory executorConfig = ExecutorConfig({
            maxMessageSize: 10000,
            executor: LZ_EXECUTOR
        });
        
        bytes memory config = abi.encode(executorConfig);
        
        // Try to call setConfig as the Safe
        vm.prank(SAFE_MULTISIG);
        try endpoint.setConfig(
            EAGLE_SHARE_OFT,
            SEND_ULN_302,
            SOLANA_EID,
            CONFIG_TYPE_EXECUTOR,
            config
        ) {
            console.log("SUCCESS: setConfig executed without reverting");
        } catch Error(string memory reason) {
            console.log("REVERT with reason:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("REVERT with low-level data:");
            console.logBytes(lowLevelData);
            
            // Try to decode as custom error
            if (lowLevelData.length >= 4) {
                bytes4 selector = bytes4(lowLevelData);
                console.log("Error selector:");
                console.logBytes4(selector);
            }
        }
    }
}

