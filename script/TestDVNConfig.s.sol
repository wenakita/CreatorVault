// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import { ILayerZeroEndpointV2 } from "../contracts/interfaces/ILayerZeroEndpointV2.sol";

/**
 * @title TestDVNConfig
 * @notice Test script to verify DVN configuration before executing
 */
contract TestDVNConfig is Script {
    // Addresses
    address constant EAGLE_SHARE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant SEND_ULN_302 = 0xbB2Ea70C9E858123480642Cf96acbcCE1372dCe1;
    address constant RECEIVE_ULN_302 = 0xc02Ab410f0734EFa3F14628780e6e695156024C2;
    address constant LZ_DVN = 0x589dEDbD617e0CBcB916A9223F4d1300c294236b;
    address constant LZ_EXECUTOR = 0x173272739Bd7Aa6e4e214714048a9fE699453059;
    
    uint32 constant SOLANA_EID = 30168;
    uint32 constant CONFIG_TYPE_EXECUTOR = 1;
    uint32 constant CONFIG_TYPE_ULN = 2;
    
    struct UlnConfig {
        uint64 confirmations;
        uint8 requiredDVNCount;
        uint8 optionalDVNCount;
        uint8 optionalDVNThreshold;
        address[] requiredDVNs;
        address[] optionalDVNs;
    }
    
    struct ExecutorConfig {
        uint32 maxMessageSize;
        address executor;
    }
    
    function run() external view {
        console.log("=================================");
        console.log("LayerZero V2 Configuration Test");
        console.log("=================================");
        console.log("");
        
        ILayerZeroEndpointV2 endpoint = ILayerZeroEndpointV2(LZ_ENDPOINT);
        
        // 1. Check delegate
        console.log("1. Checking delegate...");
        address currentDelegate = endpoint.delegates(EAGLE_SHARE_OFT);
        console.log("   Current delegate:", currentDelegate);
        console.log("");
        
        // 2. Check send library
        console.log("2. Checking send library...");
        address currentSendLib = endpoint.getSendLibrary(EAGLE_SHARE_OFT, SOLANA_EID);
        console.log("   Current send library:", currentSendLib);
        console.log("   Expected send library:", SEND_ULN_302);
        console.log("   Match:", currentSendLib == SEND_ULN_302);
        console.log("");
        
        // 3. Check receive library
        console.log("3. Checking receive library...");
        address currentReceiveLib = endpoint.getReceiveLibrary(EAGLE_SHARE_OFT, SOLANA_EID);
        console.log("   Current receive library:", currentReceiveLib);
        console.log("   Expected receive library:", RECEIVE_ULN_302);
        console.log("   Match:", currentReceiveLib == RECEIVE_ULN_302);
        console.log("");
        
        // 4. Check current DVN config (if any)
        console.log("4. Checking current DVN config...");
        try endpoint.getConfig(EAGLE_SHARE_OFT, SEND_ULN_302, SOLANA_EID, CONFIG_TYPE_ULN) returns (bytes memory config) {
            if (config.length > 0) {
                UlnConfig memory currentConfig = abi.decode(config, (UlnConfig));
                console.log("   Confirmations:", currentConfig.confirmations);
                console.log("   Required DVN Count:", currentConfig.requiredDVNCount);
                console.log("   Optional DVN Count:", currentConfig.optionalDVNCount);
                console.log("   Optional DVN Threshold:", currentConfig.optionalDVNThreshold);
                if (currentConfig.requiredDVNs.length > 0) {
                    console.log("   Required DVNs:");
                    for (uint i = 0; i < currentConfig.requiredDVNs.length; i++) {
                        console.log("     -", currentConfig.requiredDVNs[i]);
                    }
                }
            } else {
                console.log("   No DVN config set yet");
            }
        } catch {
            console.log("   No DVN config set yet (or error reading)");
        }
        console.log("");
        
        // 5. Check current Executor config (if any)
        console.log("5. Checking current Executor config...");
        try endpoint.getConfig(EAGLE_SHARE_OFT, SEND_ULN_302, SOLANA_EID, CONFIG_TYPE_EXECUTOR) returns (bytes memory config) {
            if (config.length > 0) {
                ExecutorConfig memory currentConfig = abi.decode(config, (ExecutorConfig));
                console.log("   Max Message Size:", currentConfig.maxMessageSize);
                console.log("   Executor:", currentConfig.executor);
            } else {
                console.log("   No Executor config set yet");
            }
        } catch {
            console.log("   No Executor config set yet (or error reading)");
        }
        console.log("");
        
        // 6. Generate new config calldata
        console.log("6. Generating new configuration calldata...");
        console.log("");
        
        // DVN Config
        address[] memory requiredDVNs = new address[](1);
        requiredDVNs[0] = LZ_DVN;
        address[] memory optionalDVNs = new address[](0);
        
        UlnConfig memory ulnConfig = UlnConfig({
            confirmations: 15,
            requiredDVNCount: 1,
            optionalDVNCount: 0,
            optionalDVNThreshold: 0,
            requiredDVNs: requiredDVNs,
            optionalDVNs: optionalDVNs
        });
        
        bytes memory dvnCalldata = abi.encodeWithSignature(
            "setConfig(address,address,uint32,uint32,bytes)",
            EAGLE_SHARE_OFT,
            SEND_ULN_302,
            SOLANA_EID,
            CONFIG_TYPE_ULN,
            abi.encode(ulnConfig)
        );
        
        console.log("   DVN Config Calldata:");
        console.log("   ", vm.toString(dvnCalldata));
        console.log("");
        
        // Executor Config
        ExecutorConfig memory executorConfig = ExecutorConfig({
            maxMessageSize: 10000,
            executor: LZ_EXECUTOR
        });
        
        bytes memory executorCalldata = abi.encodeWithSignature(
            "setConfig(address,address,uint32,uint32,bytes)",
            EAGLE_SHARE_OFT,
            SEND_ULN_302,
            SOLANA_EID,
            CONFIG_TYPE_EXECUTOR,
            abi.encode(executorConfig)
        );
        
        console.log("   Executor Config Calldata:");
        console.log("   ", vm.toString(executorCalldata));
        console.log("");
        
        console.log("=================================");
        console.log("Test Complete");
        console.log("=================================");
    }
}

