// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {LBPStrategyWithTaxHook} from "../contracts/vault/strategies/launchpad/LBPStrategyWithTaxHook.sol";
import {MigratorParameters} from "liquidity-launcher/src/types/MigratorParameters.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @notice Deploy helper for LBPStrategyWithTaxHook.
/// @dev This script only deploys the strategy. To start the auction you must:
///      1) Transfer `totalSupply` of `token` to the deployed strategy address
///      2) Call `strategy.onTokensReceived()`
contract DeployLBPStrategyWithTaxHookScript is Script {
    struct Env {
        address token;
        uint128 totalSupply;
        address auctionFactory;
        address positionRecipient;
        address operator;
        address taxHook;
        address currency;
        uint24 poolLPFee;
        int24 poolTickSpacing;
        uint24 tokenSplitToAuction;
        uint64 migrationBlock;
        uint64 sweepBlock;
        bool createOneSidedTokenPosition;
        bool createOneSidedCurrencyPosition;
        address positionManager;
        address poolManager;
        bytes auctionParams;
    }

    function _env() internal view returns (Env memory e) {
        e.token = vm.envAddress("TOKEN");

        uint256 totalSupplyU256 = vm.envUint("TOTAL_SUPPLY"); // must fit uint128
        require(totalSupplyU256 <= type(uint128).max, "TOTAL_SUPPLY > uint128");
        e.totalSupply = uint128(totalSupplyU256);

        e.auctionFactory = vm.envAddress("AUCTION_FACTORY");
        e.positionRecipient = vm.envAddress("POSITION_RECIPIENT");
        e.operator = vm.envAddress("OPERATOR");
        e.taxHook = vm.envAddress("TAX_HOOK");

        e.currency = vm.envAddress("CURRENCY"); // address(0) for native
        e.poolLPFee = uint24(vm.envUint("POOL_LP_FEE"));
        e.poolTickSpacing = int24(int256(vm.envUint("POOL_TICK_SPACING")));
        e.tokenSplitToAuction = uint24(vm.envUint("TOKEN_SPLIT_TO_AUCTION_MPS")); // 1e7 = 100%

        e.migrationBlock = uint64(vm.envUint("MIGRATION_BLOCK"));
        e.sweepBlock = uint64(vm.envUint("SWEEP_BLOCK"));

        e.createOneSidedTokenPosition = vm.envBool("CREATE_ONE_SIDED_TOKEN_POSITION");
        e.createOneSidedCurrencyPosition = vm.envBool("CREATE_ONE_SIDED_CURRENCY_POSITION");

        e.positionManager = vm.envAddress("POSITION_MANAGER");
        e.poolManager = vm.envAddress("POOL_MANAGER");

        // Auction parameters are passed as ABI-encoded AuctionParameters (bytes).
        // IMPORTANT: fundsRecipient should be ActionConstants.MSG_SENDER (address(1)) per Liquidity Launcher validation.
        e.auctionParams = vm.envBytes("AUCTION_PARAMS");
    }

    function run() public {
        Env memory e = _env();

        MigratorParameters memory migrator = MigratorParameters({
            migrationBlock: e.migrationBlock,
            currency: e.currency,
            poolLPFee: e.poolLPFee,
            poolTickSpacing: e.poolTickSpacing,
            tokenSplitToAuction: e.tokenSplitToAuction,
            auctionFactory: e.auctionFactory,
            positionRecipient: e.positionRecipient,
            sweepBlock: e.sweepBlock,
            operator: e.operator,
            createOneSidedTokenPosition: e.createOneSidedTokenPosition,
            createOneSidedCurrencyPosition: e.createOneSidedCurrencyPosition
        });

        vm.startBroadcast();
        LBPStrategyWithTaxHook strategy = new LBPStrategyWithTaxHook(
            e.token,
            e.totalSupply,
            migrator,
            e.auctionParams,
            IPositionManager(e.positionManager),
            IPoolManager(e.poolManager),
            e.taxHook
        );
        vm.stopBroadcast();

        console2.log("LBPStrategyWithTaxHook deployed at:", address(strategy));
        console2.log("Next: transfer token supply to strategy, then call onTokensReceived()");
    }
}

