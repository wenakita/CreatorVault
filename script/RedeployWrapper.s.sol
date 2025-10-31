// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../contracts/EagleVaultWrapper.sol";

/**
 * @title RedeployWrapper
 * @notice Redeploys the EagleVaultWrapper with the correct vault address
 */
contract RedeployWrapper is Script {
    // Current deployed addresses
    address constant VAULT = 0xb7D1044Aa912AE4BC95099E8027dD26B1506F261;  // NEW vault address
    address constant SHARE_OFT = 0x532Ec3711C9E219910045e2bBfA0280ae0d8457e;
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        console.log("=================================================");
        console.log("REDEPLOYING EAGLE VAULT WRAPPER");
        console.log("=================================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Vault:", VAULT);
        console.log("ShareOFT:", SHARE_OFT);
        console.log("");

        // Deploy new wrapper
        EagleVaultWrapper wrapper = new EagleVaultWrapper(
            VAULT,          // Correct vault address
            SHARE_OFT,      // ShareOFT address
            deployer,       // Fee recipient
            deployer        // Owner
        );

        console.log("NEW Wrapper deployed at:", address(wrapper));
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Grant minter role to wrapper on ShareOFT");
        console.log("   shareOFT.setMinter(", address(wrapper), ", true)");
        console.log("2. Update test scripts with new wrapper address");
        console.log("");

        vm.stopBroadcast();
    }
}

