// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { OFTAdapter } from "@layerzerolabs/oft-evm/contracts/OFTAdapter.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IChainRegistry {
    function getLayerZeroEndpoint(uint16 _chainId) external view returns (address);
    function getCurrentChainId() external view returns (uint16);
}

/**
 * @title ProductiveWLFIAdapter
 * @notice Capital-efficient OFT Adapter that deposits idle WLFI into EagleOVault to earn yield
 * 
 * @dev ENHANCEMENT over standard WLFIAdapter:
 *      Instead of holding idle WLFI (0% APY), this adapter deposits idle liquidity
 *      into the vault to earn yield (e.g., 10% APY from Charm strategies).
 * 
 * KEY FEATURES:
 * ✅ Deposits idle WLFI → EagleOVault (earns yield)
 * ✅ Maintains configurable liquid buffer (default 10%)
 * ✅ Auto-redeems from vault when unlock needed
 * ✅ Same external interface as standard adapter
 * ✅ Drop-in replacement for WLFIAdapter
 * ✅ Capital efficiency: 100% (vs 0% for standard)
 * 
 * CAPITAL EFFICIENCY:
 * - Standard Adapter: 50,000 WLFI idle → $0/year earnings
 * - Productive Adapter: 50,000 WLFI in vault → $5,000/year (at 10% APY)
 * 
 * ARCHITECTURE:
 * 1. Admin pre-funds adapter with WLFI
 * 2. Adapter deposits 90% to vault (earns yield)
 * 3. Adapter keeps 10% liquid (instant unlock)
 * 4. When cross-chain unlock needed:
 *    - If buffer sufficient → unlock from buffer
 *    - If buffer insufficient → redeem from vault + unlock
 * 5. Periodically rebalance buffer (manual or keeper)
 * 
 * REQUIREMENTS:
 * ⚠️  Vault MUST have synchronous redemption (EagleOVault ✅)
 * ⚠️  Vault should have sufficient liquidity for adapter redeems
 * 
 * GAS COSTS:
 * - Buffer unlock: ~50,000 gas (same as standard adapter)
 * - Vault redemption + unlock: ~150,000 gas (+100k for redeem)
 * - Trade-off: Higher gas per unlock, but earning yield 24/7
 * 
 * DEPLOYMENT:
 * 1. Deploy ProductiveWLFIAdapter(wlfi, vault, registry, delegate)
 * 2. Transfer WLFI to adapter (e.g., 50,000 WLFI)
 * 3. Call depositIdleToVault() to start earning
 * 4. Configure buffer ratio if needed (default 10%)
 * 5. Set LayerZero peers
 * 
 * @author Eagle Protocol
 * @notice Deploy this AFTER validating standard adapter works in production
 */
contract ProductiveWLFIAdapter is OFTAdapter {
    using SafeERC20 for IERC20;

    /// @notice EagleOVault (ERC4626 vault)
    IERC4626 public immutable vault;
    
    /// @notice WLFI token
    IERC20 public immutable wlfi;
    
    /// @notice EagleRegistry for LayerZero endpoint lookup
    IChainRegistry public immutable registry;
    
    /// @notice Target buffer ratio (in basis points, 1000 = 10%)
    uint256 public bufferRatioBps = 1000; // 10% default
    
    /// @notice Minimum buffer to maintain (absolute amount)
    uint256 public minBuffer = 1000 ether; // 1,000 WLFI minimum
    
    /// @notice Maximum basis points
    uint256 public constant MAX_BPS = 10000;

    /// @notice Emitted when idle WLFI is deposited to vault
    event DepositedToVault(uint256 wlfiAmount, uint256 sharesReceived);
    
    /// @notice Emitted when vault shares are redeemed for WLFI
    event RedeemedFromVault(uint256 sharesRedeemed, uint256 wlfiReceived);
    
    /// @notice Emitted when buffer ratio is updated
    event BufferRatioUpdated(uint256 oldRatio, uint256 newRatio);
    
    /// @notice Emitted when minimum buffer is updated
    event MinBufferUpdated(uint256 oldMin, uint256 newMin);

    /// @notice Buffer ratio too high
    error BufferRatioTooHigh();
    
    /// @notice Insufficient vault shares
    error InsufficientVaultShares();

    /**
     * @notice Constructor for Productive WLFI Adapter
     * @param _wlfi Address of WLFI token
     * @param _vault Address of EagleOVault (ERC4626)
     * @param _registry Address of EagleRegistry
     * @param _delegate Admin address
     */
    constructor(
        address _wlfi,
        address _vault,
        address _registry,
        address _delegate
    ) OFTAdapter(
        _wlfi,
        _getEndpointFromRegistry(_registry),
        _delegate
    ) Ownable(_delegate) {
        require(_wlfi != address(0), "ProductiveWLFIAdapter: wlfi cannot be zero");
        require(_vault != address(0), "ProductiveWLFIAdapter: vault cannot be zero");
        require(_registry != address(0), "ProductiveWLFIAdapter: registry cannot be zero");
        require(_delegate != address(0), "ProductiveWLFIAdapter: delegate cannot be zero");
        
        wlfi = IERC20(_wlfi);
        vault = IERC4626(_vault);
        registry = IChainRegistry(_registry);
        
        // Approve vault to spend WLFI (infinite approval for gas efficiency)
        wlfi.approve(_vault, type(uint256).max);
    }

    /**
     * @notice Deposit idle WLFI into vault to earn yield
     * @dev Maintains buffer ratio, deposits excess to vault
     */
    function depositIdleToVault() external onlyOwner {
        uint256 wlfiBalance = wlfi.balanceOf(address(this));
        uint256 targetBuffer = _calculateTargetBuffer();
        
        if (wlfiBalance > targetBuffer) {
            uint256 toDeposit = wlfiBalance - targetBuffer;
            uint256 sharesReceived = vault.deposit(toDeposit, address(this));
            emit DepositedToVault(toDeposit, sharesReceived);
        }
    }

    /**
     * @notice Rebalance buffer to target ratio
     * @dev Call periodically to maintain optimal buffer
     */
    function rebalanceBuffer() external onlyOwner {
        uint256 wlfiBalance = wlfi.balanceOf(address(this));
        uint256 targetBuffer = _calculateTargetBuffer();
        
        if (wlfiBalance < targetBuffer) {
            // Buffer too low, redeem from vault
            uint256 needed = targetBuffer - wlfiBalance;
            _redeemFromVault(needed);
        } else if (wlfiBalance > targetBuffer * 120 / 100) {
            // Buffer too high (>20% over target), deposit excess
            uint256 excess = wlfiBalance - targetBuffer;
            uint256 sharesReceived = vault.deposit(excess, address(this));
            emit DepositedToVault(excess, sharesReceived);
        }
    }

    /**
     * @notice Set buffer ratio (in basis points)
     * @param _bufferRatioBps New buffer ratio (e.g., 1000 = 10%, 500 = 5%)
     */
    function setBufferRatio(uint256 _bufferRatioBps) external onlyOwner {
        if (_bufferRatioBps > 5000) revert BufferRatioTooHigh(); // Max 50%
        uint256 oldRatio = bufferRatioBps;
        bufferRatioBps = _bufferRatioBps;
        emit BufferRatioUpdated(oldRatio, _bufferRatioBps);
    }

    /**
     * @notice Set minimum buffer amount
     * @param _minBuffer Minimum WLFI to keep as buffer
     */
    function setMinBuffer(uint256 _minBuffer) external onlyOwner {
        uint256 oldMin = minBuffer;
        minBuffer = _minBuffer;
        emit MinBufferUpdated(oldMin, _minBuffer);
    }

    /**
     * @notice Override _credit to redeem from vault if buffer insufficient
     * @dev Called by LayerZero when unlocking tokens
     */
    function _credit(
        address _to,
        uint256 _amountLD,
        uint32 _srcEid
    ) internal virtual override returns (uint256) {
        uint256 wlfiBalance = wlfi.balanceOf(address(this));
        
        // If buffer insufficient, redeem from vault
        if (wlfiBalance < _amountLD) {
            uint256 needed = _amountLD - wlfiBalance;
            _redeemFromVault(needed);
        }
        
        // Continue with standard unlock
        return super._credit(_to, _amountLD, _srcEid);
    }

    /**
     * @notice Redeem WLFI from vault
     * @param _amount Amount of WLFI needed
     */
    function _redeemFromVault(uint256 _amount) internal {
        uint256 vaultShares = vault.balanceOf(address(this));
        uint256 sharesToRedeem = vault.previewWithdraw(_amount);
        
        if (sharesToRedeem > vaultShares) {
            revert InsufficientVaultShares();
        }
        
        uint256 wlfiReceived = vault.redeem(sharesToRedeem, address(this), address(this));
        emit RedeemedFromVault(sharesToRedeem, wlfiReceived);
    }

    /**
     * @notice Calculate target buffer based on total liquidity
     * @return Target WLFI buffer amount
     */
    function _calculateTargetBuffer() internal view returns (uint256) {
        uint256 totalLiquidity = getTotalLiquidity();
        uint256 calculatedBuffer = (totalLiquidity * bufferRatioBps) / MAX_BPS;
        
        // Ensure minimum buffer
        return calculatedBuffer > minBuffer ? calculatedBuffer : minBuffer;
    }

    /**
     * @notice Get LayerZero endpoint from registry
     * @param _registry Registry address
     * @return LayerZero endpoint address
     */
    function _getEndpointFromRegistry(address _registry) private view returns (address) {
        IChainRegistry reg = IChainRegistry(_registry);
        uint16 chainId = reg.getCurrentChainId();
        address endpoint = reg.getLayerZeroEndpoint(chainId);
        require(endpoint != address(0), "ProductiveWLFIAdapter: endpoint not configured");
        return endpoint;
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get total liquidity (WLFI + vault shares value)
     * @return Total WLFI equivalent
     */
    function getTotalLiquidity() public view returns (uint256) {
        uint256 wlfiBalance = wlfi.balanceOf(address(this));
        uint256 vaultShares = vault.balanceOf(address(this));
        uint256 vaultValue = vault.convertToAssets(vaultShares);
        return wlfiBalance + vaultValue;
    }

    /**
     * @notice Get WLFI buffer balance
     * @return WLFI in buffer
     */
    function getBufferBalance() external view returns (uint256) {
        return wlfi.balanceOf(address(this));
    }

    /**
     * @notice Get vault shares balance
     * @return Vault shares held
     */
    function getVaultShares() external view returns (uint256) {
        return vault.balanceOf(address(this));
    }

    /**
     * @notice Get vault shares value in WLFI
     * @return WLFI value of vault shares
     */
    function getVaultValue() external view returns (uint256) {
        uint256 shares = vault.balanceOf(address(this));
        return vault.convertToAssets(shares);
    }

    /**
     * @notice Get current buffer ratio (actual vs target)
     * @return actual Current buffer ratio in bps
     * @return target Target buffer ratio in bps
     */
    function getBufferStatus() external view returns (uint256 actual, uint256 target) {
        uint256 totalLiquidity = getTotalLiquidity();
        uint256 wlfiBalance = wlfi.balanceOf(address(this));
        
        target = bufferRatioBps;
        actual = totalLiquidity > 0 ? (wlfiBalance * MAX_BPS) / totalLiquidity : 0;
    }

    /**
     * @notice Get adapter name
     */
    function adapterName() external pure returns (string memory) {
        return "Productive WLFI LayerZero Adapter";
    }

    /**
     * @notice Get adapter version
     */
    function adapterVersion() external pure returns (string memory) {
        return "2.0.0-productive";
    }

    /**
     * @notice Check if rebalance is needed
     * @return needed True if rebalance recommended
     * @return reason Human-readable reason
     */
    function needsRebalance() external view returns (bool needed, string memory reason) {
        uint256 wlfiBalance = wlfi.balanceOf(address(this));
        uint256 targetBuffer = _calculateTargetBuffer();
        
        if (wlfiBalance < targetBuffer * 80 / 100) {
            return (true, "Buffer too low (<80% of target)");
        }
        
        if (wlfiBalance > targetBuffer * 120 / 100) {
            return (true, "Buffer too high (>120% of target)");
        }
        
        return (false, "Buffer within acceptable range");
    }
}

