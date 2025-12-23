// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OFT} from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ICreatorRegistry {
    function getLotteryManager(uint16 chainId) external view returns (address);
    function getLayerZeroEndpoint(uint16 chainId) external view returns (address);
}

interface ICreatorLotteryManager {
    function processSwapLottery(address recipient, address token, uint256 amount) external returns (uint256);
}

interface ICreatorOVault {
    function convertToAssets(uint256 shares) external view returns (uint256);
}

interface ICreatorGaugeController {
    function receiveFees(uint256 amount) external;
}

/**
 * @title CreatorShareOFT
 * @author 0xakita.eth (CreatorVault)
 * @notice OFT receipt token for CreatorOVault with buy fee and lottery integration
 * 
 * @dev FEATURES:
 *      - LayerZero OFT for cross-chain share transfers
 *      - Buy fee on DEX purchases (configurable, default 6.9%)
 *      - Lottery integration for buyers
 *      - SwapOnly address classification for DEX detection
 * 
 * @dev FEE MECHANISM:
 *      - Register DEX pools/routers as SwapOnly
 *      - Buys (from SwapOnly → user) = fee to GaugeController
 *      - Sells and normal transfers = no fee
 * 
 * @dev PART OF CREATORTECH PLATFORM:
 *      Each creator deploys their own ShareOFT (e.g., stkmaakita for akita vault)
 */
contract CreatorShareOFT is OFT, ReentrancyGuard {
    
    // ================================
    // CONSTANTS
    // ================================
    
    uint256 public constant BASIS_POINTS = 10000;
    uint16 public constant MAX_FEE_BPS = 1000; // 10% max
    
    // ================================
    // TYPES
    // ================================
    
    /// @notice Address classification for fee detection
    enum OperationType {
        Unknown,   // Normal transfer - no fees
        SwapOnly,  // Trading venue - buys = fee
        NoFees     // Exempt from all fees
    }
    
    // ================================
    // STATE
    // ================================
    
    /// @notice CreatorRegistry for ecosystem contracts
    ICreatorRegistry public registry;
    
    /// @notice Chain EID for this deployment
    uint32 public immutable chainEid;
    
    /// @notice Associated vault
    address public vault;
    
    /// @notice All fees go here
    address public gaugeController;
    
    /// @notice Buy fee in basis points (690 = 6.9%)
    uint16 public buyFeeBps = 690;
    
    /// @notice Feature toggles
    bool public feesEnabled = true;
    bool public lotteryEnabled = true;
    
    /// @notice Address classification mapping
    mapping(address => OperationType) public addressType;
    
    /// @notice Minter permissions (for wrapper integration)
    mapping(address => bool) public isMinter;
    
    // ================================
    // EVENTS
    // ================================
    
    event VaultSet(address indexed vault);
    event RegistrySet(address indexed registry);
    event SharesMinted(address indexed to, uint256 amount);
    event SharesBurned(address indexed from, uint256 amount);
    event BuyFee(address indexed from, address indexed to, uint256 amount, uint256 fee);
    event FeeCollected(address indexed gaugeController, uint256 amount);
    event LotteryTriggered(address indexed buyer, uint256 amount, uint256 requestId);
    event AddressTypeSet(address indexed addr, OperationType opType);
    event GaugeControllerSet(address indexed controller);
    event BuyFeeUpdated(uint16 oldFee, uint16 newFee);
    event MinterUpdated(address indexed minter, bool status);
    
    // ================================
    // ERRORS
    // ================================
    
    error OnlyVaultOrMinter();
    error ZeroAddress();
    error FeeTooHigh();
    error NotMinter();
    
    // ================================
    // MODIFIERS
    // ================================
    
    modifier onlyVaultOrMinter() {
        if (msg.sender != vault && !isMinter[msg.sender] && msg.sender != owner()) {
            revert OnlyVaultOrMinter();
        }
        _;
    }
    
    // ================================
    // CONSTRUCTOR
    // ================================
    
    /**
     * @notice Deploy chain-specific share token
     * @param _name Token name (e.g., "AKITA Shares")
     * @param _symbol Token symbol (e.g., "wsAKITA")
     * @param _registry CreatorRegistry address (same on all chains for deterministic addresses)
     * @param _owner Owner address
     * 
     * @dev DETERMINISTIC DEPLOYMENT:
     *      Registry address is same on all chains via CREATE2.
     *      LayerZero endpoint is looked up from registry at construction.
     *      This allows same constructor args → same CREATE2 address on all chains.
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _registry,
        address _owner
    ) OFT(_name, _symbol, ICreatorRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid)), _owner) Ownable(_owner) {
        if (_registry == address(0)) revert ZeroAddress();
        
        registry = ICreatorRegistry(_registry);
        chainEid = uint32(block.chainid);
        addressType[address(this)] = OperationType.NoFees;
    }
    
    // ================================
    // VAULT FUNCTIONS
    // ================================
    
    /**
     * @notice Set the vault that can mint/burn shares
     * @param _vault CreatorOVault address
     */
    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        vault = _vault;
        addressType[_vault] = OperationType.NoFees;
        emit VaultSet(_vault);
    }
    
    /**
     * @notice Set the registry for ecosystem lookups
     * @param _registry CreatorRegistry address
     */
    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        registry = ICreatorRegistry(_registry);
        emit RegistrySet(_registry);
    }
    
    /**
     * @notice Set minter permission (for wrapper integration)
     * @param minter Address to grant/revoke minting
     * @param status True to grant, false to revoke
     */
    function setMinter(address minter, bool status) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        isMinter[minter] = status;
        emit MinterUpdated(minter, status);
    }
    
    /**
     * @notice Mint shares (vault/minter only)
     * @param _to Recipient
     * @param _amount Amount to mint
     */
    function mint(address _to, uint256 _amount) external onlyVaultOrMinter {
        _mint(_to, _amount);
        emit SharesMinted(_to, _amount);
    }
    
    /**
     * @notice Burn shares (vault/minter only)
     * @param _from Address to burn from
     * @param _amount Amount to burn
     */
    function burn(address _from, uint256 _amount) external onlyVaultOrMinter {
        _burn(_from, _amount);
        emit SharesBurned(_from, _amount);
    }
    
    // ================================
    // TRANSFERS WITH FEES
    // ================================
    
    /**
     * @notice Transfer shares with fee detection
     */
    function transfer(address to, uint256 amount) public override returns (bool) {
        return _transferWithFees(_msgSender(), to, amount);
    }

    /**
     * @notice Transfer shares from another account with fee detection
     */
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _spendAllowance(from, _msgSender(), amount);
        return _transferWithFees(from, to, amount);
    }

    /**
     * @dev Internal transfer with fee logic
     */
    function _transferWithFees(address from, address to, uint256 amount) internal returns (bool) {
        if (from == address(0) || to == address(0)) revert ZeroAddress();

        OperationType fromType = addressType[from];
        OperationType toType = addressType[to];
        
        // Skip fees if either side is exempt
        if (fromType == OperationType.NoFees || toType == OperationType.NoFees) {
            _transfer(from, to, amount);
            return true;
        }
        
        // BUY = from trading venue to non-venue
        if (fromType == OperationType.SwapOnly && toType != OperationType.SwapOnly) {
            return _processBuy(from, to, amount);
        }
        
        // All else = no fees
        _transfer(from, to, amount);
        return true;
    }

    /**
     * @dev Process buy with fees. Follows CEI pattern.
     * 
     * @notice FEE FLOW - THE SOCIAL-FI ENGINE:
     *         1. Fee is collected in OFT tokens (stkmaakita)
     *         2. Sent to GaugeController via receiveFees()
     *         3. GaugeController distributes:
     *            - 50% burned → increases PPS for all vault holders
     *            - 31% lottery → jackpot for buyers
     *            - 19% creator → treasury
     *         
     *         This makes users "win with the creator" - their vault
     *         shares become more valuable from trading activity!
     */
    function _processBuy(address from, address to, uint256 amount) internal nonReentrant returns (bool) {
        // Cache storage reads
        uint16 _buyFeeBps = buyFeeBps;
        address _gaugeController = gaugeController;
        bool _feesEnabled = feesEnabled;
        
        if (!_feesEnabled || _buyFeeBps == 0 || _gaugeController == address(0)) {
            _transfer(from, to, amount);
            return true;
        }
        
        // Calculate fee
        uint256 feeAmount = (amount * _buyFeeBps) / BASIS_POINTS;
        uint256 transferAmount = amount - feeAmount;

        // CEI: Effects - transfer fee to this contract first, then to buyer
        _transfer(from, address(this), feeAmount);
        _transfer(from, to, transferAmount);
        
        emit BuyFee(from, to, amount, feeAmount);

        // Interactions: Send fees to gauge controller
        _sendFeesToGauge(_gaugeController, feeAmount);
        
        // Trigger lottery for buyer
        _triggerLottery(to, transferAmount);
        
        return true;
    }
    
    /**
     * @dev Send accumulated fees to gauge controller
     */
    function _sendFeesToGauge(address _gaugeController, uint256 amount) internal {
        if (amount == 0) return;
        
        // Approve gauge controller to pull tokens
        _approve(address(this), _gaugeController, amount);
        
        // Call receiveFees on gauge controller
        try ICreatorGaugeController(_gaugeController).receiveFees(amount) {
            emit FeeCollected(_gaugeController, amount);
        } catch {
            // If gauge controller call fails, transfer directly as fallback
            _transfer(address(this), _gaugeController, amount);
            emit FeeCollected(_gaugeController, amount);
        }
    }

    // ================================
    // LOTTERY
    // ================================

    /**
     * @dev Trigger lottery for recipient (EOA only)
     */
    function _triggerLottery(address recipient, uint256 amount) internal {
        if (!lotteryEnabled) return;
        if (address(registry) == address(0)) return;
        
        // Only EOAs can win lottery
        if (recipient.code.length > 0) return;
        
        address mgr = registry.getLotteryManager(uint16(block.chainid));
        if (mgr == address(0)) return;
        
        try ICreatorLotteryManager(mgr).processSwapLottery(recipient, address(this), amount) returns (uint256 id) {
            if (id > 0) emit LotteryTriggered(recipient, amount, id);
        } catch {
            // Lottery failure should not block transfer
        }
    }

    // ================================
    // ADMIN
    // ================================
    
    /**
     * @notice Set operation type for an address
     */
    function setAddressType(address addr, OperationType opType) external onlyOwner {
        if (addr == address(0)) revert ZeroAddress();
        addressType[addr] = opType;
        emit AddressTypeSet(addr, opType);
    }

    /**
     * @notice Batch set operation types
     */
    function setAddressTypes(address[] calldata addrs, OperationType opType) external onlyOwner {
        for (uint256 i; i < addrs.length;) {
            address addr = addrs[i];
            if (addr == address(0)) revert ZeroAddress();
            addressType[addr] = opType;
            emit AddressTypeSet(addr, opType);
            unchecked { ++i; }
        }
    }

    /**
     * @notice Set gauge controller (fee recipient)
     */
    function setGaugeController(address _controller) external onlyOwner {
        if (_controller == address(0)) revert ZeroAddress();
        gaugeController = _controller;
        addressType[_controller] = OperationType.NoFees;
        emit GaugeControllerSet(_controller);
    }

    /**
     * @notice Set buy fee (max 10%)
     */
    function setBuyFee(uint16 _feeBps) external onlyOwner {
        if (_feeBps > MAX_FEE_BPS) revert FeeTooHigh();
        emit BuyFeeUpdated(buyFeeBps, _feeBps);
        buyFeeBps = _feeBps;
    }

    /**
     * @notice Enable/disable fees
     */
    function setFeesEnabled(bool _enabled) external onlyOwner {
        feesEnabled = _enabled;
    }
    
    /**
     * @notice Enable/disable lottery
     */
    function setLotteryEnabled(bool _enabled) external onlyOwner {
        lotteryEnabled = _enabled;
    }

    // ================================
    // VIEW FUNCTIONS
    // ================================
    
    /**
     * @notice Convert shares to underlying Creator Coin amount
     */
    function convertToAssets(uint256 shares) public view returns (uint256) {
        if (vault == address(0)) return shares;
        return ICreatorOVault(vault).convertToAssets(shares);
    }

    /**
     * @notice Preview fee for a transfer
     */
    function previewFee(address from, address to, uint256 amount) external view returns (bool isBuy, uint256 fee) {
        if (addressType[from] == OperationType.NoFees || addressType[to] == OperationType.NoFees) {
            return (false, 0);
        }
        if (addressType[from] == OperationType.SwapOnly && addressType[to] != OperationType.SwapOnly && feesEnabled) {
            return (true, (amount * buyFeeBps) / BASIS_POINTS);
        }
        return (false, 0);
    }

    /**
     * @notice Check if address is a trading venue
     */
    function isTradingVenue(address addr) external view returns (bool) {
        return addressType[addr] == OperationType.SwapOnly;
    }

    /**
     * @notice Confirm transfers are always allowed
     */
    function canTransfer(address, address, uint256) external pure returns (bool) {
        return true;
    }
    
    /**
     * @notice Check if address is a minter
     */
    function checkMinter(address account) external view returns (bool) {
        return isMinter[account] || account == vault || account == owner();
    }
    
    /**
     * @notice Get contract version
     */
    function version() external pure returns (string memory) {
        return "1.0.0-creatortech";
    }
    
    /**
     * @notice Get token category
     */
    function category() external pure returns (string memory) {
        return "Creator Vault Share Token";
    }
    
    /**
     * @notice Get token description
     */
    function description() external pure returns (string memory) {
        return "CreatorVault Share Token - Represents proportional ownership of assets in a Creator Coin Omnichain Vault. Enables cross-chain transfers via LayerZero.";
    }
}

