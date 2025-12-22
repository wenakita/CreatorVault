// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OFT} from "@layerzerolabs/lz-evm-oapp-v2/contracts/oft/OFT.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IOmniDragonRegistry} from "../../interfaces/config/IOmniDragonRegistry.sol";
import {IOmniDragonLotteryManager} from "../../interfaces/lottery/IOmniDragonLotteryManager.sol";
import {IDragonOVault} from "../../interfaces/vaults/IDragonOVault.sol";

/**
 * @title DragonShareOFT
 * @author 0xakita.eth
 * @notice OFT receipt token for DragonOVault with 6.9% buy fee and lottery
 * @dev Fee detection: Register pools/routers as SwapOnly, buys = 6.9% fee to GaugeController
 */
contract DragonShareOFT is OFT, ReentrancyGuard {
    
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
    
    IOmniDragonRegistry public immutable registry;
    uint32 public immutable chainEid;
    
    address public vault;
    string public chainPrefix;
    
    /// @notice All fees go here
    address public gaugeController;
    
    /// @notice Buy fee in basis points (690 = 6.9%)
    uint16 public buyFeeBps = 690;
    
    bool public feesEnabled = true;
    bool public lotteryEnabled = true;
    
    /// @notice Address classification mapping
    mapping(address => OperationType) public addressType;
    
    // ================================
    // EVENTS
    // ================================
    
    event VaultSet(address indexed vault);
    event SharesMinted(address indexed to, uint256 amount);
    event SharesBurned(address indexed from, uint256 amount);
    event BuyFee(address indexed from, address indexed to, uint256 amount, uint256 fee);
    event FeeCollected(address indexed gaugeController, uint256 amount);
    event LotteryTriggered(address indexed buyer, uint256 amount, uint256 requestId);
    event AddressTypeSet(address indexed addr, OperationType opType);
    event GaugeControllerSet(address indexed controller);
    event BuyFeeUpdated(uint16 oldFee, uint16 newFee);
    
    // ================================
    // ERRORS
    // ================================
    
    error OnlyVault();
    error ZeroAddress();
    error FeeTooHigh();
    
    // ================================
    // MODIFIERS
    // ================================
    
    modifier onlyVault() {
        if (msg.sender != vault) revert OnlyVault();
        _;
    }
    
    // ================================
    // CONSTRUCTOR
    // ================================
    
    /**
     * @notice Deploy chain-specific share token
     * @param _name Token name (e.g., "baseDRAGON")
     * @param _symbol Token symbol
     * @param _chainPrefix Chain prefix for display
     * @param _registry OmniDragon registry address
     * @param _owner Owner address
     */
    constructor(
        string memory _name,
        string memory _symbol,
        string memory _chainPrefix,
        address _registry,
        address _owner
    ) OFT(
        _name,
        _symbol,
        IOmniDragonRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid)),
        _owner
    ) Ownable(_owner) {
        if (_registry == address(0)) revert ZeroAddress();
        
        registry = IOmniDragonRegistry(_registry);
        chainPrefix = _chainPrefix;
        chainEid = uint32(registry.chainIdToEid(block.chainid));
        addressType[address(this)] = OperationType.NoFees;
    }
    
    // ================================
    // VAULT FUNCTIONS
    // ================================
    
    /**
     * @notice Set the vault that can mint/burn shares
     * @param _vault DragonOVault address
     */
    function setVault(address _vault) external onlyOwner {
        if (_vault == address(0)) revert ZeroAddress();
        vault = _vault;
        addressType[_vault] = OperationType.NoFees;
        emit VaultSet(_vault);
    }
    
    /**
     * @notice Mint shares (vault only)
     * @param _to Recipient
     * @param _amount Amount to mint
     */
    function mint(address _to, uint256 _amount) external onlyVault {
        _mint(_to, _amount);
        emit SharesMinted(_to, _amount);
    }
    
    /**
     * @notice Burn shares (vault only)
     * @param _from Address to burn from
     * @param _amount Amount to burn
     */
    function burn(address _from, uint256 _amount) external onlyVault {
        _burn(_from, _amount);
        emit SharesBurned(_from, _amount);
    }
    
    // ================================
    // TRANSFERS
    // ================================
    
    /// @notice Transfer shares with fee detection
    function transfer(address to, uint256 amount) public override returns (bool) {
        return _transferWithFees(_msgSender(), to, amount);
    }

    /// @notice Transfer shares from another account with fee detection
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

        // CEI: Effects before interactions
        _transfer(from, _gaugeController, feeAmount);
        _transfer(from, to, transferAmount);
        
        emit BuyFee(from, to, amount, feeAmount);
        emit FeeCollected(_gaugeController, feeAmount);

        // Interactions: External calls after state changes
        _triggerLottery(to, transferAmount);
        
        return true;
    }

    // ================================
    // LOTTERY
    // ================================

    /**
     * @dev Trigger lottery for recipient (EOA only)
     */
    function _triggerLottery(address recipient, uint256 amount) internal {
        if (!lotteryEnabled) return;
        
        // Only EOAs can win lottery
        if (recipient.code.length > 0) return;
        
        address mgr = registry.getLotteryManager(uint16(block.chainid));
        if (mgr == address(0)) return;
        
        try IOmniDragonLotteryManager(mgr).processSwapLottery(recipient, address(this), amount) returns (uint256 id) {
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
     * @notice Get chain-specific name
     */
    function getChainName() external view returns (string memory) {
        return string(abi.encodePacked(chainPrefix, "DRAGON"));
    }
    
    /**
     * @notice Convert shares to underlying DRAGON amount
     */
    function convertToAssets(uint256 shares) public view returns (uint256) {
        if (vault == address(0)) return shares;
        return IDragonOVault(vault).convertToAssets(shares);
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
}
