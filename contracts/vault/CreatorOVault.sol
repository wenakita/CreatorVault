// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title CreatorOVault
 * @author 0xakita.eth
 * @notice Minimal ERC-4626 vault for Creator Coins.
 * @dev This contract is intentionally size-constrained (EIP-170). Advanced strategy logic lives elsewhere.
 *
 * Core invariants:
 * - Underlying asset is the Creator Coin (ERC-20).
 * - Vault shares are ERC-20 (this contract address).
 * - Wrapper is whitelisted to deposit/redeem on behalf of users.
 * - GaugeController can burn shares it holds to increase PPS.
 * - Uses OZ ERC4626 virtual shares offset via `_decimalsOffset() = 3` (1e3) for inflation-attack resistance.
 */
contract CreatorOVault is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =================================
    // CONSTANTS
    // =================================

    /// @notice Minimum first deposit (matches frontend + batcher expectations).
    uint256 public constant MINIMUM_FIRST_DEPOSIT = 50_000_000e18;

    /// @notice Permission bitmask (reserved for future use).
    uint256 public constant OP_DEPOSIT = 1 << 0;
    uint256 public constant OP_WITHDRAW = 1 << 1;
    uint256 public constant OP_ACTIVATE = 1 << 2;

    // =================================
    // STATE
    // =================================

    /// @notice Creator Coin token (underlying asset).
    IERC20 public immutable CREATOR_COIN;

    /// @notice Whitelist gate for vault entrypoints (deposit/mint/withdraw/redeem).
    bool public whitelistEnabled = true;
    mapping(address => bool) public whitelist;

    /// @notice Gauge controller (can burn shares to increase PPS).
    address public gaugeController;

    /// @notice Protocol rescue authority (opt-in, set by owner; used by ops tooling).
    address public protocolRescue;

    // =================================
    // EVENTS
    // =================================

    event WhitelistEnabled(bool enabled);
    event WhitelistUpdated(address indexed account, bool status);
    event GaugeControllerUpdated(address indexed oldController, address indexed newController);
    event RescueConfigured(address indexed rescue);

    // =================================
    // ERRORS
    // =================================

    error ZeroAddress();
    error ZeroAmount();
    error ZeroShares();
    error NotWhitelisted();
    error OnlyGaugeController();
    error FirstDepositTooSmall(uint256 provided, uint256 minimum);

    // =================================
    // MODIFIERS
    // =================================

    modifier onlyWhitelisted() {
        if (whitelistEnabled && !whitelist[msg.sender]) revert NotWhitelisted();
        _;
    }

    modifier onlyGaugeController() {
        if (msg.sender != gaugeController) revert OnlyGaugeController();
        _;
    }

    // =================================
    // CONSTRUCTOR
    // =================================

    constructor(
        address _creatorCoin,
        address _owner,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) ERC4626(IERC20(_creatorCoin)) Ownable(_owner) {
        if (_creatorCoin == address(0) || _owner == address(0)) revert ZeroAddress();
        CREATOR_COIN = IERC20(_creatorCoin);
        whitelist[_owner] = true;
    }

    // =================================
    // ERC4626 OVERRIDES (WHITELISTED + REENTRANCY SAFE)
    // =================================

    function deposit(uint256 assets, address receiver)
        public
        override
        nonReentrant
        onlyWhitelisted
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0)) revert ZeroAddress();

        if (totalSupply() == 0 && assets < MINIMUM_FIRST_DEPOSIT) {
            revert FirstDepositTooSmall(assets, MINIMUM_FIRST_DEPOSIT);
        }

        shares = super.deposit(assets, receiver);
        if (shares == 0) revert ZeroShares();
    }

    function mint(uint256 shares, address receiver)
        public
        override
        nonReentrant
        onlyWhitelisted
        returns (uint256 assets)
    {
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0)) revert ZeroAddress();

        assets = super.mint(shares, receiver);
        if (assets == 0) revert ZeroAmount();

        // Ensure the very first mint corresponds to at least the minimum deposit.
        // (This mirrors the deposit check while keeping mint available for advanced flows.)
        if (totalSupply() == shares && assets < MINIMUM_FIRST_DEPOSIT) {
            revert FirstDepositTooSmall(assets, MINIMUM_FIRST_DEPOSIT);
        }
    }

    function withdraw(uint256 assets, address receiver, address owner_)
        public
        override
        nonReentrant
        onlyWhitelisted
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAmount();
        if (receiver == address(0) || owner_ == address(0)) revert ZeroAddress();
        shares = super.withdraw(assets, receiver, owner_);
        if (shares == 0) revert ZeroShares();
    }

    function redeem(uint256 shares, address receiver, address owner_)
        public
        override
        nonReentrant
        onlyWhitelisted
        returns (uint256 assets)
    {
        if (shares == 0) revert ZeroShares();
        if (receiver == address(0) || owner_ == address(0)) revert ZeroAddress();
        assets = super.redeem(shares, receiver, owner_);
        if (assets == 0) revert ZeroAmount();
    }

    // =================================
    // GAUGE CONTROLLER
    // =================================

    function setGaugeController(address _controller) external onlyOwner {
        address old = gaugeController;
        gaugeController = _controller;
        emit GaugeControllerUpdated(old, _controller);
    }

    /// @notice Burn shares held by the GaugeController to increase PPS for all holders.
    function burnSharesForPriceIncrease(uint256 shares) external onlyGaugeController {
        if (shares == 0) revert ZeroShares();
        _burn(msg.sender, shares);
    }

    /// @notice Price per share in 1e18 units.
    function pricePerShare() external view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) return 1e18;
        return (totalAssets() * 1e18) / supply;
    }

    // =================================
    // WHITELIST
    // =================================

    function setWhitelistEnabled(bool enabled) external onlyOwner {
        whitelistEnabled = enabled;
        emit WhitelistEnabled(enabled);
    }

    function setWhitelist(address _account, bool _status) external onlyOwner {
        if (_account == address(0)) revert ZeroAddress();
        whitelist[_account] = _status;
        emit WhitelistUpdated(_account, _status);
    }

    // =================================
    // PROTOCOL RESCUE (OPTIONAL)
    // =================================

    function setProtocolRescue(address rescue) external onlyOwner {
        protocolRescue = rescue;
        emit RescueConfigured(rescue);
    }

    // =================================
    // ERC20/4626 METADATA
    // =================================

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    function _decimalsOffset() internal pure override returns (uint8) {
        return 3; // 10^3 = 1000 virtual shares (inflation-attack resistance)
    }
}

