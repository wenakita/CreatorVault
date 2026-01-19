// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ICreatorOVaultDeposit {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
}

interface IVaultShareBurnStream {
    function queueShares(uint256 shares) external;
}

interface IWETH {
    function deposit() external payable;
}

interface ISwapRouterV3 {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

/**
 * @title PayoutRouter
 * @author 0xakita.eth
 * @notice Receives creator earnings and routes value into the vault via an enforceable burn stream.
 *
 * @dev Design goals:
 * - Safe `payoutRecipient`: never reverts on ERC20 transfers (no hooks needed).
 * - Can accept ETH: wraps to WETH (kept until processed).
 * - Converts payout tokens → creator coin via Uniswap V3 (exactInput path), deposits into the vault,
 *   and queues the minted vault shares into a burn stream (dripped/burned over time).
 * - Owner/keeper-gated processing to prevent griefing via bad swap params.
 *
 * @dev Notes:
 * - The burn stream MUST be configured on the vault (one-time) so it can burn its own shares.
 * - Vault shares minted to the burn stream are not withdrawable (no owner escape hatch), satisfying
 *   "not trust me bro" enforceability.
 */
contract PayoutRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // IMMUTABLES
    // ================================

    IERC20 public immutable creatorCoin;
    address public immutable vault;
    address public immutable burnStream;
    address public immutable swapRouter;
    address public immutable weth;

    // ================================
    // CONFIG
    // ================================

    /// @notice Optional keeper (bot/operator) allowed to process swaps.
    address public keeper;

    /// @notice tokenIn => Uniswap V3 encoded path ending in `creatorCoin`.
    /// @dev Path encoding: tokenIn (20) + fee (3) + tokenMid (20) [+ fee (3) + tokenOut (20) ...]
    mapping(address => bytes) public swapPathToCreator;

    // ================================
    // EVENTS
    // ================================

    event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);
    event SwapPathSet(address indexed tokenIn, bytes path);
    event ConvertedAndQueued(address indexed tokenIn, uint256 amountIn, uint256 creatorOut, uint256 vaultSharesQueued);
    event EmergencyWithdraw(address indexed token, address indexed to, uint256 amount);

    // ================================
    // ERRORS
    // ================================

    error ZeroAddress();
    error NotAuthorized();
    error ZeroAmount();
    error PathNotSet(address tokenIn);
    error InvalidPath(address tokenIn);

    // ================================
    // MODIFIERS
    // ================================

    modifier onlyOwnerOrKeeper() {
        if (msg.sender != owner() && msg.sender != keeper) revert NotAuthorized();
        _;
    }

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(
        address _creatorCoin,
        address _vault,
        address _burnStream,
        address _owner,
        address _swapRouter,
        address _weth
    ) Ownable(_owner) {
        if (
            _creatorCoin == address(0) ||
            _vault == address(0) ||
            _burnStream == address(0) ||
            _owner == address(0) ||
            _swapRouter == address(0) ||
            _weth == address(0)
        ) {
            revert ZeroAddress();
        }

        creatorCoin = IERC20(_creatorCoin);
        vault = _vault;
        burnStream = _burnStream;
        swapRouter = _swapRouter;
        weth = _weth;

        // Allow this router to deposit creatorCoin without repeated approvals.
        IERC20(_creatorCoin).forceApprove(_vault, type(uint256).max);
    }

    // ================================
    // RECEIVE
    // ================================

    receive() external payable {
        // If ETH is sent, wrap to WETH and hold until processed.
        if (msg.value > 0) {
            IWETH(weth).deposit{value: msg.value}();
        }
    }

    // ================================
    // ADMIN
    // ================================

    function setKeeper(address newKeeper) external onlyOwner {
        address old = keeper;
        keeper = newKeeper;
        emit KeeperUpdated(old, newKeeper);
    }

    /**
     * @notice Set the Uniswap V3 swap path for a payout token.
     * @dev This also pre-approves the router to spend tokenIn.
     */
    function setSwapPath(address tokenIn, bytes calldata path) external onlyOwner {
        if (tokenIn == address(0)) revert ZeroAddress();
        if (tokenIn == address(creatorCoin)) revert InvalidPath(tokenIn);
        if (path.length < 43) revert InvalidPath(tokenIn); // 20 + 3 + 20

        // Validate path starts with tokenIn and ends with creatorCoin.
        address start = _readAddress(path, 0);
        address end = _readAddress(path, path.length - 20);
        if (start != tokenIn || end != address(creatorCoin)) revert InvalidPath(tokenIn);

        swapPathToCreator[tokenIn] = path;

        // Approve swap router once (best-effort; SafeERC20 handles non-standard tokens).
        IERC20(tokenIn).forceApprove(swapRouter, type(uint256).max);

        emit SwapPathSet(tokenIn, path);
    }

    // ================================
    // PROCESSING
    // ================================

    /**
     * @notice Convert a payout token into creatorCoin and inject into the vault (PPS-only).
     * @param tokenIn Payout token to convert (e.g. USDC, WETH, ZORA). Use creatorCoin to inject directly.
     * @param amountIn Amount of tokenIn to convert/inject (must already be held by this router).
     * @param minCreatorOut Minimum creatorCoin received from swap (slippage guard). Ignored when tokenIn==creatorCoin.
     */
    function convertAndQueue(address tokenIn, uint256 amountIn, uint256 minCreatorOut)
        external
        nonReentrant
        onlyOwnerOrKeeper
        returns (uint256 creatorOut, uint256 sharesQueued)
    {
        if (tokenIn == address(0)) revert ZeroAddress();
        if (amountIn == 0) revert ZeroAmount();

        if (tokenIn == address(creatorCoin)) {
            // Inject already-held creatorCoin (no swap).
            creatorOut = amountIn;
        } else {
            bytes memory path = swapPathToCreator[tokenIn];
            if (path.length == 0) revert PathNotSet(tokenIn);

            // Swap using funds already held in this router.
            IERC20 inToken = IERC20(tokenIn);
            uint256 bal = inToken.balanceOf(address(this));
            if (bal < amountIn) revert ZeroAmount();

            creatorOut = ISwapRouterV3(swapRouter).exactInput(
                ISwapRouterV3.ExactInputParams({
                    path: path,
                    recipient: address(this),
                    deadline: block.timestamp,
                    amountIn: amountIn,
                    amountOutMinimum: minCreatorOut
                })
            );
        }

        if (creatorOut == 0) revert ZeroAmount();
        sharesQueued = ICreatorOVaultDeposit(vault).deposit(creatorOut, burnStream);
        if (sharesQueued == 0) revert ZeroAmount();

        // Queue minted vault shares for NEXT epoch drip/burn.
        // Anyone can call `checkpoint()` later to start/drip when the epoch begins.
        IVaultShareBurnStream(burnStream).queueShares(sharesQueued);

        emit ConvertedAndQueued(tokenIn, amountIn, creatorOut, sharesQueued);
    }

    /**
     * @notice Emergency withdraw any token (including payouts) to a safe address.
     * @dev Intended for safety; does not attempt to preserve PPS semantics.
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        if (token == address(0)) {
            // ETH withdraw
            (bool ok, ) = to.call{value: amount}("");
            require(ok, "ETH transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }

        emit EmergencyWithdraw(token, to, amount);
    }

    // ================================
    // INTERNAL HELPERS
    // ================================

    function _readAddress(bytes memory data, uint256 offset) internal pure returns (address addr) {
        // Read 20 bytes from `data` at `offset`.
        // solhint-disable-next-line no-inline-assembly
        assembly {
            addr := shr(96, mload(add(add(data, 0x20), offset)))
        }
    }
}
