// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IDragonOVaultWrapper {
    function wrap(uint256 amount) external returns (uint256);
    function unwrap(uint256 amount) external returns (uint256);
    function shareOFT() external view returns (address);
    function vaultShares() external view returns (address);
}

/**
 * @title DragonVaultComposer
 * @author 0xakita.eth
 * @notice Simplifies vault operations into single transactions
 * 
 * @dev OPERATIONS:
 *      - depositAndWrap(): omniDRAGON → chainDRAGON (one tx)
 *      - unwrapAndRedeem(): chainDRAGON → omniDRAGON (one tx)
 * 
 * @dev USER EXPERIENCE:
 *      Users only see: omniDRAGON ↔ chainDRAGON
 *      Hidden: vault deposit/redeem + wrap/unwrap
 * 
 * Deploy on each chain with same address.
 */
contract DragonVaultComposer is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // STATE
    // ================================

    /// @notice omniDRAGON token (same on all chains)
    IERC20 public immutable omniDragon;

    /// @notice DragonVault (ERC-4626, same on all chains)
    IERC4626 public immutable vault;

    /// @notice DragonVaultWrapper (same on all chains)
    IDragonOVaultWrapper public immutable wrapper;

    /// @notice Chain-specific DragonShareOFT (set post-deploy)
    IERC20 public chainDragon;

    // ================================
    // EVENTS
    // ================================

    event DepositedAndWrapped(
        address indexed user,
        uint256 omniDragonIn,
        uint256 vaultShares,
        uint256 chainDragonOut
    );

    event UnwrappedAndRedeemed(
        address indexed user,
        uint256 chainDragonIn,
        uint256 vaultShares,
        uint256 omniDragonOut
    );

    event ChainDragonSet(address indexed chainDragon);

    // ================================
    // ERRORS
    // ================================

    error ZeroAmount();
    error ZeroAddress();
    error ChainDragonNotSet();
    error SlippageExceeded();

    // ================================
    // CONSTRUCTOR
    // ================================

    /**
     * @notice Deploy with same address on all chains
     * @param _omniDragon omniDRAGON address (same on all chains)
     * @param _vault DragonVault address (same on all chains)
     * @param _wrapper DragonVaultWrapper address (same on all chains)
     * @param _owner Owner address
     */
    constructor(
        address _omniDragon,
        address _vault,
        address _wrapper,
        address _owner
    ) Ownable(_owner) {
        require(_omniDragon != address(0), "Zero omniDragon");
        require(_vault != address(0), "Zero vault");
        require(_wrapper != address(0), "Zero wrapper");

        omniDragon = IERC20(_omniDragon);
        vault = IERC4626(_vault);
        wrapper = IDragonOVaultWrapper(_wrapper);

        // Infinite approvals for seamless operations
        IERC20(_omniDragon).approve(_vault, type(uint256).max);
        IERC20(_vault).approve(_wrapper, type(uint256).max);
    }

    // ================================
    // ADMIN
    // ================================

    /**
     * @notice Set chain-specific DragonShareOFT (called after deploy)
     * @param _chainDragon baseDRAGON/arbDRAGON/etc address
     */
    function setChainDragon(address _chainDragon) external onlyOwner {
        if (_chainDragon == address(0)) revert ZeroAddress();
        chainDragon = IERC20(_chainDragon);
        emit ChainDragonSet(_chainDragon);
    }

    // ================================
    // COMPOSE OPERATIONS
    // ================================

    /**
     * @notice Deposit omniDRAGON and receive chainDRAGON in ONE transaction
     * 
     * @dev FLOW:
     *      1. Transfer omniDRAGON from user
     *      2. Deposit to vault → get dragonVAULT shares
     *      3. Wrap shares → get chainDRAGON
     *      4. Transfer chainDRAGON to user
     * 
     * @param amount Amount of omniDRAGON to deposit
     * @param minOut Minimum chainDRAGON to receive (slippage protection)
     * @return chainDragonOut Amount of chainDRAGON received
     */
    function depositAndWrap(
        uint256 amount,
        uint256 minOut
    ) external nonReentrant returns (uint256 chainDragonOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(chainDragon) == address(0)) revert ChainDragonNotSet();

        // 1. Take omniDRAGON from user
        omniDragon.safeTransferFrom(msg.sender, address(this), amount);

        // 2. Deposit to vault (get dragonVAULT)
        uint256 vaultShares = vault.deposit(amount, address(this));

        // 3. Wrap to chainDRAGON
        chainDragonOut = wrapper.wrap(vaultShares);

        // 4. Check slippage
        if (chainDragonOut < minOut) revert SlippageExceeded();

        // 5. Send chainDRAGON to user
        chainDragon.safeTransfer(msg.sender, chainDragonOut);

        emit DepositedAndWrapped(msg.sender, amount, vaultShares, chainDragonOut);
    }

    /**
     * @notice Unwrap chainDRAGON and redeem for omniDRAGON in ONE transaction
     * 
     * @dev FLOW:
     *      1. Transfer chainDRAGON from user
     *      2. Unwrap → get dragonVAULT shares
     *      3. Redeem shares → get omniDRAGON
     *      4. Transfer omniDRAGON to user
     * 
     * @param amount Amount of chainDRAGON to unwrap
     * @param minOut Minimum omniDRAGON to receive (slippage protection)
     * @return omniDragonOut Amount of omniDRAGON received
     */
    function unwrapAndRedeem(
        uint256 amount,
        uint256 minOut
    ) external nonReentrant returns (uint256 omniDragonOut) {
        if (amount == 0) revert ZeroAmount();
        if (address(chainDragon) == address(0)) revert ChainDragonNotSet();

        // 1. Take chainDRAGON from user
        chainDragon.safeTransferFrom(msg.sender, address(this), amount);

        // 2. Approve wrapper (if not already)
        chainDragon.approve(address(wrapper), amount);

        // 3. Unwrap to vault shares
        uint256 vaultShares = wrapper.unwrap(amount);

        // 4. Redeem for omniDRAGON
        omniDragonOut = vault.redeem(vaultShares, msg.sender, address(this));

        // 5. Check slippage
        if (omniDragonOut < minOut) revert SlippageExceeded();

        emit UnwrappedAndRedeemed(msg.sender, amount, vaultShares, omniDragonOut);
    }

    // ================================
    // VIEW
    // ================================

    /**
     * @notice Preview how much chainDRAGON you'll get for depositing omniDRAGON
     * @param omniDragonAmount Amount of omniDRAGON to deposit
     * @return Estimated chainDRAGON output
     */
    function previewDepositAndWrap(uint256 omniDragonAmount) external view returns (uint256) {
        // Vault: assets → shares (1:1 initially)
        uint256 vaultShares = vault.previewDeposit(omniDragonAmount);
        // Wrapper: 1:1 minus fees
        // For now assume no fees, so output = shares
        return vaultShares;
    }

    /**
     * @notice Preview how much omniDRAGON you'll get for unwrapping chainDRAGON
     * @param chainDragonAmount Amount of chainDRAGON to unwrap
     * @return Estimated omniDRAGON output
     */
    function previewUnwrapAndRedeem(uint256 chainDragonAmount) external view returns (uint256) {
        // Wrapper: 1:1 minus fees
        // For now assume no fees, so vaultShares = chainDragonAmount
        uint256 vaultShares = chainDragonAmount;
        // Vault: shares → assets
        return vault.previewRedeem(vaultShares);
    }

    /**
     * @notice Get all contract addresses for UI integration
     */
    function getContracts() external view returns (
        address _omniDragon,
        address _vault,
        address _wrapper,
        address _chainDragon
    ) {
        return (
            address(omniDragon),
            address(vault),
            address(wrapper),
            address(chainDragon)
        );
    }

    // ================================
    // EMERGENCY
    // ================================

    /**
     * @notice Emergency withdraw stuck tokens
     * @dev Only owner, for recovery purposes
     */
    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}

