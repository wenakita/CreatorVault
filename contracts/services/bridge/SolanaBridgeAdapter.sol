// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IBaseSolanaBridge} from "./interfaces/IBaseSolanaBridge.sol";
import {ICrossChainERC20Factory} from "./interfaces/ICrossChainERC20Factory.sol";
import {ICreatorRegistry} from "../../interfaces/core/ICreatorRegistry.sol";

/**
 * @title ICCAuction
 * @author 0xakita.eth
 * @notice Interface for Continuous Clearing Auction
 */
interface ICCAuction {
    function submitBid(
        uint256 maxPrice,
        uint128 amount,
        address owner,
        uint256 prevTickPrice,
        bytes calldata hookData
    ) external payable returns (uint256 bidId);
    
    function claimTokens(uint256 bidId) external;
    function exitBid(uint256 bidId) external;
}

interface IERC4626Deposit {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function asset() external view returns (address);
}

interface IWETH {
    function deposit() external payable;
}

/**
 * @title IUniswapV4Router
 * @notice Interface for swapping on Uniswap V4
 */
interface IUniswapV4Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/**
 * @title SolanaBridgeAdapter
 * @author 0xakita.eth
 * @notice Bridge adapter for CreatorVault assets between Base and Solana.
 * @dev Used to register ■TOKEN and route bridge + lottery actions.
 */
contract SolanaBridgeAdapter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // CONSTANTS
    // ================================

    /// @notice Base-Solana Bridge on Base Mainnet
    address public constant BRIDGE = address(bytes20(hex"3eff766c76a1be2ce1acf2b69c78bcae257d5188"));
    
    /// @notice CrossChainERC20Factory for wrapped tokens
    address public constant TOKEN_FACTORY = address(bytes20(hex"dd56781d0509650f8c2981231b6c917f2d5d7df2"));
    
    /// @notice Wrapped SOL on Base
    address public constant SOL_ON_BASE = address(bytes20(hex"311935cd80b76769bf2ecc9d8ab7635b2139cf82"));

    /// @notice Sentinel Solana pubkey used by the Base bridge to denote native SOL on Solana.
    /// @dev Source: Base bridge `TokenLib.NATIVE_SOL_PUBKEY`.
    bytes32 public constant NATIVE_SOL_PUBKEY =
        bytes32(hex"069be72ab836d4eacc02525b7350a78a395da2f1253a40ebafd6630000000000");

    // ================================
    // STATE
    // ================================

    /// @notice Registry for looking up vault addresses
    address public registry;
    
    /// @notice Mapping of ■TOKEN (Base) → SPL mint (Solana, as bytes32)
    mapping(address => bytes32) public tokenToSolanaMint;
    
    /// @notice Mapping of SPL mint (Solana) → ■TOKEN (Base)
    mapping(bytes32 => address) public solanaMintToToken;
    
    /// @notice Registered token decimals (Base token decimals and Solana mint decimals).
    /// @dev The Base↔Solana bridge expresses amounts in *remote* units (`uint64`), so we track decimals to avoid ambiguity.
    mapping(address => uint8) public tokenToBaseDecimals;
    mapping(address => uint8) public tokenToSolanaDecimals;

    /// @notice Mapping of Solana address → Twin contract address on Base
    mapping(bytes32 => address) public solanaTwinMapping;
    
    /// @notice Whether a token is registered for Solana bridging
    mapping(address => bool) public isRegistered;

    /// @notice Allowed CCA auction contracts for Solana-originated bids/claims/exits.
    /// @dev Must be configured by the adapter owner.
    mapping(address => bool) public allowedCcaAuctions;

    // ================================
    // EVENTS
    // ================================

    event TokenRegistered(address indexed baseToken, bytes32 indexed solanaMint);
    event BridgeToSolana(address indexed from, bytes32 indexed to, address token, uint256 amount);
    event BridgeFromSolana(bytes32 indexed from, address indexed to, address token, uint256 amount);
    event TwinMapped(bytes32 indexed solanaAddress, address indexed twinAddress);

    event CcaAuctionAllowed(address indexed auction, bool allowed);
    
    // CCA Events
    event CCABidFromSolana(address indexed twin, address indexed auction, uint256 bidId, uint128 amount, uint256 ethValue);
    event CCAClaimed(address indexed twin, address indexed auction, uint256 bidId);
    event CCAExited(address indexed twin, address indexed auction, uint256 bidId);
    
    // Lottery Events
    event LotteryEntryFromSolana(address indexed twin, address indexed recipient, address wsToken, uint256 amount);

    // ================================
    // ERRORS
    // ================================

    error TokenNotRegistered();
    error CreatorCoinNotRegistered(address creatorToken);
    error VaultNotConfigured(address creatorToken);
    error VaultAssetMismatch(address vault, address expectedAsset, address actualAsset);
    error DexRouterNotConfigured(uint16 chainId);
    error CcaAuctionNotAllowed(address auction);
    error InvalidAmount();
    error InvalidAddress();
    error UnauthorizedTwin(address caller, address expectedTwin);
    error BridgeFailed();

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(address _registry, address _owner) Ownable(_owner) {
        registry = _registry;
    }

    // ================================
    // AUTH (SOLANA → BASE)
    // ================================

    /**
     * @dev Solana-originated calls MUST be executed by the deterministic Twin contract
     *      for the provided Solana pubkey.
     */
    modifier onlyTwin(bytes32 solanaPubkey) {
        if (solanaPubkey == bytes32(0)) revert InvalidAddress();
        address expected = IBaseSolanaBridge(BRIDGE).getPredictedTwinAddress(solanaPubkey);
        if (msg.sender != expected) revert UnauthorizedTwin(msg.sender, expected);
        _;
    }

    // ================================
    // REGISTRATION
    // ================================

    /**
     * @notice Register a wsToken for Solana bridging
     * @dev Creates a wrapped SPL token on Solana via the bridge
     * @param baseToken The wsToken address on Base
     * @param solanaMint The SPL token mint address on Solana (as bytes32)
     * @param solanaDecimals The SPL token decimals on Solana
     */
    function registerToken(
        address baseToken,
        bytes32 solanaMint,
        uint8 solanaDecimals
    ) external onlyOwner {
        if (baseToken == address(0)) revert InvalidAddress();
        if (solanaMint == bytes32(0)) revert InvalidAddress();

        uint8 baseDecimals = IERC20Metadata(baseToken).decimals();
        
        tokenToSolanaMint[baseToken] = solanaMint;
        solanaMintToToken[solanaMint] = baseToken;
        isRegistered[baseToken] = true;

        tokenToBaseDecimals[baseToken] = baseDecimals;
        tokenToSolanaDecimals[baseToken] = solanaDecimals;
        
        emit TokenRegistered(baseToken, solanaMint);
    }

    /**
     * @notice Deploy a wrapped token on Base for a Solana SPL token
     * @param solanaMint SPL token mint address
     * @param name Token name
     * @param symbol Token symbol
     * @param decimals Token decimals
     * @return wrappedToken The deployed wrapped token address
     */
    function deployWrappedToken(
        bytes32 solanaMint,
        string calldata name,
        string calldata symbol,
        uint8 decimals
    ) external onlyOwner returns (address wrappedToken) {
        if (solanaMint == bytes32(0)) revert InvalidAddress();
        wrappedToken = ICrossChainERC20Factory(TOKEN_FACTORY).deploy(
            solanaMint,
            name,
            symbol,
            decimals
        );
        
        solanaMintToToken[solanaMint] = wrappedToken;
        tokenToSolanaMint[wrappedToken] = solanaMint;
        isRegistered[wrappedToken] = true;

        // Cross-chain wrapped tokens should mirror Solana decimals.
        tokenToBaseDecimals[wrappedToken] = decimals;
        tokenToSolanaDecimals[wrappedToken] = decimals;
        
        emit TokenRegistered(wrappedToken, solanaMint);
    }

    // ================================
    // BRIDGE TO SOLANA
    // ================================

    /**
     * @notice Bridge wsTokens from Base to Solana
     * @param token The wsToken to bridge
     * @param amount Amount to bridge
     * @param solanaDestination Destination address on Solana (as bytes32)
     */
    function bridgeToSolana(
        address token,
        uint256 amount,
        bytes32 solanaDestination
    ) external payable nonReentrant {
        if (!isRegistered[token]) revert TokenNotRegistered();
        if (amount == 0) revert InvalidAmount();
        if (solanaDestination == bytes32(0)) revert InvalidAddress();
        
        bytes32 solanaMint = tokenToSolanaMint[token];
        if (solanaMint == bytes32(0)) revert InvalidAddress();

        uint8 baseDecimals = tokenToBaseDecimals[token];
        uint8 solanaDecimals = tokenToSolanaDecimals[token];
        
        // Pull tokens from user
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve bridge
        IERC20(token).forceApprove(BRIDGE, amount);
        
        // Build transfer struct
        // NOTE: The Base↔Solana bridge expects `remoteAmount` in *remote* token units (uint64).
        // We convert Base token units → Solana token units *exactly* (reverting if rounding would be required).
        IBaseSolanaBridge.Transfer memory transfer = IBaseSolanaBridge.Transfer({
            localToken: token,
            remoteToken: solanaMint,
            to: solanaDestination,
            remoteAmount: _toRemoteAmountExact(amount, baseDecimals, solanaDecimals)
        });
        
        // Bridge with no additional calls
        IBaseSolanaBridge.Ix[] memory ixs = new IBaseSolanaBridge.Ix[](0);
        IBaseSolanaBridge(BRIDGE).bridgeToken{value: msg.value}(transfer, ixs);
        
        emit BridgeToSolana(msg.sender, solanaDestination, token, amount);
    }

    /**
     * @notice Bridge SOL from Base to Solana
     * @param amount Amount of SOL to bridge
     * @param solanaDestination Destination on Solana
     */
    function bridgeSOLToSolana(
        uint256 amount,
        bytes32 solanaDestination
    ) external payable nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (solanaDestination == bytes32(0)) revert InvalidAddress();
        
        // Pull SOL tokens from user
        IERC20(SOL_ON_BASE).safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve bridge
        IERC20(SOL_ON_BASE).forceApprove(BRIDGE, amount);
        
        // Native SOL on Solana uses the bridge's sentinel pubkey.
        bytes32 solMint = NATIVE_SOL_PUBKEY;
        
        IBaseSolanaBridge.Transfer memory transfer = IBaseSolanaBridge.Transfer({
            localToken: SOL_ON_BASE,
            remoteToken: solMint,
            to: solanaDestination,
            remoteAmount: _toUint64(amount) // SOL-on-Base uses 9 decimals (lamports), matching Solana.
        });
        
        IBaseSolanaBridge.Ix[] memory ixs = new IBaseSolanaBridge.Ix[](0);
        IBaseSolanaBridge(BRIDGE).bridgeToken{value: msg.value}(transfer, ixs);
        
        emit BridgeToSolana(msg.sender, solanaDestination, SOL_ON_BASE, amount);
    }

    // ================================
    // RECEIVE FROM SOLANA
    // ================================

    /**
     * @notice Called by Twin contracts to deposit into vault
     * @dev Solana users can call this via the bridge with attached call
     * @param creatorToken The Creator Coin (vault asset) to deposit
     * @param amount Amount to deposit
     * @param recipient Who receives the vault shares
     */
    function depositFromSolana(
        bytes32 solanaPubkey,
        address creatorToken,
        uint256 amount,
        address recipient
    ) external nonReentrant onlyTwin(solanaPubkey) returns (uint256 shares) {
        if (creatorToken == address(0)) revert InvalidAddress();
        if (recipient == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        // Resolve the canonical vault from the registry.
        if (!ICreatorRegistry(registry).isCreatorCoinRegistered(creatorToken)) revert CreatorCoinNotRegistered(creatorToken);
        address vault = ICreatorRegistry(registry).getVaultForToken(creatorToken);
        if (vault == address(0)) revert VaultNotConfigured(creatorToken);

        // Sanity check: vault.asset() must equal creatorToken.
        address asset = IERC4626Deposit(vault).asset();
        if (asset != creatorToken) revert VaultAssetMismatch(vault, creatorToken, asset);

        // Pull tokens from Twin (user must have bridged creatorToken to their Twin first).
        IERC20(creatorToken).safeTransferFrom(msg.sender, address(this), amount);

        // Approve vault and deposit.
        IERC20(creatorToken).forceApprove(vault, amount);
        shares = IERC4626Deposit(vault).deposit(amount, recipient);

        emit BridgeFromSolana(solanaPubkey, recipient, creatorToken, amount);
    }

    // ================================
    // CCA PARTICIPATION (SOLANA USERS)
    // ================================

    /**
     * @notice Submit a CCA bid on behalf of a Solana user
     * @dev Called by Twin contract via bridge with attached call
     * 
     * @param ccaAuction The CCA auction contract address
     * @param maxPrice Maximum price willing to pay (Q96 format)
     * @param amount Amount of tokens to bid for
     * @param prevTickPrice Previous tick price for placement
     * 
     * @return bidId The ID of the submitted bid
     * 
     * @dev FLOW FOR SOLANA USERS:
     *      1. User bridges SOL from Solana to Base with attached call
     *      2. Bridge mints SOL on Base to Twin contract
     *      3. Twin contract calls this function
     *      4. This contract submits bid to CCA on user's behalf
     *      5. Bid ownership is assigned to Twin contract (user controls)
     */
    function submitCCABidFromSolana(
        bytes32 solanaPubkey,
        address ccaAuction,
        uint256 maxPrice,
        uint128 amount,
        uint256 prevTickPrice
    ) external payable nonReentrant onlyTwin(solanaPubkey) returns (uint256 bidId) {
        if (ccaAuction == address(0)) revert InvalidAddress();
        if (!allowedCcaAuctions[ccaAuction]) revert CcaAuctionNotAllowed(ccaAuction);
        if (amount == 0) revert InvalidAmount();
        
        // msg.sender is the Twin contract (controlled by Solana user)
        address twinContract = msg.sender;
        
        // Submit bid to CCA - the Twin contract becomes the bid owner
        bidId = ICCAuction(ccaAuction).submitBid{value: msg.value}(
            maxPrice,
            amount,
            twinContract, // Owner is the Twin (Solana user controls this)
            prevTickPrice,
            "" // No hook data
        );
        
        emit CCABidFromSolana(twinContract, ccaAuction, bidId, amount, msg.value);
    }

    /**
     * @notice Claim tokens from a graduated CCA auction
     * @dev Called by Twin contract after auction graduates
     * @param ccaAuction The CCA auction contract
     * @param bidId The bid ID to claim
     */
    function claimCCATokensFromSolana(
        bytes32 solanaPubkey,
        address ccaAuction,
        uint256 bidId
    ) external nonReentrant onlyTwin(solanaPubkey) {
        if (ccaAuction == address(0)) revert InvalidAddress();
        if (!allowedCcaAuctions[ccaAuction]) revert CcaAuctionNotAllowed(ccaAuction);
        
        // Claim tokens - they go to the bid owner (Twin contract)
        ICCAuction(ccaAuction).claimTokens(bidId);
        
        emit CCAClaimed(msg.sender, ccaAuction, bidId);
    }

    /**
     * @notice Exit a CCA bid and reclaim ETH
     * @param ccaAuction The CCA auction contract
     * @param bidId The bid ID to exit
     */
    function exitCCABidFromSolana(
        bytes32 solanaPubkey,
        address ccaAuction,
        uint256 bidId
    ) external nonReentrant onlyTwin(solanaPubkey) {
        if (ccaAuction == address(0)) revert InvalidAddress();
        if (!allowedCcaAuctions[ccaAuction]) revert CcaAuctionNotAllowed(ccaAuction);
        
        ICCAuction(ccaAuction).exitBid(bidId);
        
        emit CCAExited(msg.sender, ccaAuction, bidId);
    }

    // ================================
    // LOTTERY PARTICIPATION (SOLANA USERS)
    // ================================

    /**
     * @notice Buy wsToken on Uniswap V4 to enter the lottery
     * @dev This triggers a lottery entry for the Solana user!
     * 
     * @param creatorToken The Creator Coin whose ShareOFT should be purchased (resolved via registry)
     * @param amountIn Amount of SOL (or other token) to spend
     * @param amountOutMin Minimum wsToken to receive
     * @param recipient Who receives the wsToken (usually Twin contract)
     * 
     * @return amountOut Amount of wsToken received
     * 
     * @dev LOTTERY ENTRY FLOW:
     *      1. Solana user bridges SOL with attached call to this function
     *      2. This contract swaps SOL for wsToken on Uniswap V4
     *      3. The wsToken transfer triggers the 6.9% fee hook
     *      4. Hook registers a lottery entry for the buyer
     *      5. Solana user is now in the jackpot draw!
     */
    function buyAndEnterLottery(
        bytes32 solanaPubkey,
        address creatorToken,
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external nonReentrant onlyTwin(solanaPubkey) returns (uint256 amountOut) {
        if (creatorToken == address(0) || tokenIn == address(0) || recipient == address(0)) revert InvalidAddress();
        if (amountIn == 0) revert InvalidAmount();

        if (!ICreatorRegistry(registry).isCreatorCoinRegistered(creatorToken)) revert CreatorCoinNotRegistered(creatorToken);
        address wsToken = ICreatorRegistry(registry).getShareOFTForToken(creatorToken);
        if (wsToken == address(0)) revert InvalidAddress();

        ICreatorRegistry.ChainConfig memory cfg = ICreatorRegistry(registry).getChainConfig(uint16(block.chainid));
        if (cfg.chainId == 0 || cfg.swapRouter == address(0)) revert DexRouterNotConfigured(uint16(block.chainid));
        address router = cfg.swapRouter;
        
        // Pull input tokens from Twin contract
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve router
        IERC20(tokenIn).forceApprove(router, amountIn);
        
        // Swap on Uniswap V4 - this triggers lottery entry via the tax hook!
        IUniswapV4Router.ExactInputSingleParams memory params = IUniswapV4Router.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: wsToken,
            fee: 3000, // 0.3% fee tier
            recipient: recipient,
            amountIn: amountIn,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = IUniswapV4Router(router).exactInputSingle(params);
        
        emit LotteryEntryFromSolana(msg.sender, recipient, wsToken, amountOut);
    }

    /**
     * @notice Buy wsToken with native ETH to enter lottery
     * @dev For users who bridged ETH or have ETH in their Twin
     */
    function buyAndEnterLotteryWithETH(
        bytes32 solanaPubkey,
        address creatorToken,
        uint256 amountOutMin,
        address recipient
    ) external payable nonReentrant onlyTwin(solanaPubkey) returns (uint256 amountOut) {
        if (creatorToken == address(0) || recipient == address(0)) revert InvalidAddress();
        if (msg.value == 0) revert InvalidAmount();

        if (!ICreatorRegistry(registry).isCreatorCoinRegistered(creatorToken)) revert CreatorCoinNotRegistered(creatorToken);
        address wsToken = ICreatorRegistry(registry).getShareOFTForToken(creatorToken);
        if (wsToken == address(0)) revert InvalidAddress();

        ICreatorRegistry.ChainConfig memory cfg = ICreatorRegistry(registry).getChainConfig(uint16(block.chainid));
        if (cfg.chainId == 0 || cfg.swapRouter == address(0)) revert DexRouterNotConfigured(uint16(block.chainid));
        address router = cfg.swapRouter;
        address weth = cfg.wrappedNativeToken;
        if (weth == address(0)) revert InvalidAddress();

        // Wrap ETH → WETH and swap WETH for wsToken.
        // NOTE: this assumes the configured swapRouter expects ERC20 input.
        IWETH(weth).deposit{value: msg.value}();
        IERC20(weth).forceApprove(router, msg.value);
        
        // Swap WETH for wsToken - triggers lottery!
        IUniswapV4Router.ExactInputSingleParams memory params = IUniswapV4Router.ExactInputSingleParams({
            tokenIn: weth,
            tokenOut: wsToken,
            fee: 3000,
            recipient: recipient,
            amountIn: msg.value,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = IUniswapV4Router(router).exactInputSingle(params);
        
        emit LotteryEntryFromSolana(msg.sender, recipient, wsToken, amountOut);
    }

    // ================================
    // COMBINED FLOWS (BRIDGE + ACTION)
    // ================================

    /**
     * @notice Generate calldata for bridge + CCA bid in one Solana tx
     * @dev Use this to build the call attached to bridge transaction
     * 
     * @param ccaAuction CCA auction address
     * @param maxPrice Max price for bid
     * @param amount Token amount to bid for
     * @param prevTickPrice Previous tick
     * 
     * @return calldata The encoded function call
     */
    function encodeCCABidCall(
        bytes32 solanaPubkey,
        address ccaAuction,
        uint256 maxPrice,
        uint128 amount,
        uint256 prevTickPrice,
        uint256 /* ethValue */
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(
            this.submitCCABidFromSolana.selector,
            solanaPubkey,
            ccaAuction,
            maxPrice,
            amount,
            prevTickPrice
        );
    }

    /**
     * @notice Generate calldata for a one-time ERC20 approve from the Twin.
     * @dev Use this to approve the adapter before calling functions that use `transferFrom`.
     *      Target for the EVM call should be the ERC20 token contract.
     */
    function encodeErc20ApproveCall(address spender, uint256 amount) external pure returns (bytes memory) {
        return abi.encodeWithSelector(bytes4(0x095ea7b3), spender, amount);
    }

    function encodeDepositFromSolanaCall(
        bytes32 solanaPubkey,
        address creatorToken,
        uint256 amount,
        address recipient
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(this.depositFromSolana.selector, solanaPubkey, creatorToken, amount, recipient);
    }

    /**
     * @notice Generate calldata for bridge + lottery entry in one Solana tx
     * @dev Use this to build the call attached to bridge transaction
     */
    function encodeLotteryEntryCall(
        bytes32 solanaPubkey,
        address creatorToken,
        address tokenIn,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(
            this.buyAndEnterLottery.selector,
            solanaPubkey,
            creatorToken,
            tokenIn,
            amountIn,
            amountOutMin,
            recipient
        );
    }

    function encodeLotteryEntryWithETHCall(
        bytes32 solanaPubkey,
        address creatorToken,
        uint256 amountOutMin,
        address recipient
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(this.buyAndEnterLotteryWithETH.selector, solanaPubkey, creatorToken, amountOutMin, recipient);
    }

    // ================================
    // TWIN CONTRACT HELPERS
    // ================================

    /**
     * @notice Get the deterministic Twin contract address for a Solana wallet
     * @dev Uses Base bridge's canonical prediction function.
     * @param solanaAddress The Solana wallet pubkey (bytes32)
     * @return twin The Twin contract address on Base
     */
    function getTwinAddress(bytes32 solanaAddress) external view returns (address twin) {
        if (solanaAddress == bytes32(0)) revert InvalidAddress();
        twin = IBaseSolanaBridge(BRIDGE).getPredictedTwinAddress(solanaAddress);
    }

    /**
     * @notice Store Twin mapping for reference
     * @param solanaAddress Solana address
     * @param twinAddress Twin contract on Base
     */
    function mapTwin(bytes32 solanaAddress, address twinAddress) external onlyOwner {
        solanaTwinMapping[solanaAddress] = twinAddress;
        emit TwinMapped(solanaAddress, twinAddress);
    }

    // ================================
    // INTERNAL HELPERS
    // ================================

    /**
     * @dev Convert a Base token amount (local units) to a Solana remote amount (remote units) exactly.
     *
     * Rounding rules:
     * - If conversion would require rounding DOWN (baseDecimals > solanaDecimals and dust exists), revert.
     * - If conversion would overflow uint256 or uint64, revert.
     *
     * This keeps bridged amounts unambiguous and prevents silent value loss.
     */
    function _toRemoteAmountExact(uint256 baseAmount, uint8 baseDecimals, uint8 solanaDecimals) internal pure returns (uint64) {
        if (baseAmount == 0) revert InvalidAmount();

        if (baseDecimals == solanaDecimals) return _toUint64(baseAmount);

        if (solanaDecimals > baseDecimals) {
            uint256 diff = uint256(solanaDecimals - baseDecimals);
            if (diff > 77) revert InvalidAmount();
            uint256 factor = 10 ** diff;
            uint256 remote = baseAmount * factor;
            if (remote / factor != baseAmount) revert InvalidAmount();
            return _toUint64(remote);
        }

        uint256 diff = uint256(baseDecimals - solanaDecimals);
        if (diff > 77) revert InvalidAmount();
        uint256 factor = 10 ** diff;
        if (baseAmount % factor != 0) revert InvalidAmount();
        return _toUint64(baseAmount / factor);
    }

    function _toUint64(uint256 v) internal pure returns (uint64) {
        if (v > type(uint64).max) revert InvalidAmount();
        return uint64(v);
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================

    /**
     * @notice Get the Solana mint for a Base token
     */
    function getSolanaMint(address baseToken) external view returns (bytes32) {
        return tokenToSolanaMint[baseToken];
    }

    /**
     * @notice Get the Base token for a Solana mint
     */
    function getBaseToken(bytes32 solanaMint) external view returns (address) {
        return solanaMintToToken[solanaMint];
    }

    /**
     * @notice Check if a token can be bridged to Solana
     */
    function canBridgeToSolana(address token) external view returns (bool) {
        return isRegistered[token];
    }

    // ================================
    // ADMIN
    // ================================

    function setRegistry(address _registry) external onlyOwner {
        registry = _registry;
    }

    function setCcaAuctionAllowed(address auction, bool allowed) external onlyOwner {
        if (auction == address(0)) revert InvalidAddress();
        allowedCcaAuctions[auction] = allowed;
        emit CcaAuctionAllowed(auction, allowed);
    }

    /**
     * @notice Emergency withdraw stuck tokens
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
