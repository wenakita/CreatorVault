// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IWETH {
    function deposit() external payable;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface IUniswapV3Pool {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
    function tickSpacing() external view returns (int24);
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked
    );
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

/**
 * @title AddLiquiditySepolia
 * @notice Add liquidity to vEAGLE/WETH pool on Sepolia
 */
contract AddLiquiditySepolia is Script {
    address constant EAGLE_SHARE_OFT = 0x532Ec3711C9E219910045e2bBfA0280ae0d8457e;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant POOL = 0x10C6Ced34A939d54385C2983ea31C659c38A095D;
    address constant POSITION_MANAGER = 0x1238536071E1c677A632429e3655c799b22cDA52;
    
    // Use smaller amounts that definitely work
    uint256 constant LIQUIDITY_AMOUNT = 0.005 ether; // 0.005 of each token

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        console.log("==============================================");
        console.log("ADDING LIQUIDITY TO SEPOLIA POOL");
        console.log("==============================================");
        console.log("");
        console.log("Network: Sepolia Testnet");
        console.log("Pool:", POOL);
        console.log("Deployer:", deployer);
        console.log("");

        // Check balances
        uint256 ethBalance = deployer.balance;
        uint256 veagleBalance = IERC20(EAGLE_SHARE_OFT).balanceOf(deployer);
        
        console.log("CURRENT BALANCES:");
        console.log("  ETH:", ethBalance);
        console.log("  vEAGLE:", veagleBalance);
        console.log("");

        require(ethBalance >= LIQUIDITY_AMOUNT, "Insufficient ETH");
        require(veagleBalance >= LIQUIDITY_AMOUNT, "Insufficient vEAGLE");

        // Get pool info
        IUniswapV3Pool pool = IUniswapV3Pool(POOL);
        (uint160 sqrtPriceX96, int24 currentTick,,,,,) = pool.slot0();
        int24 tickSpacing = pool.tickSpacing();
        
        console.log("POOL INFO:");
        console.log("  Current tick:", currentTick);
        console.log("  Tick spacing:", tickSpacing);
        console.log("  sqrt price:", sqrtPriceX96);
        console.log("");

        // Calculate tick range (use wider range around current price)
        // For 1% fee tier, tick spacing is 200
        int24 tickLower = ((currentTick - 20000) / tickSpacing) * tickSpacing;
        int24 tickUpper = ((currentTick + 20000) / tickSpacing) * tickSpacing;
        
        console.log("LIQUIDITY RANGE:");
        console.log("  Tick lower:", tickLower);
        console.log("  Tick upper:", tickUpper);
        console.log("");

        // Wrap ETH
        console.log("Step 1: Wrapping", LIQUIDITY_AMOUNT, "ETH...");
        IWETH(WETH).deposit{value: LIQUIDITY_AMOUNT}();
        console.log("  SUCCESS");
        console.log("");

        // Approve tokens
        console.log("Step 2: Approving tokens...");
        IWETH(WETH).approve(POSITION_MANAGER, type(uint256).max);
        IERC20(EAGLE_SHARE_OFT).approve(POSITION_MANAGER, type(uint256).max);
        console.log("  SUCCESS");
        console.log("");

        // Add liquidity
        console.log("Step 3: Adding liquidity...");
        console.log("  vEAGLE amount:", LIQUIDITY_AMOUNT);
        console.log("  WETH amount:", LIQUIDITY_AMOUNT);
        console.log("");
        
        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            token0: EAGLE_SHARE_OFT,
            token1: WETH,
            fee: 10000, // 1% fee tier
            tickLower: tickLower,
            tickUpper: tickUpper,
            amount0Desired: LIQUIDITY_AMOUNT,
            amount1Desired: LIQUIDITY_AMOUNT,
            amount0Min: 0,
            amount1Min: 0,
            recipient: deployer,
            deadline: block.timestamp + 300
        });

        try INonfungiblePositionManager(POSITION_MANAGER).mint(mintParams) returns (
            uint256 tokenId,
            uint128 liquidity,
            uint256 amount0,
            uint256 amount1
        ) {
            console.log("SUCCESS! Liquidity added:");
            console.log("  Position Token ID:", tokenId);
            console.log("  Liquidity:", liquidity);
            console.log("  vEAGLE added:", amount0);
            console.log("  WETH added:", amount1);
            console.log("");
            console.log("==============================================");
            console.log("LIQUIDITY SUCCESSFULLY ADDED!");
            console.log("==============================================");
            console.log("");
            console.log("You can now run swap tests:");
            console.log("  forge script script/ExecuteTestSwap.s.sol \\");
            console.log("    --rpc-url https://eth-sepolia.g.alchemy.com/v2/omeyMm6mGtblMX7rCT-QTGQvTLFD4J9F \\");
            console.log("    --broadcast --legacy");
        } catch Error(string memory reason) {
            console.log("FAILED to add liquidity!");
            console.log("Reason:", reason);
        } catch (bytes memory) {
            console.log("FAILED to add liquidity!");
            console.log("Unknown error - trying alternative approach...");
            console.log("");
            console.log("TIP: You can add liquidity via Uniswap UI:");
            console.log("  1. Go to https://app.uniswap.org/pools");
            console.log("  2. Connect to Sepolia");
            console.log("  3. Find pool:", POOL);
            console.log("  4. Add liquidity manually");
        }

        vm.stopBroadcast();
    }
}

