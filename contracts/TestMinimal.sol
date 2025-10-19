// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

contract TestMinimal {
    address public owner;
    uint256 public number;
    
    constructor(address _owner) {
        owner = _owner;
        number = 42;
    }
    
    function setNumber(uint256 _num) external {
        number = _num;
    }
}

