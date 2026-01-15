// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/helpers/infra/UniversalBytecodeStore.sol";

/**
 * @dev Seed UniversalBytecodeStore with all creation codes used by CreatorVaultBatcher.
 *
 * Run:
 *  forge script script/SeedUniversalBytecodeStore.s.sol:SeedUniversalBytecodeStore --rpc-url $BASE_RPC_URL --broadcast
 *
 * Env overrides:
 *  PRIVATE_KEY (required)
 *  UNIVERSAL_BYTECODE_STORE (optional; defaults to Base mainnet store)
 */
contract SeedUniversalBytecodeStore is Script {
    address constant DEFAULT_BYTECODE_STORE = 0xCDf45B94348DBBABba4bE6f4a5341badb83D4dC4;
    string constant FRONTEND_BYTECODE_PATH = "frontend/src/deploy/bytecode.generated.ts";

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address storeAddr = vm.envOr("UNIVERSAL_BYTECODE_STORE", DEFAULT_BYTECODE_STORE);

        console2.log("UniversalBytecodeStore:", storeAddr);
        UniversalBytecodeStore store = UniversalBytecodeStore(storeAddr);
        string memory src = vm.readFile(FRONTEND_BYTECODE_PATH);

        vm.startBroadcast(pk);
        _storeIfMissing(store, _extractCreationCode(src, "OFTBootstrapRegistry"), "OFTBootstrapRegistry");
        _storeIfMissing(store, _extractCreationCode(src, "CreatorShareOFT"), "CreatorShareOFT");
        _storeIfMissing(store, _extractCreationCode(src, "CreatorOVault"), "CreatorOVault");
        _storeIfMissing(store, _extractCreationCode(src, "CreatorOVaultWrapper"), "CreatorOVaultWrapper");
        _storeIfMissing(store, _extractCreationCode(src, "CreatorGaugeController"), "CreatorGaugeController");
        _storeIfMissing(store, _extractCreationCode(src, "CCALaunchStrategy"), "CCALaunchStrategy");
        _storeIfMissing(store, _extractCreationCode(src, "CreatorOracle"), "CreatorOracle");
        vm.stopBroadcast();
    }

    function _extractCreationCode(string memory src, string memory key) internal pure returns (bytes memory) {
        string memory needle = string.concat(key, ": '");
        uint256 start = _indexOf(src, needle);
        require(start != type(uint256).max, "BYTECODE_KEY_NOT_FOUND");
        start += bytes(needle).length;

        bytes memory s = bytes(src);
        uint256 end = start;
        while (end < s.length && s[end] != bytes1("'")) {
            end++;
        }
        require(end > start && end < s.length, "BYTECODE_UNTERMINATED");

        bytes memory hexBytes = new bytes(end - start);
        for (uint256 i = 0; i < hexBytes.length; i++) {
            hexBytes[i] = s[start + i];
        }

        return _fromHexString(string(hexBytes));
    }

    function _storeIfMissing(UniversalBytecodeStore store, bytes memory creationCode, string memory label) internal {
        bytes32 codeId = keccak256(creationCode);
        address pointer = store.pointers(codeId);
        if (pointer == address(0)) {
            (bytes32 storedId, address storedPointer) = store.store(creationCode);
            console2.log(label, "stored codeId:", uint256(storedId));
            console2.log(label, "pointer:", storedPointer);
        } else {
            console2.log(label, "already stored codeId:", uint256(codeId));
            console2.log(label, "pointer:", pointer);
        }
    }

    function _indexOf(string memory haystack, string memory needle) internal pure returns (uint256) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length == 0 || h.length < n.length) return type(uint256).max;

        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool ok = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) {
                    ok = false;
                    break;
                }
            }
            if (ok) return i;
        }
        return type(uint256).max;
    }

    function _fromHexChar(uint8 c) internal pure returns (uint8) {
        if (c >= 48 && c <= 57) return c - 48; // 0-9
        if (c >= 97 && c <= 102) return c - 87; // a-f
        if (c >= 65 && c <= 70) return c - 55; // A-F
        revert("INVALID_HEX_CHAR");
    }

    function _fromHexString(string memory str) internal pure returns (bytes memory) {
        bytes memory s = bytes(str);
        require(s.length >= 4, "HEX_TOO_SHORT");
        require(s[0] == bytes1("0") && (s[1] == bytes1("x") || s[1] == bytes1("X")), "HEX_PREFIX");
        uint256 len = s.length - 2;
        require(len % 2 == 0, "HEX_ODD_LEN");

        bytes memory out = new bytes(len / 2);
        for (uint256 i = 0; i < out.length; i++) {
            uint8 hi = _fromHexChar(uint8(s[2 + (2 * i)]));
            uint8 lo = _fromHexChar(uint8(s[3 + (2 * i)]));
            out[i] = bytes1((hi << 4) | lo);
        }
        return out;
    }
}
