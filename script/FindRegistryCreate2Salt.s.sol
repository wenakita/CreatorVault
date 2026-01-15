// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/CreatorRegistry.sol";

/// @notice Search for a CREATE2 salt that yields a vanity registry address.
/// @dev Run with: SALT_START=0 SALT_ITERS=1000000 forge script script/FindRegistryCreate2Salt.s.sol:FindRegistryCreate2Salt -vvvv
contract FindRegistryCreate2Salt is Script {
    address constant CREATE2_FACTORY_ADDR = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function _create2(address deployer, bytes32 salt, bytes32 initCodeHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))));
    }

    function _isVanity(address addr) internal pure returns (bool) {
        uint160 v = uint160(addr);
        bool prefixOk = (v >> 148) == 0x777;
        bool suffixOk = (v & 0xFFFF) == 0x4626;
        return prefixOk && suffixOk;
    }

    function run() external {
        address owner = vm.envAddress("PROTOCOL_OWNER");
        uint256 start = vm.envOr("SALT_START", uint256(0));
        uint256 iters = vm.envOr("SALT_ITERS", uint256(1_000_000));

        bytes32 initCodeHash = keccak256(abi.encodePacked(type(CreatorRegistry).creationCode, abi.encode(owner)));
        console2.log("Owner:", owner);
        console2.log("InitCodeHash:", uint256(initCodeHash));
        console2.log("Start:", start);
        console2.log("Iters:", iters);

        vm.pauseGasMetering();
        for (uint256 i = 0; i < iters; i++) {
            bytes32 salt = bytes32(start + i);
            address predicted = _create2(CREATE2_FACTORY_ADDR, salt, initCodeHash);
            if (_isVanity(predicted)) {
                vm.resumeGasMetering();
                console2.log("Found salt:", uint256(salt));
                console2.logBytes32(salt);
                console2.log("Address:", predicted);
                return;
            }
        }
        vm.resumeGasMetering();

        console2.log("No vanity salt found in range.");
    }
}
