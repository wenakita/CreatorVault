// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";

interface IEagleShareOFT {
    function setMinter(address minter, bool status) external;
}

contract ConfigureNewWrapper is Script {
    address constant SHARE_OFT = 0x532Ec3711C9E219910045e2bBfA0280ae0d8457e;
    address constant NEW_WRAPPER = 0x622F8714c95f220AF666d77882CDCF63816dB8A7;
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Granting minter role to new wrapper...");
        IEagleShareOFT(SHARE_OFT).setMinter(NEW_WRAPPER, true);
        console.log("Success! New wrapper can now mint/burn ShareOFT");
        
        vm.stopBroadcast();
    }
}

pragma solidity ^0.8.22;

import "forge-std/Script.sol";

