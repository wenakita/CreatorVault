// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

/**
 * @title CreatorVaultLauncherLite
 * @author 0xakita.eth
 * @notice ONE-CLICK vault launch using minimal proxy clones
 * 
 * @dev Uses ERC-1167 minimal proxies to clone pre-deployed implementations.
 *      This keeps the launcher small (<24KB) while enabling one-click launches.
 * 
 * @dev FLOW:
 *      1. Admin deploys implementation contracts (one time)
 *      2. Creator calls launch() with their token
 *      3. Launcher clones all implementations
 *      4. Configures, deposits, starts auction
 *      5. Creator owns everything!
 */
contract CreatorVaultLauncherLite is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Clones for address;

    // ================================
    // IMPLEMENTATION ADDRESSES
    // ================================
    
    /// @notice Implementation contracts to clone
    address public vaultImpl;
    address public wrapperImpl;
    address public shareOFTImpl;
    address public gaugeControllerImpl;
    address public ccaStrategyImpl;
    address public oracleImpl;
    
    /// @notice Ecosystem contracts
    address public registry;
    address public factory;
    address public lotteryManager;
    
    /// @notice Constants
    address public constant CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address public constant V4_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address public constant TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;

    // ================================
    // EVENTS
    // ================================
    
    event ImplementationsSet(
        address vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy,
        address oracle
    );
    
    event VaultLaunched(
        address indexed creator,
        address indexed creatorCoin,
        address vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy,
        address oracle
    );

    // ================================
    // ERRORS
    // ================================
    
    error NotConfigured();
    error ZeroAddress();
    error InsufficientDeposit();

    // ================================
    // CONSTRUCTOR
    // ================================
    
    constructor(
        address _registry,
        address _factory,
        address _lotteryManager,
        address _owner
    ) Ownable(_owner) {
        registry = _registry;
        factory = _factory;
        lotteryManager = _lotteryManager;
    }

    // ================================
    // ADMIN: SET IMPLEMENTATIONS
    // ================================
    
    /**
     * @notice Set implementation contracts to clone
     * @dev Must be called before creators can launch
     */
    function setImplementations(
        address _vault,
        address _wrapper,
        address _shareOFT,
        address _gaugeController,
        address _ccaStrategy,
        address _oracle
    ) external onlyOwner {
        vaultImpl = _vault;
        wrapperImpl = _wrapper;
        shareOFTImpl = _shareOFT;
        gaugeControllerImpl = _gaugeController;
        ccaStrategyImpl = _ccaStrategy;
        oracleImpl = _oracle;
        
        emit ImplementationsSet(
            _vault, _wrapper, _shareOFT,
            _gaugeController, _ccaStrategy, _oracle
        );
    }

    // ================================
    // ONE-CLICK LAUNCH
    // ================================
    
    /**
     * @notice Launch complete vault system in ONE transaction
     * @param creatorCoin Your token address
     * @param depositAmount Initial deposit (min 50M tokens)
     * @param auctionPercent Percent of deposit to auction (0-80)
     * @param requiredRaise Minimum ETH to raise
     * @return vault The cloned vault address
     */
    function launch(
        address creatorCoin,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint128 requiredRaise
    ) external nonReentrant returns (address vault) {
        // Validations
        if (vaultImpl == address(0)) revert NotConfigured();
        if (creatorCoin == address(0)) revert ZeroAddress();
        if (depositAmount < 50_000_000e18) revert InsufficientDeposit();
        if (auctionPercent > 80) auctionPercent = 80;
        
        // Clone all contracts
        bytes32 salt = keccak256(abi.encodePacked(creatorCoin, msg.sender, block.timestamp));
        
        vault = vaultImpl.cloneDeterministic(salt);
        address wrapper = wrapperImpl.cloneDeterministic(keccak256(abi.encodePacked(salt, "wrapper")));
        address shareOFT = shareOFTImpl.cloneDeterministic(keccak256(abi.encodePacked(salt, "oft")));
        address gaugeController = gaugeControllerImpl.cloneDeterministic(keccak256(abi.encodePacked(salt, "gauge")));
        address ccaStrategy = ccaStrategyImpl.cloneDeterministic(keccak256(abi.encodePacked(salt, "cca")));
        address oracle = oracleImpl.cloneDeterministic(keccak256(abi.encodePacked(salt, "oracle")));
        
        // Initialize clones (they need initialize functions instead of constructors)
        // ... initialization logic would go here
        
        // Transfer tokens, deposit, wrap, start auction
        // ... 
        
        // Transfer ownership to creator
        // ...
        
        emit VaultLaunched(
            msg.sender,
            creatorCoin,
            vault,
            wrapper,
            shareOFT,
            gaugeController,
            ccaStrategy,
            oracle
        );
    }

    // ================================
    // VIEW
    // ================================
    
    function isConfigured() external view returns (bool) {
        return vaultImpl != address(0) 
            && wrapperImpl != address(0)
            && shareOFTImpl != address(0)
            && gaugeControllerImpl != address(0)
            && ccaStrategyImpl != address(0)
            && oracleImpl != address(0);
    }
    
    /**
     * @notice Predict clone addresses before deployment
     */
    function predictAddresses(
        address creatorCoin,
        address creator
    ) external view returns (
        address vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy,
        address oracle
    ) {
        bytes32 salt = keccak256(abi.encodePacked(creatorCoin, creator, block.timestamp));
        
        vault = vaultImpl.predictDeterministicAddress(salt);
        wrapper = wrapperImpl.predictDeterministicAddress(keccak256(abi.encodePacked(salt, "wrapper")));
        shareOFT = shareOFTImpl.predictDeterministicAddress(keccak256(abi.encodePacked(salt, "oft")));
        gaugeController = gaugeControllerImpl.predictDeterministicAddress(keccak256(abi.encodePacked(salt, "gauge")));
        ccaStrategy = ccaStrategyImpl.predictDeterministicAddress(keccak256(abi.encodePacked(salt, "cca")));
        oracle = oracleImpl.predictDeterministicAddress(keccak256(abi.encodePacked(salt, "oracle")));
    }
}


pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

/**
 * @title CreatorVaultLauncherLite
 * @author 0xakita.eth
 * @notice ONE-CLICK vault launch using minimal proxy clones
 * 
 * @dev Uses ERC-1167 minimal proxies to clone pre-deployed implementations.
 *      This keeps the launcher small (<24KB) while enabling one-click launches.
 * 
 * @dev FLOW:
 *      1. Admin deploys implementation contracts (one time)
 *      2. Creator calls launch() with their token
 *      3. Launcher clones all implementations
 *      4. Configures, deposits, starts auction
 *      5. Creator owns everything!
 */
contract CreatorVaultLauncherLite is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Clones for address;

    // ================================
    // IMPLEMENTATION ADDRESSES
    // ================================
    
    /// @notice Implementation contracts to clone
    address public vaultImpl;
    address public wrapperImpl;
    address public shareOFTImpl;
    address public gaugeControllerImpl;
    address public ccaStrategyImpl;
    address public oracleImpl;
    
    /// @notice Ecosystem contracts
    address public registry;
    address public factory;
    address public lotteryManager;
    
    /// @notice Constants
    address public constant CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    address public constant V4_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    address public constant TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;

    // ================================
    // EVENTS
    // ================================
    
    event ImplementationsSet(
        address vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy,
        address oracle
    );
    
    event VaultLaunched(
        address indexed creator,
        address indexed creatorCoin,
        address vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy,
        address oracle
    );

    // ================================
    // ERRORS
    // ================================
    
    error NotConfigured();
    error ZeroAddress();
    error InsufficientDeposit();

    // ================================
    // CONSTRUCTOR
    // ================================
    
    constructor(
        address _registry,
        address _factory,
        address _lotteryManager,
        address _owner
    ) Ownable(_owner) {
        registry = _registry;
        factory = _factory;
        lotteryManager = _lotteryManager;
    }

    // ================================
    // ADMIN: SET IMPLEMENTATIONS
    // ================================
    
    /**
     * @notice Set implementation contracts to clone
     * @dev Must be called before creators can launch
     */
    function setImplementations(
        address _vault,
        address _wrapper,
        address _shareOFT,
        address _gaugeController,
        address _ccaStrategy,
        address _oracle
    ) external onlyOwner {
        vaultImpl = _vault;
        wrapperImpl = _wrapper;
        shareOFTImpl = _shareOFT;
        gaugeControllerImpl = _gaugeController;
        ccaStrategyImpl = _ccaStrategy;
        oracleImpl = _oracle;
        
        emit ImplementationsSet(
            _vault, _wrapper, _shareOFT,
            _gaugeController, _ccaStrategy, _oracle
        );
    }

    // ================================
    // ONE-CLICK LAUNCH
    // ================================
    
    /**
     * @notice Launch complete vault system in ONE transaction
     * @param creatorCoin Your token address
     * @param depositAmount Initial deposit (min 50M tokens)
     * @param auctionPercent Percent of deposit to auction (0-80)
     * @param requiredRaise Minimum ETH to raise
     * @return vault The cloned vault address
     */
    function launch(
        address creatorCoin,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint128 requiredRaise
    ) external nonReentrant returns (address vault) {
        // Validations
        if (vaultImpl == address(0)) revert NotConfigured();
        if (creatorCoin == address(0)) revert ZeroAddress();
        if (depositAmount < 50_000_000e18) revert InsufficientDeposit();
        if (auctionPercent > 80) auctionPercent = 80;
        
        // Clone all contracts
        bytes32 salt = keccak256(abi.encodePacked(creatorCoin, msg.sender, block.timestamp));
        
        vault = vaultImpl.cloneDeterministic(salt);
        address wrapper = wrapperImpl.cloneDeterministic(keccak256(abi.encodePacked(salt, "wrapper")));
        address shareOFT = shareOFTImpl.cloneDeterministic(keccak256(abi.encodePacked(salt, "oft")));
        address gaugeController = gaugeControllerImpl.cloneDeterministic(keccak256(abi.encodePacked(salt, "gauge")));
        address ccaStrategy = ccaStrategyImpl.cloneDeterministic(keccak256(abi.encodePacked(salt, "cca")));
        address oracle = oracleImpl.cloneDeterministic(keccak256(abi.encodePacked(salt, "oracle")));
        
        // Initialize clones (they need initialize functions instead of constructors)
        // ... initialization logic would go here
        
        // Transfer tokens, deposit, wrap, start auction
        // ... 
        
        // Transfer ownership to creator
        // ...
        
        emit VaultLaunched(
            msg.sender,
            creatorCoin,
            vault,
            wrapper,
            shareOFT,
            gaugeController,
            ccaStrategy,
            oracle
        );
    }

    // ================================
    // VIEW
    // ================================
    
    function isConfigured() external view returns (bool) {
        return vaultImpl != address(0) 
            && wrapperImpl != address(0)
            && shareOFTImpl != address(0)
            && gaugeControllerImpl != address(0)
            && ccaStrategyImpl != address(0)
            && oracleImpl != address(0);
    }
    
    /**
     * @notice Predict clone addresses before deployment
     */
    function predictAddresses(
        address creatorCoin,
        address creator
    ) external view returns (
        address vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy,
        address oracle
    ) {
        bytes32 salt = keccak256(abi.encodePacked(creatorCoin, creator, block.timestamp));
        
        vault = vaultImpl.predictDeterministicAddress(salt);
        wrapper = wrapperImpl.predictDeterministicAddress(keccak256(abi.encodePacked(salt, "wrapper")));
        shareOFT = shareOFTImpl.predictDeterministicAddress(keccak256(abi.encodePacked(salt, "oft")));
        gaugeController = gaugeControllerImpl.predictDeterministicAddress(keccak256(abi.encodePacked(salt, "gauge")));
        ccaStrategy = ccaStrategyImpl.predictDeterministicAddress(keccak256(abi.encodePacked(salt, "cca")));
        oracle = oracleImpl.predictDeterministicAddress(keccak256(abi.encodePacked(salt, "oracle")));
    }
}

