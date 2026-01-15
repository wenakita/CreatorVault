// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IWETH9
 * @author WETH9
 * @notice Interface for Wrapped Ether (WETH9).
 * @dev Used by swap and LP tooling.
 */
interface IWETH9 is IERC20 {
    /**
     * @notice Deposit ETH to get WETH
     */
    function deposit() external payable;
    
    /**
     * @notice Withdraw WETH to get ETH
     * @param amount Amount of WETH to withdraw
     */
    function withdraw(uint256 amount) external;
}
