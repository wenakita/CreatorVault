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
 * @title EagleOVaultComposer
 * @notice Unified composer for EagleOVault with wrapper integration
 * 
 * @dev ARCHITECTURE:
 *      - Combines local operations (depositAndWrap, unwrapAndRedeem)
 *      - LayerZero cross-chain compose operations
 *      - Integrates with EagleVaultWrapper pattern
 *      - Uses EagleRegistry for endpoint management
 * 
 * @dev USER EXPERIENCE:
 *      Users ONLY see: WLFI → EAGLE → WLFI
 *      Hidden: WLFI → Vault → vEAGLE → Wrapper → EAGLE
 * 
 * @dev OPERATION TYPES:
 *      1. Local: depositAndWrap() - WLFI → EAGLE (same chain)
 *      2. Local: unwrapAndRedeem() - EAGLE → WLFI (same chain)
 *      3. Cross-chain deposit: WLFI (remote) → EAGLE (hub)
 *      4. Cross-chain redeem: EAGLE (remote) → WLFI (hub)
 * 
 * Deploy ONLY on hub chain (Ethereum).
 */
contract EagleOVaultComposer is OAppCore, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =================================
    // STATE VARIABLES
    // =================================

    /// @notice The ERC4626 vault contract
    IERC4626 public immutable VAULT;

    /// @notice The asset OFT for cross-chain asset transfers (WLFI/USD1)
    address public immutable ASSET_OFT;

    /// @notice The share OFT for cross-chain share transfers (EAGLE)
    address public immutable SHARE_OFT;

    /// @notice The vault wrapper for share conversion
    IEagleVaultWrapper public immutable WRAPPER;

    /// @notice EagleRegistry for endpoint and chain info
    IEagleRegistry public immutable REGISTRY;

    /// @notice Hub chain endpoint ID
    uint32 public immutable VAULT_EID;

    /// @notice Underlying asset ERC20
    IERC20 public immutable ASSET_ERC20;

    /// @notice Vault shares ERC20
    IERC20 public immutable SHARE_ERC20;

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
    event Redeemed(bytes32 sender, bytes32 recipient, uint32 dstEid, uint256 shareAmt, uint256 assetAmt);
    event ComposerInitialized(address vault, address assetOFT, address shareOFT, address wrapper, address registry);

    // =================================
    // ERRORS
    // =================================

    error ZeroAmount();
    error ZeroAddress();
    error OnlyEndpoint(address caller);
    error OnlySelf(address caller);
    error OnlyValidComposeCaller(address caller);
    error InsufficientMsgValue(uint256 expectedMsgValue, uint256 actualMsgValue);
    error SlippageExceeded(uint256 amountLD, uint256 minAmountLD);

    // =================================
    // CONSTRUCTOR
    // =================================

    /**
     * @param _vault EagleOVault address
     * @param _assetOFT Asset OFT address (WLFI/USD1)
     * @param _shareOFT Share OFT address (EAGLE)
     * @param _wrapper EagleVaultWrapper address
     * @param _registry EagleRegistry address
     * @param _delegate Admin address
     */
    constructor(
        address _vault,
        address _assetOFT,
        address _shareOFT,
        address _wrapper,
        address _registry,
        address _delegate
    ) OAppCore(_getEndpoint(_registry), _delegate) Ownable(_delegate) {
        if (_vault == address(0)) revert ZeroAddress();
        if (_assetOFT == address(0)) revert ZeroAddress();
        if (_shareOFT == address(0)) revert ZeroAddress();
        if (_wrapper == address(0)) revert ZeroAddress();
        if (_registry == address(0)) revert ZeroAddress();

        VAULT = IERC4626(_vault);
        ASSET_OFT = _assetOFT;
        SHARE_OFT = _shareOFT;
        WRAPPER = IEagleVaultWrapper(_wrapper);
        REGISTRY = IEagleRegistry(_registry);

        ASSET_ERC20 = IERC20(VAULT.asset());
        SHARE_ERC20 = IERC20(address(VAULT));

        // Get vault EID from registry
        uint16 chainId = REGISTRY.getCurrentChainId();
        VAULT_EID = REGISTRY.getEidForChainId(chainId);

        // Grant infinite approvals for seamless operations
        ASSET_ERC20.approve(_vault, type(uint256).max);
        SHARE_ERC20.approve(_wrapper, type(uint256).max);

        emit ComposerInitialized(_vault, _assetOFT, _shareOFT, _wrapper, _registry);
    }

    /**
     * @notice Helper to get endpoint from registry during construction
     */
    function _getEndpoint(address _registry) private view returns (address) {
        IEagleRegistry registry = IEagleRegistry(_registry);
        uint16 chainId = registry.getCurrentChainId();
        return registry.getLayerZeroEndpoint(chainId);
    }

    // =================================
    // LOCAL OPERATIONS (Hub Chain Only)
    // =================================

    /**
     * @notice Deposit WLFI/USD1 and receive EAGLE in ONE transaction
     * @dev LOCAL ONLY: For users on hub chain
     * 
     * @dev HIDDEN STEPS:
     *      1. Transfer WLFI from user
     *      2. Deposit WLFI to vault → get vault shares (HIDDEN!)
     *      3. Wrap vault shares → get EAGLE OFT
     *      4. Transfer EAGLE to user
     * 
     * @dev USER SEES:
     *      WLFI in → EAGLE out ✨
     * 
     * @param assets Amount of WLFI/USD1 to deposit
     * @param receiver Address to receive EAGLE
     * @return eagleAmount Amount of EAGLE OFT received
     */
    function depositAndWrap(uint256 assets, address receiver) 
        external 
        nonReentrant 
        returns (uint256 eagleAmount) 
    {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        // STEP 1: Take WLFI from user
        ASSET_ERC20.safeTransferFrom(msg.sender, address(this), assets);

        // STEP 2: Deposit to vault (get vault shares) - HIDDEN FROM USER!
        uint256 sharesMinted = VAULT.deposit(assets, address(this));

        // Get EAGLE balance before wrap
        uint256 eagleBalanceBefore = IERC20(SHARE_OFT).balanceOf(address(this));

        // STEP 3: Wrap vault shares → EAGLE OFT - HIDDEN FROM USER!
        WRAPPER.wrap(sharesMinted);

        // Calculate how much EAGLE we got (net of wrapper fees)
        eagleAmount = IERC20(SHARE_OFT).balanceOf(address(this)) - eagleBalanceBefore;

        // STEP 4: Send EAGLE to user
        IERC20(SHARE_OFT).safeTransfer(receiver, eagleAmount);

        emit DepositedAndWrapped(msg.sender, assets, eagleAmount);
    }

    /**
     * @notice Unwrap EAGLE and redeem for WLFI/USD1 in ONE transaction
     * @dev LOCAL ONLY: For users on hub chain
     * 
     * @dev HIDDEN STEPS:
     *      1. Transfer EAGLE from user
     *      2. Unwrap EAGLE → get vault shares (HIDDEN!)
     *      3. Redeem vault shares → get WLFI
     *      4. Transfer WLFI to user
     * 
     * @dev USER SEES:
     *      EAGLE in → WLFI out ✨
     * 
     * @param eagleAmount Amount of EAGLE to unwrap
     * @param receiver Address to receive WLFI/USD1
     * @return assets Amount of WLFI/USD1 received
     */
    function unwrapAndRedeem(uint256 eagleAmount, address receiver)
        external
        nonReentrant
        returns (uint256 assets)
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

        // STEP 3: Redeem vault shares → WLFI - HIDDEN FROM USER!
        assets = VAULT.redeem(sharesReceived, receiver, address(this));

        emit UnwrappedAndRedeemed(msg.sender, eagleAmount, assets);
    }

    // =================================
    // CROSS-CHAIN OPERATIONS (LayerZero)
    // =================================

    /**
     * @notice Deposit assets and send shares cross-chain
     * @dev LOCAL ONLY: For users on hub chain wanting to deposit + bridge
     * 
     * Flow: WLFI → Vault → vEAGLE → Wrapper → EAGLE → Bridge
     */
    function depositAndSend(
        uint256 _assetAmount,
        SendParam calldata _sendParam,
        address _refundAddress
    ) external payable nonReentrant returns (MessagingReceipt memory receipt, bytes memory oftReceipt) {
        // 1. Take assets from user
        ASSET_ERC20.safeTransferFrom(msg.sender, address(this), _assetAmount);

        // 2. Deposit to vault (get vault shares)
        uint256 vaultShares = VAULT.deposit(_assetAmount, address(this));

        // 3. Wrap vault shares → EAGLE (with wrapper fees)
        uint256 eagleBalanceBefore = IERC20(SHARE_OFT).balanceOf(address(this));
        WRAPPER.wrap(vaultShares);
        uint256 eagleAmount = IERC20(SHARE_OFT).balanceOf(address(this)) - eagleBalanceBefore;

        // 4. Check slippage
        _assertSlippage(eagleAmount, _sendParam.minAmountLD);

        // 5. Send EAGLE to destination
        SendParam memory updatedParam = _sendParam;
        updatedParam.amountLD = eagleAmount;
        updatedParam.minAmountLD = 0; // Reset after slippage check

        (receipt, ) = IOFT(SHARE_OFT).send{value: msg.value}(
            updatedParam,
            MessagingFee(msg.value, 0),
            _refundAddress
        );

        emit Deposited(
            bytes32(uint256(uint160(msg.sender))),
            _sendParam.to,
            _sendParam.dstEid,
            _assetAmount,
            eagleAmount
        );
    }

    /**
     * @notice Redeem shares and send assets cross-chain
     * @dev LOCAL ONLY: For users on hub chain wanting to redeem + bridge
     * 
     * Flow: EAGLE → Wrapper → vEAGLE → Vault → WLFI → Bridge
     */
    function redeemAndSend(
        uint256 _eagleAmount,
        SendParam calldata _sendParam,
        address _refundAddress
    ) external payable nonReentrant returns (MessagingReceipt memory receipt, bytes memory oftReceipt) {
        // 1. Take EAGLE from user
        IERC20(SHARE_OFT).safeTransferFrom(msg.sender, address(this), _eagleAmount);

        // 2. Unwrap EAGLE → vault shares (with wrapper fees)
        uint256 vaultSharesBefore = SHARE_ERC20.balanceOf(address(this));
        WRAPPER.unwrap(_eagleAmount);
        uint256 vaultShares = SHARE_ERC20.balanceOf(address(this)) - vaultSharesBefore;

        // 3. Redeem vault shares → assets
        uint256 assetAmount = VAULT.redeem(vaultShares, address(this), address(this));

        // 4. Check slippage
        _assertSlippage(assetAmount, _sendParam.minAmountLD);

        // 5. Send assets to destination
        SendParam memory updatedParam = _sendParam;
        updatedParam.amountLD = assetAmount;
        updatedParam.minAmountLD = 0; // Reset after slippage check

        (receipt, ) = IOFT(ASSET_OFT).send{value: msg.value}(
            updatedParam,
            MessagingFee(msg.value, 0),
            _refundAddress
        );

        emit Redeemed(
            bytes32(uint256(uint160(msg.sender))),
            _sendParam.to,
            _sendParam.dstEid,
            _eagleAmount,
            assetAmount
        );
    }

    // =================================
    // LAYERZERO COMPOSE HANDLER
    // =================================

    /**
     * @notice LayerZero compose message handler
     * @dev Called by endpoint when tokens arrive with composeMsg
     * 
     * AUTOMATIC OPERATION DETECTION:
     * - If caller is ASSET_OFT → deposit flow
     * - If caller is SHARE_OFT → redeem flow
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

        // Decode standard LayerZero compose message format
        // Format: nonce (32) + srcEid (4) + sender (32) + composeMsg
        (, , address composeSender, bytes memory composeMsg, ) = abi.decode(
            _message,
            (uint64, uint32, address, bytes, bytes)
        );

        // Determine operation and amount
        (address oftToken, uint256 amount) = _decodeComposeMessage(composeMsg);

        // Try-catch for automatic refunds on failure
        try this.handleCompose{value: msg.value}(
            oftToken,
            bytes32(uint256(uint160(composeSender))),
            composeMsg,
            amount
        ) {
            emit Sent(_guid);
        } catch (bytes memory /*_err*/) {
            // Automatic refund on any failure
            _refund(oftToken, composeMsg, amount, tx.origin);
            emit Refunded(_guid);
        }
    }

    /**
     * @notice Handle compose operations with vault + wrapper integration
     * @dev Called by lzCompose in try-catch for automatic refunds
     */
    function handleCompose(
        address _oftIn,
        bytes32 _composeFrom,
        bytes calldata _composeMsg,
        uint256 _amount
    ) external payable {
        // Only self can call (from try-catch in lzCompose)
        if (msg.sender != address(this)) revert OnlySelf(msg.sender);

        // Decode routing instructions
        (SendParam memory sendParam, uint256 minMsgValue) = abi.decode(
            _composeMsg,
            (SendParam, uint256)
        );

        // Check sufficient msg.value for destination delivery
        if (msg.value < minMsgValue) {
            revert InsufficientMsgValue(minMsgValue, msg.value);
        }

        // OPERATION DETECTION:
        if (_oftIn == ASSET_OFT) {
            // Asset arrived → Deposit + Wrap flow
            _depositWrapAndSend(_amount, sendParam, _composeFrom);
        } else if (_oftIn == SHARE_OFT) {
            // EAGLE arrived → Unwrap + Redeem flow
            _unwrapRedeemAndSend(_amount, sendParam, _composeFrom);
        } else {
            revert OnlyValidComposeCaller(_oftIn);
        }
    }

    // =================================
    // INTERNAL OPERATION FUNCTIONS
    // =================================

    /**
     * @notice Deposit + Wrap flow
     * @dev WLFI → Vault → vEAGLE → Wrapper → EAGLE
     */
    function _depositWrapAndSend(
        uint256 _assetAmount,
        SendParam memory _sendParam,
        bytes32 _composeFrom
    ) internal {
        // 1. Deposit assets to vault
        uint256 vaultShares = VAULT.deposit(_assetAmount, address(this));

        // 2. Wrap vault shares → EAGLE (with wrapper fees)
        uint256 eagleBalanceBefore = IERC20(SHARE_OFT).balanceOf(address(this));
        WRAPPER.wrap(vaultShares);
        uint256 eagleAmount = IERC20(SHARE_OFT).balanceOf(address(this)) - eagleBalanceBefore;

        // 3. Slippage check
        _assertSlippage(eagleAmount, _sendParam.minAmountLD);

        // 4. Update amount and route output
        _sendParam.amountLD = eagleAmount;
        _sendParam.minAmountLD = 0; // Reset after check
        _send(SHARE_OFT, SHARE_OFT, _sendParam, tx.origin);

        emit Deposited(_composeFrom, _sendParam.to, _sendParam.dstEid, _assetAmount, eagleAmount);
    }

    /**
     * @notice Unwrap + Redeem flow
     * @dev EAGLE → Wrapper → vEAGLE → Vault → WLFI
     */
    function _unwrapRedeemAndSend(
        uint256 _eagleAmount,
        SendParam memory _sendParam,
        bytes32 _composeFrom
    ) internal {
        // 1. Unwrap EAGLE → vault shares (with wrapper fees)
        uint256 vaultSharesBefore = SHARE_ERC20.balanceOf(address(this));
        WRAPPER.unwrap(_eagleAmount);
        uint256 vaultShares = SHARE_ERC20.balanceOf(address(this)) - vaultSharesBefore;

        // 2. Redeem vault shares → assets
        uint256 assetAmount = VAULT.redeem(vaultShares, address(this), address(this));

        // 3. Slippage check
        _assertSlippage(assetAmount, _sendParam.minAmountLD);

        // 4. Update amount and route output
        _sendParam.amountLD = assetAmount;
        _sendParam.minAmountLD = 0; // Reset after check
        _send(ASSET_OFT, address(ASSET_ERC20), _sendParam, tx.origin);

        emit Redeemed(_composeFrom, _sendParam.to, _sendParam.dstEid, _eagleAmount, assetAmount);
    }

    /**
     * @notice Smart output routing (local or cross-chain)
     */
    function _send(
        address _oft,
        address _token,
        SendParam memory _sendParam,
        address _refundAddress
    ) internal {
        if (_sendParam.dstEid == VAULT_EID) {
            // Same chain: Direct ERC20 transfer
            IERC20(_token).safeTransfer(
                address(uint160(uint256(_sendParam.to))),
                _sendParam.amountLD
            );
        } else {
            // Cross-chain: OFT send
            IOFT(_oft).send{value: msg.value}(
                _sendParam,
                MessagingFee(msg.value, 0),
                _refundAddress
            );
        }
    }

    /**
     * @notice Refund tokens on failure
     */
    function _refund(
        address _oftToken,
        bytes memory _composeMsg,
        uint256 _amount,
        address _refundAddress
    ) internal {
        // Send tokens back to original sender
        IERC20(_oftToken).safeTransfer(_refundAddress, _amount);
    }

    // =================================
    // HELPER FUNCTIONS
    // =================================

    function _assertSlippage(uint256 _amountLD, uint256 _minAmountLD) internal pure {
        if (_amountLD < _minAmountLD) {
            revert SlippageExceeded(_amountLD, _minAmountLD);
        }
    }

    function _decodeComposeMessage(bytes memory _composeMsg) 
        internal 
        pure 
        returns (address oftToken, uint256 amount) 
    {
        // LayerZero compose message decoding
        (SendParam memory sendParam, ) = abi.decode(_composeMsg, (SendParam, uint256));
        return (address(0), sendParam.amountLD);
    }

    // =================================
    // VIEW FUNCTIONS
    // =================================

    /**
     * @notice Preview how much EAGLE you'll get for depositing WLFI
     * @param assets Amount of WLFI to deposit
     * @return eagleAmount Estimated EAGLE output (accounting for fees)
     */
    function previewDepositAndWrap(uint256 assets) 
        external 
        view 
        returns (uint256 eagleAmount) 
    {
        // 1. Preview vault deposit (assets → shares)
        uint256 shares = VAULT.previewDeposit(assets);
        
        // 2. Estimate wrapper fee
        uint256 wrapperFee = (shares * WRAPPER.depositFee()) / WRAPPER.BASIS_POINTS();
        eagleAmount = shares - wrapperFee;
    }

    /**
     * @notice Preview how much WLFI you'll get for redeeming EAGLE
     * @param eagleAmount Amount of EAGLE to redeem
     * @return assets Estimated WLFI output (accounting for fees)
     */
    function previewUnwrapAndRedeem(uint256 eagleAmount)
        external
        view
        returns (uint256 assets)
    {
        // 1. Estimate wrapper fee
        uint256 unwrapFee = (eagleAmount * WRAPPER.withdrawFee()) / WRAPPER.BASIS_POINTS();
        uint256 sharesAfterFee = eagleAmount - unwrapFee;
        
        // 2. Preview vault redeem (shares → assets)
        assets = VAULT.previewRedeem(sharesAfterFee);
    }

    /**
     * @notice Get all contract addresses for UI integration
     */
    function getContracts() external view returns (
        address vault,
        address wrapper,
        address eagle,
        address asset,
        address registry
    ) {
        return (
            address(VAULT),
            address(WRAPPER),
            address(SHARE_OFT),
            address(ASSET_ERC20),
            address(REGISTRY)
        );
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

    // =================================
    // EMERGENCY FUNCTIONS
    // =================================

    /**
     * @notice Emergency withdraw stuck tokens
     * @dev Only owner, for recovery purposes
     */
    function emergencyWithdraw(address token, address to, uint256 amount) 
        external 
        onlyOwner 
    {
        IERC20(token).safeTransfer(to, amount);
    }
}
