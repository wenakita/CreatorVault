// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../../contracts/layerzero/oft/WLFIOFTAdapter.sol";

/**
 * @title DeployWLFIAdapter
 * @notice Deploy WLFI OFT Adapter on Ethereum
 */
contract DeployWLFIAdapter is Script {
    
    // WLFI token on Ethereum
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    
    // LayerZero V2 Endpoint
    address constant LZ_ENDPOINT = 0x1a44076050125825900e736c501f859c50fE728c;
    
    // Owner
    address constant OWNER = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("DEPLOY: WLFI OFT Adapter on Ethereum");
        console.log("==============================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("WLFI Token:", WLFI);
        console.log("LZ Endpoint:", LZ_ENDPOINT);
        console.log("Owner:", OWNER);
        console.log("");
        
        require(block.chainid == 1, "Must run on Ethereum mainnet");
        require(deployer == OWNER, "Deployer must be owner");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Deploying WLFI OFT Adapter...");
        
        WLFIOFTAdapter adapter = new WLFIOFTAdapter(
            WLFI,
            LZ_ENDPOINT,
            OWNER
        );
        
        console.log("");
        console.log("==============================================");
        console.log("SUCCESS!");
        console.log("==============================================");
        console.log("");
        console.log("WLFI OFT Adapter:", address(adapter));
        console.log("");
        console.log("Verification:");
        console.log("  Token:", address(adapter.token()));
        console.log("  Endpoint:", address(adapter.endpoint()));
        console.log("  Owner:", adapter.owner());
        console.log("");
        
        vm.stopBroadcast();
        
        console.log("==============================================");
        console.log("NEXT STEPS");
        console.log("==============================================");
        console.log("");
        console.log("1. Set peer to Base WLFI OFT:");
        console.log("   cast send", address(adapter), "\\");
        console.log("     \"setPeer(uint32,bytes32)\" \\");
        console.log("     30184 \\");
        console.log("     0x00000000000000000000000047d5BB59484639A7E66f480DeF84cc1267BfA8FE \\");
        console.log("     --rpc-url $ETHEREUM_RPC_URL --private-key $PRIVATE_KEY");
        console.log("");
        console.log("2. Set peer on Base (Base -> Ethereum):");
        console.log("   cast send 0x47d5BB59484639A7E66f480DeF84cc1267BfA8FE \\");
        console.log("     \"setPeer(uint32,bytes32)\" \\");
        console.log("     30101 \\");
        console.log("     $(cast --to-bytes32", address(adapter), ") \\");
        console.log("     --rpc-url $BASE_RPC_URL --private-key $PRIVATE_KEY");
        console.log("");
        console.log("3. Deploy ComposerV2 with this adapter address");
        console.log("");
    }
}

