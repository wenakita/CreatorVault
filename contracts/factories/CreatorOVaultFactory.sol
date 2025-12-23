// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @notice Interface for Zora-style coins
 * @dev Only payoutRecipient() is used for authorization - this is the canonical
 *      creator address for Zora tokens that receives trading fees
 */
interface IZoraCoin {
    function payoutRecipient() external view returns (address);
}
import {CreatorOVault} from "../vault/CreatorOVault.sol";
import {CreatorOVaultWrapper} from "../vault/CreatorOVaultWrapper.sol";
import {CreatorShareOFT} from "../layerzero/CreatorShareOFT.sol";
import {CreatorGaugeController} from "../governance/CreatorGaugeController.sol";
import {CCALaunchStrategy} from "../strategies/CCALaunchStrategy.sol";
import {CreatorChainlinkOracle} from "../oracles/CreatorChainlinkOracle.sol";
import {ICreatorRegistry} from "../interfaces/core/ICreatorRegistry.sol";

/**
 * @title CreatorOVaultFactory
 * @author 0xakita.eth Think FriendTech, but for CreatorCoins, in ERC-4626 Omnichain Vaults + Lottery
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
 *      - stake(AKITA) → sAKITA → wrap → wsAKITA
 *      - unwrap(wsAKITA) → sAKITA → unstake → AKITA
 *      
 * @dev LAUNCH FLOW (via CCA):
 *      1. Deploy infrastructure via this factory
 *      2. Creator stakes AKITA → sAKITA → wraps → wsAKITA
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
 *      Creator Coin: AKITA
 *      Shares: "AKITA Shares" (sAKITA) - vault deposit receipt
 *      Wrapped Shares: "Wrapped AKITA Shares" (wsAKITA) - cross-chain OFT
 * 
 * @dev TOKEN FLOW:
 *      AKITA → stake → sAKITA → wrap → wsAKITA (trades on DEX)
 */
contract CreatorOVaultFactory is Ownable {
    
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
        address oracle;          // Per-creator price oracle
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
        address oracle,
        address creator
    );
    
    event RegistryUpdated(address indexed newRegistry);
    event GaugeControllerDeployed(address indexed creatorCoin, address indexed gaugeController);
    event CCAStrategyDeployed(address indexed creatorCoin, address indexed ccaStrategy);
    event OracleDeployed(address indexed creatorCoin, address indexed oracle);
    
    // =================================
    // ERRORS
    // =================================
    
    error ZeroAddress();
    error InvalidName();
    error InvalidSymbol();
    error NotTokenOwner();      // Only creator coin owner can deploy vault
    error TokenNotOwnable();    // Creator coin must implement Ownable
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
    // MODIFIERS
    // =================================
    
    /**
     * @notice Ensures only the creator coin owner can deploy a vault
     * @dev Prevents front-running by malicious actors
     *      
     *      AUTHORIZATION PATTERNS (checked in order):
     *      1. Standard Ownable: owner() - for standard ERC20s
     *      2. Zora Coins: payoutRecipient() - canonical creator address
     *      
     *      IMPORTANT: For Zora tokens, ONLY payoutRecipient() is trusted.
     *      This is the address that receives trading fees and represents
     *      the token's creator. Other owner-related functions are ignored.
     */
    modifier onlyTokenOwner(address _creatorCoin) {
        address creator = _getCreatorAddress(_creatorCoin);
        
        if (creator != msg.sender && creator != tx.origin) {
            revert NotTokenOwner();
        }
        _;
    }
    
    /**
     * @notice Get the canonical creator address for a token
     * @dev Tries owner() first, falls back to payoutRecipient()
     * @param _token The token to check
     * @return creator The creator address (reverts if neither pattern works)
     */
    function _getCreatorAddress(address _token) internal view returns (address creator) {
        // Pattern 1: Standard Ownable (owner())
        try Ownable(_token).owner() returns (address tokenOwner) {
            if (tokenOwner != address(0)) {
                return tokenOwner;
            }
        } catch {}
        
        // Pattern 2: Zora Coins (payoutRecipient - the canonical creator)
        try IZoraCoin(_token).payoutRecipient() returns (address zoraCreator) {
            if (zoraCreator != address(0)) {
                return zoraCreator;
            }
        } catch {}
        
        // Neither pattern worked
        revert TokenNotOwnable();
    }
    
    // =================================
    // DEPLOYMENT FUNCTIONS
    // =================================
    
    /**
     * @notice Deploy complete vault infrastructure for a Creator Coin
     * @param _creatorCoin Creator Coin token address
     * @return info DeploymentInfo struct with all contract addresses
     * 
     * @dev ONLY TOKEN OWNER CAN CALL (prevents front-running)
     * 
     * @dev AUTO-NAMING CONVENTION (OHM Pattern):
     *      Creator Coin: AKITA
     *      Shares: "AKITA Shares" (sAKITA) - vault deposit receipt
     *      Wrapped Shares: "Wrapped AKITA Shares" (wsAKITA) - cross-chain OFT
     * 
     * @dev TOKEN FLOW:
     *      AKITA → stake → sAKITA → wrap → wsAKITA (cross-chain)
     */
    function deploy(
        address _creatorCoin
    ) external onlyTokenOwner(_creatorCoin) returns (DeploymentInfo memory info) {
        // Validate inputs
        if (_creatorCoin == address(0)) revert ZeroAddress();
        if (deployments[_creatorCoin].exists) revert AlreadyDeployed();
        
        // Get creator (token owner) - use same logic as modifier
        address creator = _getCreatorAddress(_creatorCoin);
        
        // Get creator coin symbol (uppercase for consistency)
        string memory symbol = _toUpperCase(IERC20Metadata(_creatorCoin).symbol());
        
        // Generate names following OHM/sOHM/wsOHM pattern
        string memory vaultName = string(abi.encodePacked(symbol, " Shares"));
        string memory vaultSymbol = string(abi.encodePacked("s", symbol));
        string memory oftName = string(abi.encodePacked("Wrapped ", symbol, " Shares"));
        string memory oftSymbol = string(abi.encodePacked("ws", symbol));
        
        // Get LayerZero endpoint
        address lzEndpoint = _getLzEndpoint();
        
        // Deploy all contracts
        info = _deployAll(_creatorCoin, vaultName, vaultSymbol, oftName, oftSymbol, lzEndpoint, creator);
        
        // Store deployment
        deployments[_creatorCoin] = info;
        deployedTokens.push(_creatorCoin);
        deploymentCount++;
        
        // Register with registry if available
        if (address(registry) != address(0)) {
            _registerWithRegistry(_creatorCoin, vaultName, vaultSymbol, creator, info);
        }
        
        emit VaultInfrastructureDeployed(
            _creatorCoin,
            info.vault,
            info.wrapper,
            info.shareOFT,
            info.gaugeController,
            info.ccaStrategy,
            info.oracle,
            creator
        );
        emit GaugeControllerDeployed(_creatorCoin, info.gaugeController);
        emit CCAStrategyDeployed(_creatorCoin, info.ccaStrategy);
        emit OracleDeployed(_creatorCoin, info.oracle);
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
     * @notice Internal helper to get LayerZero endpoint
     */
    function _getLzEndpoint() internal view returns (address lzEndpoint) {
        if (address(registry) != address(0)) {
            lzEndpoint = registry.getLayerZeroEndpoint(uint16(block.chainid));
        }
        if (lzEndpoint == address(0)) {
            // Fallback to common endpoint
            lzEndpoint = 0x1a44076050125825900e736c501f859c50fE728c;
        }
    }
    
    /**
     * @notice Internal helper to deploy all contracts
     */
    function _deployAll(
        address _creatorCoin,
        string memory _vaultName,
        string memory _vaultSymbol,
        string memory _oftName,
        string memory _oftSymbol,
        address _lzEndpoint,
        address _creator
    ) internal returns (DeploymentInfo memory info) {
        // Deploy core infrastructure
        info.vault = _deployVault(_creatorCoin, _vaultName, _vaultSymbol, _creator);
        info.wrapper = _deployWrapper(_creatorCoin, info.vault, _creator);
        info.shareOFT = _deployShareOFT(_oftName, _oftSymbol, _lzEndpoint, _creator);
        
        // Deploy fee distribution
        info.gaugeController = _deployGaugeController(info.shareOFT, info.wrapper, info.vault, _creator);
        
        // Deploy CCA fair launch strategy
        info.ccaStrategy = _deployCCAStrategy(info.shareOFT, info.vault, _creator);
        
        // Deploy per-creator price oracle
        info.oracle = _deployOracle(_oftSymbol, _lzEndpoint, _creator);
        
        // Configure all cross-contract permissions
        _configureAllPermissions(info.vault, info.wrapper, info.shareOFT, info.gaugeController, _creator);
        
        // Set remaining fields
        info.creatorCoin = _creatorCoin;
        info.creator = _creator;
        info.deployedAt = block.timestamp;
        info.exists = true;
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
    
    /**
     * @notice Deploy per-creator Chainlink oracle for price tracking
     * @dev Each creator coin needs its own oracle to track its V4 pool TWAP
     * 
     * @param _symbol Creator token symbol (used for identification)
     * @param _lzEndpoint LayerZero endpoint for cross-chain price broadcast
     * @param _owner Creator who owns the oracle
     */
    function _deployOracle(
        string memory _symbol,
        address _lzEndpoint,
        address _owner
    ) internal returns (address) {
        // Get Chainlink ETH/USD feed for this chain
        address chainlinkFeed = _getChainlinkEthUsdFeed();
        
        CreatorChainlinkOracle oracle = new CreatorChainlinkOracle(
            _lzEndpoint,
            chainlinkFeed,
            _symbol,
            _owner
        );
        
        return address(oracle);
    }
    
    /**
     * @notice Get Chainlink ETH/USD feed for current chain
     * @dev Returns known feed addresses for supported chains
     */
    function _getChainlinkEthUsdFeed() internal view returns (address) {
        uint256 chainId = block.chainid;
        
        if (chainId == 8453) {
            // Base Mainnet
            return 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
        } else if (chainId == 84532) {
            // Base Sepolia
            return 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1;
        } else if (chainId == 1) {
            // Ethereum Mainnet
            return 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
        } else if (chainId == 42161) {
            // Arbitrum One
            return 0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612;
        } else if (chainId == 10) {
            // Optimism
            return 0x13e3Ee699D1909E989722E753853AE30b17e08c5;
        }
        
        // Default: return zero address (oracle will need manual configuration)
        return address(0);
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
        DeploymentInfo memory _info
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
        
        // Set vault, wrapper, ShareOFT, oracle, and gauge controller
        registry.setCreatorVault(_creatorCoin, _info.vault);
        registry.setCreatorWrapper(_creatorCoin, _info.wrapper);
        registry.setCreatorShareOFT(_creatorCoin, _info.shareOFT);
        registry.setCreatorOracle(_creatorCoin, _info.oracle);
        registry.setCreatorGaugeController(_creatorCoin, _info.gaugeController);
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
     *      - wrapper: stake/unstake + wrap/unwrap (AKITA ↔ sAKITA ↔ wsAKITA)
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
        address ccaStrategy,
        address oracle
    ) {
        DeploymentInfo storage info = deployments[_creatorCoin];
        return (info.vault, info.wrapper, info.shareOFT, info.gaugeController, info.ccaStrategy, info.oracle);
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

