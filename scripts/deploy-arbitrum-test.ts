import { ethers } from "hardhat";

/**
 * Deploy EagleOVault V2 Hybrid on Arbitrum for testing
 * Using test tokens: WLFI, USD1, and MEAGLE (Charm receipt)
 */
async function main() {
  console.log("🦅 Deploying EagleOVault V2 Hybrid on ARBITRUM (Testnet)...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH\n");

  // =================================
  // ARBITRUM CONFIGURATION
  // =================================
  
  const ARBITRUM_CONFIG = {
    // Your test tokens
    WLFI: "0x4780940f87d2Ce81d9dBAE8cC79B2239366e4747",
    USD1: "0x8C815948C41D2A87413E796281A91bE91C4a94aB",
    MEAGLE: "0x4c2dd52177af5f96f2b39e857fccd290e14f0c7e", // Charm vault receipt
    
    // Arbitrum infrastructure
    UNISWAP_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 SwapRouter
    PORTALS_ROUTER: "0xbf5a7f3629fb325e2a8453d595ab103465f75e62", // Portals Router
    WETH9: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // Arbitrum WETH
    
    // Deployment params
    DEPLOYMENT_THRESHOLD: ethers.parseEther("100"), // Lower for testing: $100
    DEPLOYMENT_INTERVAL: 5 * 60, // 5 minutes for testing
  };

  console.log("📋 Arbitrum Configuration:");
  console.log("  ═══════════════════════════════════════");
  console.log("  Test Tokens:");
  console.log("    WLFI:", ARBITRUM_CONFIG.WLFI);
  console.log("    USD1:", ARBITRUM_CONFIG.USD1);
  console.log("    MEAGLE (Charm):", ARBITRUM_CONFIG.MEAGLE);
  console.log("  ───────────────────────────────────────");
  console.log("  Infrastructure:");
  console.log("    Uniswap Router:", ARBITRUM_CONFIG.UNISWAP_ROUTER);
  console.log("    Portals Router:", ARBITRUM_CONFIG.PORTALS_ROUTER);
  console.log("    WETH:", ARBITRUM_CONFIG.WETH9);
  console.log("  ═══════════════════════════════════════\n");

  // =================================
  // DEPLOY VAULT
  // =================================
  
  console.log("🚀 Deploying EagleOVaultV2Hybrid...");
  
  const EagleOVaultV2Hybrid = await ethers.getContractFactory("EagleOVaultV2Hybrid");
  const vault = await EagleOVaultV2Hybrid.deploy(
    ARBITRUM_CONFIG.WLFI,
    ARBITRUM_CONFIG.USD1,
    ARBITRUM_CONFIG.UNISWAP_ROUTER,
    ARBITRUM_CONFIG.PORTALS_ROUTER,
    ARBITRUM_CONFIG.WETH9,
    deployer.address
  );
  
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ Vault deployed to:", vaultAddress);

  // =================================
  // CONFIGURE VAULT
  // =================================
  
  console.log("\n⚙️  Configuring vault for TESTING...");
  
  // Set LOW thresholds for testing
  console.log("  Setting deployment params (test mode)...");
  let tx = await vault.setDeploymentParams(
    ARBITRUM_CONFIG.DEPLOYMENT_THRESHOLD,
    ARBITRUM_CONFIG.DEPLOYMENT_INTERVAL
  );
  await tx.wait();
  console.log("    ✅ Deployment threshold:", ethers.formatEther(ARBITRUM_CONFIG.DEPLOYMENT_THRESHOLD));
  console.log("    ✅ Deployment interval:", ARBITRUM_CONFIG.DEPLOYMENT_INTERVAL / 60, "minutes");

  // =================================
  // VERIFY INTEGRATION
  // =================================
  
  console.log("\n🔍 Verifying integration...");
  
  const [uniRouter, portalsRouter, weth] = await vault.getIntegrationAddresses();
  console.log("  ✅ Uniswap Router:", uniRouter);
  console.log("  ✅ Portals Router:", portalsRouter);
  console.log("  ✅ WETH:", weth);
  
  const [wlfiBalance, usd1Balance] = await vault.getVaultBalances();
  console.log("  ✅ Initial balances:");
  console.log("     WLFI:", ethers.formatEther(wlfiBalance));
  console.log("     USD1:", ethers.formatEther(usd1Balance));

  // =================================
  // CHECK TOKEN DECIMALS
  // =================================
  
  console.log("\n🔢 Checking token decimals...");
  
  const erc20Abi = [
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)"
  ];
  
  const wlfiToken = new ethers.Contract(ARBITRUM_CONFIG.WLFI, erc20Abi, deployer);
  const usd1Token = new ethers.Contract(ARBITRUM_CONFIG.USD1, erc20Abi, deployer);
  
  try {
    const wlfiDecimals = await wlfiToken.decimals();
    const wlfiSymbol = await wlfiToken.symbol();
    const usd1Decimals = await usd1Token.decimals();
    const usd1Symbol = await usd1Token.symbol();
    
    console.log(`  ${wlfiSymbol}: ${wlfiDecimals} decimals`);
    console.log(`  ${usd1Symbol}: ${usd1Decimals} decimals`);
  } catch (error) {
    console.log("  ⚠️  Could not fetch token info (might not be deployed yet)");
  }

  // =================================
  // DEPLOYMENT SUMMARY
  // =================================
  
  console.log("\n📝 Deployment Summary:");
  console.log("  ═══════════════════════════════════════");
  console.log("  Network: Arbitrum");
  console.log("  Vault Address:", vault.address);
  console.log("  Owner:", deployer.address);
  console.log("  ═══════════════════════════════════════");

  // =================================
  // TESTING INSTRUCTIONS
  // =================================
  
  console.log("\n🧪 Testing Instructions:");
  console.log("  ═══════════════════════════════════════");
  
  console.log("\n  STEP 1: Get test tokens");
  console.log("  ─────────────────────────");
  console.log("  You need WLFI and USD1 to test.");
  console.log("  If you control these tokens, mint some to your address:");
  console.log(`  - WLFI: ${ARBITRUM_CONFIG.WLFI}`);
  console.log(`  - USD1: ${ARBITRUM_CONFIG.USD1}`);
  
  console.log("\n  STEP 2: Approve vault");
  console.log("  ─────────────────────────");
  console.log("  wlfiToken.approve(vaultAddress, amount);");
  console.log("  usd1Token.approve(vaultAddress, amount);");
  
  console.log("\n  STEP 3: Test Method 1 - Portals Zap");
  console.log("  ─────────────────────────");
  console.log("  1. Get quote from Portals API:");
  console.log("     GET https://api.portals.fi/v2/portal?");
  console.log(`       inputToken=arbitrum:${ARBITRUM_CONFIG.WLFI}`);
  console.log("       inputAmount=1000000000000000000");
  console.log(`       outputToken=arbitrum:${ARBITRUM_CONFIG.USD1}`);
  console.log(`       sender=${vault.address}`);
  console.log("  2. Execute:");
  console.log(`     vault.zapViaPortals(...)`);
  
  console.log("\n  STEP 4: Test Method 2 - Uniswap Zap");
  console.log("  ─────────────────────────");
  console.log("  Zap from ETH:");
  console.log(`  vault.zapDepositETH("${deployer.address}", minShares, { value: ethers.utils.parseEther("0.01") })`);
  console.log("\n  Or zap from USDC (if available):");
  console.log(`  vault.zapDeposit(USDC_ADDRESS, amount, "${deployer.address}", minShares)`);
  
  console.log("\n  STEP 5: Test Method 3 - Direct Deposit");
  console.log("  ─────────────────────────");
  console.log("  vault.depositDual(");
  console.log("    ethers.utils.parseEther('50'),  // 50 WLFI");
  console.log("    ethers.utils.parseEther('50'),  // 50 USD1");
  console.log(`    '${deployer.address}'`);
  console.log("  )");
  
  console.log("\n  STEP 6: Check your EAGLE balance");
  console.log("  ─────────────────────────");
  console.log(`  vault.balanceOf('${deployer.address}')`);
  
  console.log("\n  STEP 7: Test withdrawal");
  console.log("  ─────────────────────────");
  console.log("  vault.withdrawDual(shares, receiver)");
  
  console.log("\n  ═══════════════════════════════════════");

  // =================================
  // QUICK TEST SCRIPT
  // =================================
  
  console.log("\n📜 Quick Test Script (save as test-vault.ts):");
  console.log("  ═══════════════════════════════════════");
  
  const testScript = `
import { ethers } from "hardhat";

async function testVault() {
  const [signer] = await ethers.getSigners();
  
  const VAULT = "${vault.address}";
  const WLFI = "${ARBITRUM_CONFIG.WLFI}";
  const USD1 = "${ARBITRUM_CONFIG.USD1}";
  
  const vault = await ethers.getContractAt("EagleOVaultV2Hybrid", VAULT);
  const wlfi = await ethers.getContractAt("IERC20", WLFI);
  const usd1 = await ethers.getContractAt("IERC20", USD1);
  
  console.log("Testing vault at:", VAULT);
  
  // Check balances
  const wlfiBalance = await wlfi.balanceOf(signer.address);
  const usd1Balance = await usd1.balanceOf(signer.address);
  console.log("Your WLFI balance:", ethers.utils.formatEther(wlfiBalance));
  console.log("Your USD1 balance:", ethers.utils.formatEther(usd1Balance));
  
  if (wlfiBalance.gt(0) && usd1Balance.gt(0)) {
    // Approve
    console.log("\\nApproving tokens...");
    await wlfi.approve(VAULT, wlfiBalance);
    await usd1.approve(VAULT, usd1Balance);
    console.log("✅ Approved");
    
    // Deposit
    console.log("\\nDepositing...");
    const depositAmount = ethers.utils.parseEther("10");
    const tx = await vault.depositDual(depositAmount, depositAmount, signer.address);
    await tx.wait();
    console.log("✅ Deposited!");
    
    // Check EAGLE balance
    const eagleBalance = await vault.balanceOf(signer.address);
    console.log("Your EAGLE balance:", ethers.utils.formatEther(eagleBalance));
  } else {
    console.log("\\n⚠️  You need WLFI and USD1 tokens to test!");
  }
}

testVault().catch(console.error);
`;
  
  console.log(testScript);
  console.log("  ═══════════════════════════════════════");

  // =================================
  // VERIFICATION COMMAND
  // =================================
  
  console.log("\n🔍 To verify on Arbiscan:");
  console.log(`
npx hardhat verify --network arbitrum ${vault.address} \\
  ${ARBITRUM_CONFIG.WLFI} \\
  ${ARBITRUM_CONFIG.USD1} \\
  ${ARBITRUM_CONFIG.UNISWAP_ROUTER} \\
  ${ARBITRUM_CONFIG.PORTALS_ROUTER} \\
  ${ARBITRUM_CONFIG.WETH9} \\
  ${deployer.address}
`);

  // =================================
  // SAVE DEPLOYMENT INFO
  // =================================
  
  const deploymentInfo = {
    network: "arbitrum",
    chainId: 42161,
    timestamp: new Date().toISOString(),
    vault: vault.address,
    owner: deployer.address,
    tokens: {
      wlfi: ARBITRUM_CONFIG.WLFI,
      usd1: ARBITRUM_CONFIG.USD1,
      meagle: ARBITRUM_CONFIG.MEAGLE
    },
    integrations: {
      uniswapRouter: ARBITRUM_CONFIG.UNISWAP_ROUTER,
      portalsRouter: ARBITRUM_CONFIG.PORTALS_ROUTER,
      weth: ARBITRUM_CONFIG.WETH9
    },
    config: {
      deploymentThreshold: ethers.utils.formatEther(ARBITRUM_CONFIG.DEPLOYMENT_THRESHOLD),
      deploymentInterval: `${ARBITRUM_CONFIG.DEPLOYMENT_INTERVAL / 60} minutes`
    },
    methods: {
      portalsZap: "zapViaPortals(address,uint256,bytes,uint256,uint256)",
      portalsZapETH: "zapETHViaPortals(bytes,uint256,uint256)",
      uniswapZap: "zapDeposit(address,uint256,address,uint256)",
      uniswapZapETH: "zapDepositETH(address,uint256)",
      directDeposit: "depositDual(uint256,uint256,address)"
    }
  };

  console.log("\n💾 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n✅ Deployment complete!");
  console.log("\n🎉 Ready to test on Arbitrum!");
  console.log("\nNext: Run the test script or use the frontend to interact with the vault.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

