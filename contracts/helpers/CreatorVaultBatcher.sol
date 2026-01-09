// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICreatorRegistry} from "../interfaces/core/ICreatorRegistry.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";

interface IUniversalBytecodeStore {
    function get(bytes32 codeId) external view returns (bytes memory);
}

interface IUniversalCreate2DeployerFromStore {
    function deploy(bytes32 salt, bytes32 codeId, bytes calldata constructorArgs) external returns (address addr);
}

interface ICreatorCoin {
    function setPayoutRecipient(address _recipient) external;
}

interface ICreatorOVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function setGaugeController(address _controller) external;
    function setWhitelist(address _account, bool _status) external;
    function transferOwnership(address newOwner) external;
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

interface ICreatorGaugeController {
    function setVault(address _vault) external;
    function setWrapper(address _wrapper) external;
    function setCreatorCoin(address _creatorCoin) external;
    function setLotteryManager(address _lotteryManager) external;
    function setOracle(address _oracle) external;
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

interface ICreatorOracle {
    function transferOwnership(address newOwner) external;
}

interface IOFTBootstrapRegistry {
    function setLayerZeroEndpoint(uint16 chainId, address endpoint) external;
}

/**
 * @title CreatorVaultBatcher
 * @notice One-call CreatorVault deployment + launch for paymaster allowlisting.
 * @dev Uses the universal bytecode store + create2 deployer for deterministic addresses with small calldata.
 */
contract CreatorVaultBatcher is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct CodeIds {
        bytes32 vault;
        bytes32 wrapper;
        bytes32 shareOFT;
        bytes32 gauge;
        bytes32 cca;
        bytes32 oracle;
        bytes32 oftBootstrap;
    }

    struct DeployParams {
        address creatorToken;
        address owner;
        address creatorTreasury;
        address payoutRecipient;
        string vaultName;
        string vaultSymbol;
        string shareName;
        string shareSymbol;
        string version;
        uint256 depositAmount;
        uint8 auctionPercent;
        uint128 requiredRaise;
        uint256 floorPriceQ96;
        bytes auctionSteps;
    }

    struct DeploymentResult {
        address vault;
        address wrapper;
        address shareOFT;
        address gaugeController;
        address ccaStrategy;
        address oracle;
        address auction;
    }

    struct PermitData {
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    error ZeroAddress();
    error InvalidPercent();
    error InvalidCodeId();
    error NotOwner();
    error PermitTokenMismatch();
    error PermitAmountTooLow();

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

    event CreatorVaultDeployed(
        address indexed creatorToken,
        address indexed owner,
        address vault,
        address wrapper,
        address shareOFT,
        address gaugeController,
        address ccaStrategy,
        address oracle,
        address auction
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
        address _permit2
    ) {
        if (_registry == address(0) || _bytecodeStore == address(0) || _create2Deployer == address(0)) revert ZeroAddress();
        if (_protocolTreasury == address(0) || _poolManager == address(0) || _taxHook == address(0)) revert ZeroAddress();
        if (_chainlinkEthUsd == address(0)) revert ZeroAddress();

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
    }

    function deployAndLaunch(
        address creatorToken,
        address owner,
        address creatorTreasury,
        address payoutRecipient,
        string calldata vaultName,
        string calldata vaultSymbol,
        string calldata shareName,
        string calldata shareSymbol,
        string calldata version,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint128 requiredRaise,
        uint256 floorPriceQ96,
        bytes calldata auctionSteps,
        CodeIds calldata codeIds
    ) external nonReentrant returns (DeploymentResult memory result) {
        _requireOwner(owner);
        _pullCreatorTokens(creatorToken, owner, depositAmount);
        DeployParams memory params = DeployParams({
            creatorToken: creatorToken,
            owner: owner,
            creatorTreasury: creatorTreasury,
            payoutRecipient: payoutRecipient,
            vaultName: vaultName,
            vaultSymbol: vaultSymbol,
            shareName: shareName,
            shareSymbol: shareSymbol,
            version: version,
            depositAmount: depositAmount,
            auctionPercent: auctionPercent,
            requiredRaise: requiredRaise,
            floorPriceQ96: floorPriceQ96,
            auctionSteps: auctionSteps
        });
        result = _deployAndLaunch(params, codeIds);
    }

    function deployAndLaunchWithPermit(
        address creatorToken,
        address owner,
        address creatorTreasury,
        address payoutRecipient,
        string calldata vaultName,
        string calldata vaultSymbol,
        string calldata shareName,
        string calldata shareSymbol,
        string calldata version,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint128 requiredRaise,
        uint256 floorPriceQ96,
        bytes calldata auctionSteps,
        CodeIds calldata codeIds,
        PermitData calldata permit
    ) external nonReentrant returns (DeploymentResult memory result) {
        _requireOwner(owner);
        _permitAndPull(creatorToken, owner, depositAmount, permit);
        DeployParams memory params = DeployParams({
            creatorToken: creatorToken,
            owner: owner,
            creatorTreasury: creatorTreasury,
            payoutRecipient: payoutRecipient,
            vaultName: vaultName,
            vaultSymbol: vaultSymbol,
            shareName: shareName,
            shareSymbol: shareSymbol,
            version: version,
            depositAmount: depositAmount,
            auctionPercent: auctionPercent,
            requiredRaise: requiredRaise,
            floorPriceQ96: floorPriceQ96,
            auctionSteps: auctionSteps
        });
        result = _deployAndLaunch(params, codeIds);
    }

    function deployAndLaunchWithPermit2(
        address creatorToken,
        address owner,
        address creatorTreasury,
        address payoutRecipient,
        string calldata vaultName,
        string calldata vaultSymbol,
        string calldata shareName,
        string calldata shareSymbol,
        string calldata version,
        uint256 depositAmount,
        uint8 auctionPercent,
        uint128 requiredRaise,
        uint256 floorPriceQ96,
        bytes calldata auctionSteps,
        CodeIds calldata codeIds,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external nonReentrant returns (DeploymentResult memory result) {
        _requireOwner(owner);
        _permit2AndPull(creatorToken, owner, depositAmount, permit, signature);
        DeployParams memory params = DeployParams({
            creatorToken: creatorToken,
            owner: owner,
            creatorTreasury: creatorTreasury,
            payoutRecipient: payoutRecipient,
            vaultName: vaultName,
            vaultSymbol: vaultSymbol,
            shareName: shareName,
            shareSymbol: shareSymbol,
            version: version,
            depositAmount: depositAmount,
            auctionPercent: auctionPercent,
            requiredRaise: requiredRaise,
            floorPriceQ96: floorPriceQ96,
            auctionSteps: auctionSteps
        });
        result = _deployAndLaunch(params, codeIds);
    }

    function _deployAndLaunch(
        DeployParams memory params,
        CodeIds calldata codeIds
    ) internal returns (DeploymentResult memory result) {
        if (params.creatorToken == address(0) || params.owner == address(0)) revert ZeroAddress();
        if (params.auctionPercent > 100) revert InvalidPercent();
        _requireCodeIds(codeIds);

        address treasury = params.creatorTreasury == address(0) ? params.owner : params.creatorTreasury;

        bytes32 baseSalt = _deriveBaseSalt(params.creatorToken, params.owner, params.version);
        bytes32 vaultSalt = _saltFor(baseSalt, "vault");
        bytes32 wrapperSalt = _saltFor(baseSalt, "wrapper");
        bytes32 gaugeSalt = _saltFor(baseSalt, "gauge");
        bytes32 ccaSalt = _saltFor(baseSalt, "cca");
        bytes32 oracleSalt = _saltFor(baseSalt, "oracle");

        bytes32 oftBootstrapSalt = keccak256(abi.encodePacked("CreatorVault:OFTBootstrapRegistry:v1"));
        bytes32 shareOftSalt = _deriveShareOftSalt(params.owner, params.shareSymbol, params.version);

        address oftBootstrapRegistry = _computeCreate2Address(
            oftBootstrapSalt,
            codeIds.oftBootstrap,
            bytes("")
        );
        if (oftBootstrapRegistry.code.length == 0) {
            create2Deployer.deploy(oftBootstrapSalt, codeIds.oftBootstrap, bytes(""));
        }

        address lzEndpoint = registry.getLayerZeroEndpoint(uint16(block.chainid));
        IOFTBootstrapRegistry(oftBootstrapRegistry).setLayerZeroEndpoint(uint16(block.chainid), lzEndpoint);

        bytes memory vaultArgs = abi.encode(params.creatorToken, params.owner, params.vaultName, params.vaultSymbol);
        result.vault = create2Deployer.deploy(vaultSalt, codeIds.vault, vaultArgs);

        bytes memory wrapperArgs = abi.encode(params.creatorToken, result.vault, params.owner);
        result.wrapper = create2Deployer.deploy(wrapperSalt, codeIds.wrapper, wrapperArgs);

        bytes memory shareOftArgs = abi.encode(params.shareName, params.shareSymbol, oftBootstrapRegistry, params.owner);
        result.shareOFT = create2Deployer.deploy(shareOftSalt, codeIds.shareOFT, shareOftArgs);

        bytes memory gaugeArgs = abi.encode(result.shareOFT, treasury, protocolTreasury, params.owner);
        result.gaugeController = create2Deployer.deploy(gaugeSalt, codeIds.gauge, gaugeArgs);

        bytes memory ccaArgs = abi.encode(result.shareOFT, address(0), result.vault, result.vault, params.owner);
        result.ccaStrategy = create2Deployer.deploy(ccaSalt, codeIds.cca, ccaArgs);

        bytes memory oracleArgs = abi.encode(address(registry), chainlinkEthUsd, params.shareSymbol, params.owner);
        result.oracle = create2Deployer.deploy(oracleSalt, codeIds.oracle, oracleArgs);

        if (params.payoutRecipient != address(0)) {
            ICreatorCoin(params.creatorToken).setPayoutRecipient(params.payoutRecipient);
        }

        ICreatorOVaultWrapper(result.wrapper).setShareOFT(result.shareOFT);
        ICreatorShareOFT(result.shareOFT).setRegistry(address(registry));
        ICreatorShareOFT(result.shareOFT).setVault(result.vault);
        ICreatorShareOFT(result.shareOFT).setMinter(result.wrapper, true);
        ICreatorShareOFT(result.shareOFT).setGaugeController(result.gaugeController);

        ICreatorGaugeController(result.gaugeController).setVault(result.vault);
        ICreatorGaugeController(result.gaugeController).setWrapper(result.wrapper);
        ICreatorGaugeController(result.gaugeController).setCreatorCoin(params.creatorToken);
        if (lotteryManager != address(0)) {
            ICreatorGaugeController(result.gaugeController).setLotteryManager(lotteryManager);
        }
        ICreatorGaugeController(result.gaugeController).setOracle(result.oracle);

        ICreatorOVault(result.vault).setGaugeController(result.gaugeController);
        ICreatorOVault(result.vault).setWhitelist(result.wrapper, true);
        ICreatorOVault(result.vault).setWhitelist(address(this), true);
        if (vaultActivationBatcher != address(0)) {
            ICreatorOVault(result.vault).setWhitelist(vaultActivationBatcher, true);
        }

        ICCALaunchStrategy(result.ccaStrategy).setApprovedLauncher(address(this), true);
        if (vaultActivationBatcher != address(0)) {
            ICCALaunchStrategy(result.ccaStrategy).setApprovedLauncher(vaultActivationBatcher, true);
        }
        ICCALaunchStrategy(result.ccaStrategy).setOracleConfig(result.oracle, poolManager, taxHook, result.gaugeController);
        ICCALaunchStrategy(result.ccaStrategy).setDefaultTickSpacing(_defaultTickSpacingQ96(params.floorPriceQ96));

        IERC20(params.creatorToken).forceApprove(result.vault, params.depositAmount);
        uint256 shares = ICreatorOVault(result.vault).deposit(params.depositAmount, address(this));

        IERC20(result.vault).forceApprove(result.wrapper, shares);
        uint256 wsTokens = ICreatorOVaultWrapper(result.wrapper).wrap(shares);

        uint256 auctionAmount = (wsTokens * params.auctionPercent) / 100;
        if (auctionAmount > 0) {
            IERC20(result.shareOFT).forceApprove(result.ccaStrategy, auctionAmount);
            result.auction = ICCALaunchStrategy(result.ccaStrategy).launchAuction(
                auctionAmount,
                params.floorPriceQ96,
                params.requiredRaise,
                params.auctionSteps
            );
        }

        uint256 remaining = wsTokens - auctionAmount;
        if (remaining > 0) {
            IERC20(result.shareOFT).safeTransfer(params.owner, remaining);
        }

        if (protocolTreasury != params.owner) {
            ICreatorOVault(result.vault).transferOwnership(protocolTreasury);
            ICreatorOVaultWrapper(result.wrapper).transferOwnership(protocolTreasury);
            ICreatorShareOFT(result.shareOFT).transferOwnership(protocolTreasury);
            ICreatorGaugeController(result.gaugeController).transferOwnership(protocolTreasury);
            ICCALaunchStrategy(result.ccaStrategy).transferOwnership(protocolTreasury);
            ICreatorOracle(result.oracle).transferOwnership(protocolTreasury);
        }

        emit CreatorVaultDeployed(
            params.creatorToken,
            params.owner,
            result.vault,
            result.wrapper,
            result.shareOFT,
            result.gaugeController,
            result.ccaStrategy,
            result.oracle,
            result.auction
        );
    }

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

    function _permit2AndPull(
        address creatorToken,
        address owner,
        uint256 amount,
        ISignatureTransfer.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) internal {
        if (permit.permitted.token != creatorToken) revert PermitTokenMismatch();
        if (permit.permitted.amount < amount) revert PermitAmountTooLow();

        ISignatureTransfer.SignatureTransferDetails memory details = ISignatureTransfer.SignatureTransferDetails({
            to: address(this),
            requestedAmount: amount
        });
        ISignatureTransfer(permit2).permitTransferFrom(permit, details, owner, signature);
    }

    function _requireCodeIds(CodeIds calldata codeIds) internal pure {
        if (
            codeIds.vault == bytes32(0) ||
            codeIds.wrapper == bytes32(0) ||
            codeIds.shareOFT == bytes32(0) ||
            codeIds.gauge == bytes32(0) ||
            codeIds.cca == bytes32(0) ||
            codeIds.oracle == bytes32(0) ||
            codeIds.oftBootstrap == bytes32(0)
        ) {
            revert InvalidCodeId();
        }
    }

    function _deriveBaseSalt(address creatorToken, address owner, string memory version) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(creatorToken, owner, block.chainid, string.concat("CreatorVault:deploy:", version)));
    }

    function _saltFor(bytes32 baseSalt, string memory label) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(baseSalt, label));
    }

    function _deriveShareOftSalt(address owner, string memory shareSymbol, string memory version) internal pure returns (bytes32) {
        bytes32 base = keccak256(abi.encodePacked(owner, _toLower(shareSymbol)));
        return keccak256(abi.encodePacked(base, string.concat("CreatorShareOFT:", version)));
    }

    function _computeCreate2Address(bytes32 salt, bytes32 codeId, bytes memory constructorArgs) internal view returns (address) {
        bytes memory creationCode = bytecodeStore.get(codeId);
        bytes32 initCodeHash = keccak256(bytes.concat(creationCode, constructorArgs));
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(create2Deployer), salt, initCodeHash)))));
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
