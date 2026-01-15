// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import {IAjnaPool, IAjnaPoolFactory} from "../contracts/interfaces/IAjnaPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWETH is IERC20 {
    function deposit() external payable;
}

/// @notice Triple-check Ajna bucket accounting when bucket `scale` != 1e18.
/// Run:
///   forge script script/TripleCheckAjnaBucketScaleFork.s.sol:TripleCheckAjnaBucketScaleFork --fork-url $BASE_RPC_URL --skip-simulation
contract TripleCheckAjnaBucketScaleFork is Script {
    address constant AJNA_ERC20_FACTORY = 0x214f62B5836D83f3D6c4f71F174209097B1A779C;
    address constant WETH = 0x4200000000000000000000000000000000000006;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        vm.deal(deployer, 10 ether);

        // Pick a real Ajna pool (factory index 0) which has bucket 0 scale > 1e18 on Base.
        address poolAddr = IAjnaPoolFactory(AJNA_ERC20_FACTORY).deployedPoolsList(0);
        IAjnaPool pool = IAjnaPool(poolAddr);

        vm.startBroadcast(pk);

        uint256 bucket = 1; // bucket 0 reverts with InvalidIndex() on this pool
        (, , , uint256 dep0, uint256 scale0) = pool.bucketInfo(bucket);
        console.log("Pool:", poolAddr);
        console.log("Bucket 0 pre deposit:", dep0);
        console.log("Bucket 0 scale pre:", scale0);

        // Deposit WETH into an empty bucket 0 (deposit is currently 0).
        uint256 amount = 1 ether;
        IWETH(WETH).deposit{value: amount}();
        IERC20(WETH).approve(poolAddr, amount);

        (uint256 lpReceived, uint256 addedAmount) = pool.addQuoteToken(amount, bucket, block.timestamp + 1 hours);
        console.log("addQuoteToken lpReceived:", lpReceived);
        console.log("addQuoteToken addedAmount:", addedAmount);

        (uint256 lpBalance, ) = pool.lenderInfo(bucket, deployer);
        (uint256 bucketLPTotal, , , uint256 bucketDeposit, uint256 bucketScale) = pool.bucketInfo(bucket);
        console.log("LP balance:", lpBalance);
        console.log("Bucket LP total:", bucketLPTotal);
        console.log("Bucket deposit (raw):", bucketDeposit);
        console.log("Bucket scale:", bucketScale);

        // Redeem immediately to see the actual quote tokens returned.
        (uint256 removedAmount, uint256 redeemedLP) = pool.removeQuoteToken(lpBalance, bucket);
        console.log("removeQuoteToken removedAmount:", removedAmount);
        console.log("removeQuoteToken redeemedLP:", redeemedLP);

        // Sanity: should get back close to what we added (could be tiny rounding diffs).
        require(removedAmount > 0, "expected removedAmount > 0");

        vm.stopBroadcast();
    }
}
