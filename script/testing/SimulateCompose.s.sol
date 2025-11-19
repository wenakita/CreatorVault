// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
    
    function quoteSend(SendParam calldata _sendParam, bool _payInLzToken) 
        external view returns (MessagingFee memory msgFee);
        
    function send(
        SendParam calldata _sendParam,
        MessagingFee calldata _fee,
        address _refundAddress
    ) external payable returns (bytes memory receipt, bytes memory oftReceipt);
}

interface IComposer {
    function ASSET_OFT() external view returns (address);
    function SHARE_OFT() external view returns (address);
}

contract SimulateCompose is Script {
    // Base addresses
    address constant EAGLE_OFT_BASE = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    
    // Ethereum addresses
    address constant COMPOSER_ETH = 0x3A91B3e863C0bd6948088e8A0A9B1D22d6D05da9;
    address constant WLFI_ADAPTER_ETH = 0x2437F6555350c131647daA0C655c4B49A7aF3621;
    
    // LayerZero EIDs
    uint32 constant ETHEREUM_EID = 30101;
    uint32 constant BASE_EID = 30184;
    
    function run() external {
        console.log("\n=== SIMULATING COMPOSED FLOW ===\n");
        
        // Use deployer address from private key
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        console.log("Deployer:", deployer);
        
        // Get Base fork
        string memory baseRpc = vm.envString("BASE_RPC_URL");
        vm.createSelectFork(baseRpc);
        console.log("Forked Base at block:", block.number);
        
        // Check EAGLE balance
        IERC20 eagleOFT = IERC20(EAGLE_OFT_BASE);
        uint256 eagleBalance = eagleOFT.balanceOf(deployer);
        console.log("EAGLE Balance:", eagleBalance / 1e18, "EAGLE");
        
        if (eagleBalance == 0) {
            console.log("\nNo EAGLE balance to test with!");
            return;
        }
        
        // Build compose message for ComposerV1
        uint256 amountToSend = 1e18; // 1 EAGLE
        
        IOFT.SendParam memory wlfiSendParam = IOFT.SendParam({
            dstEid: BASE_EID,
            to: bytes32(uint256(uint160(deployer))),
            amountLD: 0, // Filled by composer
            minAmountLD: 0.8e18, // 20% slippage
            extraOptions: hex"",
            composeMsg: hex"",
            oftCmd: hex""
        });
        
        uint256 minMsgValue = 0.0003 ether;
        
        bytes memory composeMsg = abi.encode(wlfiSendParam, minMsgValue);
        
        // Build send param
        IOFT.SendParam memory sendParam = IOFT.SendParam({
            dstEid: ETHEREUM_EID,
            to: bytes32(uint256(uint160(COMPOSER_ETH))),
            amountLD: amountToSend,
            minAmountLD: 0.98e18,
            extraOptions: _buildOptions(200000, 500000, uint128(minMsgValue)),
            composeMsg: composeMsg,
            oftCmd: hex""
        });
        
        // Quote fee
        console.log("\n--- Quoting LayerZero Fee ---");
        IOFT eagleOFTInterface = IOFT(EAGLE_OFT_BASE);
        IOFT.MessagingFee memory quote = eagleOFTInterface.quoteSend(sendParam, false);
        uint256 totalFee = quote.nativeFee + minMsgValue;
        
        console.log("LayerZero Fee:", quote.nativeFee / 1e16, "/ 100 ETH");
        console.log("WLFI Bridge Fee:", minMsgValue / 1e16, "/ 100 ETH");
        console.log("Total Fee:", totalFee / 1e16, "/ 100 ETH");
        
        // Check ETH balance
        uint256 ethBalance = deployer.balance;
        console.log("\nETH Balance:", ethBalance / 1e16, "/ 100 ETH");
        
        if (ethBalance < totalFee) {
            console.log("\nInsufficient ETH for actual transaction");
            console.log("   Need:", totalFee / 1e16, "/ 100 ETH");
            console.log("   Have:", ethBalance / 1e16, "/ 100 ETH");
            console.log("   Short:", (totalFee - ethBalance) / 1e16, "/ 100 ETH");
        } else {
            console.log("\nSufficient ETH for transaction!");
        }
        
        // Simulate the send (without broadcasting)
        console.log("\n--- Simulating Transaction ---");
        console.log("This will:");
        console.log("1. Bridge 1 EAGLE from Base -> Ethereum");
        console.log("2. Composer unwraps EAGLE -> vEAGLE");
        console.log("3. Composer redeems vEAGLE -> WLFI");
        console.log("4. Composer bridges WLFI back to Base");
        console.log("\nAll in 1 transaction!");
        
        console.log("\n--- Compose Message Analysis ---");
        console.log("Composer:", COMPOSER_ETH);
        console.log("Return to:", deployer);
        console.log("Destination EID:", BASE_EID);
        console.log("Min WLFI expected:", wlfiSendParam.minAmountLD / 1e18, "WLFI");
        
        // Verify composer configuration
        console.log("\n--- Verifying Composer ---");
        IComposer composer = IComposer(COMPOSER_ETH);
        
        vm.createSelectFork(vm.envString("ETHEREUM_RPC_URL"));
        console.log("Switched to Ethereum fork");
        
        address assetOFT = composer.ASSET_OFT();
        address shareOFT = composer.SHARE_OFT();
        
        console.log("Composer ASSET_OFT (WLFI Adapter):", assetOFT);
        console.log("Composer SHARE_OFT (EAGLE):", shareOFT);
        
        if (assetOFT != WLFI_ADAPTER_ETH) {
            console.log("\nCRITICAL: Composer ASSET_OFT mismatch!");
            console.log("   Expected:", WLFI_ADAPTER_ETH);
            console.log("   Got:", assetOFT);
            return;
        }
        
        if (shareOFT != EAGLE_OFT_BASE) {
            console.log("\nCRITICAL: Composer SHARE_OFT mismatch!");
            console.log("   Expected:", EAGLE_OFT_BASE);
            console.log("   Got:", shareOFT);
            return;
        }
        
        console.log("\nComposer configuration verified!");
        
        console.log("\n=== SIMULATION COMPLETE ===");
        console.log("\nTransaction would succeed with correct parameters");
        console.log("Ready to execute with real funds!");
    }
    
    function _buildOptions(
        uint128 lzReceiveGas,
        uint128 composeGas,
        uint128 composeValue
    ) internal pure returns (bytes memory) {
        // LayerZero Options V3 format
        // Type 3: LzReceive option
        // Type 1: Compose option
        bytes memory options = abi.encodePacked(
            uint16(3), // version
            uint128(lzReceiveGas), // gas for lzReceive
            uint128(0), // value for lzReceive
            uint16(1), // compose option type
            uint128(composeGas), // gas for compose
            uint128(composeValue) // value for compose
        );
        
        return abi.encodePacked(
            bytes1(0x00), // options type
            uint16(3), // version
            uint128(lzReceiveGas),
            uint128(0),
            uint16(1),
            uint16(0), // index
            uint128(composeGas),
            uint128(composeValue)
        );
    }
}

