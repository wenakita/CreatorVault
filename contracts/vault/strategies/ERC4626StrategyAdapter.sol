// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

import {IStrategy} from "../../interfaces/IStrategy.sol";

interface ICreatorOVaultLike {
    function CREATOR_COIN() external view returns (IERC20);
}

/**
 * @title ERC4626StrategyAdapter
 * @author 0xakita.eth
 * @notice Adapts an ERC-4626 vault to the `IStrategy` interface.
 * @dev Used by CreatorOVault to integrate ERC-4626 yield sources.
 */
contract ERC4626StrategyAdapter is IStrategy, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // ERRORS
    // ================================

    error OnlyVault();
    error StrategyPaused();

    // ================================
    // STATE
    // ================================

    /// @notice CreatorOVault that owns this strategy.
    address public immutable vault;

    /// @notice Underlying asset token (must match the ERC-4626 `asset()`).
    IERC20 public immutable ASSET;

    /// @notice Target ERC-4626 vault (strategy holds shares of this vault).
    IERC4626 public immutable ERC4626_VAULT;

    /// @notice Strategy active flag.
    bool private _isActive;

    /// @notice Target % of strategy assets to keep idle (basis points).
    uint256 public idleBufferBps = 1000; // 10% default

    // ================================
    // MODIFIERS
    // ================================

    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }

    modifier whenActive() {
        if (!_isActive) revert StrategyPaused();
        _;
    }

    // ================================
    // CONSTRUCTOR
    // ================================

    constructor(address _vault, address _erc4626Vault, address _owner) Ownable(_owner) {
        require(_vault != address(0), "Invalid vault");
        require(_erc4626Vault != address(0), "Invalid ERC4626");

        vault = _vault;
        ERC4626_VAULT = IERC4626(_erc4626Vault);

        address assetAddr = IERC4626(_erc4626Vault).asset();
        require(assetAddr != address(0), "Invalid asset");
        ASSET = IERC20(assetAddr);

        // Safety: prevent wiring a strategy with an asset that doesn't match the vault's creator coin.
        require(address(ICreatorOVaultLike(_vault).CREATOR_COIN()) == assetAddr, "Vault/asset mismatch");

        _isActive = true;
    }

    // ================================
    // ISTRATEGY VIEW
    // ================================

    function isActive() external view override returns (bool) {
        return _isActive;
    }

    function asset() external view override returns (address) {
        return address(ASSET);
    }

    function getTotalAssets() public view override returns (uint256) {
        uint256 idle = ASSET.balanceOf(address(this));
        uint256 sharesHeld = ERC4626_VAULT.balanceOf(address(this));
        if (sharesHeld == 0) return idle;

        // Best-effort conversion (some 4626 implementations can revert in edge cases).
        try ERC4626_VAULT.convertToAssets(sharesHeld) returns (uint256 assetsFromShares) {
            return idle + assetsFromShares;
        } catch {
            return idle;
        }
    }

    // ================================
    // ISTRATEGY OPERATIONS
    // ================================

    function deposit(uint256 amount) external override onlyVault whenActive nonReentrant returns (uint256 deposited) {
        if (amount == 0) return 0;

        // Pull assets from the vault.
        // Pull assets from the vault (onlyVault guards access).
        ASSET.safeTransferFrom(vault, address(this), amount);

        // Maintain idle buffer: deposit only excess idle into the ERC4626 vault.
        uint256 total = getTotalAssets();
        uint256 desiredIdle = (total * idleBufferBps) / 10_000;
        uint256 idle = ASSET.balanceOf(address(this));
        uint256 toDeposit = idle > desiredIdle ? idle - desiredIdle : 0;

        if (toDeposit > 0) {
            // Best-effort: if the ERC4626 deposit reverts, keep funds idle (never brick vault ops).
            ASSET.forceApprove(address(ERC4626_VAULT), toDeposit);
            try ERC4626_VAULT.deposit(toDeposit, address(this)) {} catch {}
        }

        deposited = amount;
        emit StrategyDeposit(msg.sender, amount, deposited);
    }

    function withdraw(uint256 amount) external override onlyVault nonReentrant returns (uint256 withdrawn) {
        if (amount == 0) return 0;

        uint256 remaining = amount;
        uint256 idle = ASSET.balanceOf(address(this));

        // Use idle first.
        if (idle > 0) {
            uint256 takeIdle = idle > remaining ? remaining : idle;
            if (takeIdle > 0) {
                ASSET.safeTransfer(vault, takeIdle);
                withdrawn += takeIdle;
                remaining -= takeIdle;
            }
        }

        if (remaining > 0) {
            uint256 pulled = _withdrawFrom4626BestEffort(remaining);
            if (pulled > 0) {
                ASSET.safeTransfer(vault, pulled);
                withdrawn += pulled;
            }
        }

        emit StrategyWithdraw(msg.sender, amount, withdrawn);
    }

    function emergencyWithdraw() external override onlyVault nonReentrant returns (uint256 totalWithdrawn) {
        _isActive = false;

        // Best-effort: withdraw as much as possible from the ERC4626 vault.
        uint256 maxAssets = _maxWithdrawBestEffort();
        if (maxAssets > 0) {
            _withdrawFrom4626BestEffort(maxAssets);
        }

        totalWithdrawn = ASSET.balanceOf(address(this));
        if (totalWithdrawn > 0) {
            ASSET.safeTransfer(vault, totalWithdrawn);
        }

        emit EmergencyWithdraw(vault, totalWithdrawn);
    }

    function harvest() external override onlyVault returns (uint256 profit) {
        // CreatorOVault accounts for gains via totalAssets() deltas in `report()`.
        profit = 0;
        emit StrategyHarvest(profit);
    }

    function rebalance() external override onlyVault {
        // Best-effort idle buffer maintenance:
        // - deposit excess idle to ERC4626
        // - or withdraw from ERC4626 to restore idle if needed
        uint256 total = getTotalAssets();
        uint256 desiredIdle = (total * idleBufferBps) / 10_000;
        uint256 idle = ASSET.balanceOf(address(this));

        if (idle > desiredIdle) {
            uint256 toDeposit = idle - desiredIdle;
            if (toDeposit > 0) {
                ASSET.forceApprove(address(ERC4626_VAULT), toDeposit);
                try ERC4626_VAULT.deposit(toDeposit, address(this)) {} catch {}
            }
        } else if (idle < desiredIdle) {
            uint256 toPull = desiredIdle - idle;
            if (toPull > 0) {
                _withdrawFrom4626BestEffort(toPull);
            }
        }

        emit StrategyRebalanced(getTotalAssets());
    }

    // ================================
    // INTERNAL (BEST-EFFORT 4626)
    // ================================

    function _maxWithdrawBestEffort() internal view returns (uint256) {
        try ERC4626_VAULT.maxWithdraw(address(this)) returns (uint256 maxAssets) {
            return maxAssets;
        } catch {
            return 0;
        }
    }

    function _maxRedeemBestEffort() internal view returns (uint256) {
        try ERC4626_VAULT.maxRedeem(address(this)) returns (uint256 maxShares) {
            return maxShares;
        } catch {
            return 0;
        }
    }

    function _withdrawFrom4626BestEffort(uint256 assets) internal returns (uint256 pulled) {
        if (assets == 0) return 0;

        uint256 maxAssets = _maxWithdrawBestEffort();
        uint256 toWithdraw = assets > maxAssets ? maxAssets : assets;
        if (toWithdraw == 0) return 0;

        // Prefer withdraw(assets) to keep accounting in asset terms.
        try ERC4626_VAULT.withdraw(toWithdraw, address(this), address(this)) returns (uint256 /* shares */) {
            pulled = toWithdraw;
            return pulled;
        } catch {
            // Fallback: try redeeming the maximum available shares (or previewWithdraw shares).
            uint256 maxShares = _maxRedeemBestEffort();
            if (maxShares == 0) return 0;

            // Attempt to redeem enough shares for the requested assets.
            uint256 sharesToRedeem = maxShares;
            try ERC4626_VAULT.previewWithdraw(toWithdraw) returns (uint256 previewShares) {
                if (previewShares < sharesToRedeem) sharesToRedeem = previewShares;
            } catch {
                // If previewWithdraw reverts, redeem maxShares (best-effort).
            }

            if (sharesToRedeem == 0) return 0;

            try ERC4626_VAULT.redeem(sharesToRedeem, address(this), address(this)) returns (uint256 assetsOut) {
                return assetsOut;
            } catch {
                return 0;
            }
        }
    }

    // ================================
    // ADMIN
    // ================================

    function setActive(bool active) external onlyOwner {
        _isActive = active;
    }

    function setIdleBufferBps(uint256 newBps) external onlyOwner {
        require(newBps <= 10_000, "Invalid bps");
        idleBufferBps = newBps;
    }

    function rescueTokens(address token, uint256 amount, address to) external onlyOwner {
        // Don't allow rescuing the underlying while active.
        if (token == address(ASSET) && _isActive) revert("Cannot rescue asset when active");
        IERC20(token).safeTransfer(to, amount);
    }
}


