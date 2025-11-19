// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "forge-std/console.sol";

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
    
    struct MessagingReceipt {
        bytes32 guid;
        uint64 nonce;
        MessagingFee fee;
    }
    
    function quoteSend(SendParam calldata _sendParam, bool _payInLzToken) 
        external 
        view 
        returns (MessagingFee memory msgFee);
    
    function send(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable returns (MessagingReceipt memory msgReceipt, bytes memory oftReceipt);
    
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title BridgeEagleFromBase
 * @notice Bridge 100 EAGLE from Base to Ethereum for redemption
 */
contract BridgeEagleFromBase is Script {
    address constant EAGLE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    uint32 constant ETHEREUM_EID = 30101;
    uint256 constant AMOUNT = 100 ether; // 100 EAGLE
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("  BRIDGE: 100 EAGLE from Base to Ethereum");
        console.log("==============================================");
        console.log("");
        console.log("Chain ID:", block.chainid);
        console.log("User:", deployer);
        console.log("Amount:", AMOUNT / 1e18, "EAGLE");
        console.log("");
        
        require(block.chainid == 8453, "Must run on Base");
        
        IOFT oft = IOFT(EAGLE_OFT);
        
        // Check balance
        uint256 balance = oft.balanceOf(deployer);
        console.log("Current EAGLE balance:", balance / 1e18);
        require(balance >= AMOUNT, "Insufficient EAGLE balance");
        console.log("");
        
        // Prepare send parameters
        // Use enforced options (empty extraOptions means use enforcedOptions)
        IOFT.SendParam memory sendParam = IOFT.SendParam({
            dstEid: ETHEREUM_EID,
            to: bytes32(uint256(uint160(deployer))),
            amountLD: AMOUNT,
            minAmountLD: AMOUNT * 99 / 100, // 1% slippage
            extraOptions: hex"", // Empty = use enforcedOptions
            composeMsg: hex"",
            oftCmd: hex""
        });
        
        // Get quote
        console.log("Getting bridge fee quote...");
        IOFT.MessagingFee memory fee = oft.quoteSend(sendParam, false);
        console.log("Native fee:", fee.nativeFee);
        console.log("Native fee (ETH):", fee.nativeFee / 1e18);
        console.log("");
        
        // Check ETH balance
        uint256 ethBalance = deployer.balance;
        console.log("ETH balance:", ethBalance / 1e18);
        require(ethBalance >= fee.nativeFee, "Insufficient ETH for bridge fee");
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Sending 100 EAGLE from Base to Ethereum...");
        (IOFT.MessagingReceipt memory receipt, ) = oft.send{value: fee.nativeFee}(
            sendParam,
            fee,
            deployer
        );
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("==============================================");
        console.log("  SUCCESS! EAGLE Bridging to Ethereum");
        console.log("==============================================");
        console.log("");
        console.log("Transaction Details:");
        console.log("  GUID:", vm.toString(receipt.guid));
        console.log("  Nonce:", receipt.nonce);
        console.log("  Fee paid:", receipt.fee.nativeFee / 1e18, "ETH");
        console.log("");
        console.log("Track on LayerZero Scan:");
        console.log("  https://layerzeroscan.com/tx/", vm.toString(receipt.guid));
        console.log("");
        console.log("Next Steps:");
        console.log("1. Wait 5-15 minutes for delivery");
        console.log("2. Verify EAGLE arrived on Ethereum");
        console.log("3. Redeem EAGLE for WLFI using Composer");
        console.log("");
    }
}

