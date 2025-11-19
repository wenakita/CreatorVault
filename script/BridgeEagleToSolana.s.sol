// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";

interface IOFT {
    struct SendParam {
        uint32 dstEid;
        bytes32 to;
        uint256 amountLD;
        uint256 minAmountLD;
        bytes extraOptions;
        bytes composeMsg;
        bytes oftCmd;
    }
    
    struct MessagingFee {
        uint256 nativeFee;
        uint256 lzTokenFee;
    }
    
    function quoteSend(SendParam calldata _sendParam, bool _payInLzToken) external view returns (MessagingFee memory msgFee);
    function send(SendParam calldata _sendParam, MessagingFee calldata _fee, address _refundAddress) external payable returns (MessagingFee memory fee, bytes memory lzMessageGuid);
}

contract BridgeEagleToSolana is Script {
    address constant EAGLE_SHARE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    address constant SAFE_MULTISIG = 0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3;
    uint32 constant SOLANA_EID = 30168;
    
    // Solana recipient (from Codespaces wallet)
    bytes32 constant SOLANA_RECIPIENT = 0x000000000000000000000000207f1ae831b5ae3a1a03c41ff3b57b63c22b3935;
    
    function run() external view {
        console.log("=================================");
        console.log("Bridge 1 EAGLE to Solana");
        console.log("=================================");
        console.log("");
        
        IOFT oft = IOFT(EAGLE_SHARE_OFT);
        
        // Prepare send parameters (1 EAGLE = 1e18)
        IOFT.SendParam memory sendParam = IOFT.SendParam({
            dstEid: SOLANA_EID,
            to: SOLANA_RECIPIENT,
            amountLD: 1 ether, // 1 EAGLE
            minAmountLD: 1 ether, // No slippage
            extraOptions: hex"0003010011010000000000000000000000000000030d40", // From enforcedOptions
            composeMsg: hex"",
            oftCmd: hex""
        });
        
        // Quote the fee
        IOFT.MessagingFee memory fee = oft.quoteSend(sendParam, false);
        
        console.log("Bridge Details:");
        console.log("  From:", SAFE_MULTISIG);
        console.log("  To (Solana):", vm.toString(SOLANA_RECIPIENT));
        console.log("  Amount: 1 EAGLE");
        console.log("  Native Fee:", fee.nativeFee);
        console.log("  Native Fee (ETH):", fee.nativeFee / 1e18);
        console.log("");
        
        // Generate transaction calldata
        bytes memory calldata_ = abi.encodeWithSignature(
            "send((uint32,bytes32,uint256,uint256,bytes,bytes,bytes),(uint256,uint256),address)",
            sendParam,
            fee,
            SAFE_MULTISIG
        );
        
        console.log("=================================");
        console.log("Safe Transaction");
        console.log("=================================");
        console.log("");
        console.log("To:", EAGLE_SHARE_OFT);
        console.log("Value:", fee.nativeFee);
        console.log("Data:", vm.toString(calldata_));
        console.log("");
        
        // For manual Safe execution
        console.log("=================================");
        console.log("Manual Execution");
        console.log("=================================");
        console.log("");
        console.log("1. Go to Safe: https://app.safe.global/transactions/queue?safe=eth:0xe5a1d534eb7f00397361F645f0F39e5D16cc1De3");
        console.log("2. Click 'New Transaction' > 'Contract Interaction'");
        console.log("3. Enter:");
        console.log("   To:", EAGLE_SHARE_OFT);
        console.log("   Value:", fee.nativeFee, "wei");
        console.log("   Data:", vm.toString(calldata_));
        console.log("");
        console.log("Estimated Cost: ~", (fee.nativeFee * 50) / 1e9, "USD @ 50 gwei");
    }
}

