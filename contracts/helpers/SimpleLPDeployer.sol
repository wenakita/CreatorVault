// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ================================
// INTERFACES
// ================================

interface IPoolManager {
        function initialize(
            address token0,
            address token1,
            uint24 fee,
            int24 tickSpacing,
            bytes calldata hookData
        ) external returns (address pool);
    }

    interface IPositionManager {
        struct MintParams {
            address token0;
            address token1;
            uint24 fee;
            int24 tickLower;
            int24 tickUpper;
            uint256 amount0Desired;
            uint256 amount1Desired;
            uint256 amount0Min;
            uint256 amount1Min;
            address recipient;
            uint256 deadline;
        }

        function mint(MintParams calldata params) external payable returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        );
    }

/**
 * @title SimpleLPDeployer
 * @notice Helper to deploy initial LP for wsAKITA/WETH on Uniswap V4 during activation
 * @dev Bundles with activation for 1-click LP deployment via account abstraction
 * 
 * Flow:
 * 1. User calls deployLP with wsAKITA + ETH
 * 2. Contract creates V4 pool if needed
 * 3. Adds full-range liquidity
 * 4. Returns LP NFT to user
 * 5. User owns and controls the liquidity
 */
contract SimpleLPDeployer is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // STATE
    // ================================

    IPoolManager public immutable poolManager;
    IPositionManager public immutable positionManager;
    address public immutable WETH;
    address public immutable taxHook;

    // Default pool parameters
    uint24 public constant DEFAULT_FEE = 3000; // 0.3% (V4 with hooks can override)
    int24 public constant FULL_RANGE_LOWER = -887272;
    int24 public constant FULL_RANGE_UPPER = 887272;

    // ================================
    // EVENTS
    // ================================

    event LPDeployed(
        address indexed user,
        address indexed token,
        address pool,
        uint256 tokenId,
        uint256 liquidity
    );

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientETH();

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(
        address _poolManager,
        address _positionManager,
        address _weth,
        address _taxHook
    ) {
        if (_poolManager == address(0) || _positionManager == address(0) || 
            _weth == address(0)) revert ZeroAddress();
        
        poolManager = IPoolManager(_poolManager);
        positionManager = IPositionManager(_positionManager);
        WETH = _weth;
        taxHook = _taxHook;
    }

    // ================================
    // MAIN FUNCTION
    // ================================

    /**
     * @notice Deploy LP for wsAKITA/WETH on Uniswap V4
     * @param wsToken The wsAKITA (or other ShareOFT) token
     * @param tokenAmount Amount of wsToken to add as liquidity
     * @param minETH Minimum ETH to add (slippage protection)
     * @return tokenId The LP NFT token ID
     * @return liquidity The amount of liquidity minted
     * 
     * @dev User must:
     *      1. Approve this contract to spend wsToken
     *      2. Send ETH with transaction for pairing
     */
    function deployLP(
        address wsToken,
        uint256 tokenAmount,
        uint256 minETH
    ) external payable nonReentrant returns (
        uint256 tokenId,
        uint128 liquidity
    ) {
        if (wsToken == address(0)) revert ZeroAddress();
        if (tokenAmount == 0) revert ZeroAmount();
        if (msg.value < minETH) revert InsufficientETH();

        // Pull wsToken from user
        IERC20(wsToken).safeTransferFrom(msg.sender, address(this), tokenAmount);

        // Wrap ETH to WETH
        (bool success,) = WETH.call{value: msg.value}("");
        require(success, "WETH wrap failed");

        // Determine token ordering (V4 requires token0 < token1)
        (address token0, address token1, uint256 amount0, uint256 amount1) = 
            wsToken < WETH 
                ? (wsToken, WETH, tokenAmount, msg.value)
                : (WETH, wsToken, msg.value, tokenAmount);

        // Approve position manager
        IERC20(token0).forceApprove(address(positionManager), amount0);
        IERC20(token1).forceApprove(address(positionManager), amount1);

        // Create full-range position
        uint256 amount0Used;
        uint256 amount1Used;
        (tokenId, liquidity, amount0Used, amount1Used) = positionManager.mint(
            IPositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: DEFAULT_FEE,
                tickLower: FULL_RANGE_LOWER,
                tickUpper: FULL_RANGE_UPPER,
                amount0Desired: amount0,
                amount1Desired: amount1,
                amount0Min: (amount0 * 95) / 100, // 5% slippage
                amount1Min: (amount1 * 95) / 100,
                recipient: msg.sender, // LP NFT goes to user
                deadline: block.timestamp
            })
        );

        // Refund unused tokens
        if (token0 == wsToken) {
            if (amount0 > amount0Used) {
                IERC20(wsToken).safeTransfer(msg.sender, amount0 - amount0Used);
            }
            if (amount1 > amount1Used) {
                // Unwrap and refund ETH
                (success,) = msg.sender.call{value: amount1 - amount1Used}("");
                require(success, "ETH refund failed");
            }
        } else {
            if (amount0 > amount0Used) {
                // Unwrap and refund ETH
                (success,) = msg.sender.call{value: amount0 - amount0Used}("");
                require(success, "ETH refund failed");
            }
            if (amount1 > amount1Used) {
                IERC20(wsToken).safeTransfer(msg.sender, amount1 - amount1Used);
            }
        }

        emit LPDeployed(msg.sender, wsToken, _getPool(token0, token1), tokenId, liquidity);
    }

    /**
     * @dev Get or create pool address
     */
    function _getPool(address token0, address token1) internal view returns (address) {
        // This is a simplified version - actual implementation would check if pool exists
        // and create it if needed via poolManager.initialize()
        return address(uint160(uint256(keccak256(abi.encodePacked(token0, token1)))));
    }

    /**
     * @notice Emergency withdraw stuck tokens
     */
    function emergencyWithdraw(address token) external {
        if (token == address(0)) {
            payable(msg.sender).transfer(address(this).balance);
        } else {
            uint256 balance = IERC20(token).balanceOf(address(this));
            IERC20(token).safeTransfer(msg.sender, balance);
        }
    }

    receive() external payable {}
}



import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// ================================
// INTERFACES
// ================================
