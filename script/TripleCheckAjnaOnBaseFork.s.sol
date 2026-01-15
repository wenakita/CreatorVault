// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import {AjnaStrategy} from "../contracts/vault/strategies/AjnaStrategy.sol";
import {IAjnaPool, IAjnaPoolFactory} from "../contracts/interfaces/IAjnaPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWETH is IERC20 {
    function deposit() external payable;
}

/// @notice Fork-based triple-check for AjnaStrategy using REAL Ajna factory + REAL pool on Base.
/// Run:
///   forge script script/TripleCheckAjnaOnBaseFork.s.sol:TripleCheckAjnaOnBaseFork --fork-url $BASE_RPC_URL
contract TripleCheckAjnaOnBaseFork is Script {
    // Base mainnet addresses (from frontend config)
    address constant AJNA_ERC20_FACTORY = 0x214f62B5836D83f3D6c4f71F174209097B1A779C;
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // collateral
    address constant WETH = 0x4200000000000000000000000000000000000006; // quote (what we lend)

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        // Give deployer ETH on the fork so we can wrap into WETH
        vm.deal(deployer, 10 ether);

        vm.startBroadcast(pk);

        // Resolve pool from factory (collateral=USDC, quote=WETH)
        IAjnaPoolFactory factory = IAjnaPoolFactory(AJNA_ERC20_FACTORY);
        bytes32 subsetHash = factory.ERC20_NON_SUBSET_HASH();
        address poolAddr = factory.deployedPools(subsetHash, USDC, WETH);
        require(poolAddr != address(0), "expected USDC/WETH Ajna pool to exist on Base");

        console.log("Ajna factory:", AJNA_ERC20_FACTORY);
        console.log("Ajna pool:", poolAddr);

        // Deploy AjnaStrategy (vault = deployer EOA for test)
        AjnaStrategy strategy = new AjnaStrategy(
            deployer,              // vault
            WETH,                  // creator coin (quote token we lend)
            AJNA_ERC20_FACTORY,    // Ajna factory
            USDC,                  // collateral token
            deployer               // owner
        );

        // Choose an empty bucket for deterministic math
        uint256 testBucket = 5000;
        strategy.setBucketIndex(testBucket);

        // Wrap ETH into WETH and approve strategy
        uint256 amount = 1 ether;
        IWETH(WETH).deposit{value: amount}();
        IERC20(WETH).approve(address(strategy), amount);

        // Deposit into strategy (strategy will lend into Ajna bucket)
        uint256 deployed = strategy.deposit(amount);
        require(deployed == amount, "deposit should return amount");

        // Verify Ajna pool token wiring
        IAjnaPool pool = IAjnaPool(poolAddr);
        require(pool.quoteTokenAddress() == WETH, "pool quote mismatch");
        require(pool.collateralAddress() == USDC, "pool collateral mismatch");

        // Check lender/bucket accounting
        (uint256 lpBalance, ) = pool.lenderInfo(testBucket, address(strategy));
        (uint256 bucketLPTotal, , , uint256 bucketDeposit, uint256 bucketScale) = pool.bucketInfo(testBucket);

        console.log("Bucket:", testBucket);
        console.log("LP balance:", lpBalance);
        console.log("Bucket LP total:", bucketLPTotal);
        console.log("Bucket deposit (raw):", bucketDeposit);
        console.log("Bucket scale:", bucketScale);

        require(lpBalance > 0, "expected LP > 0 after deposit");
        require(bucketLPTotal > 0, "expected bucket LP > 0");
        require(bucketDeposit > 0, "expected bucket deposit > 0");

        // Strategy total assets should be close to amount (same unit: WETH wei)
        uint256 totalAssets = strategy.getTotalAssets();
        console.log("Strategy totalAssets:", totalAssets);
        require(totalAssets > 0, "strategy totalAssets should be > 0");

        // Withdraw half and ensure funds return to vault (deployer)
        uint256 beforeBal = IERC20(WETH).balanceOf(deployer);
        uint256 got = strategy.withdraw(amount / 2);
        uint256 afterBal = IERC20(WETH).balanceOf(deployer);

        console.log("Withdraw requested:", amount / 2);
        console.log("Withdraw returned:", got);
        console.log("Deployer balance delta:", afterBal - beforeBal);

        require(afterBal > beforeBal, "expected deployer WETH balance to increase");

        vm.stopBroadcast();
    }
}
