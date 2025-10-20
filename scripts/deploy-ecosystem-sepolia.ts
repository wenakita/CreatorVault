import { ethers } from "hardhat";

/**
 * Complete Eagle Ecosystem Deployment on Sepolia
 * 
 * Deploys:
 * 1. Mock tokens (WLFI, USD1) or uses existing
 * 2. EagleRegistry
 * 3. EagleShareOFT
 * 4. EagleOVault
 * 5. EagleVaultWrapper (bridge)
 * 6. Configures all connections
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("=".repeat(60));
  console.log("🦅 EAGLE ECOSYSTEM - SEPOLIA DEPLOYMENT");
  console.log("=".repeat(60));
  console.log("\n📍 Network: Sepolia Testnet");
  console.log("👤 Deployer:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.2")) {
    console.warn("\n⚠️  WARNING: Low balance! Recommended: 0.3+ ETH");
    console.log("Get Sepolia ETH: https://sepoliafaucet.com");
  }
  
  // Configuration
  const SEPOLIA_CHAIN_ID = 11155111;
  const SEPOLIA_CHAIN_ID_UINT16 = 13991;
  const SEPOLIA_LZ_ENDPOINT = "0x6EDCE65403992e310A62460808c4b910D972f10f";
  const SEPOLIA_LZ_EID = 40161;
  const WETH_SEPOLIA = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const UNISWAP_ROUTER_SEPOLIA = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E"; // SwapRouter on Sepolia
  
  const deploymentInfo: any = {
    network: "sepolia",
    chainId: SEPOLIA_CHAIN_ID,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {},
    configuration: {}
  };
  
  // ========================================
  // STEP 1: Deploy Mock Tokens (for testing)
  // ========================================
  
  console.log("\n" + "=".repeat(60));
  console.log("STEP 1: Deploying Mock Tokens");
  console.log("=".repeat(60));
  
  // Deploy MockERC20 for WLFI
  console.log("\n📝 Deploying Mock WLFI...");
  const MockERC20 = await ethers.getContractFactory("contracts/mocks/MockERC20.sol:MockERC20");
  const wlfi = await MockERC20.deploy("World Liberty Financial", "WLFI", 18);
  await wlfi.waitForDeployment();
  const wlfiAddress = await wlfi.getAddress();
  console.log("✅ Mock WLFI deployed:", wlfiAddress);
  
  // Mint some WLFI for testing
  await (await wlfi.mint(deployer.address, ethers.parseEther("100000"))).wait();
  console.log("   Minted 100,000 WLFI for testing");
  
  // Deploy MockERC20 for USD1
  console.log("\n📝 Deploying Mock USD1...");
  const usd1 = await MockERC20.deploy("USD1 Stablecoin", "USD1", 18);
  await usd1.waitForDeployment();
  const usd1Address = await usd1.getAddress();
  console.log("✅ Mock USD1 deployed:", usd1Address);
  
  // Mint some USD1 for testing
  await (await usd1.mint(deployer.address, ethers.parseEther("100000"))).wait();
  console.log("   Minted 100,000 USD1 for testing");
  
  // Deploy Mock Chainlink Price Feed
  console.log("\n📝 Deploying Mock USD1 Price Feed...");
  const MockPriceFeed = await ethers.getContractFactory("contracts/mocks/MockChainlinkAggregator.sol:MockChainlinkAggregator");
  const usd1PriceFeed = await MockPriceFeed.deploy(8, 100000000); // $1.00
  await usd1PriceFeed.waitForDeployment();
  const usd1PriceFeedAddress = await usd1PriceFeed.getAddress();
  console.log("✅ Mock USD1 Price Feed deployed:", usd1PriceFeedAddress);
  console.log("   Price set to: $1.00");
  
  // Deploy Mock Uniswap V3 Pool
  console.log("\n📝 Deploying Mock WLFI/USD1 Pool...");
  const MockPool = await ethers.getContractFactory("contracts/mocks/MockUniswapV3Pool.sol:MockUniswapV3Pool");
  const pool = await MockPool.deploy(wlfiAddress, usd1Address);
  await pool.waitForDeployment();
  const poolAddress = await pool.getAddress();
  console.log("✅ Mock Pool deployed:", poolAddress);
  
  deploymentInfo.contracts.wlfi = wlfiAddress;
  deploymentInfo.contracts.usd1 = usd1Address;
  deploymentInfo.contracts.usd1PriceFeed = usd1PriceFeedAddress;
  deploymentInfo.contracts.pool = poolAddress;
  
  // ========================================
  // STEP 2: Deploy EagleRegistry
  // ========================================
  
  console.log("\n" + "=".repeat(60));
  console.log("STEP 2: Deploying EagleRegistry");
  console.log("=".repeat(60));
  
  const EagleRegistry = await ethers.getContractFactory("EagleRegistry");
  console.log("\n📝 Deploying contract...");
  const registry = await EagleRegistry.deploy(deployer.address);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("✅ EagleRegistry deployed:", registryAddress);
  
  // Configure registry
  console.log("\n📝 Configuring registry...");
  await (await registry.registerChain(
    SEPOLIA_CHAIN_ID_UINT16,
    "Sepolia",
    WETH_SEPOLIA,
    "WETH",
    true
  )).wait();
  
  await (await registry.setLayerZeroEndpoint(
    SEPOLIA_CHAIN_ID_UINT16,
    SEPOLIA_LZ_ENDPOINT
  )).wait();
  
  await (await registry.setChainIdToEid(
    SEPOLIA_CHAIN_ID,
    SEPOLIA_LZ_EID
  )).wait();
  
  console.log("✅ Registry configured");
  deploymentInfo.contracts.registry = registryAddress;
  
  // ========================================
  // STEP 3: Deploy EagleShareOFT
  // ========================================
  
  console.log("\n" + "=".repeat(60));
  console.log("STEP 3: Deploying EagleShareOFT");
  console.log("=".repeat(60));
  
  const feeConfig = {
    buyFee: 0,
    sellFee: 0,
    treasuryShare: 5000,
    vaultShare: 5000,
    treasury: deployer.address,
    vaultBeneficiary: deployer.address,
    feesEnabled: false
  };
  
  console.log("\n📝 Deploying EagleShareOFT...");
  const EagleShareOFT = await ethers.getContractFactory("EagleShareOFT");
  const oft = await EagleShareOFT.deploy(
    "Eagle Vault Shares",
    "EAGLE",
    ethers.ZeroAddress,
    registryAddress,
    deployer.address,
    feeConfig
  );
  await oft.waitForDeployment();
  const oftAddress = await oft.getAddress();
  console.log("✅ EagleShareOFT deployed:", oftAddress);
  
  deploymentInfo.contracts.oft = oftAddress;
  
  // ========================================
  // STEP 4: Deploy EagleOVault
  // ========================================
  
  console.log("\n" + "=".repeat(60));
  console.log("STEP 4: Deploying EagleOVault");
  console.log("=".repeat(60));
  
  console.log("\n📝 Deploying vault...");
  const EagleOVault = await ethers.getContractFactory("EagleOVault");
  const vault = await EagleOVault.deploy(
    wlfiAddress,           // WLFI token
    usd1Address,           // USD1 token
    usd1PriceFeedAddress,  // USD1 price feed
    poolAddress,           // WLFI/USD1 pool
    UNISWAP_ROUTER_SEPOLIA, // Uniswap router
    deployer.address       // Owner
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ EagleOVault deployed:", vaultAddress);
  
  deploymentInfo.contracts.vault = vaultAddress;
  
  // ========================================
  // STEP 5: Deploy EagleVaultWrapper
  // ========================================
  
  console.log("\n" + "=".repeat(60));
  console.log("STEP 5: Deploying EagleVaultWrapper");
  console.log("=".repeat(60));
  
  console.log("\n📝 Deploying wrapper (bridge)...");
  const EagleVaultWrapper = await ethers.getContractFactory("EagleVaultWrapper");
  const wrapper = await EagleVaultWrapper.deploy(
    vaultAddress,      // Vault
    oftAddress,        // OFT
    deployer.address,  // Fee recipient
    deployer.address   // Owner
  );
  await wrapper.waitForDeployment();
  const wrapperAddress = await wrapper.getAddress();
  console.log("✅ EagleVaultWrapper deployed:", wrapperAddress);
  
  deploymentInfo.contracts.wrapper = wrapperAddress;
  
  // ========================================
  // STEP 6: Configure Connections
  // ========================================
  
  console.log("\n" + "=".repeat(60));
  console.log("STEP 6: Configuring Connections");
  console.log("=".repeat(60));
  
  console.log("\n📝 Setting vault bridge on OFT...");
  await (await oft.setVaultBridge(wrapperAddress)).wait();
  console.log("✅ Vault bridge set");
  
  // Deployer is already owner, no need to authorize
  console.log("\n✅ Deployer is vault owner (authorized by default)");
  
  // ========================================
  // STEP 7: Verify Setup
  // ========================================
  
  console.log("\n" + "=".repeat(60));
  console.log("STEP 7: Verifying Setup");
  console.log("=".repeat(60));
  
  const vaultBridge = await oft.vaultBridge();
  const vaultName = await vault.name();
  const vaultSymbol = await vault.symbol();
  const oftName = await oft.name();
  const oftSymbol = await oft.symbol();
  
  console.log("\n🔍 Vault:");
  console.log("  Name:", vaultName);
  console.log("  Symbol:", vaultSymbol);
  console.log("  Address:", vaultAddress);
  
  console.log("\n🔍 OFT:");
  console.log("  Name:", oftName);
  console.log("  Symbol:", oftSymbol);
  console.log("  Address:", oftAddress);
  
  console.log("\n🔍 Wrapper:");
  console.log("  Address:", wrapperAddress);
  console.log("  Vault Bridge Set:", vaultBridge === wrapperAddress);
  
  // ========================================
  // DEPLOYMENT SUMMARY
  // ========================================
  
  deploymentInfo.configuration = {
    layerZeroEndpoint: SEPOLIA_LZ_ENDPOINT,
    layerZeroEid: SEPOLIA_LZ_EID,
    uniswapRouter: UNISWAP_ROUTER_SEPOLIA,
    feesEnabled: false
  };
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  
  console.log("\n📊 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n🔗 Etherscan Links:");
  console.log("WLFI:", `https://sepolia.etherscan.io/address/${wlfiAddress}`);
  console.log("USD1:", `https://sepolia.etherscan.io/address/${usd1Address}`);
  console.log("Registry:", `https://sepolia.etherscan.io/address/${registryAddress}`);
  console.log("OFT:", `https://sepolia.etherscan.io/address/${oftAddress}`);
  console.log("Vault:", `https://sepolia.etherscan.io/address/${vaultAddress}`);
  console.log("Wrapper:", `https://sepolia.etherscan.io/address/${wrapperAddress}`);
  
  console.log("\n📝 Quick Start:");
  console.log("\n1. Approve tokens:");
  console.log(`   await wlfi.approve("${vaultAddress}", ethers.parseEther("1000"))`);
  console.log(`   await usd1.approve("${vaultAddress}", ethers.parseEther("1000"))`);
  
  console.log("\n2. Deposit to vault:");
  console.log(`   await vault.depositDual(ethers.parseEther("10"), ethers.parseEther("10"))`);
  
  console.log("\n3. Approve wrapper:");
  console.log(`   await vault.approve("${wrapperAddress}", ethers.parseEther("1000000"))`);
  
  console.log("\n4. Wrap shares → OFT:");
  console.log(`   await wrapper.wrap(ethers.parseEther("100000"))`);
  
  console.log("\n5. Check balances:");
  console.log(`   const vEagle = await vault.balanceOf(deployer.address)`);
  console.log(`   const eagle = await oft.balanceOf(deployer.address)`);
  
  // Save to file
  const fs = require('fs');
  const path = require('path');
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }
  fs.writeFileSync(
    path.join(deploymentsDir, 'sepolia-ecosystem.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("\n💾 Saved to: deployments/sepolia-ecosystem.json");
  
  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

