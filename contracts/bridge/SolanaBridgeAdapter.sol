// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ICCAuction
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
 * @title ICreatorLotteryManager
 * @notice Interface for lottery entry
 */
interface ICreatorLotteryManager {
    function processSwapLottery(address recipient, address token, uint256 amount) external returns (uint256);
}

/**
 * @title IBaseSolanaBridge
 * @notice Interface for the Base-Solana bridge contract
 * @dev Production address: 0x3eff766C76a1be2Ce1aCF2B69c78bCae257D5188
 */
interface IBaseSolanaBridge {
    struct Transfer {
        address localToken;     // ERC20 token on Base
        bytes32 remoteToken;    // SPL token mint address (as bytes32)
        bytes32 to;             // Solana destination address (as bytes32)
        uint256 remoteAmount;   // Amount in remote token decimals
    }
    
    struct Call {
        bytes32 target;         // Solana program address
        bytes data;             // Instruction data
        uint256 value;          // SOL value (if any)
    }
    
    function bridgeToken(Transfer calldata transfer, Call[] calldata calls) external payable;
    function bridgeCall(Call[] calldata calls) external payable;
}

/**
 * @title ICrossChainERC20Factory
 * @notice Interface for deploying wrapped tokens
 * @dev Production address: 0xDD56781d0509650f8C2981231B6C917f2d5d7dF2
 */
interface ICrossChainERC20Factory {
    function deploy(
        bytes32 remoteToken,
        string calldata name,
        string calldata symbol,
        uint8 decimals
    ) external returns (address);
    
    function getToken(bytes32 remoteToken) external view returns (address);
}

/**
 * @title SolanaBridgeAdapter
 * @author 0xakita.eth (CreatorVault)
 * @notice Adapter for bridging CreatorVault tokens between Base and Solana
 * 
 * @dev USE CASES:
 *      1. Solana users deposit SOL → get wsTokens on Base
 *      2. Base users bridge wsTokens to Solana
 *      3. Cross-chain lottery entries from Solana
 * 
 * @dev BASE-SOLANA BRIDGE ARCHITECTURE:
 *      - Solana → Base: Lock SOL/SPL → Validators approve → Mint on Base
 *      - Base → Solana: Burn on Base → Generate proof → Unlock on Solana
 *      - Twin Contracts: Each Solana wallet has a deterministic Base address
 * 
 * @dev PRODUCTION ADDRESSES (Base Mainnet):
 *      Bridge: 0x3eff766C76a1be2Ce1aCF2B69c78bCae257D5188
 *      Factory: 0xDD56781d0509650f8C2981231B6C917f2d5d7dF2
 *      SOL Token: 0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82
 */
contract SolanaBridgeAdapter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // CONSTANTS
    // ================================

    /// @notice Base-Solana Bridge on Base Mainnet
    address public constant BRIDGE = 0x3eff766C76a1be2Ce1aCF2B69c78bCae257D5188;
    
    /// @notice CrossChainERC20Factory for wrapped tokens
    address public constant TOKEN_FACTORY = 0xDD56781d0509650f8C2981231B6C917f2d5d7dF2;
    
    /// @notice Wrapped SOL on Base
    address public constant SOL_ON_BASE = 0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82;

    // ================================
    // STATE
    // ================================

    /// @notice Registry for looking up vault addresses
    address public registry;
    
    /// @notice Mapping of wsToken (Base) → SPL mint (Solana, as bytes32)
    mapping(address => bytes32) public tokenToSolanaMint;
    
    /// @notice Mapping of SPL mint (Solana) → wsToken (Base)
    mapping(bytes32 => address) public solanaMintToToken;
    
    /// @notice Mapping of Solana address → Twin contract address on Base
    mapping(bytes32 => address) public solanaTwinMapping;
    
    /// @notice Whether a token is registered for Solana bridging
    mapping(address => bool) public isRegistered;

    // ================================
    // EVENTS
    // ================================

    event TokenRegistered(address indexed baseToken, bytes32 indexed solanaMint);
    event BridgeToSolana(address indexed from, bytes32 indexed to, address token, uint256 amount);
    event BridgeFromSolana(bytes32 indexed from, address indexed to, address token, uint256 amount);
    event TwinMapped(bytes32 indexed solanaAddress, address indexed twinAddress);
    
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
    error InvalidAmount();
    error InvalidAddress();
    error BridgeFailed();

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(address _registry, address _owner) Ownable(_owner) {
        registry = _registry;
    }

    // ================================
    // REGISTRATION
    // ================================

    /**
     * @notice Register a wsToken for Solana bridging
     * @dev Creates a wrapped SPL token on Solana via the bridge
     * @param baseToken The wsToken address on Base
     * @param solanaMint The SPL token mint address on Solana (as bytes32)
     */
    function registerToken(
        address baseToken,
        bytes32 solanaMint
    ) external onlyOwner {
        if (baseToken == address(0)) revert InvalidAddress();
        
        tokenToSolanaMint[baseToken] = solanaMint;
        solanaMintToToken[solanaMint] = baseToken;
        isRegistered[baseToken] = true;
        
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
        wrappedToken = ICrossChainERC20Factory(TOKEN_FACTORY).deploy(
            solanaMint,
            name,
            symbol,
            decimals
        );
        
        solanaMintToToken[solanaMint] = wrappedToken;
        tokenToSolanaMint[wrappedToken] = solanaMint;
        isRegistered[wrappedToken] = true;
        
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
    ) external nonReentrant {
        if (!isRegistered[token]) revert TokenNotRegistered();
        if (amount == 0) revert InvalidAmount();
        if (solanaDestination == bytes32(0)) revert InvalidAddress();
        
        bytes32 solanaMint = tokenToSolanaMint[token];
        
        // Pull tokens from user
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve bridge
        IERC20(token).forceApprove(BRIDGE, amount);
        
        // Build transfer struct
        IBaseSolanaBridge.Transfer memory transfer = IBaseSolanaBridge.Transfer({
            localToken: token,
            remoteToken: solanaMint,
            to: solanaDestination,
            remoteAmount: amount // Assumes same decimals
        });
        
        // Bridge with no additional calls
        IBaseSolanaBridge.Call[] memory calls = new IBaseSolanaBridge.Call[](0);
        IBaseSolanaBridge(BRIDGE).bridgeToken(transfer, calls);
        
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
    ) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (solanaDestination == bytes32(0)) revert InvalidAddress();
        
        // Pull SOL tokens from user
        IERC20(SOL_ON_BASE).safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve bridge
        IERC20(SOL_ON_BASE).forceApprove(BRIDGE, amount);
        
        // SOL mint address on Solana (native SOL wrapped)
        bytes32 solMint = bytes32(0); // Native SOL
        
        IBaseSolanaBridge.Transfer memory transfer = IBaseSolanaBridge.Transfer({
            localToken: SOL_ON_BASE,
            remoteToken: solMint,
            to: solanaDestination,
            remoteAmount: amount
        });
        
        IBaseSolanaBridge.Call[] memory calls = new IBaseSolanaBridge.Call[](0);
        IBaseSolanaBridge(BRIDGE).bridgeToken(transfer, calls);
        
        emit BridgeToSolana(msg.sender, solanaDestination, SOL_ON_BASE, amount);
    }

    // ================================
    // RECEIVE FROM SOLANA
    // ================================

    /**
     * @notice Called by Twin contracts to deposit into vault
     * @dev Solana users can call this via the bridge with attached call
     * @param vault The vault to deposit into
     * @param token The token to deposit
     * @param amount Amount to deposit
     * @param recipient Who receives the vault shares
     */
    function depositFromSolana(
        address vault,
        address token,
        uint256 amount,
        address recipient
    ) external nonReentrant {
        // This would be called from a Twin contract
        // The Twin contract is msg.sender
        
        // Pull tokens (user must have bridged tokens to their Twin first)
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Approve vault
        IERC20(token).forceApprove(vault, amount);
        
        // Deposit into vault
        // Note: This assumes vault has a deposit function
        // In practice, this would call the CreatorOVaultWrapper
        (bool success,) = vault.call(
            abi.encodeWithSignature("deposit(uint256,address)", amount, recipient)
        );
        
        if (!success) revert BridgeFailed();
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
        address ccaAuction,
        uint256 maxPrice,
        uint128 amount,
        uint256 prevTickPrice
    ) external payable nonReentrant returns (uint256 bidId) {
        if (ccaAuction == address(0)) revert InvalidAddress();
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
        address ccaAuction,
        uint256 bidId
    ) external nonReentrant {
        if (ccaAuction == address(0)) revert InvalidAddress();
        
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
        address ccaAuction,
        uint256 bidId
    ) external nonReentrant {
        if (ccaAuction == address(0)) revert InvalidAddress();
        
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
     * @param router Uniswap V4 router address
     * @param wsToken The wsToken to buy (lottery token)
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
        address router,
        address tokenIn,
        address wsToken,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external nonReentrant returns (uint256 amountOut) {
        if (router == address(0) || wsToken == address(0)) revert InvalidAddress();
        if (amountIn == 0) revert InvalidAmount();
        
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
        address router,
        address wsToken,
        uint256 amountOutMin,
        address recipient
    ) external payable nonReentrant returns (uint256 amountOut) {
        if (router == address(0) || wsToken == address(0)) revert InvalidAddress();
        if (msg.value == 0) revert InvalidAmount();
        
        // Swap ETH for wsToken - triggers lottery!
        IUniswapV4Router.ExactInputSingleParams memory params = IUniswapV4Router.ExactInputSingleParams({
            tokenIn: address(0), // ETH
            tokenOut: wsToken,
            fee: 3000,
            recipient: recipient,
            amountIn: msg.value,
            amountOutMinimum: amountOutMin,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = IUniswapV4Router(router).exactInputSingle{value: msg.value}(params);
        
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
     * @param ethValue ETH value to send with bid
     * 
     * @return calldata The encoded function call
     */
    function encodeCCABidCall(
        address ccaAuction,
        uint256 maxPrice,
        uint128 amount,
        uint256 prevTickPrice,
        uint256 /* ethValue */
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(
            this.submitCCABidFromSolana.selector,
            ccaAuction,
            maxPrice,
            amount,
            prevTickPrice
        );
    }

    /**
     * @notice Generate calldata for bridge + lottery entry in one Solana tx
     * @dev Use this to build the call attached to bridge transaction
     */
    function encodeLotteryEntryCall(
        address router,
        address tokenIn,
        address wsToken,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external pure returns (bytes memory) {
        return abi.encodeWithSelector(
            this.buyAndEnterLottery.selector,
            router,
            tokenIn,
            wsToken,
            amountIn,
            amountOutMin,
            recipient
        );
    }

    // ================================
    // TWIN CONTRACT HELPERS
    // ================================

    /**
     * @notice Get the deterministic Twin contract address for a Solana wallet
     * @dev Twin addresses are deterministically derived from Solana pubkeys
     * @param solanaAddress The Solana wallet address (as bytes32)
     * @return twin The Twin contract address on Base
     */
    function getTwinAddress(bytes32 solanaAddress) external pure returns (address twin) {
        // Twin contract derivation formula from Base-Solana bridge
        // This is a simplified version - actual derivation may differ
        twin = address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            BRIDGE,
            solanaAddress,
            bytes32(0) // Creation code hash placeholder
        )))));
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


