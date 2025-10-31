// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWETH {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address owner) external view returns (uint256);
}

interface IEagleOVault {
    function depositDual(uint256 wlfiAmount, uint256 usd1Amount, address receiver) external returns (uint256 shares);
    function balanceOf(address owner) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IEagleVaultWrapper {
    function wrap(uint256 amount) external;
}

interface INonfungiblePositionManager {
    struct MintParams {
        address token0;
        address token1;
        uint24 fee;
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired;
        uint256 amount1Desired;
        uint256 amount0Min;
        uint256 amount1Min;
        address recipient;
        uint256 deadline;
    }

    function mint(MintParams calldata params) external payable returns (
        uint256 tokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );
}

interface IUniswapV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
}

/**
 * @title WrapAndAddLiquidity
 * @notice Complete flow: Deposit -> Wrap -> Add Liquidity -> Test Swaps
 */
contract WrapAndAddLiquidity is Script {
    // Deployed addresses
    address constant WLFI = 0x33fB8387d4C6F5B344ca6C6C68e4576db10BDEa3;
    address constant USD1 = 0xdDC8061BB5e2caE36E27856620086bc6d59C2242;
    address constant VAULT = 0xb7D1044Aa912AE4BC95099E8027dD26B1506F261;
    address constant WRAPPER = 0x622F8714c95f220AF666d77882CDCF63816dB8A7;
    address constant EAGLE_SHARE_OFT = 0x532Ec3711C9E219910045e2bBfA0280ae0d8457e;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant POOL = 0x10C6Ced34A939d54385C2983ea31C659c38A095D;
    address constant POSITION_MANAGER = 0x1238536071E1c677A632429e3655c799b22cDA52;
    
    uint24 constant FEE_TIER = 10000; // 1%
    int24 constant TICK_LOWER = -887220;
    int24 constant TICK_UPPER = 887220;
    
    uint256 constant DEPOSIT_AMOUNT = 10000 ether; // 10000 WLFI + 10000 USD1
    uint256 constant LIQUIDITY_VEAGLE = 5000 ether; // 5000 vEAGLE for liquidity
    uint256 constant LIQUIDITY_ETH = 0.005 ether; // 0.5 ETH for liquidity

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        console.log("=======================================================");
        console.log("COMPLETE FLOW: DEPOSIT -> WRAP -> ADD LIQUIDITY");
        console.log("=======================================================");
        console.log("");

        // Step 1: Deposit to vault
        console.log("STEP 1: Depositing to EagleOVault...");
        IERC20(WLFI).approve(VAULT, DEPOSIT_AMOUNT);
        IERC20(USD1).approve(VAULT, DEPOSIT_AMOUNT);
        
        IEagleOVault vault = IEagleOVault(VAULT);
        uint256 shares = vault.depositDual(DEPOSIT_AMOUNT, DEPOSIT_AMOUNT, deployer);
        console.log("  Deposited:", DEPOSIT_AMOUNT / 1e18);
        console.log("  Received shares:", shares / 1e18);
        console.log("");

        // Step 2: Wrap to OFT
        console.log("STEP 2: Wrapping to EagleShareOFT...");
        IERC20(VAULT).approve(WRAPPER, shares);
        
        IEagleVaultWrapper wrapper = IEagleVaultWrapper(WRAPPER);
        wrapper.wrap(shares);
        
        uint256 oftBalance = IERC20(EAGLE_SHARE_OFT).balanceOf(deployer);
        console.log("  Wrapped:", shares / 1e18);
        console.log("  OFT balance:", oftBalance / 1e18);
        console.log("");

        // Step 3: Add liquidity
        console.log("STEP 3: Adding Liquidity to vEAGLE/WETH pool...");
        
        IWETH weth = IWETH(WETH);
        weth.deposit{value: LIQUIDITY_ETH}();
        
        IERC20(EAGLE_SHARE_OFT).approve(POSITION_MANAGER, type(uint256).max);
        weth.approve(POSITION_MANAGER, type(uint256).max);
        
        IUniswapV3Pool pool = IUniswapV3Pool(POOL);
        address token0 = pool.token0();
        address token1 = pool.token1();
        bool veagleIsToken0 = token0 == EAGLE_SHARE_OFT;
        
        INonfungiblePositionManager positionManager = INonfungiblePositionManager(POSITION_MANAGER);
        
        INonfungiblePositionManager.MintParams memory params = INonfungiblePositionManager.MintParams({
            token0: token0,
            token1: token1,
            fee: FEE_TIER,
            tickLower: TICK_LOWER,
            tickUpper: TICK_UPPER,
            amount0Desired: veagleIsToken0 ? LIQUIDITY_VEAGLE : LIQUIDITY_ETH,
            amount1Desired: veagleIsToken0 ? LIQUIDITY_ETH : LIQUIDITY_VEAGLE,
            amount0Min: 0,
            amount1Min: 0,
            recipient: deployer,
            deadline: block.timestamp + 300
        });

        (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1) = positionManager.mint(params);
        
        console.log("  Position NFT ID:", tokenId);
        console.log("  Liquidity added:", liquidity);
        console.log("");

        console.log("=======================================================");
        console.log("SUCCESS! Pool ready for swaps with fee-on-swap!");
        console.log("=======================================================");

        vm.stopBroadcast();
    }
}

