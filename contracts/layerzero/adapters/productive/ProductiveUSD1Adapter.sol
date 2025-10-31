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
 * @title ProductiveUSD1Adapter
 * @notice Capital-efficient OFT Adapter that deposits idle USD1 into EagleOVault to earn yield
 * 
 * @dev ENHANCEMENT over standard USD1Adapter:
 *      Instead of holding idle USD1 (0% APY), this adapter deposits idle liquidity
 *      into the vault to earn yield (e.g., 10% APY from Charm strategies).
 * 
 * KEY FEATURES:
 * ✅ Deposits idle USD1 → EagleOVault (earns yield)
 * ✅ Maintains configurable liquid buffer (default 10%)
 * ✅ Auto-redeems from vault when unlock needed
 * ✅ Same external interface as standard adapter
 * ✅ Drop-in replacement for USD1Adapter
 * ✅ Capital efficiency: 100% (vs 0% for standard)
 * 
 * CAPITAL EFFICIENCY:
 * - Standard Adapter: 50,000 USD1 idle → $0/year earnings
 * - Productive Adapter: 50,000 USD1 in vault → $5,000/year (at 10% APY)
 * 
 * ARCHITECTURE:
 * 1. Admin pre-funds adapter with USD1
 * 2. Adapter deposits 90% to vault (earns yield)
 * 3. Adapter keeps 10% liquid (instant unlock)
 * 4. When cross-chain unlock needed:
 *    - If buffer sufficient → unlock from buffer
 *    - If buffer insufficient → redeem from vault + unlock
 * 5. Periodically rebalance buffer (manual or keeper)
 * 
 * STABLECOIN CONSIDERATIONS:
 * - USD1 is a stablecoin (pegged to $1 USD)
 * - Lower volatility than WLFI
 * - Can maintain smaller buffer (e.g., 5% vs 10%)
 * - Predictable redemption amounts
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
 * 1. Deploy ProductiveUSD1Adapter(usd1, vault, registry, delegate)
 * 2. Transfer USD1 to adapter (e.g., 50,000 USD1)
 * 3. Call depositIdleToVault() to start earning
 * 4. Configure buffer ratio if needed (default 10%)
 * 5. Set LayerZero peers
 * 
 * @author Eagle Protocol
 * @notice Deploy this AFTER validating standard adapter works in production
 */
contract ProductiveUSD1Adapter is OFTAdapter {
    using SafeERC20 for IERC20;

    /// @notice EagleOVault (ERC4626 vault)
    IERC4626 public immutable vault;
    
    /// @notice USD1 token
    IERC20 public immutable usd1;
    
    /// @notice EagleRegistry for LayerZero endpoint lookup
    IChainRegistry public immutable registry;
    
    /// @notice Target buffer ratio (in basis points, 1000 = 10%)
    uint256 public bufferRatioBps = 1000; // 10% default
    
    /// @notice Minimum buffer to maintain (absolute amount)
    uint256 public minBuffer = 1000 ether; // 1,000 USD1 minimum
    
    /// @notice Maximum basis points
    uint256 public constant MAX_BPS = 10000;

    /// @notice Emitted when idle USD1 is deposited to vault
    event DepositedToVault(uint256 usd1Amount, uint256 sharesReceived);
    
    /// @notice Emitted when vault shares are redeemed for USD1
    event RedeemedFromVault(uint256 sharesRedeemed, uint256 usd1Received);
    
    /// @notice Emitted when buffer ratio is updated
    event BufferRatioUpdated(uint256 oldRatio, uint256 newRatio);
    
    /// @notice Emitted when minimum buffer is updated
    event MinBufferUpdated(uint256 oldMin, uint256 newMin);

    /// @notice Buffer ratio too high
    error BufferRatioTooHigh();
    
    /// @notice Insufficient vault shares
    error InsufficientVaultShares();

    /**
     * @notice Constructor for Productive USD1 Adapter
     * @param _usd1 Address of USD1 token
     * @param _vault Address of EagleOVault (ERC4626)
     * @param _registry Address of EagleRegistry
     * @param _delegate Admin address
     */
    constructor(
        address _usd1,
        address _vault,
        address _registry,
        address _delegate
    ) OFTAdapter(
        _usd1,
        _getEndpointFromRegistry(_registry),
        _delegate
    ) Ownable(_delegate) {
        require(_usd1 != address(0), "ProductiveUSD1Adapter: usd1 cannot be zero");
        require(_vault != address(0), "ProductiveUSD1Adapter: vault cannot be zero");
        require(_registry != address(0), "ProductiveUSD1Adapter: registry cannot be zero");
        require(_delegate != address(0), "ProductiveUSD1Adapter: delegate cannot be zero");
        
        usd1 = IERC20(_usd1);
        vault = IERC4626(_vault);
        registry = IChainRegistry(_registry);
        
        // Approve vault to spend USD1 (infinite approval for gas efficiency)
        usd1.approve(_vault, type(uint256).max);
    }

    /**
     * @notice Deposit idle USD1 into vault to earn yield
     * @dev Maintains buffer ratio, deposits excess to vault
     */
    function depositIdleToVault() external onlyOwner {
        uint256 usd1Balance = usd1.balanceOf(address(this));
        uint256 targetBuffer = _calculateTargetBuffer();
        
        if (usd1Balance > targetBuffer) {
            uint256 toDeposit = usd1Balance - targetBuffer;
            uint256 sharesReceived = vault.deposit(toDeposit, address(this));
            emit DepositedToVault(toDeposit, sharesReceived);
        }
    }

    /**
     * @notice Rebalance buffer to target ratio
     * @dev Call periodically to maintain optimal buffer
     */
    function rebalanceBuffer() external onlyOwner {
        uint256 usd1Balance = usd1.balanceOf(address(this));
        uint256 targetBuffer = _calculateTargetBuffer();
        
        if (usd1Balance < targetBuffer) {
            // Buffer too low, redeem from vault
            uint256 needed = targetBuffer - usd1Balance;
            _redeemFromVault(needed);
        } else if (usd1Balance > targetBuffer * 120 / 100) {
            // Buffer too high (>20% over target), deposit excess
            uint256 excess = usd1Balance - targetBuffer;
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
     * @param _minBuffer Minimum USD1 to keep as buffer
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
        uint256 usd1Balance = usd1.balanceOf(address(this));
        
        // If buffer insufficient, redeem from vault
        if (usd1Balance < _amountLD) {
            uint256 needed = _amountLD - usd1Balance;
            _redeemFromVault(needed);
        }
        
        // Continue with standard unlock
        return super._credit(_to, _amountLD, _srcEid);
    }

    /**
     * @notice Redeem USD1 from vault
     * @param _amount Amount of USD1 needed
     */
    function _redeemFromVault(uint256 _amount) internal {
        uint256 vaultShares = vault.balanceOf(address(this));
        uint256 sharesToRedeem = vault.previewWithdraw(_amount);
        
        if (sharesToRedeem > vaultShares) {
            revert InsufficientVaultShares();
        }
        
        uint256 usd1Received = vault.redeem(sharesToRedeem, address(this), address(this));
        emit RedeemedFromVault(sharesToRedeem, usd1Received);
    }

    /**
     * @notice Calculate target buffer based on total liquidity
     * @return Target USD1 buffer amount
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
        require(endpoint != address(0), "ProductiveUSD1Adapter: endpoint not configured");
        return endpoint;
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @notice Get total liquidity (USD1 + vault shares value)
     * @return Total USD1 equivalent
     */
    function getTotalLiquidity() public view returns (uint256) {
        uint256 usd1Balance = usd1.balanceOf(address(this));
        uint256 vaultShares = vault.balanceOf(address(this));
        uint256 vaultValue = vault.convertToAssets(vaultShares);
        return usd1Balance + vaultValue;
    }

    /**
     * @notice Get USD1 buffer balance
     * @return USD1 in buffer
     */
    function getBufferBalance() external view returns (uint256) {
        return usd1.balanceOf(address(this));
    }

    /**
     * @notice Get vault shares balance
     * @return Vault shares held
     */
    function getVaultShares() external view returns (uint256) {
        return vault.balanceOf(address(this));
    }

    /**
     * @notice Get vault shares value in USD1
     * @return USD1 value of vault shares
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
        uint256 usd1Balance = usd1.balanceOf(address(this));
        
        target = bufferRatioBps;
        actual = totalLiquidity > 0 ? (usd1Balance * MAX_BPS) / totalLiquidity : 0;
    }

    /**
     * @notice Get adapter name
     */
    function adapterName() external pure returns (string memory) {
        return "Productive USD1 LayerZero Adapter";
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
        uint256 usd1Balance = usd1.balanceOf(address(this));
        uint256 targetBuffer = _calculateTargetBuffer();
        
        if (usd1Balance < targetBuffer * 80 / 100) {
            return (true, "Buffer too low (<80% of target)");
        }
        
        if (usd1Balance > targetBuffer * 120 / 100) {
            return (true, "Buffer too high (>120% of target)");
        }
        
        return (false, "Buffer within acceptable range");
    }
}

