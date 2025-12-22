// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OAppCore} from "@layerzerolabs/oapp-evm/contracts/oapp/OAppCore.sol";
import {Origin} from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import {IOFT, SendParam, MessagingReceipt, MessagingFee} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/interfaces/IOFT.sol";
import {IOmniDragonRegistry} from "../../interfaces/config/IOmniDragonRegistry.sol";

/**
 * @notice Interface for DragonVaultWrapper
 */
interface IDragonOVaultWrapper {
    function wrap(uint256 amount) external returns (uint256);
    function unwrap(uint256 amount) external returns (uint256);
    function wrapFee() external view returns (uint256);
    function unwrapFee() external view returns (uint256);
    function BASIS_POINTS() external view returns (uint256);
    function previewWrap(uint256 amount, address user) external view returns (uint256);
    function previewUnwrap(uint256 amount, address user) external view returns (uint256);
}

/**
 * @title DragonOVaultComposer
 * @author 0xakita.eth
 * @notice Unified composer for DragonOVault with wrapper integration
 * 
 * @dev ARCHITECTURE:
 *      - Combines local operations (depositAndWrap, unwrapAndRedeem)
 *      - LayerZero cross-chain compose operations
 *      - Integrates with DragonVaultWrapper pattern
 *      - Uses OmniDragonRegistry for endpoint management
 * 
 * @dev USER EXPERIENCE:
 *      Users ONLY see: omniDRAGON → baseDRAGON → omniDRAGON
 *      Hidden: omniDRAGON → Vault → dragonVAULT → Wrapper → baseDRAGON
 * 
 * @dev OPERATION TYPES:
 *      1. Local: depositAndWrap() - omniDRAGON → baseDRAGON (same chain)
 *      2. Local: unwrapAndRedeem() - baseDRAGON → omniDRAGON (same chain)
 *      3. Cross-chain: deposit on Base, bridge baseDRAGON anywhere
 *      4. Cross-chain: receive baseDRAGON, redeem for omniDRAGON
 * 
 * Deploy ONLY on Base (hub chain).
 */
contract DragonOVaultComposer is OAppCore, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =================================
    // STATE VARIABLES
    // =================================

    /// @notice The ERC4626 vault contract (DragonOVault)
    IERC4626 public immutable VAULT;

    /// @notice The underlying asset (omniDRAGON)
    IERC20 public immutable DRAGON;

    /// @notice The share OFT (baseDRAGON)
    address public immutable SHARE_OFT;

    /// @notice The vault wrapper
    IDragonOVaultWrapper public immutable WRAPPER;

    /// @notice OmniDragon Registry
    IOmniDragonRegistry public immutable REGISTRY;

    /// @notice Hub chain endpoint ID (Base = 30184)
    uint32 public immutable HUB_EID;

    /// @notice Vault shares ERC20 (dragonVAULT)
    IERC20 public immutable VAULT_SHARES;

    // =================================
    // EVENTS
    // =================================

    // Local operations
    event DepositedAndWrapped(address indexed user, uint256 dragonIn, uint256 baseDragonOut);
    event UnwrappedAndRedeemed(address indexed user, uint256 baseDragonIn, uint256 dragonOut);
    
    // Cross-chain operations
    event DepositedAndBridged(
        address indexed user,
        uint256 dragonIn,
        uint256 baseDragonOut,
        uint32 dstEid,
        bytes32 recipient
    );
    event ReceivedAndRedeemed(
        bytes32 indexed guid,
        address indexed recipient,
        uint256 baseDragonIn,
        uint256 dragonOut
    );
    event Refunded(bytes32 indexed guid, address indexed recipient, uint256 amount);

    // =================================
    // ERRORS
    // =================================

    error ZeroAmount();
    error ZeroAddress();
    error OnlyEndpoint(address caller);
    error OnlySelf(address caller);
    error InsufficientMsgValue(uint256 expected, uint256 actual);
    error SlippageExceeded(uint256 amountLD, uint256 minAmountLD);

    // =================================
    // CONSTRUCTOR
    // =================================

    /**
     * @param _vault DragonOVault address
     * @param _shareOFT baseDRAGON address (DragonShareOFT)
     * @param _wrapper DragonVaultWrapper address
     * @param _registry OmniDragonRegistry address
     * @param _owner Admin address
     */
    constructor(
        address _vault,
        address _shareOFT,
        address _wrapper,
        address _registry,
        address _owner
    ) OAppCore(
        IOmniDragonRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid)),
        _owner
    ) Ownable(_owner) {
        if (_vault == address(0)) revert ZeroAddress();
        if (_shareOFT == address(0)) revert ZeroAddress();
        if (_wrapper == address(0)) revert ZeroAddress();
        if (_registry == address(0)) revert ZeroAddress();

        VAULT = IERC4626(_vault);
        SHARE_OFT = _shareOFT;
        WRAPPER = IDragonOVaultWrapper(_wrapper);
        REGISTRY = IOmniDragonRegistry(_registry);

        DRAGON = IERC20(VAULT.asset());
        VAULT_SHARES = IERC20(_vault);

        // Get hub EID from registry
        HUB_EID = REGISTRY.getEidForChainId(uint16(block.chainid));

        // Grant infinite approvals for seamless operations
        DRAGON.approve(_vault, type(uint256).max);
        VAULT_SHARES.approve(_wrapper, type(uint256).max);
    }

    // =================================
    // LOCAL OPERATIONS (Base Only)
    // =================================

    /**
     * @notice Deposit omniDRAGON and receive baseDRAGON in ONE transaction
     * @dev LOCAL ONLY: For users on Base
     * 
     * @dev HIDDEN STEPS:
     *      1. Transfer omniDRAGON from user
     *      2. Deposit to vault → get dragonVAULT shares (HIDDEN!)
     *      3. Wrap dragonVAULT → get baseDRAGON OFT
     *      4. Transfer baseDRAGON to user
     * 
     * @dev USER SEES:
     *      omniDRAGON in → baseDRAGON out ✨
     * 
     * @param dragonAmount Amount of omniDRAGON to deposit
     * @param receiver Address to receive baseDRAGON
     * @return baseDragonAmount Amount of baseDRAGON received
     */
    function depositAndWrap(uint256 dragonAmount, address receiver) 
        external 
        nonReentrant 
        returns (uint256 baseDragonAmount) 
    {
        if (dragonAmount == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        // STEP 1: Take omniDRAGON from user
        DRAGON.safeTransferFrom(msg.sender, address(this), dragonAmount);

        // STEP 2: Deposit to vault → get dragonVAULT shares (HIDDEN!)
        uint256 vaultShares = VAULT.deposit(dragonAmount, address(this));

        // STEP 3: Wrap vault shares → baseDRAGON (HIDDEN!)
        uint256 balanceBefore = IERC20(SHARE_OFT).balanceOf(address(this));
        WRAPPER.wrap(vaultShares);
        baseDragonAmount = IERC20(SHARE_OFT).balanceOf(address(this)) - balanceBefore;

        // STEP 4: Send baseDRAGON to user
        IERC20(SHARE_OFT).safeTransfer(receiver, baseDragonAmount);

        emit DepositedAndWrapped(msg.sender, dragonAmount, baseDragonAmount);
    }

    /**
     * @notice Unwrap baseDRAGON and redeem for omniDRAGON in ONE transaction
     * @dev LOCAL ONLY: For users on Base
     * 
     * @dev HIDDEN STEPS:
     *      1. Transfer baseDRAGON from user
     *      2. Unwrap baseDRAGON → get dragonVAULT shares (HIDDEN!)
     *      3. Redeem dragonVAULT → get omniDRAGON
     *      4. Transfer omniDRAGON to user
     * 
     * @dev USER SEES:
     *      baseDRAGON in → omniDRAGON out ✨
     * 
     * @param baseDragonAmount Amount of baseDRAGON to redeem
     * @param receiver Address to receive omniDRAGON
     * @return dragonAmount Amount of omniDRAGON received
     */
    function unwrapAndRedeem(uint256 baseDragonAmount, address receiver)
        external
        nonReentrant
        returns (uint256 dragonAmount)
    {
        if (baseDragonAmount == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        // STEP 1: Take baseDRAGON from user
        IERC20(SHARE_OFT).safeTransferFrom(msg.sender, address(this), baseDragonAmount);

        // STEP 2: Unwrap baseDRAGON → dragonVAULT shares (HIDDEN!)
        uint256 vaultSharesBefore = VAULT_SHARES.balanceOf(address(this));
        WRAPPER.unwrap(baseDragonAmount);
        uint256 vaultShares = VAULT_SHARES.balanceOf(address(this)) - vaultSharesBefore;

        // STEP 3: Redeem vault shares → omniDRAGON (HIDDEN!)
        dragonAmount = VAULT.redeem(vaultShares, receiver, address(this));

        emit UnwrappedAndRedeemed(msg.sender, baseDragonAmount, dragonAmount);
    }

    // =================================
    // CROSS-CHAIN OPERATIONS
    // =================================

    /**
     * @notice Deposit omniDRAGON and bridge baseDRAGON to another chain
     * @dev Combines deposit + wrap + bridge in one transaction
     * 
     * Flow: omniDRAGON → Vault → dragonVAULT → Wrapper → baseDRAGON → Bridge
     */
    function depositWrapAndBridge(
        uint256 dragonAmount,
        uint256 minBaseDragonOut,
        SendParam calldata sendParam
    ) external payable nonReentrant returns (MessagingReceipt memory receipt) {
        if (dragonAmount == 0) revert ZeroAmount();

        // 1. Take omniDRAGON from user
        DRAGON.safeTransferFrom(msg.sender, address(this), dragonAmount);

        // 2. Deposit to vault
        uint256 vaultShares = VAULT.deposit(dragonAmount, address(this));

        // 3. Wrap to baseDRAGON
        uint256 balanceBefore = IERC20(SHARE_OFT).balanceOf(address(this));
        WRAPPER.wrap(vaultShares);
        uint256 baseDragonAmount = IERC20(SHARE_OFT).balanceOf(address(this)) - balanceBefore;

        // 4. Slippage check
        if (baseDragonAmount < minBaseDragonOut) {
            revert SlippageExceeded(baseDragonAmount, minBaseDragonOut);
        }

        // 5. Approve and bridge
        IERC20(SHARE_OFT).approve(SHARE_OFT, baseDragonAmount);
        
        SendParam memory updatedParam = sendParam;
        updatedParam.amountLD = baseDragonAmount;

        (receipt, ) = IOFT(SHARE_OFT).send{value: msg.value}(
            updatedParam,
            MessagingFee(msg.value, 0),
            msg.sender
        );

        emit DepositedAndBridged(
            msg.sender,
            dragonAmount,
            baseDragonAmount,
            sendParam.dstEid,
            sendParam.to
        );
    }

    // =================================
    // LAYERZERO COMPOSE HANDLER
    // =================================

    /**
     * @notice Handle incoming cross-chain baseDRAGON with compose message
     * @dev Called when baseDRAGON arrives with instructions to redeem
     */
    function lzCompose(
        address _oapp,
        bytes32 _guid,
        bytes calldata _message,
        address _executor,
        bytes calldata _extraData
    ) external payable {
        // Only endpoint can call
        if (msg.sender != address(endpoint)) revert OnlyEndpoint(msg.sender);

        // Decode compose message
        (uint64 nonce, uint32 srcEid, uint256 amountLD, bytes32 composeFrom, bytes memory composeMsg) = 
            abi.decode(_message, (uint64, uint32, uint256, bytes32, bytes));

        // Decode recipient from composeMsg
        address recipient = abi.decode(composeMsg, (address));

        // Try to redeem, refund on failure
        try this.handleRedemption(amountLD, recipient) returns (uint256 dragonOut) {
            emit ReceivedAndRedeemed(_guid, recipient, amountLD, dragonOut);
        } catch {
            // Refund baseDRAGON to recipient
            IERC20(SHARE_OFT).safeTransfer(recipient, amountLD);
            emit Refunded(_guid, recipient, amountLD);
        }
    }

    /**
     * @notice Internal handler for redemption (called in try-catch)
     */
    function handleRedemption(uint256 baseDragonAmount, address recipient) 
        external 
        returns (uint256 dragonAmount) 
    {
        if (msg.sender != address(this)) revert OnlySelf(msg.sender);

        // 1. Unwrap baseDRAGON → vault shares
        uint256 vaultSharesBefore = VAULT_SHARES.balanceOf(address(this));
        WRAPPER.unwrap(baseDragonAmount);
        uint256 vaultShares = VAULT_SHARES.balanceOf(address(this)) - vaultSharesBefore;

        // 2. Redeem vault shares → omniDRAGON
        dragonAmount = VAULT.redeem(vaultShares, recipient, address(this));
    }

    // =================================
    // VIEW FUNCTIONS
    // =================================

    /**
     * @notice Preview how much baseDRAGON you'll get for depositing omniDRAGON
     * @param dragonAmount Amount of omniDRAGON to deposit
     * @return baseDragonAmount Estimated baseDRAGON output
     */
    function previewDepositAndWrap(uint256 dragonAmount) 
        external 
        view 
        returns (uint256 baseDragonAmount) 
    {
        // 1. Preview vault deposit
        uint256 vaultShares = VAULT.previewDeposit(dragonAmount);
        
        // 2. Preview wrapper (with fees)
        baseDragonAmount = WRAPPER.previewWrap(vaultShares, msg.sender);
    }

    /**
     * @notice Preview how much omniDRAGON you'll get for redeeming baseDRAGON
     * @param baseDragonAmount Amount of baseDRAGON to redeem
     * @return dragonAmount Estimated omniDRAGON output
     */
    function previewUnwrapAndRedeem(uint256 baseDragonAmount)
        external
        view
        returns (uint256 dragonAmount)
    {
        // 1. Preview unwrap (with fees)
        uint256 vaultShares = WRAPPER.previewUnwrap(baseDragonAmount, msg.sender);
        
        // 2. Preview vault redeem
        dragonAmount = VAULT.previewRedeem(vaultShares);
    }

    /**
     * @notice Quote LayerZero fee for deposit + bridge
     */
    function quoteDepositWrapAndBridge(
        uint256 dragonAmount,
        SendParam calldata sendParam
    ) external view returns (MessagingFee memory fee) {
        uint256 vaultShares = VAULT.previewDeposit(dragonAmount);
        uint256 baseDragonAmount = WRAPPER.previewWrap(vaultShares, msg.sender);
        
        SendParam memory quoteSendParam = sendParam;
        quoteSendParam.amountLD = baseDragonAmount;
        
        fee = IOFT(SHARE_OFT).quoteSend(quoteSendParam, false);
    }

    /**
     * @notice Get all contract addresses
     */
    function getContracts() external view returns (
        address vault,
        address wrapper,
        address shareOFT,
        address dragon,
        address registry
    ) {
        return (
            address(VAULT),
            address(WRAPPER),
            SHARE_OFT,
            address(DRAGON),
            address(REGISTRY)
        );
    }

    // =================================
    // OAPP REQUIRED FUNCTIONS
    // =================================

    function oAppVersion() external pure returns (uint64 senderVersion, uint64 receiverVersion) {
        return (1, 1);
    }

    function allowInitializePath(Origin calldata) external pure returns (bool) {
        return true;
    }

    function nextNonce(uint32, bytes32) external pure returns (uint64) {
        return 0;
    }

    // =================================
    // EMERGENCY FUNCTIONS
    // =================================

    /**
     * @notice Emergency withdraw stuck tokens
     */
    function emergencyWithdraw(address token, address to, uint256 amount) 
        external 
        onlyOwner 
    {
        IERC20(token).safeTransfer(to, amount);
    }
}
