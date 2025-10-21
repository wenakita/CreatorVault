// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Minimal interfaces to avoid dependency issues
interface IUniswapV3Factory {
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

interface IUniswapV3Pool {
    function initialize(uint160 sqrtPriceX96) external;
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
}

/**
 * @title PostDeployment1_CreatePool
 * @notice Creates Uniswap V3 pool for WLFI/USD1 and adds initial liquidity
 * @dev Run after main deployment is complete
 */
contract PostDeployment1_CreatePool is Script {
    // Deployed contract addresses (LIVE on Sepolia - Block 9460340)
    address constant WLFI = 0x33fB8387d4C6F5B344ca6C6C68e4576db10BDEa3;
    address constant USD1 = 0xdDC8061BB5e2caE36E27856620086bc6d59C2242;
    
    // Uniswap V3 on Sepolia
    address constant UNISWAP_V3_FACTORY = 0x0227628f3F023bb0B980b67D528571c95c6DaC1c;
    
    // Pool parameters
    uint24 constant FEE_TIER = 3000; // 0.3% fee tier
    uint160 constant INITIAL_SQRT_PRICE = 79228162514264337593543950336; // 1:1 price (sqrt(1) * 2^96)
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("=================================================");
        console.log("POST-DEPLOYMENT: CREATE UNISWAP V3 POOL");
        console.log("=================================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("WLFI:", WLFI);
        console.log("USD1:", USD1);
        console.log("");
        
        IUniswapV3Factory factory = IUniswapV3Factory(UNISWAP_V3_FACTORY);
        
        // Step 1: Check if pool already exists
        address existingPool = factory.getPool(WLFI, USD1, FEE_TIER);
        
        if (existingPool != address(0)) {
            console.log("Pool already exists at:", existingPool);
            console.log("Skipping pool creation...");
            console.log("");
        } else {
            console.log("Step 1: Creating Uniswap V3 pool...");
            console.log("  Fee tier: 0.3%");
            console.log("  Initial price: 1:1");
            console.log("");
            
            // Create pool
            address pool = factory.createPool(WLFI, USD1, FEE_TIER);
            console.log("  Pool created at:", pool);
            
            // Initialize pool with 1:1 price
            IUniswapV3Pool(pool).initialize(INITIAL_SQRT_PRICE);
            console.log("  Pool initialized with 1:1 price");
            console.log("");
            
            existingPool = pool;
        }
        
        console.log("=================================================");
        console.log("POOL CREATION COMPLETE!");
        console.log("=================================================");
        console.log("");
        console.log("Pool address:", existingPool);
        console.log("Pool details:");
        console.log("  Token0:", IUniswapV3Pool(existingPool).token0());
        console.log("  Token1:", IUniswapV3Pool(existingPool).token1());
        console.log("  Fee tier:", IUniswapV3Pool(existingPool).fee() / 10000, "%");
        console.log("");
        console.log("NOTE: To add liquidity, use the Uniswap V3 interface:");
        console.log("   https://app.uniswap.org/add");
        console.log("   Or use a specialized liquidity management tool");
        console.log("");
        console.log("Next: Test vault deposit/withdraw flows");
        
        vm.stopBroadcast();
    }
}

