'forge config --json' running
'/home/akitav2/.solc-select/artifacts/solc-0.8.22/solc-0.8.22 --version' running
'/home/akitav2/.solc-select/artifacts/solc-0.8.22/solc-0.8.22 @openzeppelin/=node_modules/@openzeppelin/ @uniswap/=node_modules/@uniswap/ @layerzerolabs/=node_modules/@layerzerolabs/ base64-sol/=node_modules/base64-sol/ eth-gas-reporter/=node_modules/eth-gas-reporter/ forge-std/=lib/forge-std/src/ hardhat-deploy/=node_modules/hardhat-deploy/ hardhat/=node_modules/hardhat/ contracts/strategies/CharmStrategyWETH.sol --combined-json abi,ast,bin,bin-runtime,srcmap,srcmap-runtime,userdoc,devdoc,hashes --optimize --optimize-runs 200 --via-ir --evm-version paris --allow-paths .,/home/akitav2/eagle-ovault-clean/contracts/strategies' running
INFO:Detectors:
CharmStrategyWETH.deposit(uint256,uint256) (contracts/strategies/CharmStrategyWETH.sol#328-453) uses arbitrary from in transferFrom: USD1.transferFrom(EAGLE_VAULT,address(this),usd1Amount) (contracts/strategies/CharmStrategyWETH.sol#346-350)
CharmStrategyWETH.deposit(uint256,uint256) (contracts/strategies/CharmStrategyWETH.sol#328-453) uses arbitrary from in transferFrom: WLFI.transferFrom(EAGLE_VAULT,address(this),wlfiAmount) (contracts/strategies/CharmStrategyWETH.sol#339-343)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#arbitrary-from-in-transferfrom
INFO:Detectors:
CharmStrategyWETH.deposit(uint256,uint256) (contracts/strategies/CharmStrategyWETH.sol#328-453) ignores return value by WLFI.transferFrom(EAGLE_VAULT,address(this),wlfiAmount) (contracts/strategies/CharmStrategyWETH.sol#339-343)
CharmStrategyWETH.deposit(uint256,uint256) (contracts/strategies/CharmStrategyWETH.sol#328-453) ignores return value by USD1.transferFrom(EAGLE_VAULT,address(this),usd1Amount) (contracts/strategies/CharmStrategyWETH.sol#346-350)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#unchecked-transfer
INFO:Detectors:
CharmStrategyWETH.withdraw(uint256) (contracts/strategies/CharmStrategyWETH.sol#461-521) performs a multiplication on the result of a division:
	- ourWeth = (totalWeth * ourShares) / totalShares (contracts/strategies/CharmStrategyWETH.sol#478)
	- totalValue = ourWlfi + (ourWeth * wlfiPerWeth) / 1e18 (contracts/strategies/CharmStrategyWETH.sol#485)
CharmStrategyWETH.withdraw(uint256) (contracts/strategies/CharmStrategyWETH.sol#461-521) performs a multiplication on the result of a division:
	- ourWeth = (totalWeth * ourShares) / totalShares (contracts/strategies/CharmStrategyWETH.sol#478)
	- sharesToWithdraw = (ourShares * value) / totalValue (contracts/strategies/CharmStrategyWETH.sol#491)
	- expectedWeth = (ourWeth * sharesToWithdraw) / ourShares (contracts/strategies/CharmStrategyWETH.sol#495)
CharmStrategyWETH.withdraw(uint256) (contracts/strategies/CharmStrategyWETH.sol#461-521) performs a multiplication on the result of a division:
	- ourWlfi = (totalWlfi * ourShares) / totalShares (contracts/strategies/CharmStrategyWETH.sol#479)
	- sharesToWithdraw = (ourShares * value) / totalValue (contracts/strategies/CharmStrategyWETH.sol#491)
	- expectedWlfi = (ourWlfi * sharesToWithdraw) / ourShares (contracts/strategies/CharmStrategyWETH.sol#496)
CharmStrategyWETH.withdraw(uint256) (contracts/strategies/CharmStrategyWETH.sol#461-521) performs a multiplication on the result of a division:
	- expectedWlfi = (ourWlfi * sharesToWithdraw) / ourShares (contracts/strategies/CharmStrategyWETH.sol#496)
	- (wethAmount,wlfiAmount) = charmVault.withdraw(sharesToWithdraw,(expectedWeth * (10000 - maxSlippage)) / 10000,(expectedWlfi * (10000 - maxSlippage)) / 10000,address(this)) (contracts/strategies/CharmStrategyWETH.sol#501-506)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128 (contracts/strategies/CharmStrategyWETH.sol#676)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128 (contracts/strategies/CharmStrategyWETH.sol#675)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128 (contracts/strategies/CharmStrategyWETH.sol#674)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128 (contracts/strategies/CharmStrategyWETH.sol#673)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128 (contracts/strategies/CharmStrategyWETH.sol#672)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128 (contracts/strategies/CharmStrategyWETH.sol#671)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128 (contracts/strategies/CharmStrategyWETH.sol#670)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128 (contracts/strategies/CharmStrategyWETH.sol#669)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128 (contracts/strategies/CharmStrategyWETH.sol#668)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128 (contracts/strategies/CharmStrategyWETH.sol#667)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128 (contracts/strategies/CharmStrategyWETH.sol#666)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128 (contracts/strategies/CharmStrategyWETH.sol#665)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128 (contracts/strategies/CharmStrategyWETH.sol#664)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128 (contracts/strategies/CharmStrategyWETH.sol#663)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128 (contracts/strategies/CharmStrategyWETH.sol#662)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128 (contracts/strategies/CharmStrategyWETH.sol#661)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128 (contracts/strategies/CharmStrategyWETH.sol#660)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128 (contracts/strategies/CharmStrategyWETH.sol#659)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) performs a multiplication on the result of a division:
	- ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128 (contracts/strategies/CharmStrategyWETH.sol#658)
	- ratio = type()(uint256).max / ratio (contracts/strategies/CharmStrategyWETH.sol#678)
CharmStrategyWETH.getTotalAmountsEmergency() (contracts/strategies/CharmStrategyWETH.sol#1078-1101) performs a multiplication on the result of a division:
	- wethAmount = (totalWeth * ourShares) / totalShares (contracts/strategies/CharmStrategyWETH.sol#1096)
	- usd1Amount = (wethAmount * 1e18) / emergencyWethPerUsd1 (contracts/strategies/CharmStrategyWETH.sol#1100)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#divide-before-multiply
INFO:Detectors:
CharmStrategyWETH._getUsd1Equivalent(uint256) (contracts/strategies/CharmStrategyWETH.sol#784-804) uses a dangerous strict equality:
	- wethAmount == 0 (contracts/strategies/CharmStrategyWETH.sol#785)
CharmStrategyWETH._swapUsd1ToWeth(uint256) (contracts/strategies/CharmStrategyWETH.sol#735-752) uses a dangerous strict equality:
	- amountIn == 0 (contracts/strategies/CharmStrategyWETH.sol#736)
CharmStrategyWETH._swapWethToUsd1(uint256) (contracts/strategies/CharmStrategyWETH.sol#758-775) uses a dangerous strict equality:
	- amountIn == 0 (contracts/strategies/CharmStrategyWETH.sol#759)
CharmStrategyWETH._swapWethToWlfi(uint256) (contracts/strategies/CharmStrategyWETH.sol#690-707) uses a dangerous strict equality:
	- amountIn == 0 (contracts/strategies/CharmStrategyWETH.sol#691)
CharmStrategyWETH._swapWlfiToWeth(uint256) (contracts/strategies/CharmStrategyWETH.sol#712-729) uses a dangerous strict equality:
	- amountIn == 0 (contracts/strategies/CharmStrategyWETH.sol#713)
CharmStrategyWETH.deposit(uint256,uint256) (contracts/strategies/CharmStrategyWETH.sol#328-453) uses a dangerous strict equality:
	- totalWlfi == 0 && totalWeth == 0 (contracts/strategies/CharmStrategyWETH.sol#365)
CharmStrategyWETH.emergencyWithdraw(uint256) (contracts/strategies/CharmStrategyWETH.sol#1000-1038) uses a dangerous strict equality:
	- ourShares == 0 (contracts/strategies/CharmStrategyWETH.sol#1010)
CharmStrategyWETH.emergencyWithdrawAll() (contracts/strategies/CharmStrategyWETH.sol#1044-1072) uses a dangerous strict equality:
	- ourShares == 0 (contracts/strategies/CharmStrategyWETH.sol#1049)
CharmStrategyWETH.getTotalAmounts() (contracts/strategies/CharmStrategyWETH.sol#839-860) uses a dangerous strict equality:
	- ourShares == 0 (contracts/strategies/CharmStrategyWETH.sol#845)
CharmStrategyWETH.getTotalAmountsEmergency() (contracts/strategies/CharmStrategyWETH.sol#1078-1101) uses a dangerous strict equality:
	- ourShares == 0 (contracts/strategies/CharmStrategyWETH.sol#1085)
CharmStrategyWETH.withdraw(uint256) (contracts/strategies/CharmStrategyWETH.sol#461-521) uses a dangerous strict equality:
	- ourShares == 0 (contracts/strategies/CharmStrategyWETH.sol#471)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#dangerous-strict-equalities
INFO:Detectors:
CharmStrategyWETH.getChainlinkPrice() (contracts/strategies/CharmStrategyWETH.sol#564-586) ignores return value by (None,wethUsdPrice,None,wethUpdatedAt,None) = wethUsdPriceFeed.latestRoundData() (contracts/strategies/CharmStrategyWETH.sol#566)
CharmStrategyWETH.getChainlinkPrice() (contracts/strategies/CharmStrategyWETH.sol#564-586) ignores return value by (None,wlfiUsdPrice,None,wlfiUpdatedAt,None) = wlfiUsdPriceFeed.latestRoundData() (contracts/strategies/CharmStrategyWETH.sol#576)
CharmStrategyWETH.getTwapPrice() (contracts/strategies/CharmStrategyWETH.sol#593-632) ignores return value by (tickCumulatives) = twapPool.observe(secondsAgos) (contracts/strategies/CharmStrategyWETH.sol#603-631)
CharmStrategyWETH._getWethPerUsd1FromChainlink() (contracts/strategies/CharmStrategyWETH.sol#811-828) ignores return value by (None,wethUsdPrice,None,wethUpdatedAt,None) = wethUsdPriceFeed.latestRoundData() (contracts/strategies/CharmStrategyWETH.sol#813)
CharmStrategyWETH._getWethPerUsd1FromChainlink() (contracts/strategies/CharmStrategyWETH.sol#811-828) ignores return value by (None,usd1UsdPrice,None,usd1UpdatedAt,None) = usd1UsdPriceFeed.latestRoundData() (contracts/strategies/CharmStrategyWETH.sol#818)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#unused-return
INFO:Detectors:
CharmStrategyWETH.constructor(address,address,address,address,address,address,address)._owner (contracts/strategies/CharmStrategyWETH.sol#213) shadows:
	- Ownable._owner (node_modules/@openzeppelin/contracts/access/Ownable.sol#21) (state variable)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#local-variable-shadowing
INFO:Detectors:
CharmStrategyWETH.updateParameters(uint256,uint256,uint256) (contracts/strategies/CharmStrategyWETH.sol#884-896) should emit an event for: 
	- twapPeriod = _twapPeriod (contracts/strategies/CharmStrategyWETH.sol#894) 
	- maxOracleAge = _maxOracleAge (contracts/strategies/CharmStrategyWETH.sol#895) 
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#missing-events-arithmetic
INFO:Detectors:
Reentrancy in CharmStrategyWETH._swapWethToUsd1(uint256) (contracts/strategies/CharmStrategyWETH.sol#758-775):
	External calls:
	- amountOut = UNISWAP_ROUTER.exactInputSingle(params) (contracts/strategies/CharmStrategyWETH.sol#772)
	Event emitted after the call(s):
	- TokensSwapped(address(WETH),address(USD1),amountIn,amountOut) (contracts/strategies/CharmStrategyWETH.sol#774)
Reentrancy in CharmStrategyWETH.rescueIdleTokens() (contracts/strategies/CharmStrategyWETH.sol#917-938):
	External calls:
	- usd1FromWeth = _swapWethToUsd1(wethBalance) (contracts/strategies/CharmStrategyWETH.sol#924)
		- amountOut = UNISWAP_ROUTER.exactInputSingle(params) (contracts/strategies/CharmStrategyWETH.sol#772)
	Event emitted after the call(s):
	- UnusedTokensReturned(usd1Balance,wlfiBalance) (contracts/strategies/CharmStrategyWETH.sol#936)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#reentrancy-vulnerabilities-3
INFO:Detectors:
CharmStrategyWETH.deposit(uint256,uint256) (contracts/strategies/CharmStrategyWETH.sol#328-453) uses timestamp for comparisons
	Dangerous comparisons:
	- totalWlfi == 0 && totalWeth == 0 (contracts/strategies/CharmStrategyWETH.sol#365)
	- totalWeth >= wethNeeded (contracts/strategies/CharmStrategyWETH.sol#377)
	- excessWeth > 0 (contracts/strategies/CharmStrategyWETH.sol#384)
	- wlfiToSwap < totalWlfi (contracts/strategies/CharmStrategyWETH.sol#399)
	- leftoverUsd1 > 0 (contracts/strategies/CharmStrategyWETH.sol#437)
	- leftoverUsd1 > 0 || leftoverWlfi > 0 (contracts/strategies/CharmStrategyWETH.sol#444)
CharmStrategyWETH.getChainlinkPrice() (contracts/strategies/CharmStrategyWETH.sol#564-586) uses timestamp for comparisons
	Dangerous comparisons:
	- block.timestamp - wethUpdatedAt > maxOracleAge (contracts/strategies/CharmStrategyWETH.sol#568)
	- block.timestamp - wlfiUpdatedAt > maxOracleAge (contracts/strategies/CharmStrategyWETH.sol#578)
CharmStrategyWETH._swapWethToWlfi(uint256) (contracts/strategies/CharmStrategyWETH.sol#690-707) uses timestamp for comparisons
	Dangerous comparisons:
	- amountIn == 0 (contracts/strategies/CharmStrategyWETH.sol#691)
CharmStrategyWETH._swapWlfiToWeth(uint256) (contracts/strategies/CharmStrategyWETH.sol#712-729) uses timestamp for comparisons
	Dangerous comparisons:
	- amountIn == 0 (contracts/strategies/CharmStrategyWETH.sol#713)
CharmStrategyWETH._getUsd1Equivalent(uint256) (contracts/strategies/CharmStrategyWETH.sol#784-804) uses timestamp for comparisons
	Dangerous comparisons:
	- wethAmount == 0 (contracts/strategies/CharmStrategyWETH.sol#785)
CharmStrategyWETH._getWethPerUsd1FromChainlink() (contracts/strategies/CharmStrategyWETH.sol#811-828) uses timestamp for comparisons
	Dangerous comparisons:
	- block.timestamp - wethUpdatedAt > maxOracleAge (contracts/strategies/CharmStrategyWETH.sol#815)
	- block.timestamp - usd1UpdatedAt > maxOracleAge (contracts/strategies/CharmStrategyWETH.sol#820)
CharmStrategyWETH.rescueIdleTokens() (contracts/strategies/CharmStrategyWETH.sol#917-938) uses timestamp for comparisons
	Dangerous comparisons:
	- usd1Balance > 0 (contracts/strategies/CharmStrategyWETH.sol#931)
	- wlfiBalance > 0 || usd1Balance > 0 (contracts/strategies/CharmStrategyWETH.sol#935)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#block-timestamp
INFO:Detectors:
SafeERC20._callOptionalReturn(IERC20,bytes) (node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#173-191) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#176-186)
SafeERC20._callOptionalReturnBool(IERC20,bytes) (node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#201-211) uses assembly
	- INLINE ASM (node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#205-209)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#assembly-usage
INFO:Detectors:
6 different versions of Solidity are used:
	- Version constraint ^0.8.22 is used by:
		-^0.8.22 (contracts/interfaces/IStrategy.sol#2)
		-^0.8.22 (contracts/strategies/CharmStrategyWETH.sol#2)
	- Version constraint ^0.8.20 is used by:
		-^0.8.20 (node_modules/@openzeppelin/contracts/access/Ownable.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/Context.sol#4)
		-^0.8.20 (node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol#4)
	- Version constraint >=0.6.2 is used by:
		->=0.6.2 (node_modules/@openzeppelin/contracts/interfaces/IERC1363.sol#4)
	- Version constraint >=0.4.16 is used by:
		->=0.4.16 (node_modules/@openzeppelin/contracts/interfaces/IERC165.sol#4)
		->=0.4.16 (node_modules/@openzeppelin/contracts/interfaces/IERC20.sol#4)
		->=0.4.16 (node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol#4)
		->=0.4.16 (node_modules/@openzeppelin/contracts/utils/introspection/IERC165.sol#4)
	- Version constraint >=0.5.0 is used by:
		->=0.5.0 (node_modules/@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol#2)
	- Version constraint >=0.7.5 is used by:
		->=0.7.5 (node_modules/@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol#2)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#different-pragma-directives-are-used
INFO:Detectors:
CharmStrategyWETH.deposit(uint256,uint256) (contracts/strategies/CharmStrategyWETH.sol#328-453) has a high cyclomatic complexity (17).
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) has a high cyclomatic complexity (24).
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#cyclomatic-complexity
INFO:Detectors:
Context._contextSuffixLength() (node_modules/@openzeppelin/contracts/utils/Context.sol#25-27) is never used and should be removed
Context._msgData() (node_modules/@openzeppelin/contracts/utils/Context.sol#21-23) is never used and should be removed
ReentrancyGuard._reentrancyGuardEntered() (node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol#84-86) is never used and should be removed
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#dead-code
INFO:Detectors:
Version constraint ^0.8.22 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- VerbatimInvalidDeduplication.
It is used by:
	- ^0.8.22 (contracts/interfaces/IStrategy.sol#2)
	- ^0.8.22 (contracts/strategies/CharmStrategyWETH.sol#2)
Version constraint ^0.8.20 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- VerbatimInvalidDeduplication
	- FullInlinerNonExpressionSplitArgumentEvaluationOrder
	- MissingSideEffectsOnSelectorAccess.
It is used by:
	- ^0.8.20 (node_modules/@openzeppelin/contracts/access/Ownable.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/Context.sol#4)
	- ^0.8.20 (node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol#4)
Version constraint >=0.6.2 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- MissingSideEffectsOnSelectorAccess
	- AbiReencodingHeadOverflowWithStaticArrayCleanup
	- DirtyBytesArrayToStorage
	- NestedCalldataArrayAbiReencodingSizeValidation
	- ABIDecodeTwoDimensionalArrayMemory
	- KeccakCaching
	- EmptyByteArrayCopy
	- DynamicArrayCleanup
	- MissingEscapingInFormatting
	- ArraySliceDynamicallyEncodedBaseType
	- ImplicitConstructorCallvalueCheck
	- TupleAssignmentMultiStackSlotComponents
	- MemoryArrayCreationOverflow.
It is used by:
	- >=0.6.2 (node_modules/@openzeppelin/contracts/interfaces/IERC1363.sol#4)
Version constraint >=0.4.16 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- DirtyBytesArrayToStorage
	- ABIDecodeTwoDimensionalArrayMemory
	- KeccakCaching
	- EmptyByteArrayCopy
	- DynamicArrayCleanup
	- ImplicitConstructorCallvalueCheck
	- TupleAssignmentMultiStackSlotComponents
	- MemoryArrayCreationOverflow
	- privateCanBeOverridden
	- SignedArrayStorageCopy
	- ABIEncoderV2StorageArrayWithMultiSlotElement
	- DynamicConstructorArgumentsClippedABIV2
	- UninitializedFunctionPointerInConstructor_0.4.x
	- IncorrectEventSignatureInLibraries_0.4.x
	- ExpExponentCleanup
	- NestedArrayFunctionCallDecoder
	- ZeroFunctionSelector.
It is used by:
	- >=0.4.16 (node_modules/@openzeppelin/contracts/interfaces/IERC165.sol#4)
	- >=0.4.16 (node_modules/@openzeppelin/contracts/interfaces/IERC20.sol#4)
	- >=0.4.16 (node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol#4)
	- >=0.4.16 (node_modules/@openzeppelin/contracts/utils/introspection/IERC165.sol#4)
Version constraint >=0.5.0 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- DirtyBytesArrayToStorage
	- ABIDecodeTwoDimensionalArrayMemory
	- KeccakCaching
	- EmptyByteArrayCopy
	- DynamicArrayCleanup
	- ImplicitConstructorCallvalueCheck
	- TupleAssignmentMultiStackSlotComponents
	- MemoryArrayCreationOverflow
	- privateCanBeOverridden
	- SignedArrayStorageCopy
	- ABIEncoderV2StorageArrayWithMultiSlotElement
	- DynamicConstructorArgumentsClippedABIV2
	- UninitializedFunctionPointerInConstructor
	- IncorrectEventSignatureInLibraries
	- ABIEncoderV2PackedStorage.
It is used by:
	- >=0.5.0 (node_modules/@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol#2)
Version constraint >=0.7.5 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- FullInlinerNonExpressionSplitArgumentEvaluationOrder
	- MissingSideEffectsOnSelectorAccess
	- AbiReencodingHeadOverflowWithStaticArrayCleanup
	- DirtyBytesArrayToStorage
	- DataLocationChangeInInternalOverride
	- NestedCalldataArrayAbiReencodingSizeValidation
	- SignedImmutables
	- ABIDecodeTwoDimensionalArrayMemory
	- KeccakCaching.
It is used by:
	- >=0.7.5 (node_modules/@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol#2)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#incorrect-versions-of-solidity
INFO:Detectors:
Parameter CharmStrategyWETH.setCharmVault(address)._charmVault (contracts/strategies/CharmStrategyWETH.sol#255) is not in mixedCase
Parameter CharmStrategyWETH.setWethUsdPriceFeed(address)._wethUsdFeed (contracts/strategies/CharmStrategyWETH.sol#266) is not in mixedCase
Parameter CharmStrategyWETH.setUsd1UsdPriceFeed(address)._usd1UsdFeed (contracts/strategies/CharmStrategyWETH.sol#276) is not in mixedCase
Parameter CharmStrategyWETH.setWlfiUsdPriceFeed(address)._wlfiUsdFeed (contracts/strategies/CharmStrategyWETH.sol#286) is not in mixedCase
Parameter CharmStrategyWETH.setTwapPool(address)._twapPool (contracts/strategies/CharmStrategyWETH.sol#295) is not in mixedCase
Parameter CharmStrategyWETH.updateParameters(uint256,uint256,uint256)._maxSlippage (contracts/strategies/CharmStrategyWETH.sol#885) is not in mixedCase
Parameter CharmStrategyWETH.updateParameters(uint256,uint256,uint256)._twapPeriod (contracts/strategies/CharmStrategyWETH.sol#886) is not in mixedCase
Parameter CharmStrategyWETH.updateParameters(uint256,uint256,uint256)._maxOracleAge (contracts/strategies/CharmStrategyWETH.sol#887) is not in mixedCase
Parameter CharmStrategyWETH.setEmergencyPrice(uint256)._wethPerUsd1 (contracts/strategies/CharmStrategyWETH.sol#983) is not in mixedCase
Variable CharmStrategyWETH.EAGLE_VAULT (contracts/strategies/CharmStrategyWETH.sol#114) is not in mixedCase
Variable CharmStrategyWETH.WETH (contracts/strategies/CharmStrategyWETH.sol#115) is not in mixedCase
Variable CharmStrategyWETH.WLFI (contracts/strategies/CharmStrategyWETH.sol#116) is not in mixedCase
Variable CharmStrategyWETH.USD1 (contracts/strategies/CharmStrategyWETH.sol#117) is not in mixedCase
Variable CharmStrategyWETH.UNISWAP_ROUTER (contracts/strategies/CharmStrategyWETH.sol#118) is not in mixedCase
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#conformance-to-solidity-naming-conventions
INFO:Detectors:
CharmStrategyWETH._getSqrtRatioAtTick(int24) (contracts/strategies/CharmStrategyWETH.sol#653-681) uses literals with too many digits:
	- ratio = 0x100000000000000000000000000000000 (contracts/strategies/CharmStrategyWETH.sol#657)
Reference: https://github.com/crytic/slither/wiki/Detector-Documentation#too-many-digits
**THIS CHECKLIST IS NOT COMPLETE**. Use `--show-ignored-findings` to show all the results.
Summary
 - [arbitrary-send-erc20](#arbitrary-send-erc20) (2 results) (High)
 - [unchecked-transfer](#unchecked-transfer) (2 results) (High)
 - [divide-before-multiply](#divide-before-multiply) (24 results) (Medium)
 - [incorrect-equality](#incorrect-equality) (11 results) (Medium)
 - [unused-return](#unused-return) (5 results) (Medium)
 - [shadowing-local](#shadowing-local) (1 results) (Low)
 - [events-maths](#events-maths) (1 results) (Low)
 - [reentrancy-events](#reentrancy-events) (2 results) (Low)
 - [timestamp](#timestamp) (7 results) (Low)
 - [assembly](#assembly) (2 results) (Informational)
 - [pragma](#pragma) (1 results) (Informational)
 - [cyclomatic-complexity](#cyclomatic-complexity) (2 results) (Informational)
 - [dead-code](#dead-code) (3 results) (Informational)
 - [solc-version](#solc-version) (6 results) (Informational)
 - [naming-convention](#naming-convention) (14 results) (Informational)
 - [too-many-digits](#too-many-digits) (1 results) (Informational)
## arbitrary-send-erc20
Impact: High
Confidence: High
 - [ ] ID-0
[CharmStrategyWETH.deposit(uint256,uint256)](contracts/strategies/CharmStrategyWETH.sol#L328-L453) uses arbitrary from in transferFrom: [USD1.transferFrom(EAGLE_VAULT,address(this),usd1Amount)](contracts/strategies/CharmStrategyWETH.sol#L346-L350)

contracts/strategies/CharmStrategyWETH.sol#L328-L453


 - [ ] ID-1
[CharmStrategyWETH.deposit(uint256,uint256)](contracts/strategies/CharmStrategyWETH.sol#L328-L453) uses arbitrary from in transferFrom: [WLFI.transferFrom(EAGLE_VAULT,address(this),wlfiAmount)](contracts/strategies/CharmStrategyWETH.sol#L339-L343)

contracts/strategies/CharmStrategyWETH.sol#L328-L453


## unchecked-transfer
Impact: High
Confidence: Medium
 - [ ] ID-2
[CharmStrategyWETH.deposit(uint256,uint256)](contracts/strategies/CharmStrategyWETH.sol#L328-L453) ignores return value by [WLFI.transferFrom(EAGLE_VAULT,address(this),wlfiAmount)](contracts/strategies/CharmStrategyWETH.sol#L339-L343)

contracts/strategies/CharmStrategyWETH.sol#L328-L453


 - [ ] ID-3
[CharmStrategyWETH.deposit(uint256,uint256)](contracts/strategies/CharmStrategyWETH.sol#L328-L453) ignores return value by [USD1.transferFrom(EAGLE_VAULT,address(this),usd1Amount)](contracts/strategies/CharmStrategyWETH.sol#L346-L350)

contracts/strategies/CharmStrategyWETH.sol#L328-L453


## divide-before-multiply
Impact: Medium
Confidence: Medium
 - [ ] ID-4
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128](contracts/strategies/CharmStrategyWETH.sol#L658)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-5
[CharmStrategyWETH.withdraw(uint256)](contracts/strategies/CharmStrategyWETH.sol#L461-L521) performs a multiplication on the result of a division:
	- [expectedWlfi = (ourWlfi * sharesToWithdraw) / ourShares](contracts/strategies/CharmStrategyWETH.sol#L496)
	- [(wethAmount,wlfiAmount) = charmVault.withdraw(sharesToWithdraw,(expectedWeth * (10000 - maxSlippage)) / 10000,(expectedWlfi * (10000 - maxSlippage)) / 10000,address(this))](contracts/strategies/CharmStrategyWETH.sol#L501-L506)

contracts/strategies/CharmStrategyWETH.sol#L461-L521


 - [ ] ID-6
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128](contracts/strategies/CharmStrategyWETH.sol#L672)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-7
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128](contracts/strategies/CharmStrategyWETH.sol#L668)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-8
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128](contracts/strategies/CharmStrategyWETH.sol#L671)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-9
[CharmStrategyWETH.getTotalAmountsEmergency()](contracts/strategies/CharmStrategyWETH.sol#L1078-L1101) performs a multiplication on the result of a division:
	- [wethAmount = (totalWeth * ourShares) / totalShares](contracts/strategies/CharmStrategyWETH.sol#L1096)
	- [usd1Amount = (wethAmount * 1e18) / emergencyWethPerUsd1](contracts/strategies/CharmStrategyWETH.sol#L1100)

contracts/strategies/CharmStrategyWETH.sol#L1078-L1101


 - [ ] ID-10
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128](contracts/strategies/CharmStrategyWETH.sol#L674)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-11
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128](contracts/strategies/CharmStrategyWETH.sol#L662)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-12
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128](contracts/strategies/CharmStrategyWETH.sol#L670)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-13
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128](contracts/strategies/CharmStrategyWETH.sol#L663)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-14
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128](contracts/strategies/CharmStrategyWETH.sol#L676)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-15
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128](contracts/strategies/CharmStrategyWETH.sol#L675)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-16
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128](contracts/strategies/CharmStrategyWETH.sol#L667)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-17
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128](contracts/strategies/CharmStrategyWETH.sol#L673)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-18
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128](contracts/strategies/CharmStrategyWETH.sol#L665)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-19
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128](contracts/strategies/CharmStrategyWETH.sol#L664)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-20
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128](contracts/strategies/CharmStrategyWETH.sol#L661)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-21
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128](contracts/strategies/CharmStrategyWETH.sol#L660)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-22
[CharmStrategyWETH.withdraw(uint256)](contracts/strategies/CharmStrategyWETH.sol#L461-L521) performs a multiplication on the result of a division:
	- [ourWeth = (totalWeth * ourShares) / totalShares](contracts/strategies/CharmStrategyWETH.sol#L478)
	- [totalValue = ourWlfi + (ourWeth * wlfiPerWeth) / 1e18](contracts/strategies/CharmStrategyWETH.sol#L485)

contracts/strategies/CharmStrategyWETH.sol#L461-L521


 - [ ] ID-23
[CharmStrategyWETH.withdraw(uint256)](contracts/strategies/CharmStrategyWETH.sol#L461-L521) performs a multiplication on the result of a division:
	- [ourWlfi = (totalWlfi * ourShares) / totalShares](contracts/strategies/CharmStrategyWETH.sol#L479)
	- [sharesToWithdraw = (ourShares * value) / totalValue](contracts/strategies/CharmStrategyWETH.sol#L491)
	- [expectedWlfi = (ourWlfi * sharesToWithdraw) / ourShares](contracts/strategies/CharmStrategyWETH.sol#L496)

contracts/strategies/CharmStrategyWETH.sol#L461-L521


 - [ ] ID-24
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128](contracts/strategies/CharmStrategyWETH.sol#L669)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-25
[CharmStrategyWETH.withdraw(uint256)](contracts/strategies/CharmStrategyWETH.sol#L461-L521) performs a multiplication on the result of a division:
	- [ourWeth = (totalWeth * ourShares) / totalShares](contracts/strategies/CharmStrategyWETH.sol#L478)
	- [sharesToWithdraw = (ourShares * value) / totalValue](contracts/strategies/CharmStrategyWETH.sol#L491)
	- [expectedWeth = (ourWeth * sharesToWithdraw) / ourShares](contracts/strategies/CharmStrategyWETH.sol#L495)

contracts/strategies/CharmStrategyWETH.sol#L461-L521


 - [ ] ID-26
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128](contracts/strategies/CharmStrategyWETH.sol#L666)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


 - [ ] ID-27
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) performs a multiplication on the result of a division:
	- [ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128](contracts/strategies/CharmStrategyWETH.sol#L659)
	- [ratio = type()(uint256).max / ratio](contracts/strategies/CharmStrategyWETH.sol#L678)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


## incorrect-equality
Impact: Medium
Confidence: High
 - [ ] ID-28
[CharmStrategyWETH.getTotalAmountsEmergency()](contracts/strategies/CharmStrategyWETH.sol#L1078-L1101) uses a dangerous strict equality:
	- [ourShares == 0](contracts/strategies/CharmStrategyWETH.sol#L1085)

contracts/strategies/CharmStrategyWETH.sol#L1078-L1101


 - [ ] ID-29
[CharmStrategyWETH.emergencyWithdrawAll()](contracts/strategies/CharmStrategyWETH.sol#L1044-L1072) uses a dangerous strict equality:
	- [ourShares == 0](contracts/strategies/CharmStrategyWETH.sol#L1049)

contracts/strategies/CharmStrategyWETH.sol#L1044-L1072


 - [ ] ID-30
[CharmStrategyWETH._swapWlfiToWeth(uint256)](contracts/strategies/CharmStrategyWETH.sol#L712-L729) uses a dangerous strict equality:
	- [amountIn == 0](contracts/strategies/CharmStrategyWETH.sol#L713)

contracts/strategies/CharmStrategyWETH.sol#L712-L729


 - [ ] ID-31
[CharmStrategyWETH.getTotalAmounts()](contracts/strategies/CharmStrategyWETH.sol#L839-L860) uses a dangerous strict equality:
	- [ourShares == 0](contracts/strategies/CharmStrategyWETH.sol#L845)

contracts/strategies/CharmStrategyWETH.sol#L839-L860


 - [ ] ID-32
[CharmStrategyWETH.deposit(uint256,uint256)](contracts/strategies/CharmStrategyWETH.sol#L328-L453) uses a dangerous strict equality:
	- [totalWlfi == 0 && totalWeth == 0](contracts/strategies/CharmStrategyWETH.sol#L365)

contracts/strategies/CharmStrategyWETH.sol#L328-L453


 - [ ] ID-33
[CharmStrategyWETH._swapUsd1ToWeth(uint256)](contracts/strategies/CharmStrategyWETH.sol#L735-L752) uses a dangerous strict equality:
	- [amountIn == 0](contracts/strategies/CharmStrategyWETH.sol#L736)

contracts/strategies/CharmStrategyWETH.sol#L735-L752


 - [ ] ID-34
[CharmStrategyWETH._swapWethToWlfi(uint256)](contracts/strategies/CharmStrategyWETH.sol#L690-L707) uses a dangerous strict equality:
	- [amountIn == 0](contracts/strategies/CharmStrategyWETH.sol#L691)

contracts/strategies/CharmStrategyWETH.sol#L690-L707


 - [ ] ID-35
[CharmStrategyWETH._getUsd1Equivalent(uint256)](contracts/strategies/CharmStrategyWETH.sol#L784-L804) uses a dangerous strict equality:
	- [wethAmount == 0](contracts/strategies/CharmStrategyWETH.sol#L785)

contracts/strategies/CharmStrategyWETH.sol#L784-L804


 - [ ] ID-36
[CharmStrategyWETH.withdraw(uint256)](contracts/strategies/CharmStrategyWETH.sol#L461-L521) uses a dangerous strict equality:
	- [ourShares == 0](contracts/strategies/CharmStrategyWETH.sol#L471)

contracts/strategies/CharmStrategyWETH.sol#L461-L521


 - [ ] ID-37
[CharmStrategyWETH.emergencyWithdraw(uint256)](contracts/strategies/CharmStrategyWETH.sol#L1000-L1038) uses a dangerous strict equality:
	- [ourShares == 0](contracts/strategies/CharmStrategyWETH.sol#L1010)

contracts/strategies/CharmStrategyWETH.sol#L1000-L1038


 - [ ] ID-38
[CharmStrategyWETH._swapWethToUsd1(uint256)](contracts/strategies/CharmStrategyWETH.sol#L758-L775) uses a dangerous strict equality:
	- [amountIn == 0](contracts/strategies/CharmStrategyWETH.sol#L759)

contracts/strategies/CharmStrategyWETH.sol#L758-L775


## unused-return
Impact: Medium
Confidence: Medium
 - [ ] ID-39
[CharmStrategyWETH.getTwapPrice()](contracts/strategies/CharmStrategyWETH.sol#L593-L632) ignores return value by [(tickCumulatives) = twapPool.observe(secondsAgos)](contracts/strategies/CharmStrategyWETH.sol#L603-L631)

contracts/strategies/CharmStrategyWETH.sol#L593-L632


 - [ ] ID-40
[CharmStrategyWETH.getChainlinkPrice()](contracts/strategies/CharmStrategyWETH.sol#L564-L586) ignores return value by [(None,wethUsdPrice,None,wethUpdatedAt,None) = wethUsdPriceFeed.latestRoundData()](contracts/strategies/CharmStrategyWETH.sol#L566)

contracts/strategies/CharmStrategyWETH.sol#L564-L586


 - [ ] ID-41
[CharmStrategyWETH._getWethPerUsd1FromChainlink()](contracts/strategies/CharmStrategyWETH.sol#L811-L828) ignores return value by [(None,wethUsdPrice,None,wethUpdatedAt,None) = wethUsdPriceFeed.latestRoundData()](contracts/strategies/CharmStrategyWETH.sol#L813)

contracts/strategies/CharmStrategyWETH.sol#L811-L828


 - [ ] ID-42
[CharmStrategyWETH.getChainlinkPrice()](contracts/strategies/CharmStrategyWETH.sol#L564-L586) ignores return value by [(None,wlfiUsdPrice,None,wlfiUpdatedAt,None) = wlfiUsdPriceFeed.latestRoundData()](contracts/strategies/CharmStrategyWETH.sol#L576)

contracts/strategies/CharmStrategyWETH.sol#L564-L586


 - [ ] ID-43
[CharmStrategyWETH._getWethPerUsd1FromChainlink()](contracts/strategies/CharmStrategyWETH.sol#L811-L828) ignores return value by [(None,usd1UsdPrice,None,usd1UpdatedAt,None) = usd1UsdPriceFeed.latestRoundData()](contracts/strategies/CharmStrategyWETH.sol#L818)

contracts/strategies/CharmStrategyWETH.sol#L811-L828


## shadowing-local
Impact: Low
Confidence: High
 - [ ] ID-44
[CharmStrategyWETH.constructor(address,address,address,address,address,address,address)._owner](contracts/strategies/CharmStrategyWETH.sol#L213) shadows:
	- [Ownable._owner](node_modules/@openzeppelin/contracts/access/Ownable.sol#L21) (state variable)

contracts/strategies/CharmStrategyWETH.sol#L213


## events-maths
Impact: Low
Confidence: Medium
 - [ ] ID-45
[CharmStrategyWETH.updateParameters(uint256,uint256,uint256)](contracts/strategies/CharmStrategyWETH.sol#L884-L896) should emit an event for: 
	- [twapPeriod = _twapPeriod](contracts/strategies/CharmStrategyWETH.sol#L894) 
	- [maxOracleAge = _maxOracleAge](contracts/strategies/CharmStrategyWETH.sol#L895) 

contracts/strategies/CharmStrategyWETH.sol#L884-L896


## reentrancy-events
Impact: Low
Confidence: Medium
 - [ ] ID-46
Reentrancy in [CharmStrategyWETH._swapWethToUsd1(uint256)](contracts/strategies/CharmStrategyWETH.sol#L758-L775):
	External calls:
	- [amountOut = UNISWAP_ROUTER.exactInputSingle(params)](contracts/strategies/CharmStrategyWETH.sol#L772)
	Event emitted after the call(s):
	- [TokensSwapped(address(WETH),address(USD1),amountIn,amountOut)](contracts/strategies/CharmStrategyWETH.sol#L774)

contracts/strategies/CharmStrategyWETH.sol#L758-L775


 - [ ] ID-47
Reentrancy in [CharmStrategyWETH.rescueIdleTokens()](contracts/strategies/CharmStrategyWETH.sol#L917-L938):
	External calls:
	- [usd1FromWeth = _swapWethToUsd1(wethBalance)](contracts/strategies/CharmStrategyWETH.sol#L924)
		- [amountOut = UNISWAP_ROUTER.exactInputSingle(params)](contracts/strategies/CharmStrategyWETH.sol#L772)
	Event emitted after the call(s):
	- [UnusedTokensReturned(usd1Balance,wlfiBalance)](contracts/strategies/CharmStrategyWETH.sol#L936)

contracts/strategies/CharmStrategyWETH.sol#L917-L938


## timestamp
Impact: Low
Confidence: Medium
 - [ ] ID-48
[CharmStrategyWETH._swapWethToWlfi(uint256)](contracts/strategies/CharmStrategyWETH.sol#L690-L707) uses timestamp for comparisons
	Dangerous comparisons:
	- [amountIn == 0](contracts/strategies/CharmStrategyWETH.sol#L691)

contracts/strategies/CharmStrategyWETH.sol#L690-L707


 - [ ] ID-49
[CharmStrategyWETH._getWethPerUsd1FromChainlink()](contracts/strategies/CharmStrategyWETH.sol#L811-L828) uses timestamp for comparisons
	Dangerous comparisons:
	- [block.timestamp - wethUpdatedAt > maxOracleAge](contracts/strategies/CharmStrategyWETH.sol#L815)
	- [block.timestamp - usd1UpdatedAt > maxOracleAge](contracts/strategies/CharmStrategyWETH.sol#L820)

contracts/strategies/CharmStrategyWETH.sol#L811-L828


 - [ ] ID-50
[CharmStrategyWETH.getChainlinkPrice()](contracts/strategies/CharmStrategyWETH.sol#L564-L586) uses timestamp for comparisons
	Dangerous comparisons:
	- [block.timestamp - wethUpdatedAt > maxOracleAge](contracts/strategies/CharmStrategyWETH.sol#L568)
	- [block.timestamp - wlfiUpdatedAt > maxOracleAge](contracts/strategies/CharmStrategyWETH.sol#L578)

contracts/strategies/CharmStrategyWETH.sol#L564-L586


 - [ ] ID-51
[CharmStrategyWETH._swapWlfiToWeth(uint256)](contracts/strategies/CharmStrategyWETH.sol#L712-L729) uses timestamp for comparisons
	Dangerous comparisons:
	- [amountIn == 0](contracts/strategies/CharmStrategyWETH.sol#L713)

contracts/strategies/CharmStrategyWETH.sol#L712-L729


 - [ ] ID-52
[CharmStrategyWETH.rescueIdleTokens()](contracts/strategies/CharmStrategyWETH.sol#L917-L938) uses timestamp for comparisons
	Dangerous comparisons:
	- [usd1Balance > 0](contracts/strategies/CharmStrategyWETH.sol#L931)
	- [wlfiBalance > 0 || usd1Balance > 0](contracts/strategies/CharmStrategyWETH.sol#L935)

contracts/strategies/CharmStrategyWETH.sol#L917-L938


 - [ ] ID-53
[CharmStrategyWETH._getUsd1Equivalent(uint256)](contracts/strategies/CharmStrategyWETH.sol#L784-L804) uses timestamp for comparisons
	Dangerous comparisons:
	- [wethAmount == 0](contracts/strategies/CharmStrategyWETH.sol#L785)

contracts/strategies/CharmStrategyWETH.sol#L784-L804


 - [ ] ID-54
[CharmStrategyWETH.deposit(uint256,uint256)](contracts/strategies/CharmStrategyWETH.sol#L328-L453) uses timestamp for comparisons
	Dangerous comparisons:
	- [totalWlfi == 0 && totalWeth == 0](contracts/strategies/CharmStrategyWETH.sol#L365)
	- [totalWeth >= wethNeeded](contracts/strategies/CharmStrategyWETH.sol#L377)
	- [excessWeth > 0](contracts/strategies/CharmStrategyWETH.sol#L384)
	- [wlfiToSwap < totalWlfi](contracts/strategies/CharmStrategyWETH.sol#L399)
	- [leftoverUsd1 > 0](contracts/strategies/CharmStrategyWETH.sol#L437)
	- [leftoverUsd1 > 0 || leftoverWlfi > 0](contracts/strategies/CharmStrategyWETH.sol#L444)

contracts/strategies/CharmStrategyWETH.sol#L328-L453


## assembly
Impact: Informational
Confidence: High
 - [ ] ID-55
[SafeERC20._callOptionalReturnBool(IERC20,bytes)](node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#L201-L211) uses assembly
	- [INLINE ASM](node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#L205-L209)

node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#L201-L211


 - [ ] ID-56
[SafeERC20._callOptionalReturn(IERC20,bytes)](node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#L173-L191) uses assembly
	- [INLINE ASM](node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#L176-L186)

node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#L173-L191


## pragma
Impact: Informational
Confidence: High
 - [ ] ID-57
6 different versions of Solidity are used:
	- Version constraint ^0.8.22 is used by:
		-[^0.8.22](contracts/interfaces/IStrategy.sol#L2)
		-[^0.8.22](contracts/strategies/CharmStrategyWETH.sol#L2)
	- Version constraint ^0.8.20 is used by:
		-[^0.8.20](node_modules/@openzeppelin/contracts/access/Ownable.sol#L4)
		-[^0.8.20](node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#L4)
		-[^0.8.20](node_modules/@openzeppelin/contracts/utils/Context.sol#L4)
		-[^0.8.20](node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol#L4)
	- Version constraint >=0.6.2 is used by:
		-[>=0.6.2](node_modules/@openzeppelin/contracts/interfaces/IERC1363.sol#L4)
	- Version constraint >=0.4.16 is used by:
		-[>=0.4.16](node_modules/@openzeppelin/contracts/interfaces/IERC165.sol#L4)
		-[>=0.4.16](node_modules/@openzeppelin/contracts/interfaces/IERC20.sol#L4)
		-[>=0.4.16](node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol#L4)
		-[>=0.4.16](node_modules/@openzeppelin/contracts/utils/introspection/IERC165.sol#L4)
	- Version constraint >=0.5.0 is used by:
		-[>=0.5.0](node_modules/@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol#L2)
	- Version constraint >=0.7.5 is used by:
		-[>=0.7.5](node_modules/@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol#L2)

contracts/interfaces/IStrategy.sol#L2


## cyclomatic-complexity
Impact: Informational
Confidence: High
 - [ ] ID-58
[CharmStrategyWETH.deposit(uint256,uint256)](contracts/strategies/CharmStrategyWETH.sol#L328-L453) has a high cyclomatic complexity (17).

contracts/strategies/CharmStrategyWETH.sol#L328-L453


 - [ ] ID-59
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) has a high cyclomatic complexity (24).

contracts/strategies/CharmStrategyWETH.sol#L653-L681


## dead-code
Impact: Informational
Confidence: Medium
 - [ ] ID-60
[Context._contextSuffixLength()](node_modules/@openzeppelin/contracts/utils/Context.sol#L25-L27) is never used and should be removed

node_modules/@openzeppelin/contracts/utils/Context.sol#L25-L27


 - [ ] ID-61
[Context._msgData()](node_modules/@openzeppelin/contracts/utils/Context.sol#L21-L23) is never used and should be removed

node_modules/@openzeppelin/contracts/utils/Context.sol#L21-L23


 - [ ] ID-62
[ReentrancyGuard._reentrancyGuardEntered()](node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol#L84-L86) is never used and should be removed

node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol#L84-L86


## solc-version
Impact: Informational
Confidence: High
 - [ ] ID-63
Version constraint ^0.8.22 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- VerbatimInvalidDeduplication.
It is used by:
	- [^0.8.22](contracts/interfaces/IStrategy.sol#L2)
	- [^0.8.22](contracts/strategies/CharmStrategyWETH.sol#L2)

contracts/interfaces/IStrategy.sol#L2


 - [ ] ID-64
Version constraint >=0.4.16 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- DirtyBytesArrayToStorage
	- ABIDecodeTwoDimensionalArrayMemory
	- KeccakCaching
	- EmptyByteArrayCopy
	- DynamicArrayCleanup
	- ImplicitConstructorCallvalueCheck
	- TupleAssignmentMultiStackSlotComponents
	- MemoryArrayCreationOverflow
	- privateCanBeOverridden
	- SignedArrayStorageCopy
	- ABIEncoderV2StorageArrayWithMultiSlotElement
	- DynamicConstructorArgumentsClippedABIV2
	- UninitializedFunctionPointerInConstructor_0.4.x
	- IncorrectEventSignatureInLibraries_0.4.x
	- ExpExponentCleanup
	- NestedArrayFunctionCallDecoder
	- ZeroFunctionSelector.
It is used by:
	- [>=0.4.16](node_modules/@openzeppelin/contracts/interfaces/IERC165.sol#L4)
	- [>=0.4.16](node_modules/@openzeppelin/contracts/interfaces/IERC20.sol#L4)
	- [>=0.4.16](node_modules/@openzeppelin/contracts/token/ERC20/IERC20.sol#L4)
	- [>=0.4.16](node_modules/@openzeppelin/contracts/utils/introspection/IERC165.sol#L4)

node_modules/@openzeppelin/contracts/interfaces/IERC165.sol#L4


 - [ ] ID-65
Version constraint >=0.6.2 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- MissingSideEffectsOnSelectorAccess
	- AbiReencodingHeadOverflowWithStaticArrayCleanup
	- DirtyBytesArrayToStorage
	- NestedCalldataArrayAbiReencodingSizeValidation
	- ABIDecodeTwoDimensionalArrayMemory
	- KeccakCaching
	- EmptyByteArrayCopy
	- DynamicArrayCleanup
	- MissingEscapingInFormatting
	- ArraySliceDynamicallyEncodedBaseType
	- ImplicitConstructorCallvalueCheck
	- TupleAssignmentMultiStackSlotComponents
	- MemoryArrayCreationOverflow.
It is used by:
	- [>=0.6.2](node_modules/@openzeppelin/contracts/interfaces/IERC1363.sol#L4)

node_modules/@openzeppelin/contracts/interfaces/IERC1363.sol#L4


 - [ ] ID-66
Version constraint >=0.7.5 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- FullInlinerNonExpressionSplitArgumentEvaluationOrder
	- MissingSideEffectsOnSelectorAccess
	- AbiReencodingHeadOverflowWithStaticArrayCleanup
	- DirtyBytesArrayToStorage
	- DataLocationChangeInInternalOverride
	- NestedCalldataArrayAbiReencodingSizeValidation
	- SignedImmutables
	- ABIDecodeTwoDimensionalArrayMemory
	- KeccakCaching.
It is used by:
	- [>=0.7.5](node_modules/@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol#L2)

node_modules/@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol#L2


 - [ ] ID-67
Version constraint ^0.8.20 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- VerbatimInvalidDeduplication
	- FullInlinerNonExpressionSplitArgumentEvaluationOrder
	- MissingSideEffectsOnSelectorAccess.
It is used by:
	- [^0.8.20](node_modules/@openzeppelin/contracts/access/Ownable.sol#L4)
	- [^0.8.20](node_modules/@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol#L4)
	- [^0.8.20](node_modules/@openzeppelin/contracts/utils/Context.sol#L4)
	- [^0.8.20](node_modules/@openzeppelin/contracts/utils/ReentrancyGuard.sol#L4)

node_modules/@openzeppelin/contracts/access/Ownable.sol#L4


 - [ ] ID-68
Version constraint >=0.5.0 contains known severe issues (https://solidity.readthedocs.io/en/latest/bugs.html)
	- DirtyBytesArrayToStorage
	- ABIDecodeTwoDimensionalArrayMemory
	- KeccakCaching
	- EmptyByteArrayCopy
	- DynamicArrayCleanup
	- ImplicitConstructorCallvalueCheck
	- TupleAssignmentMultiStackSlotComponents
	- MemoryArrayCreationOverflow
	- privateCanBeOverridden
	- SignedArrayStorageCopy
	- ABIEncoderV2StorageArrayWithMultiSlotElement
	- DynamicConstructorArgumentsClippedABIV2
	- UninitializedFunctionPointerInConstructor
	- IncorrectEventSignatureInLibraries
	- ABIEncoderV2PackedStorage.
It is used by:
	- [>=0.5.0](node_modules/@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol#L2)

node_modules/@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol#L2


## naming-convention
Impact: Informational
Confidence: High
 - [ ] ID-69
Parameter [CharmStrategyWETH.updateParameters(uint256,uint256,uint256)._maxSlippage](contracts/strategies/CharmStrategyWETH.sol#L885) is not in mixedCase

contracts/strategies/CharmStrategyWETH.sol#L885


 - [ ] ID-70
Parameter [CharmStrategyWETH.setTwapPool(address)._twapPool](contracts/strategies/CharmStrategyWETH.sol#L295) is not in mixedCase

contracts/strategies/CharmStrategyWETH.sol#L295


 - [ ] ID-71
Variable [CharmStrategyWETH.WLFI](contracts/strategies/CharmStrategyWETH.sol#L116) is not in mixedCase

contracts/strategies/CharmStrategyWETH.sol#L116


 - [ ] ID-72
Parameter [CharmStrategyWETH.updateParameters(uint256,uint256,uint256)._twapPeriod](contracts/strategies/CharmStrategyWETH.sol#L886) is not in mixedCase

contracts/strategies/CharmStrategyWETH.sol#L886


 - [ ] ID-73
Variable [CharmStrategyWETH.UNISWAP_ROUTER](contracts/strategies/CharmStrategyWETH.sol#L118) is not in mixedCase

contracts/strategies/CharmStrategyWETH.sol#L118


 - [ ] ID-74
Variable [CharmStrategyWETH.USD1](contracts/strategies/CharmStrategyWETH.sol#L117) is not in mixedCase

contracts/strategies/CharmStrategyWETH.sol#L117


 - [ ] ID-75
INFO:Slither:contracts/strategies/CharmStrategyWETH.sol analyzed (14 contracts with 100 detectors), 84 result(s) found
Parameter [CharmStrategyWETH.setWethUsdPriceFeed(address)._wethUsdFeed](contracts/strategies/CharmStrategyWETH.sol#L266) is not in mixedCase

contracts/strategies/CharmStrategyWETH.sol#L266


 - [ ] ID-76
Parameter [CharmStrategyWETH.setUsd1UsdPriceFeed(address)._usd1UsdFeed](contracts/strategies/CharmStrategyWETH.sol#L276) is not in mixedCase

contracts/strategies/CharmStrategyWETH.sol#L276


 - [ ] ID-77
Parameter [CharmStrategyWETH.updateParameters(uint256,uint256,uint256)._maxOracleAge](contracts/strategies/CharmStrategyWETH.sol#L887) is not in mixedCase

contracts/strategies/CharmStrategyWETH.sol#L887


 - [ ] ID-78
Variable [CharmStrategyWETH.EAGLE_VAULT](contracts/strategies/CharmStrategyWETH.sol#L114) is not in mixedCase

contracts/strategies/CharmStrategyWETH.sol#L114


 - [ ] ID-79
Parameter [CharmStrategyWETH.setCharmVault(address)._charmVault](contracts/strategies/CharmStrategyWETH.sol#L255) is not in mixedCase

contracts/strategies/CharmStrategyWETH.sol#L255


 - [ ] ID-80
Variable [CharmStrategyWETH.WETH](contracts/strategies/CharmStrategyWETH.sol#L115) is not in mixedCase

contracts/strategies/CharmStrategyWETH.sol#L115


 - [ ] ID-81
Parameter [CharmStrategyWETH.setEmergencyPrice(uint256)._wethPerUsd1](contracts/strategies/CharmStrategyWETH.sol#L983) is not in mixedCase

contracts/strategies/CharmStrategyWETH.sol#L983


 - [ ] ID-82
Parameter [CharmStrategyWETH.setWlfiUsdPriceFeed(address)._wlfiUsdFeed](contracts/strategies/CharmStrategyWETH.sol#L286) is not in mixedCase

contracts/strategies/CharmStrategyWETH.sol#L286


## too-many-digits
Impact: Informational
Confidence: Medium
 - [ ] ID-83
[CharmStrategyWETH._getSqrtRatioAtTick(int24)](contracts/strategies/CharmStrategyWETH.sol#L653-L681) uses literals with too many digits:
	- [ratio = 0x100000000000000000000000000000000](contracts/strategies/CharmStrategyWETH.sol#L657)

contracts/strategies/CharmStrategyWETH.sol#L653-L681


