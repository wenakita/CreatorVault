// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Contract imports
import {CreatorOVault} from "../vault/CreatorOVault.sol";
import {CreatorOVaultWrapper} from "../vault/CreatorOVaultWrapper.sol";
import {CreatorShareOFT} from "../layerzero/CreatorShareOFT.sol";
import {CreatorGaugeController} from "../governance/CreatorGaugeController.sol";
import {CCALaunchStrategy} from "../strategies/CCALaunchStrategy.sol";
import {CreatorChainlinkOracle} from "../oracles/CreatorChainlinkOracle.sol";
import {CreatorRegistry} from "../core/CreatorRegistry.sol";
import {CreatorOVaultFactory} from "./CreatorOVaultFactory.sol";

/**
 * @title CreatorVaultLauncher
 * @author 0xakita.eth
 * @notice ONE-CLICK vault launch for creators
 * 
 * @dev WHAT THIS DOES IN ONE TRANSACTION:
 *      1. Deploy all 6 contracts (vault, wrapper, OFT, gauge, CCA, oracle)
 *      2. Configure all permissions and integrations
 *      3. Register with ecosystem contracts
 *      4. Accept creator's initial deposit
 *      5. Wrap deposit to wsToken
 *      6. Start CCA auction
 * 
 * @dev CREATOR JUST NEEDS TO:
 *      1. Approve this contract for their tokens
 *      2. Call launch() with parameters
 *      3. Done! Auction starts, system is live
 */
contract CreatorVaultLauncher is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // IMMUTABLES
    // ================================
    
    /// @notice Main ecosystem registry
    CreatorRegistry public immutable registry;
    
    /// @notice Factory for registration
    CreatorOVaultFactory public immutable factory;
    
    /// @notice Shared lottery manager
    address public immutable lotteryManager;
    
    /// @notice Chainlink ETH/USD feed on Base
    address public constant CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    
    /// @notice V4 PoolManager on Base
    address public constant V4_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    
    /// @notice Tax Hook (6.9% sell fees)
    address public constant TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;

    // ================================
    // EVENTS
    // ================================
    
    event VaultLaunched(
        address indexed creator,
        address indexed creatorCoin,
        address vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy,
        address oracle,
        uint256 depositAmount,
        uint256 auctionAmount
    );

    // ================================
    // ERRORS
    // ================================
    
    error ZeroAddress();
    error InsufficientDeposit();
    error AuctionAmountTooHigh();
    error TransferFailed();

    // ================================
    // CONSTRUCTOR
    // ================================
    
    constructor(
        address _registry,
        address _factory,
        address _lotteryManager,
        address _owner
    ) Ownable(_owner) {
        if (_registry == address(0)) revert ZeroAddress();
        if (_factory == address(0)) revert ZeroAddress();
        
        registry = CreatorRegistry(_registry);
        factory = CreatorOVaultFactory(_factory);
        lotteryManager = _lotteryManager;
    }

    // ================================
    // ONE-CLICK LAUNCH
    // ================================
    
    /**
     * @notice Launch complete vault system in ONE transaction
     * @param creatorCoin Your token address (must be payoutRecipient)
     * @param depositAmount Initial deposit (min 50M tokens)
     * @param auctionAmount Amount of wsTokens to auction (max 80% of deposit)
     * @param requiredRaise Minimum ETH to raise in auction
     * @return vault The deployed vault address
     * 
     * @dev PREREQUISITES:
     *      - Caller must be payoutRecipient of creatorCoin
     *      - Caller must have approved this contract for depositAmount
     */
    function launch(
        address creatorCoin,
        uint256 depositAmount,
        uint256 auctionAmount,
        uint128 requiredRaise
    ) external nonReentrant returns (address vault) {
        // Validations
        if (creatorCoin == address(0)) revert ZeroAddress();
        if (depositAmount < 50_000_000e18) revert InsufficientDeposit();
        if (auctionAmount > (depositAmount * 80) / 100) revert AuctionAmountTooHigh();
        
        // Get token metadata for naming
        string memory symbol = _toUpperCase(_getSymbol(creatorCoin));
        
        // ============ STEP 1: DEPLOY ALL CONTRACTS ============
        
        DeployedContracts memory contracts = _deployContracts(
            creatorCoin,
            symbol,
            msg.sender
        );
        
        vault = contracts.vault;
        
        // ============ STEP 2: CONFIGURE PERMISSIONS ============
        
        _configurePermissions(contracts);
        
        // ============ STEP 3: CONFIGURE INTEGRATIONS ============
        
        _configureIntegrations(contracts, creatorCoin);
        
        // ============ STEP 4: REGISTER WITH ECOSYSTEM ============
        
        _registerWithEcosystem(contracts, creatorCoin, msg.sender);
        
        // ============ STEP 5: ACCEPT DEPOSIT & WRAP ============
        
        // Transfer tokens from creator
        IERC20(creatorCoin).safeTransferFrom(msg.sender, address(this), depositAmount);
        
        // Approve and deposit to vault
        IERC20(creatorCoin).forceApprove(contracts.vault, depositAmount);
        uint256 shares = CreatorOVault(payable(contracts.vault)).deposit(depositAmount, address(this));
        
        // Approve and wrap shares
        IERC20(contracts.vault).forceApprove(contracts.wrapper, shares);
        CreatorOVaultWrapper(contracts.wrapper).wrap(shares);
        
        // ============ STEP 6: START CCA AUCTION ============
        
        if (auctionAmount > 0) {
            // Approve CCA for auction amount
            IERC20(contracts.shareOFT).forceApprove(contracts.ccaStrategy, auctionAmount);
            
            // Start auction (uses default duration and floor price from CCA)
            CCALaunchStrategy(payable(contracts.ccaStrategy)).launchAuctionSimple(
                auctionAmount,
                requiredRaise
            );
        }
        
        // Transfer remaining wsTokens to creator
        uint256 remaining = IERC20(contracts.shareOFT).balanceOf(address(this));
        if (remaining > 0) {
            IERC20(contracts.shareOFT).safeTransfer(msg.sender, remaining);
        }
        
        // Transfer ownership of all contracts to creator
        _transferOwnership(contracts, msg.sender);
        
        emit VaultLaunched(
            msg.sender,
            creatorCoin,
            contracts.vault,
            contracts.wrapper,
            contracts.shareOFT,
            contracts.gaugeController,
            contracts.ccaStrategy,
            contracts.oracle,
            depositAmount,
            auctionAmount
        );
    }

    // ================================
    // INTERNAL: DEPLOYMENT
    // ================================
    
    struct DeployedContracts {
        address vault;
        address wrapper;
        address shareOFT;
        address gaugeController;
        address ccaStrategy;
        address oracle;
    }
    
    function _deployContracts(
        address creatorCoin,
        string memory symbol,
        address creator
    ) internal returns (DeployedContracts memory c) {
        string memory vaultName = string(abi.encodePacked(symbol, " Shares"));
        string memory vaultSymbol = string(abi.encodePacked("s", symbol));
        string memory oftName = string(abi.encodePacked("Wrapped ", symbol, " Shares"));
        string memory oftSymbol = string(abi.encodePacked("ws", symbol));
        
        // 1. Deploy Vault
        c.vault = address(new CreatorOVault(
            creatorCoin,
            address(this),  // temporary owner
            vaultName,
            vaultSymbol
        ));
        
        // 2. Deploy Wrapper
        c.wrapper = address(new CreatorOVaultWrapper(
            creatorCoin,
            c.vault,
            address(this)  // temporary owner
        ));
        
        // 3. Deploy ShareOFT (uses registry for LZ endpoint)
        c.shareOFT = address(new CreatorShareOFT(
            oftName,
            oftSymbol,
            address(registry),
            address(this)  // temporary owner
        ));
        
        // 4. Deploy GaugeController
        c.gaugeController = address(new CreatorGaugeController(
            c.shareOFT,
            creator,   // creator treasury
            owner(),   // protocol treasury
            address(this)  // temporary owner
        ));
        
        // 5. Deploy CCA Strategy
        c.ccaStrategy = address(new CCALaunchStrategy(
            c.shareOFT,
            address(0),  // ETH as currency
            c.vault,     // funds to vault
            c.vault,     // unsold tokens to vault
            address(this)  // temporary owner
        ));
        
        // 6. Deploy Oracle (uses registry for LZ endpoint)
        c.oracle = address(new CreatorChainlinkOracle(
            address(registry),
            CHAINLINK_ETH_USD,
            oftSymbol,
            address(this)  // temporary owner
        ));
    }
    
    function _configurePermissions(DeployedContracts memory c) internal {
        // Vault permissions
        CreatorOVault(payable(c.vault)).setGaugeController(c.gaugeController);
        CreatorOVault(payable(c.vault)).setWhitelist(c.wrapper, true);
        
        // Wrapper permissions
        CreatorOVaultWrapper(c.wrapper).setShareOFT(c.shareOFT);
        
        // ShareOFT permissions
        CreatorShareOFT(c.shareOFT).setMinter(c.wrapper, true);
        
        // GaugeController permissions
        CreatorGaugeController(payable(c.gaugeController)).setVault(c.vault);
        CreatorGaugeController(payable(c.gaugeController)).setWrapper(c.wrapper);
    }
    
    function _configureIntegrations(
        DeployedContracts memory c,
        address creatorCoin
    ) internal {
        // GaugeController integrations
        CreatorGaugeController(payable(c.gaugeController)).setCreatorCoin(creatorCoin);
        CreatorGaugeController(payable(c.gaugeController)).setOracle(c.oracle);
        
        if (lotteryManager != address(0)) {
            CreatorGaugeController(payable(c.gaugeController)).setLotteryManager(lotteryManager);
        }
        
        // CCA oracle config for auto V4 pool setup
        CCALaunchStrategy(payable(c.ccaStrategy)).setOracleConfig(
            c.oracle,
            V4_POOL_MANAGER,
            TAX_HOOK
        );
    }
    
    function _registerWithEcosystem(
        DeployedContracts memory c,
        address creatorCoin,
        address creator
    ) internal {
        // Register with main registry
        registry.setCreatorOracle(creatorCoin, c.oracle);
        registry.setCreatorGaugeController(creatorCoin, c.gaugeController);
        
        // Register with factory
        if (!factory.isDeployed(creatorCoin)) {
            factory.registerDeployment(
                creatorCoin,
                c.vault,
                c.wrapper,
                c.shareOFT,
                c.gaugeController,
                c.ccaStrategy,
                c.oracle,
                creator
            );
        }
    }
    
    function _transferOwnership(DeployedContracts memory c, address newOwner) internal {
        CreatorOVault(payable(c.vault)).transferOwnership(newOwner);
        CreatorOVaultWrapper(c.wrapper).transferOwnership(newOwner);
        CreatorShareOFT(c.shareOFT).transferOwnership(newOwner);
        CreatorGaugeController(payable(c.gaugeController)).transferOwnership(newOwner);
        CCALaunchStrategy(payable(c.ccaStrategy)).transferOwnership(newOwner);
        CreatorChainlinkOracle(c.oracle).transferOwnership(newOwner);
    }

    // ================================
    // HELPERS
    // ================================
    
    function _getSymbol(address token) internal view returns (string memory) {
        // Try to get symbol from token
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("symbol()")
        );
        if (success && data.length > 0) {
            return abi.decode(data, (string));
        }
        return "TOKEN";
    }
    
    function _toUpperCase(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bUpper = new bytes(bStr.length);
        for (uint i = 0; i < bStr.length; i++) {
            if (bStr[i] >= 0x61 && bStr[i] <= 0x7A) {
                bUpper[i] = bytes1(uint8(bStr[i]) - 32);
            } else {
                bUpper[i] = bStr[i];
            }
        }
        return string(bUpper);
    }

    // ================================
    // ADMIN
    // ================================
    
    /// @notice Rescue stuck tokens
    function rescue(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success,) = to.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
    
    receive() external payable {}
}



import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Contract imports
import {CreatorOVault} from "../vault/CreatorOVault.sol";
import {CreatorOVaultWrapper} from "../vault/CreatorOVaultWrapper.sol";
import {CreatorShareOFT} from "../layerzero/CreatorShareOFT.sol";
import {CreatorGaugeController} from "../governance/CreatorGaugeController.sol";
import {CCALaunchStrategy} from "../strategies/CCALaunchStrategy.sol";
import {CreatorChainlinkOracle} from "../oracles/CreatorChainlinkOracle.sol";
import {CreatorRegistry} from "../core/CreatorRegistry.sol";
import {CreatorOVaultFactory} from "./CreatorOVaultFactory.sol";

/**
 * @title CreatorVaultLauncher
 * @author 0xakita.eth
 * @notice ONE-CLICK vault launch for creators
 * 
 * @dev WHAT THIS DOES IN ONE TRANSACTION:
 *      1. Deploy all 6 contracts (vault, wrapper, OFT, gauge, CCA, oracle)
 *      2. Configure all permissions and integrations
 *      3. Register with ecosystem contracts
 *      4. Accept creator's initial deposit
 *      5. Wrap deposit to wsToken
 *      6. Start CCA auction
 * 
 * @dev CREATOR JUST NEEDS TO:
 *      1. Approve this contract for their tokens
 *      2. Call launch() with parameters
 *      3. Done! Auction starts, system is live
 */
contract CreatorVaultLauncher is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ================================
    // IMMUTABLES
    // ================================
    
    /// @notice Main ecosystem registry
    CreatorRegistry public immutable registry;
    
    /// @notice Factory for registration
    CreatorOVaultFactory public immutable factory;
    
    /// @notice Shared lottery manager
    address public immutable lotteryManager;
    
    /// @notice Chainlink ETH/USD feed on Base
    address public constant CHAINLINK_ETH_USD = 0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70;
    
    /// @notice V4 PoolManager on Base
    address public constant V4_POOL_MANAGER = 0x498581fF718922c3f8e6A244956aF099B2652b2b;
    
    /// @notice Tax Hook (6.9% sell fees)
    address public constant TAX_HOOK = 0xca975B9dAF772C71161f3648437c3616E5Be0088;

    // ================================
    // EVENTS
    // ================================
    
    event VaultLaunched(
        address indexed creator,
        address indexed creatorCoin,
        address vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy,
        address oracle,
        uint256 depositAmount,
        uint256 auctionAmount
    );

    // ================================
    // ERRORS
    // ================================
    
    error ZeroAddress();
    error InsufficientDeposit();
    error AuctionAmountTooHigh();
    error TransferFailed();

    // ================================
    // CONSTRUCTOR
    // ================================
    
    constructor(
        address _registry,
        address _factory,
        address _lotteryManager,
        address _owner
    ) Ownable(_owner) {
        if (_registry == address(0)) revert ZeroAddress();
        if (_factory == address(0)) revert ZeroAddress();
        
        registry = CreatorRegistry(_registry);
        factory = CreatorOVaultFactory(_factory);
        lotteryManager = _lotteryManager;
    }

    // ================================
    // ONE-CLICK LAUNCH
    // ================================
    
    /**
     * @notice Launch complete vault system in ONE transaction
     * @param creatorCoin Your token address (must be payoutRecipient)
     * @param depositAmount Initial deposit (min 50M tokens)
     * @param auctionAmount Amount of wsTokens to auction (max 80% of deposit)
     * @param requiredRaise Minimum ETH to raise in auction
     * @return vault The deployed vault address
     * 
     * @dev PREREQUISITES:
     *      - Caller must be payoutRecipient of creatorCoin
     *      - Caller must have approved this contract for depositAmount
     */
    function launch(
        address creatorCoin,
        uint256 depositAmount,
        uint256 auctionAmount,
        uint128 requiredRaise
    ) external nonReentrant returns (address vault) {
        // Validations
        if (creatorCoin == address(0)) revert ZeroAddress();
        if (depositAmount < 50_000_000e18) revert InsufficientDeposit();
        if (auctionAmount > (depositAmount * 80) / 100) revert AuctionAmountTooHigh();
        
        // Get token metadata for naming
        string memory symbol = _toUpperCase(_getSymbol(creatorCoin));
        
        // ============ STEP 1: DEPLOY ALL CONTRACTS ============
        
        DeployedContracts memory contracts = _deployContracts(
            creatorCoin,
            symbol,
            msg.sender
        );
        
        vault = contracts.vault;
        
        // ============ STEP 2: CONFIGURE PERMISSIONS ============
        
        _configurePermissions(contracts);
        
        // ============ STEP 3: CONFIGURE INTEGRATIONS ============
        
        _configureIntegrations(contracts, creatorCoin);
        
        // ============ STEP 4: REGISTER WITH ECOSYSTEM ============
        
        _registerWithEcosystem(contracts, creatorCoin, msg.sender);
        
        // ============ STEP 5: ACCEPT DEPOSIT & WRAP ============
        
        // Transfer tokens from creator
        IERC20(creatorCoin).safeTransferFrom(msg.sender, address(this), depositAmount);
        
        // Approve and deposit to vault
        IERC20(creatorCoin).forceApprove(contracts.vault, depositAmount);
        uint256 shares = CreatorOVault(payable(contracts.vault)).deposit(depositAmount, address(this));
        
        // Approve and wrap shares
        IERC20(contracts.vault).forceApprove(contracts.wrapper, shares);
        CreatorOVaultWrapper(contracts.wrapper).wrap(shares);
        
        // ============ STEP 6: START CCA AUCTION ============
        
        if (auctionAmount > 0) {
            // Approve CCA for auction amount
            IERC20(contracts.shareOFT).forceApprove(contracts.ccaStrategy, auctionAmount);
            
            // Start auction (uses default duration and floor price from CCA)
            CCALaunchStrategy(payable(contracts.ccaStrategy)).launchAuctionSimple(
                auctionAmount,
                requiredRaise
            );
        }
        
        // Transfer remaining wsTokens to creator
        uint256 remaining = IERC20(contracts.shareOFT).balanceOf(address(this));
        if (remaining > 0) {
            IERC20(contracts.shareOFT).safeTransfer(msg.sender, remaining);
        }
        
        // Transfer ownership of all contracts to creator
        _transferOwnership(contracts, msg.sender);
        
        emit VaultLaunched(
            msg.sender,
            creatorCoin,
            contracts.vault,
            contracts.wrapper,
            contracts.shareOFT,
            contracts.gaugeController,
            contracts.ccaStrategy,
            contracts.oracle,
            depositAmount,
            auctionAmount
        );
    }

    // ================================
    // INTERNAL: DEPLOYMENT
    // ================================
    
    struct DeployedContracts {
        address vault;
        address wrapper;
        address shareOFT;
        address gaugeController;
        address ccaStrategy;
        address oracle;
    }
    
    function _deployContracts(
        address creatorCoin,
        string memory symbol,
        address creator
    ) internal returns (DeployedContracts memory c) {
        string memory vaultName = string(abi.encodePacked(symbol, " Shares"));
        string memory vaultSymbol = string(abi.encodePacked("s", symbol));
        string memory oftName = string(abi.encodePacked("Wrapped ", symbol, " Shares"));
        string memory oftSymbol = string(abi.encodePacked("ws", symbol));
        
        // 1. Deploy Vault
        c.vault = address(new CreatorOVault(
            creatorCoin,
            address(this),  // temporary owner
            vaultName,
            vaultSymbol
        ));
        
        // 2. Deploy Wrapper
        c.wrapper = address(new CreatorOVaultWrapper(
            creatorCoin,
            c.vault,
            address(this)  // temporary owner
        ));
        
        // 3. Deploy ShareOFT (uses registry for LZ endpoint)
        c.shareOFT = address(new CreatorShareOFT(
            oftName,
            oftSymbol,
            address(registry),
            address(this)  // temporary owner
        ));
        
        // 4. Deploy GaugeController
        c.gaugeController = address(new CreatorGaugeController(
            c.shareOFT,
            creator,   // creator treasury
            owner(),   // protocol treasury
            address(this)  // temporary owner
        ));
        
        // 5. Deploy CCA Strategy
        c.ccaStrategy = address(new CCALaunchStrategy(
            c.shareOFT,
            address(0),  // ETH as currency
            c.vault,     // funds to vault
            c.vault,     // unsold tokens to vault
            address(this)  // temporary owner
        ));
        
        // 6. Deploy Oracle (uses registry for LZ endpoint)
        c.oracle = address(new CreatorChainlinkOracle(
            address(registry),
            CHAINLINK_ETH_USD,
            oftSymbol,
            address(this)  // temporary owner
        ));
    }
    
    function _configurePermissions(DeployedContracts memory c) internal {
        // Vault permissions
        CreatorOVault(payable(c.vault)).setGaugeController(c.gaugeController);
        CreatorOVault(payable(c.vault)).setWhitelist(c.wrapper, true);
        
        // Wrapper permissions
        CreatorOVaultWrapper(c.wrapper).setShareOFT(c.shareOFT);
        
        // ShareOFT permissions
        CreatorShareOFT(c.shareOFT).setMinter(c.wrapper, true);
        
        // GaugeController permissions
        CreatorGaugeController(payable(c.gaugeController)).setVault(c.vault);
        CreatorGaugeController(payable(c.gaugeController)).setWrapper(c.wrapper);
    }
    
    function _configureIntegrations(
        DeployedContracts memory c,
        address creatorCoin
    ) internal {
        // GaugeController integrations
        CreatorGaugeController(payable(c.gaugeController)).setCreatorCoin(creatorCoin);
        CreatorGaugeController(payable(c.gaugeController)).setOracle(c.oracle);
        
        if (lotteryManager != address(0)) {
            CreatorGaugeController(payable(c.gaugeController)).setLotteryManager(lotteryManager);
        }
        
        // CCA oracle config for auto V4 pool setup
        CCALaunchStrategy(payable(c.ccaStrategy)).setOracleConfig(
            c.oracle,
            V4_POOL_MANAGER,
            TAX_HOOK
        );
    }
    
    function _registerWithEcosystem(
        DeployedContracts memory c,
        address creatorCoin,
        address creator
    ) internal {
        // Register with main registry
        registry.setCreatorOracle(creatorCoin, c.oracle);
        registry.setCreatorGaugeController(creatorCoin, c.gaugeController);
        
        // Register with factory
        if (!factory.isDeployed(creatorCoin)) {
            factory.registerDeployment(
                creatorCoin,
                c.vault,
                c.wrapper,
                c.shareOFT,
                c.gaugeController,
                c.ccaStrategy,
                c.oracle,
                creator
            );
        }
    }
    
    function _transferOwnership(DeployedContracts memory c, address newOwner) internal {
        CreatorOVault(payable(c.vault)).transferOwnership(newOwner);
        CreatorOVaultWrapper(c.wrapper).transferOwnership(newOwner);
        CreatorShareOFT(c.shareOFT).transferOwnership(newOwner);
        CreatorGaugeController(payable(c.gaugeController)).transferOwnership(newOwner);
        CCALaunchStrategy(payable(c.ccaStrategy)).transferOwnership(newOwner);
        CreatorChainlinkOracle(c.oracle).transferOwnership(newOwner);
    }

    // ================================
    // HELPERS
    // ================================
    
    function _getSymbol(address token) internal view returns (string memory) {
        // Try to get symbol from token
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("symbol()")
        );
        if (success && data.length > 0) {
            return abi.decode(data, (string));
        }
        return "TOKEN";
    }
    
    function _toUpperCase(string memory str) internal pure returns (string memory) {
        bytes memory bStr = bytes(str);
        bytes memory bUpper = new bytes(bStr.length);
        for (uint i = 0; i < bStr.length; i++) {
            if (bStr[i] >= 0x61 && bStr[i] <= 0x7A) {
                bUpper[i] = bytes1(uint8(bStr[i]) - 32);
            } else {
                bUpper[i] = bStr[i];
            }
        }
        return string(bUpper);
    }

    // ================================
    // ADMIN
    // ================================
    
    /// @notice Rescue stuck tokens
    function rescue(address token, address to, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success,) = to.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
    
    receive() external payable {}
}

