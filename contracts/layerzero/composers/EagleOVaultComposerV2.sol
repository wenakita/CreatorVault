// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { OAppCore } from "@layerzerolabs/oapp-evm/contracts/oapp/OAppCore.sol";
import { Origin } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { IOFT, SendParam, MessagingReceipt, MessagingFee } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { IEagleRegistry } from "../../interfaces/IEagleRegistry.sol";

/**
 * @notice Interface for EagleVaultWrapper
 */
interface IEagleVaultWrapper {
    function wrap(uint256 amount) external;
    function unwrap(uint256 amount) external;
    function depositFee() external view returns (uint256);
    function withdrawFee() external view returns (uint256);
    function BASIS_POINTS() external view returns (uint256);
}

/**
 * @title EagleOVaultComposerV2
 * @notice Enhanced composer with WLFI cross-chain support
 * 
 * @dev NEW FEATURES:
 *      - Supports WLFI OFT Adapter for cross-chain WLFI
 *      - Enables 1-tx composed flow: EAGLE (Base) → WLFI (Base)
 *      - Backward compatible with existing flows
 * 
 * @dev COMPOSED FLOW (NEW):
 *      1. User on Base: shareOFT.send() with composeMsg
 *      2. Ethereum Composer receives EAGLE
 *      3. Unwrap EAGLE → vEAGLE
 *      4. Redeem vEAGLE → WLFI
 *      5. Send WLFI back to Base via WLFIOFTAdapter
 * 
 * Deploy ONLY on hub chain (Ethereum).
 */
contract EagleOVaultComposerV2 is OAppCore, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =================================
    // STATE VARIABLES
    // =================================

    /// @notice The ERC4626 vault contract
    IERC4626 public immutable VAULT;

    /// @notice The share OFT for cross-chain share transfers (EAGLE)
    address public immutable SHARE_OFT;

    /// @notice The vault wrapper for share conversion
    IEagleVaultWrapper public immutable WRAPPER;

    /// @notice EagleRegistry for endpoint and chain info
    IEagleRegistry public immutable REGISTRY;

    /// @notice Hub chain endpoint ID
    uint32 public immutable VAULT_EID;

    /// @notice Vault shares ERC20
    IERC20 public immutable SHARE_ERC20;

    /// @notice WLFI token (native on Ethereum)
    IERC20 public immutable WLFI;

    /// @notice USD1 token
    IERC20 public immutable USD1;

    /// @notice WLFI OFT Adapter (for cross-chain WLFI transfers)
    address public immutable WLFI_ADAPTER;

    // =================================
    // EVENTS
    // =================================

    // Local operations
    event DepositedAndWrapped(address indexed user, uint256 assetsIn, uint256 eagleOut);
    event UnwrappedAndRedeemed(address indexed user, uint256 eagleIn, uint256 assetsOut);
    
    // LayerZero compose operations
    event Sent(bytes32 indexed guid);
    event Refunded(bytes32 indexed guid);
    event Deposited(bytes32 sender, bytes32 recipient, uint32 dstEid, uint256 assetAmt, uint256 shareAmt);
    event Redeemed(bytes32 sender, bytes32 recipient, uint32 dstEid, uint256 shareAmt, uint256 wlfiAmt, uint256 usd1Amt);
    event ComposerInitialized(address vault, address shareOFT, address wrapper, address wlfiAdapter);

    // =================================
    // ERRORS
    // =================================

    error ZeroAmount();
    error ZeroAddress();
    error OnlyEndpoint(address caller);
    error OnlySelf(address caller);
    error OnlyValidComposeCaller(address caller);
    error SlippageExceeded(uint256 amount, uint256 minAmount);
    error InsufficientMsgValue(uint256 required, uint256 provided);

    // =================================
    // INTERNAL HELPERS
    // =================================
    
    /**
     * @notice Get LayerZero endpoint from registry
     * @param _registry EagleRegistry address
     * @return LayerZero V2 endpoint address
     */
    function _getLzEndpoint(address _registry) private view returns (address) {
        if (_registry == address(0)) revert ZeroAddress();
        address endpoint = IEagleRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid));
        if (endpoint == address(0)) revert ZeroAddress();
        return endpoint;
    }

    // =================================
    // CONSTRUCTOR
    // =================================

    constructor(
        address _vault,
        address _shareOFT,
        address _wrapper,
        address _wlfiAdapter,
        address _wlfi,
        address _usd1,
        address _registry,
        address _owner
    ) OAppCore(_getLzEndpoint(_registry), _owner) Ownable(_owner) {
        if (_vault == address(0)) revert ZeroAddress();
        if (_shareOFT == address(0)) revert ZeroAddress();
        if (_wrapper == address(0)) revert ZeroAddress();
        if (_wlfiAdapter == address(0)) revert ZeroAddress();
        if (_wlfi == address(0)) revert ZeroAddress();
        if (_usd1 == address(0)) revert ZeroAddress();
        if (_registry == address(0)) revert ZeroAddress();

        VAULT = IERC4626(_vault);
        SHARE_OFT = _shareOFT;
        WRAPPER = IEagleVaultWrapper(_wrapper);
        WLFI_ADAPTER = _wlfiAdapter;
        WLFI = IERC20(_wlfi);
        USD1 = IERC20(_usd1);
        REGISTRY = IEagleRegistry(_registry);
        
        SHARE_ERC20 = IERC20(VAULT.asset());
        VAULT_EID = REGISTRY.getEidForChainId(block.chainid);

        // Approve vault and wrapper (using direct approve for better compatibility)
        IERC20(VAULT.asset()).approve(_vault, type(uint256).max); // vEAGLE → Vault for deposits
        IERC20(_vault).approve(_vault, type(uint256).max); // Vault shares → Vault for redemptions
        IERC20(_vault).approve(_wrapper, type(uint256).max); // Vault shares → Wrapper for wrapping
        IERC20(_shareOFT).approve(_wrapper, type(uint256).max); // EAGLE → Wrapper for unwrapping ⭐ THIS IS THE KEY!
        WLFI.approve(_wlfiAdapter, type(uint256).max); // WLFI → Adapter for bridging
        USD1.approve(_wlfiAdapter, type(uint256).max); // USD1 → Adapter for bridging

        emit ComposerInitialized(_vault, _shareOFT, _wrapper, _wlfiAdapter);
    }

    // =================================
    // LOCAL OPERATIONS
    // =================================

    /**
     * @notice Deposit WLFI/USD1 and receive EAGLE (local, same chain)
     * @dev User flow: WLFI → EAGLE
     * @dev Hidden: WLFI → Vault → vEAGLE → Wrapper → EAGLE
     */
    function depositAndWrap(uint256 assets, address receiver) 
        external 
        nonReentrant 
        returns (uint256 eagleAmount) 
    {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        // STEP 1: Take WLFI from user
        WLFI.safeTransferFrom(msg.sender, address(this), assets);

        // STEP 2: Deposit to vault → vEAGLE - HIDDEN FROM USER!
        uint256 sharesMinted = VAULT.deposit(assets, address(this));

        // STEP 3: Wrap vEAGLE → EAGLE - HIDDEN FROM USER!
        uint256 eagleBalanceBefore = IERC20(SHARE_OFT).balanceOf(address(this));
        WRAPPER.wrap(sharesMinted);
        eagleAmount = IERC20(SHARE_OFT).balanceOf(address(this)) - eagleBalanceBefore;

        // STEP 4: Transfer EAGLE to user
        IERC20(SHARE_OFT).safeTransfer(receiver, eagleAmount);

        emit DepositedAndWrapped(msg.sender, assets, eagleAmount);
    }

    /**
     * @notice Unwrap EAGLE and redeem for WLFI (local, same chain)
     * @dev User flow: EAGLE → WLFI
     * @dev Hidden: EAGLE → Wrapper → vEAGLE → Vault → WLFI
     */
    function unwrapAndRedeem(uint256 eagleAmount, address receiver) 
        external 
        nonReentrant 
        returns (uint256 wlfiAmount, uint256 usd1Amount) 
    {
        if (eagleAmount == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        // STEP 1: Take EAGLE from user
        IERC20(SHARE_OFT).safeTransferFrom(msg.sender, address(this), eagleAmount);

        // Get vault shares balance before unwrap
        uint256 sharesBalanceBefore = VAULT.balanceOf(address(this));

        // STEP 2: Unwrap EAGLE → vault shares - HIDDEN FROM USER!
        WRAPPER.unwrap(eagleAmount);

        // Calculate how many vault shares we got (net of wrapper fees)
        uint256 sharesReceived = VAULT.balanceOf(address(this)) - sharesBalanceBefore;

        // STEP 3: Redeem vault shares → WLFI + USD1 - HIDDEN FROM USER!
        uint256 wlfiBefore = WLFI.balanceOf(address(this));
        uint256 usd1Before = USD1.balanceOf(address(this));
        
        VAULT.redeem(sharesReceived, address(this), address(this));
        
        wlfiAmount = WLFI.balanceOf(address(this)) - wlfiBefore;
        usd1Amount = USD1.balanceOf(address(this)) - usd1Before;

        // STEP 4: Transfer assets to receiver
        if (wlfiAmount > 0) WLFI.safeTransfer(receiver, wlfiAmount);
        if (usd1Amount > 0) USD1.safeTransfer(receiver, usd1Amount);

        emit UnwrappedAndRedeemed(msg.sender, eagleAmount, wlfiAmount + usd1Amount);
    }

    // =================================
    // CROSS-CHAIN OPERATIONS (LayerZero)
    // =================================

    /**
     * @notice Deposit WLFI and send EAGLE cross-chain
     * @dev LOCAL ONLY: For users on hub chain wanting to deposit + bridge
     * 
     * Flow: WLFI → Vault → vEAGLE → Wrapper → EAGLE → Bridge
     */
    function depositAndSend(
        uint256 _wlfiAmount,
        SendParam calldata _sendParam,
        address _refundAddress
    ) external payable nonReentrant returns (MessagingReceipt memory receipt) {
        
        // Take WLFI from user
        WLFI.safeTransferFrom(msg.sender, address(this), _wlfiAmount);

        // Deposit to vault
        uint256 vaultShares = VAULT.deposit(_wlfiAmount, address(this));

        // Wrap to EAGLE
        uint256 eagleBefore = IERC20(SHARE_OFT).balanceOf(address(this));
        WRAPPER.wrap(vaultShares);
        uint256 eagleAmount = IERC20(SHARE_OFT).balanceOf(address(this)) - eagleBefore;

        // Send EAGLE cross-chain
        SendParam memory sendParam = _sendParam;
        sendParam.amountLD = eagleAmount;
        
        (receipt, ) = IOFT(SHARE_OFT).send{value: msg.value}(
            sendParam,
            MessagingFee(msg.value, 0),
            _refundAddress
        );
    }

    // =================================
    // LAYERZERO COMPOSE
    // =================================

    /**
     * @notice LayerZero compose handler
     * @dev Receives EAGLE from remote chain, unwraps, redeems, and sends WLFI back
     * 
     * COMPOSED FLOW:
     * 1. Receive EAGLE from Base
     * 2. Unwrap EAGLE → vEAGLE  
     * 3. Redeem vEAGLE → WLFI + USD1
     * 4. Send WLFI back to Base via adapter
     * 5. (Optional) Send USD1 back to Base
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

        // Decode OFT compose message format (OFTComposeMsgCodec)
        // Format: nonce (8) + srcEid (4) + amountLD (32) + composeFrom (32) + composeMsg
        // The composeMsg ITSELF contains: userComposeFrom (32) + innerMsg
        uint64 nonce;
        uint32 srcEid;
        uint256 amountLD;
        bytes32 composeFromBytes32; // OFT-level (not used)
        bytes32 userComposeFromBytes32; // Our level
        bytes memory innerMsg;
        
        assembly {
            let ptr := add(_message.offset, 0)
            nonce := shr(192, calldataload(ptr))              // 8 bytes
            srcEid := shr(224, calldataload(add(ptr, 8)))     // 4 bytes
            amountLD := calldataload(add(ptr, 12))            // 32 bytes
            composeFromBytes32 := calldataload(add(ptr, 44))  // 32 bytes (OFT-level)
            userComposeFromBytes32 := calldataload(add(ptr, 76)) // 32 bytes (Our level)
            
            // Inner message starts at offset 108 (after both composeFrom fields)
            let innerMsgLen := sub(_message.length, 108)
            innerMsg := mload(0x40)
            mstore(innerMsg, innerMsgLen)
            calldatacopy(add(innerMsg, 32), add(ptr, 108), innerMsgLen)
            mstore(0x40, add(add(innerMsg, 32), innerMsgLen))
        }
        
        address composeSender = address(uint160(uint256(userComposeFromBytes32)));

        // Decode inner message: (eagleAmount, wlfiSendParam, usd1SendParam, minMsgValue)
        (
            uint256 eagleAmount,
            SendParam memory wlfiSendParam,
            SendParam memory usd1SendParam,
            uint256 minMsgValue
        ) = abi.decode(innerMsg, (uint256, SendParam, SendParam, uint256));
        
        // Use amountLD from OFT as the actual EAGLE amount (more accurate than encoded amount)
        eagleAmount = amountLD;

        // Check sufficient msg.value
        if (msg.value < minMsgValue) {
            revert InsufficientMsgValue(minMsgValue, msg.value);
        }

        // Try-catch for automatic refunds on failure
        try this.handleRedeemCompose{value: msg.value}(
            eagleAmount,
            wlfiSendParam,
            usd1SendParam,
            srcEid,
            composeSender
        ) {
            emit Sent(_guid);
        } catch (bytes memory /*_err*/) {
            // Refund EAGLE on failure
            IERC20(SHARE_OFT).safeTransfer(composeSender, eagleAmount);
            emit Refunded(_guid);
        }
    }

    /**
     * @notice Handle redeem + send compose operation
     * @dev Called by lzCompose in try-catch for automatic refunds
     */
    function handleRedeemCompose(
        uint256 _eagleAmount,
        SendParam memory _wlfiSendParam,
        SendParam memory _usd1SendParam,
        uint32 _srcEid,
        address _composeSender
    ) external payable {
        // Only self can call (from try-catch in lzCompose)
        if (msg.sender != address(this)) revert OnlySelf(msg.sender);

        // 1. Unwrap EAGLE → vault shares (with wrapper fees)
        uint256 vaultSharesBefore = VAULT.balanceOf(address(this));
        WRAPPER.unwrap(_eagleAmount);
        uint256 vaultShares = VAULT.balanceOf(address(this)) - vaultSharesBefore;

        // 2. Redeem vault shares → WLFI + USD1
        uint256 wlfiBefore = WLFI.balanceOf(address(this));
        uint256 usd1Before = USD1.balanceOf(address(this));
        
        VAULT.redeem(vaultShares, address(this), address(this));
        
        uint256 wlfiAmount = WLFI.balanceOf(address(this)) - wlfiBefore;
        uint256 usd1Amount = USD1.balanceOf(address(this)) - usd1Before;

        // 3. Slippage check for WLFI
        if (wlfiAmount < _wlfiSendParam.minAmountLD) {
            revert SlippageExceeded(wlfiAmount, _wlfiSendParam.minAmountLD);
        }

        // 4. Send WLFI back to source chain
        _wlfiSendParam.amountLD = wlfiAmount;
        _wlfiSendParam.minAmountLD = 0; // Reset after check
        
        // Allocate fees intelligently based on what's being sent
        uint256 wlfiFee;
        uint256 usd1Fee;
        
        if (_usd1SendParam.dstEid != 0 && usd1Amount > 0) {
            // Both WLFI and USD1: split fee evenly
            wlfiFee = msg.value / 2;
            usd1Fee = msg.value - wlfiFee;
        } else {
            // Only WLFI: use full fee
            wlfiFee = msg.value;
            usd1Fee = 0;
        }
        
        IOFT(WLFI_ADAPTER).send{value: wlfiFee}(
            _wlfiSendParam,
            MessagingFee(wlfiFee, 0),
            _composeSender
        );

        // 5. Send USD1 back to source chain (if enabled and amount > 0)
        if (_usd1SendParam.dstEid != 0 && usd1Amount > 0) {
            _usd1SendParam.amountLD = usd1Amount;
            
            IOFT(WLFI_ADAPTER).send{value: usd1Fee}(
                _usd1SendParam,
                MessagingFee(usd1Fee, 0),
                _composeSender
            );
        }

        emit Redeemed(
            bytes32(uint256(uint160(_composeSender))),
            _wlfiSendParam.to,
            _srcEid,
            _eagleAmount,
            wlfiAmount,
            usd1Amount
        );
    }

    // =================================
    // ADMIN FUNCTIONS
    // =================================

    /**
     * @notice Manually set all approvals (in case constructor failed)
     * @dev Only owner can call
     */
    function setApprovals() external onlyOwner {
        // Use direct approve instead of forceApprove as it might be more compatible
        IERC20(VAULT.asset()).approve(address(VAULT), type(uint256).max);
        IERC20(address(VAULT)).approve(address(VAULT), type(uint256).max);
        IERC20(address(VAULT)).approve(address(WRAPPER), type(uint256).max);
        IERC20(address(SHARE_OFT)).approve(address(WRAPPER), type(uint256).max);
        WLFI.approve(WLFI_ADAPTER, type(uint256).max);
        USD1.approve(WLFI_ADAPTER, type(uint256).max);
    }

    // =================================
    // RECEIVE FUNCTION
    // =================================

    /**
     * @notice Allow contract to receive ETH
     * @dev Required for lzCompose callback with msg.value
     */
    receive() external payable {}

    // =================================
    // VIEW FUNCTIONS
    // =================================

    /**
     * @notice Quote LayerZero fee for cross-chain send
     */
    function quoteSend(
        SendParam calldata _sendParam,
        bool _payInLzToken
    ) external view returns (MessagingFee memory fee) {
        return IOFT(SHARE_OFT).quoteSend(_sendParam, _payInLzToken);
    }

    /**
     * @notice Preview WLFI → EAGLE conversion
     */
    function previewDepositAndWrap(uint256 assets) external view returns (uint256 eagleAmount) {
        uint256 shares = VAULT.previewDeposit(assets);
        uint256 wrapperFee = (shares * WRAPPER.depositFee()) / WRAPPER.BASIS_POINTS();
        return shares - wrapperFee;
    }

    /**
     * @notice Preview EAGLE → WLFI conversion
     */
    function previewUnwrapAndRedeem(uint256 eagleAmount) external view returns (uint256 wlfiAmount) {
        uint256 unwrapFee = (eagleAmount * WRAPPER.withdrawFee()) / WRAPPER.BASIS_POINTS();
        uint256 shares = eagleAmount - unwrapFee;
        return VAULT.previewRedeem(shares);
    }

    /**
     * @notice OApp version
     */
    function oAppVersion() external pure returns (uint64 senderVersion, uint64 receiverVersion) {
        return (1, 1);
    }

    function allowInitializePath(Origin calldata /*origin*/) external pure returns (bool) {
        return true;
    }

    function nextNonce(uint32 /*_eid*/, bytes32 /*_sender*/) external pure returns (uint64) {
        return 0;
    }
}

