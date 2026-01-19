// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {ICreatorRegistry} from "../../interfaces/core/ICreatorRegistry.sol";
import {ICreatorGaugeController} from "../../interfaces/core/ICreatorGaugeController.sol";
import {ICreatorOVault} from "../../interfaces/core/ICreatorOVault.sol";

interface IUniversalCreate2DeployerFromStore {
    function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr);
    function computeAddress(bytes32 salt, bytes32 initCodeHash) external view returns (address);
}

interface IUniversalBytecodeStore {
    function get(bytes32 codeId) external view returns (bytes memory);
}

interface ICreatorCoin {
    function setPayoutRecipient(address _recipient) external;
}

interface ICreatorOVaultWrapper {
    function setShareOFT(address _shareOFT) external;
    function wrap(uint256 amount) external returns (uint256 wsTokens);
    function transferOwnership(address newOwner) external;
}

interface ICreatorShareOFT {
    function setRegistry(address _registry) external;
    function setVault(address _vault) external;
    function setMinter(address minter, bool status) external;
    function setGaugeController(address _controller) external;
    function transferOwnership(address newOwner) external;
}

interface ICCALaunchStrategy {
    function setApprovedLauncher(address launcher, bool approved) external;
    function setOracleConfig(address _oracle, address _poolManager, address _taxHook, address _feeRecipient) external;
    function setDefaultTickSpacing(uint256 _spacing) external;
    function launchAuction(
        uint256 amount,
        uint256 floorPrice,
        uint128 requiredRaise,
        bytes calldata auctionSteps
    ) external returns (address auction);
    function transferOwnership(address newOwner) external;
}

interface IOwnableTransfer {
    function transferOwnership(address newOwner) external;
}

interface IOFTBootstrapRegistry {
    function setLayerZeroEndpoint(uint16 chainId, address endpoint) external;
}

interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);
}

interface IUniswapV3Pool {
    function initialize(uint160 sqrtPriceX96) external;
}

interface ICharmAlphaVaultDeploy {
    function initializeAndTransfer(
        address newGovernance,
        address newKeeper,
        int24 baseThreshold,
        int24 limitThreshold,
        int24 maxTwapDeviation,
        uint32 twapDuration
    ) external;
}

interface ICreatorCharmStrategy {
    function initializeApprovals() external;
}

interface ICreatorOVaultStrategyManager {
    function addStrategy(address strategy, uint256 weight) external;
    function setAutoAllocate(bool autoAllocate) external;
}

/**
 * @title CreatorVaultBatcherTwoStep
 * @author 0xakita.eth
 * @notice Two-transaction CreatorVault deployment (Phase 1 + Phase 2).
 * @dev We can no longer deploy the full stack in one transaction on Base due to code-deposit gas limits.
 *      This contract splits deployment into two calls:
 *      - Phase 1: deploy vault + wrapper + shareOFT + minimal wiring (no token pulls / no auction)
 *      - Phase 2: deploy gauge + strategy + oracle + full wiring + deposit + optional auction + ownership transfers
 */
contract CreatorVaultBatcherTwoStep is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint24 public constant V3_FEE_TIER = 3000; // 0.3% CREATOR/USDC pool

    struct CodeIds {
        bytes32 vault;
        bytes32 wrapper;
        bytes32 shareOFT;
        bytes32 gauge;
        bytes32 cca;
        bytes32 oracle;
        bytes32 oftBootstrap;
    }

    struct Phase1Params {
        address creatorToken;
        address owner;
        string vaultName;
        string vaultSymbol;
        string shareName;
        string shareSymbol;
        string version;
    }

    struct Phase2Params {
        address creatorToken;
        address owner;
        address creatorTreasury;
        address payoutRecipient;
        address vault;
        address wrapper;
        address shareOFT;
        string shareSymbol;
        string version;
        uint256 depositAmount;
        uint8 auctionPercent;
        uint128 requiredRaise;
        uint256 floorPriceQ96;
        bytes auctionSteps;
    }

    struct PermitData {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    struct Phase1Result {
        address oftBootstrapRegistry;
        address vault;
        address wrapper;
        address shareOFT;
    }

    struct Phase2Result {
        address gaugeController;
        address ccaStrategy;
        address oracle;
        address auction;
    }

    struct StrategyCodeIds {
        bytes32 charmAlphaVaultDeploy;
        bytes32 creatorCharmStrategy;
        bytes32 ajnaStrategy;
    }

    struct Phase3Params {
        address creatorToken;
        address owner;
        address vault;
        string version;
        // If the CREATOR/USDC V3 pool does not exist yet, we can create it with this initial price.
        // If the pool already exists, you can pass 0 and we'll skip initialization.
        uint160 initialSqrtPriceX96;
        string charmVaultName;
        string charmVaultSymbol;
        uint256 charmWeightBps;
        uint256 ajnaWeightBps;
        bool enableAutoAllocate;
    }

    struct Phase3Result {
        address v3Pool;
        address charmVault;
        address charmStrategy;
        address ajnaStrategy;
    }

    error ZeroAddress();
    error InvalidPercent();
    error InvalidCodeId();
    error NotOwner();
    error Phase1Missing();
    error InvalidWeight();
    error V3PoolMissing();
    error MissingInitialSqrtPriceX96();

    ICreatorRegistry public immutable registry;
    IUniversalBytecodeStore public immutable bytecodeStore;
    IUniversalCreate2DeployerFromStore public immutable create2Deployer;

    address public immutable protocolTreasury;
    address public immutable poolManager;
    address public immutable taxHook;
    address public immutable chainlinkEthUsd;
    address public immutable vaultActivationBatcher;
    address public immutable lotteryManager;
    address public immutable permit2;
    address public immutable usdc;
    address public immutable uniswapV3Factory;
    address public immutable uniswapRouter;
    address public immutable ajnaFactory;

    event Phase1Deployed(
        address indexed creatorToken,
        address indexed owner,
        address oftBootstrapRegistry,
        address vault,
        address wrapper,
        address shareOFT
    );

    event Phase2DeployedAndLaunched(
        address indexed creatorToken,
        address indexed owner,
        address gaugeController,
        address ccaStrategy,
        address oracle,
        address auction
    );

    event Phase3StrategiesDeployed(
        address indexed creatorToken,
        address indexed owner,
        address indexed vault,
        address v3Pool,
        address charmVault,
        address charmStrategy,
        address ajnaStrategy,
        uint256 charmWeightBps,
        uint256 ajnaWeightBps
    );

    constructor(
        address _registry,
        address _bytecodeStore,
        address _create2Deployer,
        address _protocolTreasury,
        address _poolManager,
        address _taxHook,
        address _chainlinkEthUsd,
        address _vaultActivationBatcher,
        address _lotteryManager,
        address _permit2,
        address _usdc,
        address _uniswapV3Factory,
        address _uniswapRouter,
        address _ajnaFactory
    ) {
        if (_registry == address(0) || _bytecodeStore == address(0) || _create2Deployer == address(0)) revert ZeroAddress();
        if (_protocolTreasury == address(0) || _poolManager == address(0) || _taxHook == address(0)) revert ZeroAddress();
        if (_chainlinkEthUsd == address(0)) revert ZeroAddress();
        if (_usdc == address(0) || _uniswapV3Factory == address(0) || _uniswapRouter == address(0) || _ajnaFactory == address(0)) {
            revert ZeroAddress();
        }

        registry = ICreatorRegistry(_registry);
        bytecodeStore = IUniversalBytecodeStore(_bytecodeStore);
        create2Deployer = IUniversalCreate2DeployerFromStore(_create2Deployer);
        protocolTreasury = _protocolTreasury;
        poolManager = _poolManager;
        taxHook = _taxHook;
        chainlinkEthUsd = _chainlinkEthUsd;
        vaultActivationBatcher = _vaultActivationBatcher;
        lotteryManager = _lotteryManager;
        permit2 = _permit2;
        usdc = _usdc;
        uniswapV3Factory = _uniswapV3Factory;
        uniswapRouter = _uniswapRouter;
        ajnaFactory = _ajnaFactory;
    }

    // ================================
    // PHASE 1
    // ================================

    function deployPhase1(
        Phase1Params calldata params,
        CodeIds calldata codeIds
    ) external nonReentrant returns (Phase1Result memory out) {
        _requireOwner(params.owner);
        if (params.creatorToken == address(0) || params.owner == address(0)) revert ZeroAddress();
        _requirePhase1CodeIds(codeIds);

        // Batcher owns the contracts until Phase 2 completes final wiring + ownership transfers.
        address tempOwner = address(this);

        string memory shareSymbolLower = _toLower(params.shareSymbol);

        bytes32 baseSalt = _deriveBaseSalt(params.creatorToken, params.owner, params.version);
        bytes32 vaultSalt = _saltFor(baseSalt, "vault");
        bytes32 wrapperSalt = _saltFor(baseSalt, "wrapper");
        bytes32 shareOftSalt = _deriveShareOftSalt(params.owner, shareSymbolLower, params.version);

        // OFT bootstrap registry is chain-global + constructor-less ⇒ initCodeHash == codeId.
        bytes32 oftBootstrapSalt = keccak256("CreatorVault:OFTBootstrapRegistry:v1");
        out.oftBootstrapRegistry = create2Deployer.computeAddress(oftBootstrapSalt, codeIds.oftBootstrap);
        if (out.oftBootstrapRegistry.code.length == 0) {
            create2Deployer.deploy(oftBootstrapSalt, codeIds.oftBootstrap, bytes(""));
        }

        address lzEndpoint = registry.getLayerZeroEndpoint(uint16(block.chainid));
        IOFTBootstrapRegistry(out.oftBootstrapRegistry).setLayerZeroEndpoint(uint16(block.chainid), lzEndpoint);

        bytes memory vaultArgs = abi.encode(params.creatorToken, tempOwner, params.vaultName, params.vaultSymbol);
        out.vault = create2Deployer.deploy(vaultSalt, codeIds.vault, vaultArgs);

        bytes memory wrapperArgs = abi.encode(params.creatorToken, out.vault, tempOwner);
        out.wrapper = create2Deployer.deploy(wrapperSalt, codeIds.wrapper, wrapperArgs);

        bytes memory shareOftArgs = abi.encode(params.shareName, shareSymbolLower, out.oftBootstrapRegistry, tempOwner);
        out.shareOFT = create2Deployer.deploy(shareOftSalt, codeIds.shareOFT, shareOftArgs);

        // Minimal wiring so Phase 2 can proceed without redeploying Phase 1 components.
        ICreatorOVaultWrapper(out.wrapper).setShareOFT(out.shareOFT);
        ICreatorShareOFT(out.shareOFT).setRegistry(address(registry));
        ICreatorShareOFT(out.shareOFT).setVault(out.vault);
        ICreatorShareOFT(out.shareOFT).setMinter(out.wrapper, true);

        ICreatorOVault(out.vault).setWhitelist(out.wrapper, true);
        ICreatorOVault(out.vault).setWhitelist(address(this), true);
        if (vaultActivationBatcher != address(0)) {
            ICreatorOVault(out.vault).setWhitelist(vaultActivationBatcher, true);
        }

        emit Phase1Deployed(params.creatorToken, params.owner, out.oftBootstrapRegistry, out.vault, out.wrapper, out.shareOFT);
    }

    // ================================
    // PHASE 2
    // ================================

    function deployPhase2AndLaunch(
        Phase2Params calldata params,
        CodeIds calldata codeIds
    ) external nonReentrant returns (Phase2Result memory out) {
        _requireOwner(params.owner);
        _pullCreatorTokens(params.creatorToken, params.owner, params.depositAmount);
        out = _deployPhase2AndLaunch(params, codeIds);
    }

    function deployPhase2AndLaunchWithPermit(
        Phase2Params calldata params,
        CodeIds calldata codeIds,
        PermitData calldata permit
    ) external nonReentrant returns (Phase2Result memory out) {
        _requireOwner(params.owner);
        _permitAndPull(params.creatorToken, params.owner, params.depositAmount, permit);
        out = _deployPhase2AndLaunch(params, codeIds);
    }

    function _deployPhase2AndLaunch(
        Phase2Params calldata params,
        CodeIds calldata codeIds
    ) internal returns (Phase2Result memory out) {
        if (params.creatorToken == address(0) || params.owner == address(0)) revert ZeroAddress();
        if (params.vault == address(0) || params.wrapper == address(0) || params.shareOFT == address(0)) revert ZeroAddress();
        if (params.auctionPercent > 100) revert InvalidPercent();
        _requirePhase2CodeIds(codeIds);

        // Require phase-1 contracts to exist.
        if (params.vault.code.length == 0 || params.wrapper.code.length == 0 || params.shareOFT.code.length == 0) revert Phase1Missing();

        address treasury = params.creatorTreasury == address(0) ? params.owner : params.creatorTreasury;
        address tempOwner = address(this);

        string memory shareSymbolLower = _toLower(params.shareSymbol);

        bytes32 baseSalt = _deriveBaseSalt(params.creatorToken, params.owner, params.version);
        bytes32 gaugeSalt = _saltFor(baseSalt, "gauge");
        bytes32 ccaSalt = _saltFor(baseSalt, "cca");
        bytes32 oracleSalt = _saltFor(baseSalt, "oracle");

        bytes memory gaugeArgs = abi.encode(params.shareOFT, treasury, protocolTreasury, tempOwner);
        out.gaugeController = create2Deployer.deploy(gaugeSalt, codeIds.gauge, gaugeArgs);

        bytes memory ccaArgs = abi.encode(params.shareOFT, address(0), params.vault, params.vault, tempOwner);
        out.ccaStrategy = create2Deployer.deploy(ccaSalt, codeIds.cca, ccaArgs);

        bytes memory oracleArgs = abi.encode(address(registry), chainlinkEthUsd, shareSymbolLower, tempOwner);
        out.oracle = create2Deployer.deploy(oracleSalt, codeIds.oracle, oracleArgs);

        if (params.payoutRecipient != address(0)) {
            ICreatorCoin(params.creatorToken).setPayoutRecipient(params.payoutRecipient);
        }

        // Phase-2 wiring (now that gauge + oracle exist).
        ICreatorShareOFT(params.shareOFT).setGaugeController(out.gaugeController);

        ICreatorGaugeController(out.gaugeController).setVault(params.vault);
        ICreatorGaugeController(out.gaugeController).setWrapper(params.wrapper);
        ICreatorGaugeController(out.gaugeController).setCreatorCoin(params.creatorToken);
        if (lotteryManager != address(0)) {
            ICreatorGaugeController(out.gaugeController).setLotteryManager(lotteryManager);
        }
        ICreatorGaugeController(out.gaugeController).setOracle(out.oracle);

        ICreatorOVault(params.vault).setGaugeController(out.gaugeController);

        ICCALaunchStrategy(out.ccaStrategy).setApprovedLauncher(address(this), true);
        if (vaultActivationBatcher != address(0)) {
            ICCALaunchStrategy(out.ccaStrategy).setApprovedLauncher(vaultActivationBatcher, true);
        }
        ICCALaunchStrategy(out.ccaStrategy).setOracleConfig(out.oracle, poolManager, taxHook, out.gaugeController);
        ICCALaunchStrategy(out.ccaStrategy).setDefaultTickSpacing(_defaultTickSpacingQ96(params.floorPriceQ96));

        // Deposit + wrap + optional auction
        IERC20(params.creatorToken).forceApprove(params.vault, params.depositAmount);
        uint256 shares = ICreatorOVault(params.vault).deposit(params.depositAmount, address(this));

        IERC20(params.vault).forceApprove(params.wrapper, shares);
        uint256 wsTokens = ICreatorOVaultWrapper(params.wrapper).wrap(shares);

        uint256 auctionAmount = (wsTokens * params.auctionPercent) / 100;
        if (auctionAmount > 0) {
            IERC20(params.shareOFT).forceApprove(out.ccaStrategy, auctionAmount);
            out.auction = ICCALaunchStrategy(out.ccaStrategy).launchAuction(
                auctionAmount,
                params.floorPriceQ96,
                params.requiredRaise,
                params.auctionSteps
            );
        }

        uint256 remaining = wsTokens - auctionAmount;
        if (remaining > 0) {
            IERC20(params.shareOFT).safeTransfer(params.owner, remaining);
        }

        // Final ownership (hybrid)
        ICreatorOVault(params.vault).setProtocolRescue(protocolTreasury);
        ICreatorOVault(params.vault).transferOwnership(params.owner);
        ICreatorOVaultWrapper(params.wrapper).transferOwnership(protocolTreasury);
        ICreatorShareOFT(params.shareOFT).transferOwnership(protocolTreasury);
        ICreatorGaugeController(out.gaugeController).transferOwnership(protocolTreasury);
        ICCALaunchStrategy(out.ccaStrategy).transferOwnership(protocolTreasury);
        IOwnableTransfer(out.oracle).transferOwnership(protocolTreasury);

        emit Phase2DeployedAndLaunched(
            params.creatorToken,
            params.owner,
            out.gaugeController,
            out.ccaStrategy,
            out.oracle,
            out.auction
        );
    }

    // ================================
    // PHASE 3 (STRATEGIES)
    // ================================

    /**
     * @notice Deploy + register initial yield strategies (Charm CREATOR/USDC + Ajna lending).
     * @dev Uses UniversalBytecodeStore + CREATE2 deployer to avoid embedding initcode in this batcher.
     */
    function deployPhase3Strategies(
        Phase3Params calldata params,
        StrategyCodeIds calldata codeIds
    ) external nonReentrant returns (Phase3Result memory out) {
        _requireOwner(params.owner);

        if (params.creatorToken == address(0) || params.owner == address(0) || params.vault == address(0)) revert ZeroAddress();
        if (params.charmWeightBps == 0 || params.charmWeightBps > 10_000) revert InvalidWeight();
        if (params.ajnaWeightBps > 10_000) revert InvalidWeight();
        if (params.charmWeightBps + params.ajnaWeightBps > 10_000) revert InvalidWeight();

        if (codeIds.charmAlphaVaultDeploy == bytes32(0) || codeIds.creatorCharmStrategy == bytes32(0)) revert InvalidCodeId();
        if (params.ajnaWeightBps > 0 && codeIds.ajnaStrategy == bytes32(0)) revert InvalidCodeId();

        // ───────────────────────────────
        // 1) Ensure CREATOR/USDC V3 pool exists (0.3% fee)
        // ───────────────────────────────
        address v3Pool = IUniswapV3Factory(uniswapV3Factory).getPool(params.creatorToken, usdc, V3_FEE_TIER);
        if (v3Pool == address(0)) {
            if (params.initialSqrtPriceX96 == 0) revert MissingInitialSqrtPriceX96();
            v3Pool = IUniswapV3Factory(uniswapV3Factory).createPool(params.creatorToken, usdc, V3_FEE_TIER);
            if (v3Pool == address(0)) revert V3PoolMissing();
            IUniswapV3Pool(v3Pool).initialize(params.initialSqrtPriceX96);
        }
        out.v3Pool = v3Pool;

        // ───────────────────────────────
        // 2) Deploy Charm alpha vault (embeds initial rebalance logic)
        // ───────────────────────────────
        bytes32 baseSalt = _deriveBaseSalt(params.creatorToken, params.owner, params.version);
        bytes32 charmVaultSalt = _saltFor(baseSalt, "charmVaultV3");

        // protocolFee: 1% (1e6 = 100%), maxTotalSupply: unlimited
        bytes memory charmVaultArgs = abi.encode(
            v3Pool,
            uint256(10_000),
            type(uint256).max,
            params.charmVaultName,
            params.charmVaultSymbol
        );
        out.charmVault = create2Deployer.deploy(charmVaultSalt, codeIds.charmAlphaVaultDeploy, charmVaultArgs);

        // Initialize embedded rebalance params + transfer governance/keeper to protocol.
        ICharmAlphaVaultDeploy(out.charmVault).initializeAndTransfer(
            protocolTreasury,
            protocolTreasury,
            3000, // baseThreshold (must be multiple of tickSpacing)
            6000, // limitThreshold (must be multiple of tickSpacing)
            100,  // maxTwapDeviation (ticks)
            1800  // twapDuration (seconds)
        );

        // ───────────────────────────────
        // 3) Deploy Charm strategy adapter + initialize approvals
        // ───────────────────────────────
        bytes32 charmStratSalt = _saltFor(baseSalt, "charmStrategyV3");
        bytes memory charmStratArgs = abi.encode(
            params.vault,
            params.creatorToken,
            usdc,
            uniswapRouter,
            out.charmVault,
            v3Pool,
            address(this)
        );
        out.charmStrategy = create2Deployer.deploy(charmStratSalt, codeIds.creatorCharmStrategy, charmStratArgs);
        ICreatorCharmStrategy(out.charmStrategy).initializeApprovals();
        IOwnableTransfer(out.charmStrategy).transferOwnership(protocolTreasury);

        // ───────────────────────────────
        // 4) Deploy Ajna strategy (optional) + transfer ownership
        // ───────────────────────────────
        if (params.ajnaWeightBps > 0) {
            bytes32 ajnaSalt = _saltFor(baseSalt, "ajnaStrategy");
            bytes memory ajnaArgs = abi.encode(params.vault, params.creatorToken, ajnaFactory, usdc, address(this));
            out.ajnaStrategy = create2Deployer.deploy(ajnaSalt, codeIds.ajnaStrategy, ajnaArgs);
            IOwnableTransfer(out.ajnaStrategy).transferOwnership(protocolTreasury);
        }

        // ───────────────────────────────
        // 5) Register strategies on the vault (batcher remains `management` from Phase 1)
        // ───────────────────────────────
        ICreatorOVaultStrategyManager(params.vault).addStrategy(out.charmStrategy, params.charmWeightBps);
        if (params.ajnaWeightBps > 0) {
            ICreatorOVaultStrategyManager(params.vault).addStrategy(out.ajnaStrategy, params.ajnaWeightBps);
        }
        if (params.enableAutoAllocate) {
            ICreatorOVaultStrategyManager(params.vault).setAutoAllocate(true);
        }

        emit Phase3StrategiesDeployed(
            params.creatorToken,
            params.owner,
            params.vault,
            out.v3Pool,
            out.charmVault,
            out.charmStrategy,
            out.ajnaStrategy,
            params.charmWeightBps,
            params.ajnaWeightBps
        );
    }

    // ================================
    // HELPERS
    // ================================

    function _requireOwner(address owner) internal view {
        if (msg.sender != owner) revert NotOwner();
    }

    function _pullCreatorTokens(address creatorToken, address owner, uint256 amount) internal {
        IERC20(creatorToken).safeTransferFrom(owner, address(this), amount);
    }

    function _permitAndPull(address creatorToken, address owner, uint256 amount, PermitData calldata permit) internal {
        IERC20Permit(creatorToken).permit(owner, address(this), amount, permit.deadline, permit.v, permit.r, permit.s);
        IERC20(creatorToken).safeTransferFrom(owner, address(this), amount);
    }

    function _requirePhase1CodeIds(CodeIds calldata codeIds) internal pure {
        if (
            codeIds.vault == bytes32(0) ||
            codeIds.wrapper == bytes32(0) ||
            codeIds.shareOFT == bytes32(0) ||
            codeIds.oftBootstrap == bytes32(0)
        ) {
            revert InvalidCodeId();
        }
    }

    function _requirePhase2CodeIds(CodeIds calldata codeIds) internal pure {
        if (codeIds.gauge == bytes32(0) || codeIds.cca == bytes32(0) || codeIds.oracle == bytes32(0)) {
            revert InvalidCodeId();
        }
    }

    function _deriveBaseSalt(address creatorToken, address owner, string calldata version) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(creatorToken, owner, block.chainid, "CreatorVault:deploy:", version));
    }

    function _saltFor(bytes32 baseSalt, string memory label) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(baseSalt, label));
    }

    function _deriveShareOftSalt(address owner, string memory shareSymbolLower, string calldata version) internal pure returns (bytes32) {
        bytes32 base = keccak256(abi.encodePacked(owner, shareSymbolLower));
        return keccak256(abi.encodePacked(base, "CreatorShareOFT:", version));
    }

    function _defaultTickSpacingQ96(uint256 floorPriceQ96) internal pure returns (uint256) {
        uint256 spacing = floorPriceQ96 / 100;
        return spacing > 1 ? spacing : 2;
    }

    function _toLower(string memory input) internal pure returns (string memory) {
        bytes memory b = bytes(input);
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 65 && c <= 90) {
                b[i] = bytes1(c + 32);
            }
        }
        return string(b);
    }
}

