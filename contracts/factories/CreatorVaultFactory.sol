// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {CreatorOVault} from "../vault/CreatorOVault.sol";
import {CreatorOVaultWrapper} from "../vault/CreatorOVaultWrapper.sol";
import {CreatorShareOFT} from "../layerzero/CreatorShareOFT.sol";
import {CreatorGaugeController} from "../governance/CreatorGaugeController.sol";
import {CCALaunchStrategy} from "../strategies/CCALaunchStrategy.sol";
import {ICreatorRegistry} from "../interfaces/core/ICreatorRegistry.sol";

/**
 * @title CreatorVaultFactory
 * @author 0xakita.eth Think FriendTech, but for CreatorCoins, in ERC-4626 Omnichain Vaults
 * @notice Factory for deploying complete Creator Coin vault infrastructure
 * 
 * @dev DEPLOYS FIVE CONTRACTS:
 *      1. CreatorOVault - ERC-4626 vault for Creator Coin
 *      2. CreatorOVaultWrapper - All-in-one deposit/withdraw + wrap/unwrap
 *      3. CreatorShareOFT - LayerZero OFT for cross-chain transfers
 *      4. CreatorGaugeController - Fee distribution (burns → PPS increase)
 *      5. CCALaunchStrategy - Fair launch via Uniswap CCA (official mechanism)
 * 
 * @dev USER EXPERIENCE:
 *      Users interact with the WRAPPER:
 *      - deposit(akita) → wsAKITA
 *      - withdraw(wsAKITA) → akita
 *      
 * 
 * @dev LAUNCH FLOW (via CCA):
 *      1. Deploy infrastructure via this factory
 *      2. Creator deposits Creator Coin → gets wsAKITA
 *      3. Launch CCA auction for fair wsAKITA distribution
 *      4. Auction graduates → V4 pool initialized automatically
 *      5. Ongoing trading uses tax hook + ShareOFT fee detection
 * 
 * @dev FEE FLOW (Social-Fi Engine):
 *      Buy fee (6.9%) → GaugeController:
 *      - 50% burned → increases PPS for all holders
 *      - 31% lottery → jackpot
 *      - 19% creator → treasury
 * 
 * @dev TOKEN NAMING CONVENTION:
 *      Creator Coin: akita
 *      Vault Share: "AKITA Vault" (sAKITA) - deposit receipt
 *      Wrapped Share: "Wrapped AKITA Share" (wsAKITA) - cross-chain OFT
 * 
 * @dev TOKEN FLOW:
 *      akita → deposit → sAKITA → wrap → wsAKITA (trades on DEX)
 */
contract CreatorVaultFactory is Ownable {
    
    // =================================
    // STATE
    // =================================
    
    /// @notice CreatorRegistry for ecosystem integration
    ICreatorRegistry public registry;
    
    /// @notice Arachnid's CREATE2 factory (deployed on 100+ chains)
    address public constant CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    /// @notice Deployment counter for unique salts
    uint256 public deploymentCount;
    
    /// @notice All deployments by this factory
    mapping(address => DeploymentInfo) public deployments;
    address[] public deployedTokens;
    
    /// @notice Struct to store deployment info
    struct DeploymentInfo {
        address creatorCoin;
        address vault;
        address wrapper;         // User-facing: deposit/withdraw + wrap/unwrap
        address shareOFT;
        address gaugeController; // Fee distribution
        address ccaStrategy;     // Fair launch via Uniswap CCA
        address creator;
        uint256 deployedAt;
        bool exists;
    }
    
    // =================================
    // EVENTS
    // =================================
    
    event VaultInfrastructureDeployed(
        address indexed creatorCoin,
        address indexed vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy,
        address creator
    );
    
    event RegistryUpdated(address indexed newRegistry);
    event GaugeControllerDeployed(address indexed creatorCoin, address indexed gaugeController);
    event CCAStrategyDeployed(address indexed creatorCoin, address indexed ccaStrategy);
    
    // =================================
    // ERRORS
    // =================================
    
    error ZeroAddress();
    error InvalidName();
    error InvalidSymbol();
    error DeploymentFailed();
    error AlreadyDeployed();
    error RegistryNotSet();
    
    // =================================
    // CONSTRUCTOR
    // =================================
    
    constructor(address _registry, address _owner) Ownable(_owner) {
        if (_owner == address(0)) revert ZeroAddress();
        if (_registry != address(0)) {
            registry = ICreatorRegistry(_registry);
        }
    }
    
    // =================================
    // DEPLOYMENT FUNCTIONS
    // =================================
    
    /**
     * @notice Deploy with auto-generated names based on creator coin symbol
     * @param _creatorCoin Creator Coin token address
     * @param _creator Creator's address (will be owner of deployed contracts)
     * @return vault CreatorOVault address
     * @return wrapper CreatorOVaultWrapper address (user-facing)
     * @return shareOFT CreatorShareOFT address
     * @return gaugeController CreatorGaugeController address
     * @return ccaStrategy CCALaunchStrategy address (fair launch)
     * 
     * @dev AUTO-NAMING CONVENTION:
     *      Creator Coin: akita
     *      Vault Share: "AKITA Vault" (sAKITA) - deposit receipt
     *      Wrapped Share: "Wrapped AKITA Share" (wsAKITA) - cross-chain OFT
     * 
     * @dev TOKEN FLOW:
     *      akita → deposit → sAKITA → wrap → wsAKITA (cross-chain)
     */
    function deployCreatorVaultAuto(
        address _creatorCoin,
        address _creator
    ) external returns (
        address vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy
    ) {
        // Get creator coin symbol (uppercase for consistency)
        string memory symbol = _toUpperCase(IERC20Metadata(_creatorCoin).symbol());
        
        // Generate names following v/ws convention
        string memory vaultName = string(abi.encodePacked(symbol, " Vault"));
        string memory vaultSymbol = string(abi.encodePacked("v", symbol));
        string memory oftName = string(abi.encodePacked("Wrapped ", symbol, " Share"));
        string memory oftSymbol = string(abi.encodePacked("ws", symbol));
        
        return this.deployCreatorVault(
            _creatorCoin,
            vaultName,
            vaultSymbol,
            oftName,
            oftSymbol,
            _creator
        );
    }
    
    /**
     * @dev Convert string to uppercase
     */
    function _toUpperCase(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bUpper = new bytes(bStr.length);
        for (uint i = 0; i < bStr.length; i++) {
            // If lowercase letter (a-z), convert to uppercase
            if (bStr[i] >= 0x61 && bStr[i] <= 0x7A) {
                bUpper[i] = bytes1(uint8(bStr[i]) - 32);
            } else {
                bUpper[i] = bStr[i];
            }
        }
        return string(bUpper);
    }
    
    /**
     * @notice Deploy complete vault infrastructure for a Creator Coin (custom names)
     * @param _creatorCoin Creator Coin token address
     * @param _vaultName Vault token name (e.g., "AKITA Vault")
     * @param _vaultSymbol Vault token symbol (e.g., "sAKITA")
     * @param _oftName Wrapped Share OFT name (e.g., "Wrapped AKITA Share")
     * @param _oftSymbol Wrapped Share OFT symbol (e.g., "wsAKITA")
     * @param _creator Creator's address (will be owner of deployed contracts)
     * @return vault CreatorOVault address
     * @return wrapper CreatorOVaultWrapper address (user-facing)
     * @return shareOFT CreatorShareOFT address (wsAKITA)
     * @return gaugeController CreatorGaugeController address
     * @return ccaStrategy CCALaunchStrategy address (fair launch)
     */
    function deployCreatorVault(
        address _creatorCoin,
        string memory _vaultName,
        string memory _vaultSymbol,
        string memory _oftName,
        string memory _oftSymbol,
        address _creator
    ) external returns (
        address vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy
    ) {
        // Validate inputs
        if (_creatorCoin == address(0)) revert ZeroAddress();
        if (_creator == address(0)) revert ZeroAddress();
        if (bytes(_vaultName).length == 0) revert InvalidName();
        if (bytes(_vaultSymbol).length == 0) revert InvalidSymbol();
        if (bytes(_oftName).length == 0) revert InvalidName();
        if (bytes(_oftSymbol).length == 0) revert InvalidSymbol();
        if (deployments[_creatorCoin].exists) revert AlreadyDeployed();
        
        // Get LayerZero endpoint
        address lzEndpoint;
        if (address(registry) != address(0)) {
            lzEndpoint = registry.getLayerZeroEndpoint(uint16(block.chainid));
        }
        if (lzEndpoint == address(0)) {
            // Fallback to common endpoint
            lzEndpoint = 0x1a44076050125825900e736c501f859c50fE728c;
        }
        
        // Deploy core infrastructure
        vault = _deployVault(_creatorCoin, _vaultName, _vaultSymbol, _creator);
        wrapper = _deployWrapper(_creatorCoin, vault, _creator);
        shareOFT = _deployShareOFT(_oftName, _oftSymbol, lzEndpoint, _creator);
        
        // Deploy fee distribution
        gaugeController = _deployGaugeController(shareOFT, wrapper, vault, _creator);
        
        // Deploy CCA fair launch strategy
        ccaStrategy = _deployCCAStrategy(shareOFT, vault, _creator);
        
        // Configure all cross-contract permissions
        _configureAllPermissions(vault, wrapper, shareOFT, gaugeController, _creator);
        
        // Store deployment info
        deployments[_creatorCoin] = DeploymentInfo({
            creatorCoin: _creatorCoin,
            vault: vault,
            wrapper: wrapper,
            shareOFT: shareOFT,
            gaugeController: gaugeController,
            ccaStrategy: ccaStrategy,
            creator: _creator,
            deployedAt: block.timestamp,
            exists: true
        });
        deployedTokens.push(_creatorCoin);
        deploymentCount++;
        
        // Register with registry if available
        if (address(registry) != address(0)) {
            _registerWithRegistry(
                _creatorCoin,
                _vaultName,
                _vaultSymbol,
                _creator,
                vault,
                wrapper,
                shareOFT
            );
        }
        
        emit VaultInfrastructureDeployed(
            _creatorCoin,
            vault,
            wrapper,
            shareOFT,
            gaugeController,
            ccaStrategy,
            _creator
        );
        emit GaugeControllerDeployed(_creatorCoin, gaugeController);
        emit CCAStrategyDeployed(_creatorCoin, ccaStrategy);
    }
    
    /**
     * @notice Deploy vault infrastructure with CREATE2 for deterministic addresses
     * @dev Uses salt based on creator coin + deployment count for uniqueness
     * @dev Note: GaugeController and CCAStrategy are deployed with regular CREATE (not CREATE2)
     */
    function deployCreatorVaultDeterministic(
        address _creatorCoin,
        string memory _vaultName,
        string memory _vaultSymbol,
        string memory _oftName,
        string memory _oftSymbol,
        address _creator,
        bytes32 _salt
    ) external returns (
        address vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy
    ) {
        if (_creatorCoin == address(0)) revert ZeroAddress();
        if (_creator == address(0)) revert ZeroAddress();
        if (deployments[_creatorCoin].exists) revert AlreadyDeployed();
        
        // Get LayerZero endpoint
        address lzEndpoint;
        if (address(registry) != address(0)) {
            lzEndpoint = registry.getLayerZeroEndpoint(uint16(block.chainid));
        }
        if (lzEndpoint == address(0)) {
            lzEndpoint = 0x1a44076050125825900e736c501f859c50fE728c;
        }
        
        // Generate unique salts for each contract
        bytes32 vaultSalt = keccak256(abi.encodePacked(_salt, "vault"));
        bytes32 wrapperSalt = keccak256(abi.encodePacked(_salt, "wrapper"));
        bytes32 oftSalt = keccak256(abi.encodePacked(_salt, "oft"));
        
        // Deploy core contracts with CREATE2
        vault = _deployVaultCreate2(_creatorCoin, _vaultName, _vaultSymbol, _creator, vaultSalt);
        wrapper = _deployWrapperCreate2(_creatorCoin, vault, _creator, wrapperSalt);
        shareOFT = _deployShareOFTCreate2(_oftName, _oftSymbol, lzEndpoint, _creator, oftSalt);
        
        // Deploy gauge controller and CCA strategy (regular CREATE)
        gaugeController = _deployGaugeController(shareOFT, wrapper, vault, _creator);
        ccaStrategy = _deployCCAStrategy(shareOFT, vault, _creator);
        
        // Configure all permissions
        _configureAllPermissions(vault, wrapper, shareOFT, gaugeController, _creator);
        
        // Store deployment
        deployments[_creatorCoin] = DeploymentInfo({
            creatorCoin: _creatorCoin,
            vault: vault,
            wrapper: wrapper,
            shareOFT: shareOFT,
            gaugeController: gaugeController,
            ccaStrategy: ccaStrategy,
            creator: _creator,
            deployedAt: block.timestamp,
            exists: true
        });
        deployedTokens.push(_creatorCoin);
        deploymentCount++;
        
        // Register with registry
        if (address(registry) != address(0)) {
            _registerWithRegistry(
                _creatorCoin,
                _vaultName,
                _vaultSymbol,
                _creator,
                vault,
                wrapper,
                shareOFT
            );
        }
        
        emit VaultInfrastructureDeployed(
            _creatorCoin,
            vault,
            wrapper,
            shareOFT,
            gaugeController,
            ccaStrategy,
            _creator
        );
        emit GaugeControllerDeployed(_creatorCoin, gaugeController);
        emit CCAStrategyDeployed(_creatorCoin, ccaStrategy);
    }
    
    // =================================
    // INTERNAL DEPLOYMENT HELPERS
    // =================================
    
    function _deployVault(
        address _creatorCoin,
        string memory _name,
        string memory _symbol,
        address _owner
    ) internal returns (address) {
        CreatorOVault vault = new CreatorOVault(
            _creatorCoin,
            _owner,
            _name,
            _symbol
        );
        return address(vault);
    }
    
    function _deployWrapper(
        address _creatorCoin,
        address _vault,
        address _owner
    ) internal returns (address) {
        CreatorOVaultWrapper wrapper = new CreatorOVaultWrapper(
            _creatorCoin,
            _vault,
            _owner
        );
        return address(wrapper);
    }
    
    function _deployShareOFT(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _owner
    ) internal returns (address) {
        CreatorShareOFT oft = new CreatorShareOFT(
            _name,
            _symbol,
            _lzEndpoint,
            _owner
        );
        return address(oft);
    }
    
    function _deployVaultCreate2(
        address _creatorCoin,
        string memory _name,
        string memory _symbol,
        address _owner,
        bytes32 _salt
    ) internal returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(CreatorOVault).creationCode,
            abi.encode(_creatorCoin, _name, _symbol, _owner)
        );
        return _create2Deploy(bytecode, _salt);
    }
    
    function _deployWrapperCreate2(
        address _creatorCoin,
        address _vault,
        address _owner,
        bytes32 _salt
    ) internal returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(CreatorOVaultWrapper).creationCode,
            abi.encode(_creatorCoin, _vault, _owner)
        );
        return _create2Deploy(bytecode, _salt);
    }
    
    function _deployShareOFTCreate2(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint,
        address _owner,
        bytes32 _salt
    ) internal returns (address) {
        bytes memory bytecode = abi.encodePacked(
            type(CreatorShareOFT).creationCode,
            abi.encode(_name, _symbol, _lzEndpoint, _owner)
        );
        return _create2Deploy(bytecode, _salt);
    }
    
    function _create2Deploy(bytes memory bytecode, bytes32 salt) internal returns (address deployed) {
        assembly {
            deployed := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }
        if (deployed == address(0)) revert DeploymentFailed();
    }
    
    function _deployGaugeController(
        address _shareOFT,
        address _wrapper,
        address _vault,
        address _owner
    ) internal returns (address) {
        CreatorGaugeController controller = new CreatorGaugeController(
            _shareOFT,
            _owner,  // creator treasury = owner initially
            _owner,  // protocol treasury = owner initially (can change later)
            _owner   // owner
        );
        
        // Configure the gauge controller
        controller.setVault(_vault);
        controller.setWrapper(_wrapper);
        
        return address(controller);
    }
    
    /**
     * @notice Deploy CCA launch strategy for fair token distribution
     * @dev CCA = Continuous Clearing Auction (Official Uniswap mechanism)
     *      Factory address: 0x0000ccaDF55C911a2FbC0BB9d2942Aa77c6FAa1D (Base/Mainnet/Unichain)
     * 
     * @param _shareOFT The wsAKITA token to auction
     * @param _vault The vault that receives raised funds
     * @param _owner Creator who owns the strategy
     */
    function _deployCCAStrategy(
        address _shareOFT,
        address _vault,
        address _owner
    ) internal returns (address) {
        CCALaunchStrategy strategy = new CCALaunchStrategy(
            _shareOFT,        // Token to auction (wsAKITA)
            address(0),       // Currency: ETH
            _vault,           // Raised ETH goes to vault
            _owner,           // Unsold tokens to creator
            _owner            // Strategy owner
        );
        
        return address(strategy);
    }
    
    // =================================
    // CONFIGURATION HELPERS
    // =================================
    
    function _configureAllPermissions(
        address _vault,
        address _wrapper,
        address _shareOFT,
        address _gaugeController,
        address _creator
    ) internal {
        // === WRAPPER CONFIG ===
        // Set wrapper's ShareOFT
        CreatorOVaultWrapper(_wrapper).setShareOFT(_shareOFT);
        
        // === SHAREOFT CONFIG ===
        // Set ShareOFT's vault
        CreatorShareOFT(_shareOFT).setVault(_vault);
        
        // Give wrapper minter rights on ShareOFT
        CreatorShareOFT(_shareOFT).setMinter(_wrapper, true);
        
        // Set gauge controller as fee recipient
        CreatorShareOFT(_shareOFT).setGaugeController(_gaugeController);
        
        // If registry is set, configure it
        if (address(registry) != address(0)) {
            CreatorShareOFT(_shareOFT).setRegistry(address(registry));
        }
        
        // === VAULT CONFIG ===
        // Set gauge controller on vault (for burning shares)
        CreatorOVault(payable(_vault)).setGaugeController(_gaugeController);
        
        // Whitelist the wrapper for deposits
        CreatorOVault(payable(_vault)).setWhitelist(_wrapper, true);
    }
    
    function _registerWithRegistry(
        address _creatorCoin,
        string memory _name,
        string memory _symbol,
        address _creator,
        address _vault,
        address _wrapper,
        address _shareOFT
    ) internal {
        // Register the Creator Coin
        registry.registerCreatorCoin(
            _creatorCoin,
            _name,
            _symbol,
            _creator,
            address(0), // pool - to be set later
            0           // poolFee - to be set later
        );
        
        // Set vault, wrapper, and ShareOFT
        registry.setCreatorVault(_creatorCoin, _vault);
        registry.setCreatorWrapper(_creatorCoin, _wrapper);
        registry.setCreatorShareOFT(_creatorCoin, _shareOFT);
    }
    
    // =================================
    // ADMIN FUNCTIONS
    // =================================
    
    /**
     * @notice Set the registry address
     */
    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        registry = ICreatorRegistry(_registry);
        emit RegistryUpdated(_registry);
    }
    
    // =================================
    // VIEW FUNCTIONS
    // =================================
    
    /**
     * @notice Get deployment info for a Creator Coin
     */
    function getDeployment(address _creatorCoin) external view returns (DeploymentInfo memory) {
        return deployments[_creatorCoin];
    }
    
    /**
     * @notice Get the user-facing contracts for a Creator Coin
     * @dev These are the main contracts users interact with:
     *      - wrapper: deposit/withdraw (akita ↔ wsAKITA)
     *      - shareOFT: cross-chain transfers
     *      - ccaStrategy: fair launch auctions
     */
    function getUserContracts(address _creatorCoin) external view returns (
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy
    ) {
        DeploymentInfo storage info = deployments[_creatorCoin];
        return (info.wrapper, info.shareOFT, info.gaugeController, info.ccaStrategy);
    }
    
    /**
     * @notice Get all contract addresses for a Creator Coin
     */
    function getAllContracts(address _creatorCoin) external view returns (
        address vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy
    ) {
        DeploymentInfo storage info = deployments[_creatorCoin];
        return (info.vault, info.wrapper, info.shareOFT, info.gaugeController, info.ccaStrategy);
    }
    
    /**
     * @notice Get all deployed Creator Coins
     */
    function getAllDeployments() external view returns (address[] memory) {
        return deployedTokens;
    }
    
    /**
     * @notice Check if a Creator Coin has been deployed
     */
    function isDeployed(address _creatorCoin) external view returns (bool) {
        return deployments[_creatorCoin].exists;
    }
    
    /**
     * @notice Predict CREATE2 addresses before deployment
     */
    function predictAddresses(
        address _creatorCoin,
        string memory _vaultName,
        string memory _vaultSymbol,
        string memory _oftName,
        string memory _oftSymbol,
        address _creator,
        bytes32 _salt
    ) external view returns (
        address predictedVault,
        address predictedWrapper,
        address predictedOFT
    ) {
        address lzEndpoint;
        if (address(registry) != address(0)) {
            lzEndpoint = registry.getLayerZeroEndpoint(uint16(block.chainid));
        }
        if (lzEndpoint == address(0)) {
            lzEndpoint = 0x1a44076050125825900e736c501f859c50fE728c;
        }
        
        bytes32 vaultSalt = keccak256(abi.encodePacked(_salt, "vault"));
        bytes32 wrapperSalt = keccak256(abi.encodePacked(_salt, "wrapper"));
        bytes32 oftSalt = keccak256(abi.encodePacked(_salt, "oft"));
        
        // Predict vault address
        bytes memory vaultBytecode = abi.encodePacked(
            type(CreatorOVault).creationCode,
            abi.encode(_creatorCoin, _vaultName, _vaultSymbol, _creator)
        );
        predictedVault = _predictCreate2(vaultBytecode, vaultSalt);
        
        // Predict wrapper address
        bytes memory wrapperBytecode = abi.encodePacked(
            type(CreatorOVaultWrapper).creationCode,
            abi.encode(_creatorCoin, predictedVault, _creator)
        );
        predictedWrapper = _predictCreate2(wrapperBytecode, wrapperSalt);
        
        // Predict OFT address
        bytes memory oftBytecode = abi.encodePacked(
            type(CreatorShareOFT).creationCode,
            abi.encode(_oftName, _oftSymbol, lzEndpoint, _creator)
        );
        predictedOFT = _predictCreate2(oftBytecode, oftSalt);
    }
    
    function _predictCreate2(bytes memory bytecode, bytes32 salt) internal view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );
        return address(uint160(uint256(hash)));
    }
    
    /**
     * @notice Generate a standard salt for a Creator Coin
     */
    function generateSalt(address _creatorCoin, string memory _symbol) external pure returns (bytes32) {
        return keccak256(abi.encodePacked("CREATORTECH_V1_", _creatorCoin, _symbol));
    }
}

