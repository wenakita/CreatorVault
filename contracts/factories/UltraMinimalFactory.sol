// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {CreatorOVault} from "../vault/CreatorOVault.sol";
import {CreatorOVaultWrapper} from "../vault/CreatorOVaultWrapper.sol";
import {CreatorShareOFT} from "../layerzero/CreatorShareOFT.sol";

/**
 * @title UltraMinimalFactory
 * @notice Ultra-lightweight factory < 24KB
 * @dev Deploys Vault, Wrapper, ShareOFT with CREATE2
 */
contract UltraMinimalFactory {
    
    address constant LZ = 0x1a44076050125825900e736c501f859c50fE728c;
    
    event VaultDeployed(address indexed token, address vault, address wrapper, address oft, address creator);
    
    error ZeroAddress();
    error Failed();
    
    /**
     * @notice Deploy vault with auto names
     * @param token Creator token address
     * @param creator Owner address
     */
    function deploy(address token, address creator) external returns (address v, address w, address o) {
        if (token == address(0) || creator == address(0)) revert ZeroAddress();
        
        string memory s = _up(IERC20Metadata(token).symbol());
        bytes32 salt = keccak256(abi.encodePacked("CV1_", token, s));
        
        v = _dv(token, string(abi.encodePacked(s, " Vault")), string(abi.encodePacked("v", s)), creator, salt);
        w = _dw(token, v, creator, salt);
        o = _do(string(abi.encodePacked("Wrapped ", s, " Share")), string(abi.encodePacked("ws", s)), creator, salt);
        
        CreatorOVaultWrapper(w).setShareOFT(o);
        CreatorShareOFT(o).setVault(v);
        CreatorShareOFT(o).setMinter(w, true);
        CreatorOVault(payable(v)).setWhitelist(w, true);
        
        emit VaultDeployed(token, v, w, o, creator);
    }
    
    function _dv(address t, string memory n, string memory s, address o, bytes32 b) internal returns (address) {
        return _c2(abi.encodePacked(type(CreatorOVault).creationCode, abi.encode(t, o, n, s)), keccak256(abi.encodePacked(b, "v")));
    }
    
    function _dw(address t, address v, address o, bytes32 b) internal returns (address) {
        return _c2(abi.encodePacked(type(CreatorOVaultWrapper).creationCode, abi.encode(t, v, o)), keccak256(abi.encodePacked(b, "w")));
    }
    
    function _do(string memory n, string memory s, address o, bytes32 b) internal returns (address) {
        return _c2(abi.encodePacked(type(CreatorShareOFT).creationCode, abi.encode(n, s, LZ, o)), keccak256(abi.encodePacked(b, "o")));
    }
    
    function _c2(bytes memory code, bytes32 salt) internal returns (address a) {
        assembly { a := create2(0, add(code, 0x20), mload(code), salt) }
        if (a == address(0)) revert Failed();
    }
    
    function _up(string memory str) internal pure returns (string memory) {
        bytes memory b = bytes(str);
        for (uint i; i < b.length; i++) {
            if (b[i] >= 0x61 && b[i] <= 0x7A) b[i] = bytes1(uint8(b[i]) - 32);
        }
        return string(b);
    }
}
