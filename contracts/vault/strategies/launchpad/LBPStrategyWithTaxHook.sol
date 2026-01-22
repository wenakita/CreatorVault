// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IContinuousClearingAuction, AuctionParameters} from "continuous-clearing-auction/src/interfaces/IContinuousClearingAuction.sol";
import {IContinuousClearingAuctionFactory} from
    "continuous-clearing-auction/src/interfaces/IContinuousClearingAuctionFactory.sol";

import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {FixedPoint96} from "@uniswap/v4-core/src/libraries/FixedPoint96.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";

import {ActionConstants} from "@uniswap/v4-periphery/src/libraries/ActionConstants.sol";
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IDistributionContract} from "liquidity-launcher/src/interfaces/IDistributionContract.sol";
import {ILBPStrategyBasic} from "liquidity-launcher/src/interfaces/ILBPStrategyBasic.sol";
import {MigratorParameters} from "liquidity-launcher/src/types/MigratorParameters.sol";
import {StrategyPlanner} from "liquidity-launcher/src/libraries/StrategyPlanner.sol";
import {ParamsBuilder} from "liquidity-launcher/src/libraries/ParamsBuilder.sol";
import {TokenPricing} from "liquidity-launcher/src/libraries/TokenPricing.sol";
import {TokenDistribution} from "liquidity-launcher/src/libraries/TokenDistribution.sol";
import {MigrationData} from "liquidity-launcher/src/types/MigrationData.sol";
import {BasePositionParams, FullRangeParams, OneSidedParams} from "liquidity-launcher/src/types/PositionTypes.sol";

/// @title LBPStrategyWithTaxHook
/// @notice Fork of Uniswap Liquidity Launcher LBPStrategyBasic that creates the v4 pool
///         with an external hook address (e.g. the existing Base tax hook).
/// @dev Hooks are immutable per pool key. To use a non-strategy hook, the pool must be initialized with it.
contract LBPStrategyWithTaxHook is ILBPStrategyBasic {
    using CurrencyLibrary for Currency;
    using StrategyPlanner for BasePositionParams;
    using TokenDistribution for uint128;
    using TokenPricing for uint256;

    error ZeroAddress();

    /// @notice The token that is being distributed
    address public immutable token;
    /// @notice The currency that the auction raised funds in
    address public immutable currency;

    /// @notice The LP fee that the v4 pool will use expressed in hundredths of a bip (1e6 = 100%)
    uint24 public immutable poolLPFee;
    /// @notice The tick spacing that the v4 pool will use
    int24 public immutable poolTickSpacing;

    /// @notice The supply of the token that was sent to this contract to be distributed
    uint128 public immutable totalSupply;
    /// @notice The remaining supply of the token that was not sent to the auction
    uint128 public immutable reserveSupply;
    /// @notice The address that will receive the position
    address public immutable positionRecipient;
    /// @notice The block number at which migration is allowed
    uint64 public immutable migrationBlock;
    /// @notice The auction factory that will be used to create the auction
    address public immutable auctionFactory;
    /// @notice The operator that can sweep currency and tokens from the pool after sweepBlock
    address public immutable operator;
    /// @notice The block number at which the operator can sweep currency and tokens from the pool
    uint64 public immutable sweepBlock;
    /// @notice Whether to create a one sided position in the token after the full range position
    bool public immutable createOneSidedTokenPosition;
    /// @notice Whether to create a one sided position in the currency after the full range position
    bool public immutable createOneSidedCurrencyPosition;

    /// @notice PoolManager used to initialize the v4 pool
    IPoolManager public immutable poolManager;
    /// @notice The position manager that will be used to create the position
    IPositionManager public immutable positionManager;

    /// @notice External hook used for the v4 pool (e.g. Base tax hook)
    address public immutable taxHook;

    /// @notice The auction that will be used to create the auction
    IContinuousClearingAuction public auction;
    /// @notice Encoded AuctionParameters (passed to the CCA factory)
    bytes public auctionParameters;

    constructor(
        address _token,
        uint128 _totalSupply,
        MigratorParameters memory _migratorParams,
        bytes memory _auctionParams,
        IPositionManager _positionManager,
        IPoolManager _poolManager,
        address _taxHook
    ) {
        _validateMigratorParams(_totalSupply, _migratorParams);
        _validateAuctionParams(_auctionParams, _migratorParams);

        if (address(_positionManager) == address(0)) revert ZeroAddress();
        if (address(_poolManager) == address(0)) revert ZeroAddress();
        if (_taxHook == address(0)) revert ZeroAddress();
        // Basic sanity: ensure hook is a contract.
        if (_taxHook.code.length == 0) revert ZeroAddress();

        auctionParameters = _auctionParams;

        token = _token;
        currency = _migratorParams.currency;
        totalSupply = _totalSupply;
        reserveSupply = _totalSupply.calculateReserveSupply(_migratorParams.tokenSplitToAuction);
        positionManager = _positionManager;
        poolManager = _poolManager;

        positionRecipient = _migratorParams.positionRecipient;
        migrationBlock = _migratorParams.migrationBlock;
        auctionFactory = _migratorParams.auctionFactory;
        poolLPFee = _migratorParams.poolLPFee;
        poolTickSpacing = _migratorParams.poolTickSpacing;
        operator = _migratorParams.operator;
        sweepBlock = _migratorParams.sweepBlock;
        createOneSidedTokenPosition = _migratorParams.createOneSidedTokenPosition;
        createOneSidedCurrencyPosition = _migratorParams.createOneSidedCurrencyPosition;
        taxHook = _taxHook;
    }

    /// @notice Gets the address of the token that will be used to create the pool
    function getPoolToken() internal view virtual returns (address) {
        return token;
    }

    /// @inheritdoc IDistributionContract
    function onTokensReceived() external {
        if (IERC20(token).balanceOf(address(this)) < totalSupply) {
            revert InvalidAmountReceived(totalSupply, IERC20(token).balanceOf(address(this)));
        }

        uint128 auctionSupply = totalSupply - reserveSupply;

        IContinuousClearingAuction _auction = IContinuousClearingAuction(
            address(
                IContinuousClearingAuctionFactory(auctionFactory)
                    .initializeDistribution(token, auctionSupply, auctionParameters, bytes32(0))
            )
        );

        Currency.wrap(token).transfer(address(_auction), auctionSupply);
        _auction.onTokensReceived();
        auction = _auction;

        emit AuctionCreated(address(_auction));
    }

    /// @inheritdoc ILBPStrategyBasic
    function migrate() external {
        _validateMigration();

        MigrationData memory data = _prepareMigrationData();

        PoolKey memory key = _initializePool(data);

        bytes memory plan = _createPositionPlan(data);

        _transferAssetsAndExecutePlan(data, plan);

        emit Migrated(key, data.sqrtPriceX96);
    }

    /// @inheritdoc ILBPStrategyBasic
    function sweepToken() external {
        if (block.number < sweepBlock) revert SweepNotAllowed(sweepBlock, block.number);
        if (msg.sender != operator) revert NotOperator(msg.sender, operator);

        uint256 tokenBalance = Currency.wrap(token).balanceOf(address(this));
        if (tokenBalance > 0) {
            Currency.wrap(token).transfer(operator, tokenBalance);
            emit TokensSwept(operator, tokenBalance);
        }
    }

    /// @inheritdoc ILBPStrategyBasic
    function sweepCurrency() external {
        if (block.number < sweepBlock) revert SweepNotAllowed(sweepBlock, block.number);
        if (msg.sender != operator) revert NotOperator(msg.sender, operator);

        uint256 currencyBalance = Currency.wrap(currency).balanceOf(address(this));
        if (currencyBalance > 0) {
            Currency.wrap(currency).transfer(operator, currencyBalance);
            emit CurrencySwept(operator, currencyBalance);
        }
    }

    // -------------------------
    // Validation (ported)
    // -------------------------

    function _validateMigratorParams(uint128 _totalSupply, MigratorParameters memory migratorParams) private pure {
        if (migratorParams.sweepBlock <= migratorParams.migrationBlock) {
            revert InvalidSweepBlock(migratorParams.sweepBlock, migratorParams.migrationBlock);
        } else if (migratorParams.tokenSplitToAuction >= TokenDistribution.MAX_TOKEN_SPLIT) {
            revert TokenSplitTooHigh(migratorParams.tokenSplitToAuction, TokenDistribution.MAX_TOKEN_SPLIT);
        } else if (
            migratorParams.poolTickSpacing > TickMath.MAX_TICK_SPACING || migratorParams.poolTickSpacing < TickMath.MIN_TICK_SPACING
        ) {
            revert InvalidTickSpacing(migratorParams.poolTickSpacing, TickMath.MIN_TICK_SPACING, TickMath.MAX_TICK_SPACING);
        } else if (migratorParams.poolLPFee > LPFeeLibrary.MAX_LP_FEE) {
            revert InvalidFee(migratorParams.poolLPFee, LPFeeLibrary.MAX_LP_FEE);
        } else if (
            migratorParams.positionRecipient == address(0) || migratorParams.positionRecipient == ActionConstants.MSG_SENDER
                || migratorParams.positionRecipient == ActionConstants.ADDRESS_THIS
        ) {
            revert InvalidPositionRecipient(migratorParams.positionRecipient);
        } else if (_totalSupply.calculateAuctionSupply(migratorParams.tokenSplitToAuction) == 0) {
            revert AuctionSupplyIsZero();
        }
    }

    function _validateAuctionParams(bytes memory auctionParams, MigratorParameters memory migratorParams) private pure {
        AuctionParameters memory _auctionParams = abi.decode(auctionParams, (AuctionParameters));
        if (_auctionParams.fundsRecipient != ActionConstants.MSG_SENDER) {
            revert InvalidFundsRecipient(_auctionParams.fundsRecipient, ActionConstants.MSG_SENDER);
        } else if (_auctionParams.endBlock >= migratorParams.migrationBlock) {
            revert InvalidEndBlock(_auctionParams.endBlock, migratorParams.migrationBlock);
        } else if (_auctionParams.currency != migratorParams.currency) {
            revert InvalidCurrency(_auctionParams.currency, migratorParams.currency);
        }
    }

    function _validateMigration() private {
        if (block.number < migrationBlock) {
            revert MigrationNotAllowed(migrationBlock, block.number);
        }

        // call checkpoint to get the final currency raised and clearing price
        auction.checkpoint();
        uint256 currencyAmount = auction.currencyRaised();

        if (currencyAmount > type(uint128).max) {
            revert CurrencyAmountTooHigh(currencyAmount, type(uint128).max);
        }
        if (currencyAmount == 0) {
            revert NoCurrencyRaised();
        }

        if (Currency.wrap(currency).balanceOf(address(this)) < currencyAmount) {
            revert InsufficientCurrency(currencyAmount, Currency.wrap(currency).balanceOf(address(this)));
        }
    }

    // -------------------------
    // Migration (ported)
    // -------------------------

    function _prepareMigrationData() private view returns (MigrationData memory data) {
        uint128 currencyRaised = uint128(auction.currencyRaised());
        address poolToken = getPoolToken();

        uint256 priceX192 = auction.clearingPrice().convertToPriceX192(currency < poolToken);
        data.sqrtPriceX96 = priceX192.convertToSqrtPriceX96();

        (data.initialTokenAmount, data.leftoverCurrency, data.initialCurrencyAmount) =
            priceX192.calculateAmounts(currencyRaised, currency < poolToken, reserveSupply);

        data.liquidity = LiquidityAmounts.getLiquidityForAmounts(
            data.sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(TickMath.minUsableTick(poolTickSpacing)),
            TickMath.getSqrtPriceAtTick(TickMath.maxUsableTick(poolTickSpacing)),
            currency < poolToken ? data.initialCurrencyAmount : data.initialTokenAmount,
            currency < poolToken ? data.initialTokenAmount : data.initialCurrencyAmount
        );

        data.shouldCreateOneSided = createOneSidedTokenPosition && reserveSupply > data.initialTokenAmount
            || createOneSidedCurrencyPosition && data.leftoverCurrency > 0;

        return data;
    }

    function _initializePool(MigrationData memory data) private returns (PoolKey memory key) {
        address poolToken = getPoolToken();

        key = PoolKey({
            currency0: Currency.wrap(currency < poolToken ? currency : poolToken),
            currency1: Currency.wrap(currency < poolToken ? poolToken : currency),
            fee: poolLPFee,
            tickSpacing: poolTickSpacing,
            hooks: IHooks(taxHook)
        });

        poolManager.initialize(key, data.sqrtPriceX96);
        return key;
    }

    function _createPositionPlan(MigrationData memory data) private view returns (bytes memory plan) {
        bytes memory actions;
        bytes[] memory params;

        address poolToken = getPoolToken();

        BasePositionParams memory baseParams = BasePositionParams({
            currency: currency,
            poolToken: poolToken,
            poolLPFee: poolLPFee,
            poolTickSpacing: poolTickSpacing,
            initialSqrtPriceX96: data.sqrtPriceX96,
            liquidity: data.liquidity,
            positionRecipient: positionRecipient,
            hooks: IHooks(taxHook)
        });

        if (data.shouldCreateOneSided) {
            (actions, params) = _createFullRangePositionPlan(
                baseParams, data.initialTokenAmount, data.initialCurrencyAmount, ParamsBuilder.FULL_RANGE_WITH_ONE_SIDED_SIZE
            );
            (actions, params) = _createOneSidedPositionPlan(
                baseParams, actions, params, data.initialTokenAmount, data.leftoverCurrency
            );
            data.hasOneSidedParams = params.length == ParamsBuilder.FULL_RANGE_WITH_ONE_SIDED_SIZE;
        } else {
            (actions, params) =
                _createFullRangePositionPlan(baseParams, data.initialTokenAmount, data.initialCurrencyAmount, ParamsBuilder.FULL_RANGE_SIZE);
        }

        (actions, params) = baseParams.planFinalTakePair(actions, params);
        return abi.encode(actions, params);
    }

    function _transferAssetsAndExecutePlan(MigrationData memory data, bytes memory plan) private {
        uint128 tokenTransferAmount = _getTokenTransferAmount(data);
        Currency.wrap(token).transfer(address(positionManager), tokenTransferAmount);

        uint128 currencyTransferAmount = _getCurrencyTransferAmount(data);

        if (Currency.wrap(currency).isAddressZero()) {
            positionManager.modifyLiquidities{value: currencyTransferAmount}(plan, block.timestamp);
        } else {
            Currency.wrap(currency).transfer(address(positionManager), currencyTransferAmount);
            positionManager.modifyLiquidities(plan, block.timestamp);
        }
    }

    function _getTokenTransferAmount(MigrationData memory data) private view returns (uint128) {
        return (reserveSupply > data.initialTokenAmount && data.hasOneSidedParams) ? reserveSupply : data.initialTokenAmount;
    }

    function _getCurrencyTransferAmount(MigrationData memory data) private pure returns (uint128) {
        return (data.leftoverCurrency > 0 && data.hasOneSidedParams)
            ? data.initialCurrencyAmount + data.leftoverCurrency
            : data.initialCurrencyAmount;
    }

    function _createFullRangePositionPlan(
        BasePositionParams memory baseParams,
        uint128 tokenAmount,
        uint128 currencyAmount,
        uint256 paramsArraySize
    ) private pure returns (bytes memory, bytes[] memory) {
        FullRangeParams memory fullRangeParams = FullRangeParams({tokenAmount: tokenAmount, currencyAmount: currencyAmount});
        return baseParams.planFullRangePosition(fullRangeParams, paramsArraySize);
    }

    function _createOneSidedPositionPlan(
        BasePositionParams memory baseParams,
        bytes memory actions,
        bytes[] memory params,
        uint128 tokenAmount,
        uint128 leftoverCurrency
    ) private view returns (bytes memory, bytes[] memory) {
        uint128 amount = leftoverCurrency > 0 ? leftoverCurrency : reserveSupply - tokenAmount;
        bool inToken = leftoverCurrency == 0;

        OneSidedParams memory oneSidedParams = OneSidedParams({amount: amount, inToken: inToken});
        return baseParams.planOneSidedPosition(oneSidedParams, actions, params);
    }

    /// @dev Only accept native currency transfers from the auction when currency is native.
    receive() external payable {
        if (Currency.wrap(currency).isAddressZero()) {
            if (msg.sender != address(auction)) revert NativeCurrencyTransferNotFromAuction(msg.sender, address(auction));
        }
    }
}

