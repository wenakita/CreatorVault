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
    uint256 constant MAX_SSTORE2_BYTES = 24_575; // EIP-170 runtime limit (24,576) minus STOP prefix.

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address storeAddr = vm.envOr("UNIVERSAL_BYTECODE_STORE", DEFAULT_BYTECODE_STORE);
        address broadcaster = vm.addr(pk);

        console2.log("Broadcaster:", broadcaster);
        console2.log("Broadcaster balance (ETH):", broadcaster.balance);

        console2.log("UniversalBytecodeStore:", storeAddr);
        UniversalBytecodeStore store = UniversalBytecodeStore(storeAddr);
        string memory src = vm.readFile(FRONTEND_BYTECODE_PATH);

        bool supportsChunking = _supportsChunking(storeAddr);
        console2.log("Store supports chunking:", supportsChunking);

        // Foundry will happily simulate these calls even if the broadcaster can't pay gas,
        // which is confusing because you'll see "stored" logs but nothing is actually mined.
        // Fail fast for the common case: 0 balance.
        if (broadcaster.balance == 0) {
            console2.log("ERROR: broadcaster has 0 ETH on this chain. Fund it and rerun.");
            return;
        }

        vm.startBroadcast(pk);
        _storeIfMissing(store, _extractCreationCode(src, "OFTBootstrapRegistry"), "OFTBootstrapRegistry", supportsChunking);
        _storeIfMissing(store, _extractCreationCode(src, "CreatorShareOFT"), "CreatorShareOFT", supportsChunking);
        _storeIfMissing(store, _extractCreationCode(src, "CreatorOVault"), "CreatorOVault", supportsChunking);
        _storeIfMissing(store, _extractCreationCode(src, "CreatorOVaultWrapper"), "CreatorOVaultWrapper", supportsChunking);
        _storeIfMissing(store, _extractCreationCode(src, "CreatorGaugeController"), "CreatorGaugeController", supportsChunking);
        _storeIfMissing(store, _extractCreationCode(src, "CCALaunchStrategy"), "CCALaunchStrategy", supportsChunking);
        _storeIfMissing(store, _extractCreationCode(src, "CreatorOracle"), "CreatorOracle", supportsChunking);
        _storeIfMissing(store, _extractCreationCode(src, "CharmAlphaVaultDeploy"), "CharmAlphaVaultDeploy", supportsChunking);
        _storeIfMissing(store, _extractCreationCode(src, "CreatorCharmStrategy"), "CreatorCharmStrategy", supportsChunking);
        _storeIfMissing(store, _extractCreationCode(src, "AjnaStrategy"), "AjnaStrategy", supportsChunking);
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

    function _storeIfMissing(
        UniversalBytecodeStore store,
        bytes memory creationCode,
        string memory label,
        bool supportsChunking
    ) internal {
        bytes32 codeId = keccak256(creationCode);
        address pointer = store.pointers(codeId);
        if (pointer == address(0)) {
            if (!supportsChunking && creationCode.length > MAX_SSTORE2_BYTES) {
                console2.log("ERROR:", label, "creation bytecode too large for v1 store:", creationCode.length);
                console2.log("       Deploy UniversalBytecodeStoreV2 and rerun with:");
                console2.log("       UNIVERSAL_BYTECODE_STORE=<v2_store_address>");
                return;
            }

            try store.store(creationCode) returns (bytes32 storedId, address storedPointer) {
                console2.log(label, "stored codeId:", uint256(storedId));
                console2.log(label, "pointer:", storedPointer);
            } catch (bytes memory err) {
                console2.log("ERROR:", label, "store() reverted");
                console2.logBytes(err);
            }
        } else {
            console2.log(label, "already stored codeId:", uint256(codeId));
            console2.log(label, "pointer:", pointer);
        }
    }

    function _supportsChunking(address storeAddr) internal view returns (bool ok) {
        // `UniversalBytecodeStoreV2` exposes `chunkCount(bytes32)` for debugging.
        // v1 stores will not recognize the selector, causing the call to fail.
        (ok, ) = storeAddr.staticcall(abi.encodeWithSignature("chunkCount(bytes32)", bytes32(0)));
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
