// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

/**
 * @title SetupLayerZeroComplete
 * @notice Generate complete LayerZero V2 configuration as Safe batch transaction
 * 
 * This script generates calldata for ALL required LayerZero configurations:
 * 1. setPeer - Register Solana as trusted peer
 * 2. setDelegate - Set Safe as delegate for LZ admin
 * 3. setSendLibrary - Configure send library
 * 4. setReceiveLibrary - Configure receive library
 * 5. setConfig (DVN) - Configure Decentralized Verifier Network
 * 6. setConfig (Executor) - Configure message executor
 * 7. setEnforcedOptions - Set minimum gas limits
 * 
 * Usage:
 *   forge script script/SetupLayerZeroComplete.s.sol:SetupLayerZeroComplete
 */
contract SetupLayerZeroComplete is Script {
    // =================================
    // ADDRESSES
    // =================================
    
    // EagleShareOFT (your contract)
    address constant EAGLE_SHARE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    
    // Safe Multisig (owner)
    address constant SAFE_MULTISIG = 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3;
    
    // LayerZero V2 Addresses (Ethereum Mainnet)
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    address constant SEND_ULN_302 = 0xbB2Ea70C9E858123480642Cf96acbcCE1372dCe1;
    address constant RECEIVE_ULN_302 = 0xc02Ab410f0734EFa3F14628780e6e695156024C2;
    address constant LZ_DVN = 0x589dEDbD617e0CBcB916A9223F4d1300c294236b;
    address constant LZ_EXECUTOR = 0x173272739Bd7Aa6e4e214714048a9fE699453059;
    
    // =================================
    // CONFIGURATION VALUES
    // =================================
    
    // Solana
    uint32 constant SOLANA_EID = 30168;
    bytes32 constant SOLANA_PEER = 0x000000000000000000000000207f1ae831b5ae3a1a03c41ff3b57b63c22b3935;
    
    // Config Types
    uint32 constant CONFIG_TYPE_EXECUTOR = 1;
    uint32 constant CONFIG_TYPE_ULN = 2;
    
    // Security params
    uint64 constant CONFIRMATIONS = 15; // Ethereum block confirmations
    uint32 constant MAX_MESSAGE_SIZE = 10000;
    
    // =================================
    // STRUCTS (matching LayerZero V2)
    // =================================
    
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
    
    struct EnforcedOptionParam {
        uint32 eid;
        uint16 msgType;
        bytes options;
    }
    
    // =================================
    // MAIN FUNCTION
    // =================================
    
    function run() external view {
        console.log("==============================================");
        console.log("  LAYERZERO V2 COMPLETE SETUP");
        console.log("  Safe Batch Transaction Generator");
        console.log("==============================================");
        console.log("");
        console.log("EagleShareOFT:", EAGLE_SHARE_OFT);
        console.log("Safe Multisig:", SAFE_MULTISIG);
        console.log("Solana EID:   ", SOLANA_EID);
        console.log("");
        
        // Generate all calldatas
        bytes[] memory calldatas = new bytes[](7);
        address[] memory targets = new address[](7);
        uint256[] memory values = new uint256[](7);
        
        // Transaction 1: setPeer
        console.log("1. setPeer (on EagleShareOFT)");
        targets[0] = EAGLE_SHARE_OFT;
        values[0] = 0;
        calldatas[0] = abi.encodeWithSignature(
            "setPeer(uint32,bytes32)",
            SOLANA_EID,
            SOLANA_PEER
        );
        console.log("   Calldata:", vm.toString(calldatas[0]));
        console.log("");
        
        // Transaction 2: setDelegate
        console.log("2. setDelegate (on LZ Endpoint)");
        targets[1] = LZ_ENDPOINT;
        values[1] = 0;
        calldatas[1] = abi.encodeWithSignature(
            "setDelegate(address)",
            SAFE_MULTISIG
        );
        console.log("   Calldata:", vm.toString(calldatas[1]));
        console.log("");
        
        // Transaction 3: setSendLibrary
        console.log("3. setSendLibrary (on LZ Endpoint)");
        targets[2] = LZ_ENDPOINT;
        values[2] = 0;
        calldatas[2] = abi.encodeWithSignature(
            "setSendLibrary(address,uint32,address)",
            EAGLE_SHARE_OFT,
            SOLANA_EID,
            SEND_ULN_302
        );
        console.log("   Calldata:", vm.toString(calldatas[2]));
        console.log("");
        
        // Transaction 4: setReceiveLibrary
        console.log("4. setReceiveLibrary (on LZ Endpoint)");
        targets[3] = LZ_ENDPOINT;
        values[3] = 0;
        calldatas[3] = abi.encodeWithSignature(
            "setReceiveLibrary(address,uint32,address,uint256)",
            EAGLE_SHARE_OFT,
            SOLANA_EID,
            RECEIVE_ULN_302,
            0  // gracePeriod
        );
        console.log("   Calldata:", vm.toString(calldatas[3]));
        console.log("");
        
        // Transaction 5: setConfig (DVN)
        console.log("5. setConfig - DVN (on LZ Endpoint)");
        targets[4] = LZ_ENDPOINT;
        values[4] = 0;
        
        // Use 2 DVNs for better security (matching current config)
        // DVNs MUST be in alphabetical order
        address[] memory requiredDVNs = new address[](2);
        requiredDVNs[0] = 0x589dEDbD617e0CBcB916A9223F4d1300c294236b; // LayerZero DVN
        requiredDVNs[1] = 0xa59BA433ac34D2927232918Ef5B2eaAfcF130BA5; // Google Cloud DVN
        address[] memory optionalDVNs = new address[](0);
        
        UlnConfig memory ulnConfig = UlnConfig({
            confirmations: CONFIRMATIONS,
            requiredDVNCount: 2,
            optionalDVNCount: 0,
            optionalDVNThreshold: 0,
            requiredDVNs: requiredDVNs,
            optionalDVNs: optionalDVNs
        });
        
        calldatas[4] = abi.encodeWithSignature(
            "setConfig(address,address,uint32,uint32,bytes)",
            EAGLE_SHARE_OFT,
            SEND_ULN_302,
            SOLANA_EID,
            CONFIG_TYPE_ULN,
            abi.encode(ulnConfig)
        );
        console.log("   Calldata:", vm.toString(calldatas[4]));
        console.log("");
        
        // Transaction 6: setConfig (Executor)
        console.log("6. setConfig - Executor (on LZ Endpoint)");
        targets[5] = LZ_ENDPOINT;
        values[5] = 0;
        
        ExecutorConfig memory executorConfig = ExecutorConfig({
            maxMessageSize: MAX_MESSAGE_SIZE,
            executor: LZ_EXECUTOR
        });
        
        calldatas[5] = abi.encodeWithSignature(
            "setConfig(address,address,uint32,uint32,bytes)",
            EAGLE_SHARE_OFT,
            SEND_ULN_302,
            SOLANA_EID,
            CONFIG_TYPE_EXECUTOR,
            abi.encode(executorConfig)
        );
        console.log("   Calldata:", vm.toString(calldatas[5]));
        console.log("");
        
        // Transaction 7: setEnforcedOptions
        console.log("7. setEnforcedOptions (on EagleShareOFT)");
        targets[6] = EAGLE_SHARE_OFT;
        values[6] = 0;
        
        // Build options: addExecutorLzReceiveOption(200000 gas, 0 value)
        bytes memory options = hex"0003010011010000000000000000000000000000030d40";
        
        EnforcedOptionParam[] memory enforcedOptions = new EnforcedOptionParam[](1);
        enforcedOptions[0] = EnforcedOptionParam({
            eid: SOLANA_EID,
            msgType: 1,  // SEND
            options: options
        });
        
        calldatas[6] = abi.encodeWithSignature(
            "setEnforcedOptions((uint32,uint16,bytes)[])",
            enforcedOptions
        );
        console.log("   Calldata:", vm.toString(calldatas[6]));
        console.log("");
        
        // Print Safe Transaction Builder format
        console.log("==============================================");
        console.log("  SAFE TRANSACTION BUILDER");
        console.log("==============================================");
        console.log("");
        console.log("Go to: https://app.safe.global/apps/open?safe=eth:0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3&appUrl=https://apps-portal.safe.global/tx-builder");
        console.log("");
        console.log("Use 'Batch Transaction Builder' and add 7 transactions:");
        console.log("");
        
        for (uint i = 0; i < 7; i++) {
            console.log("Transaction", i + 1, ":");
            console.log("  To:  ", targets[i]);
            console.log("  Value:", values[i]);
            console.log("  Data:", vm.toString(calldatas[i]));
            console.log("");
        }
        
        console.log("==============================================");
        console.log("  COST ESTIMATE");
        console.log("==============================================");
        console.log("");
        console.log("Gas Estimate: ~700,000 gas");
        console.log("Cost @ 50 gwei: ~$45-55");
        console.log("Cost @ 100 gwei: ~$90-110");
        console.log("");
        
        console.log("==============================================");
        console.log("  AFTER EXECUTION - VERIFY");
        console.log("==============================================");
        console.log("");
        console.log("1. Check peer is set:");
        console.log("   cast call", EAGLE_SHARE_OFT, "'peers(uint32)(bytes32)'", SOLANA_EID);
        console.log("");
        console.log("2. Check delegate:");
        console.log("   cast call", LZ_ENDPOINT, "'delegates(address)(address)'", EAGLE_SHARE_OFT);
        console.log("");
        console.log("3. Test send (small amount):");
        console.log("   Use LayerZero SDK to send 1 EAGLE to Solana");
        console.log("");
    }
}

