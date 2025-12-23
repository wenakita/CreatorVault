// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// =================================
// INTERFACES (defined outside contract)
// =================================

interface ICreatorOVaultFactoryBatcher {
    struct DeploymentInfo {
        address creatorCoin;
        address vault;
        address wrapper;
        address shareOFT;
        address gaugeController;
        address ccaStrategy;
        address oracle;
        address creator;
        uint256 deployedAt;
        bool exists;
    }
    
    function deploy(address _creatorCoin) external returns (DeploymentInfo memory);
    function deployments(address _token) external view returns (DeploymentInfo memory);
}

interface IPayoutRouterFactoryBatcher {
    function deploy(address _wrapper, address _owner) external returns (address);
    function computeAddress(address _wrapper, address _owner) external view returns (address);
}

interface IZoraCoinBatcher {
    function setPayoutRecipient(address _recipient) external;
    function payoutRecipient() external view returns (address);
}

/**
 * @title CreatorDeploymentBatcher
 * @author 0xakita.eth (CreatorVault)
 * @notice Helper for batching Creator Vault deployment via ERC-4337 Account Abstraction
 * 
 * @dev ERC-4337 FLOW:
 *      ┌─────────────────────────────────────────────────────────────────────────┐
 *      │                        Smart Account (AA Wallet)                        │
 *      │                                  │                                      │
 *      │   executeBatch([                 │                                      │
 *      │       factory.deploy(token),     │ ← Single UserOperation               │
 *      │       payoutRouterFactory.deploy │                                      │
 *      │       zoraCoin.setPayoutRecipient│                                      │
 *      │       lotteryManager.setCreator  │                                      │
 *      │   ])                             │                                      │
 *      │                                  │                                      │
 *      │                                  ▼                                      │
 *      │                            EntryPoint                                   │
 *      │                                  │                                      │
 *      │                            Bundler                                      │
 *      └─────────────────────────────────────────────────────────────────────────┘
 * 
 * @dev WHY ERC-4337:
 *      1. Single transaction deploys EVERYTHING
 *      2. Atomic: all succeed or all revert
 *      3. Gasless option via paymaster
 *      4. Better UX for creators
 * 
 * @dev DEPLOYMENT BUNDLE:
 *      Call 1: factory.deploy(creatorCoin)
 *              → Deploys: Vault, Wrapper, ShareOFT, GaugeController, CCAStrategy, Oracle
 *      
 *      Call 2: payoutRouterFactory.deploy(wrapper, creator)
 *              → Deploys: PayoutRouter for fee-to-burn routing
 *      
 *      Call 3: zoraCoin.setPayoutRecipient(payoutRouter)  [Optional]
 *              → Redirects Zora fees to PayoutRouter
 *      
 *      All in ONE UserOperation!
 * 
 * @dev USAGE:
 *      1. Use this contract to encode calldata for each step
 *      2. Submit encoded calls to your Smart Account's executeBatch()
 *      3. Send UserOperation to bundler
 *      4. Wait for receipt
 */
contract CreatorDeploymentBatcher {
    using SafeERC20 for IERC20;
    
    // =================================
    // STATE
    // =================================
    
    /// @notice The CreatorOVaultFactory
    ICreatorOVaultFactoryBatcher public immutable factory;
    
    /// @notice The PayoutRouterFactory
    IPayoutRouterFactoryBatcher public immutable payoutRouterFactory;
    
    // =================================
    // EVENTS
    // =================================
    
    event FullDeploymentCompleted(
        address indexed creatorCoin,
        address vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy,
        address oracle,
        address payoutRouter,
        address creator
    );
    
    // =================================
    // ERRORS
    // =================================
    
    error ZeroAddress();
    error DeploymentFailed();
    
    // =================================
    // CONSTRUCTOR
    // =================================
    
    constructor(address _factory, address _payoutRouterFactory) {
        if (_factory == address(0)) revert ZeroAddress();
        // payoutRouterFactory is optional
        
        factory = ICreatorOVaultFactoryBatcher(_factory);
        payoutRouterFactory = IPayoutRouterFactoryBatcher(_payoutRouterFactory);
    }
    
    // =================================
    // BATCH DEPLOYMENT (Single Call)
    // =================================
    
    /**
     * @notice Deploy everything in a single call (for non-AA usage)
     * @param _creatorCoin The creator coin token address
     * @param _deployPayoutRouter Whether to deploy PayoutRouter
     * @param _redirectPayoutRecipient Whether to change Zora's payoutRecipient
     * @return info The deployment info from factory
     * @return payoutRouter The PayoutRouter address (or zero if not deployed)
     * 
     * @dev This function can be called directly OR via AA executeBatch
     *      For AA, you might prefer calling each step separately for more control
     */
    function deployAll(
        address _creatorCoin,
        bool _deployPayoutRouter,
        bool _redirectPayoutRecipient
    ) external returns (
        ICreatorOVaultFactoryBatcher.DeploymentInfo memory info,
        address payoutRouter
    ) {
        // Step 1: Deploy core infrastructure via factory
        info = factory.deploy(_creatorCoin);
        
        if (info.vault == address(0)) revert DeploymentFailed();
        
        // Step 2: Deploy PayoutRouter (optional)
        if (_deployPayoutRouter && address(payoutRouterFactory) != address(0)) {
            payoutRouter = payoutRouterFactory.deploy(info.wrapper, msg.sender);
        }
        
        // Step 3: Redirect payoutRecipient (optional, only if caller is current recipient)
        if (_redirectPayoutRecipient && payoutRouter != address(0)) {
            // This will only work if msg.sender (the AA wallet) is the current payoutRecipient
            try IZoraCoinBatcher(_creatorCoin).setPayoutRecipient(payoutRouter) {} catch {}
        }
        
        emit FullDeploymentCompleted(
            _creatorCoin,
            info.vault,
            info.wrapper,
            info.shareOFT,
            info.gaugeController,
            info.ccaStrategy,
            info.oracle,
            payoutRouter,
            info.creator
        );
    }
    
    // =================================
    // CALLDATA ENCODERS (for AA wallets)
    // =================================
    
    /**
     * @notice Encode factory.deploy() calldata
     * @param _creatorCoin The token to deploy vault for
     * @return target The factory address
     * @return data The encoded calldata
     * 
     * @dev Use this to build your UserOperation's calls array
     */
    function encodeFactoryDeploy(address _creatorCoin) 
        external 
        view 
        returns (address target, bytes memory data) 
    {
        target = address(factory);
        data = abi.encodeWithSelector(
            ICreatorOVaultFactoryBatcher.deploy.selector,
            _creatorCoin
        );
    }
    
    /**
     * @notice Encode payoutRouterFactory.deploy() calldata
     * @param _wrapper The wrapper address (get from factory.deployments after step 1)
     * @param _owner The owner/creator address
     * @return target The payoutRouterFactory address
     * @return data The encoded calldata
     */
    function encodePayoutRouterDeploy(address _wrapper, address _owner)
        external
        view
        returns (address target, bytes memory data)
    {
        target = address(payoutRouterFactory);
        data = abi.encodeWithSelector(
            IPayoutRouterFactoryBatcher.deploy.selector,
            _wrapper,
            _owner
        );
    }
    
    /**
     * @notice Encode setPayoutRecipient() calldata for Zora tokens
     * @param _zoraCoin The Zora coin address
     * @param _newRecipient The new payout recipient (PayoutRouter address)
     * @return target The Zora coin address
     * @return data The encoded calldata
     */
    function encodeSetPayoutRecipient(address _zoraCoin, address _newRecipient)
        external
        pure
        returns (address target, bytes memory data)
    {
        target = _zoraCoin;
        data = abi.encodeWithSelector(
            IZoraCoinBatcher.setPayoutRecipient.selector,
            _newRecipient
        );
    }
    
    // =================================
    // PREVIEW FUNCTIONS
    // =================================
    
    /**
     * @notice Preview all addresses that would be deployed
     * @param _creatorCoin The token address
     * @param _owner The owner/creator address
     * @return wrapper The predicted wrapper address (if deterministic)
     * @return payoutRouter The predicted PayoutRouter address
     * 
     * @dev Useful for previewing before deployment
     */
    function previewDeployment(address _creatorCoin, address _owner)
        external
        view
        returns (address wrapper, address payoutRouter)
    {
        // Check if already deployed
        ICreatorOVaultFactoryBatcher.DeploymentInfo memory existing = factory.deployments(_creatorCoin);
        
        if (existing.exists) {
            wrapper = existing.wrapper;
            if (address(payoutRouterFactory) != address(0)) {
                payoutRouter = payoutRouterFactory.computeAddress(wrapper, _owner);
            }
        }
        // Note: Can't predict wrapper address before deployment unless using CREATE2
    }
    
    /**
     * @notice Get existing deployment info
     */
    function getDeployment(address _creatorCoin) 
        external 
        view 
        returns (ICreatorOVaultFactoryBatcher.DeploymentInfo memory) 
    {
        return factory.deployments(_creatorCoin);
    }
}
