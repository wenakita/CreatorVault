import { ethers } from "hardhat";

/**
 * Deploy EagleOVault V2 Hybrid
 * Supports: Portals + Uniswap + Direct deposits
 */
async function main() {
  console.log("🦅 Deploying EagleOVault V2 Hybrid...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH\n");

  const network = await ethers.provider.getNetwork();
  console.log("Network:", network.name, `(${network.chainId})`);

  // =================================
  // CONFIGURATION
  // =================================
  
  let WLFI_ADDRESS: string;
  let USD1_ADDRESS: string;
  let UNISWAP_ROUTER: string;
  let PORTALS_ROUTER: string;
  let WETH9_ADDRESS: string;
  
  if (network.chainId === 1) {
    // Ethereum Mainnet
    WLFI_ADDRESS = process.env.WLFI_ADDRESS || "0x..."; // TODO: Set
    USD1_ADDRESS = process.env.USD1_ADDRESS || "0x..."; // TODO: Set
    UNISWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // Uniswap V3 SwapRouter
    PORTALS_ROUTER = "0xbf5a7f3629fb325e2a8453d595ab103465f75e62"; // Portals Router
    WETH9_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; // WETH9
  } else if (network.chainId === 11155111) {
    // Sepolia Testnet
    WLFI_ADDRESS = process.env.WLFI_ADDRESS || "0x..."; // TODO: Deploy test tokens
    USD1_ADDRESS = process.env.USD1_ADDRESS || "0x...";
    UNISWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
    PORTALS_ROUTER = "0xbf5a7f3629fb325e2a8453d595ab103465f75e62"; // Check if available on Sepolia
    WETH9_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  } else {
    throw new Error(`Unsupported network: ${network.chainId}`);
  }

  console.log("\n📋 Configuration:");
  console.log("  WLFI:", WLFI_ADDRESS);
  console.log("  USD1:", USD1_ADDRESS);
  console.log("  Uniswap Router:", UNISWAP_ROUTER);
  console.log("  Portals Router:", PORTALS_ROUTER);
  console.log("  WETH9:", WETH9_ADDRESS);

  // =================================
  // DEPLOY VAULT
  // =================================
  
  console.log("\n🚀 Deploying EagleOVaultV2Hybrid...");
  
  const EagleOVaultV2Hybrid = await ethers.getContractFactory("EagleOVaultV2Hybrid");
  const vault = await EagleOVaultV2Hybrid.deploy(
    WLFI_ADDRESS,
    USD1_ADDRESS,
    UNISWAP_ROUTER,
    PORTALS_ROUTER,
    WETH9_ADDRESS,
    deployer.address
  );
  
  await vault.deployed();
  console.log("✅ EagleOVaultV2Hybrid deployed to:", vault.address);

  // =================================
  // CONFIGURE VAULT
  // =================================
  
  console.log("\n⚙️  Configuring vault...");
  
  // Set deployment parameters
  console.log("  Setting deployment params...");
  let tx = await vault.setDeploymentParams(
    ethers.utils.parseEther("10000"), // $10k threshold
    60 * 60 // 1 hour interval
  );
  await tx.wait();
  console.log("    ✅ Deployment threshold: $10k");
  console.log("    ✅ Deployment interval: 1 hour");
  
  // Set Portals configuration (optional)
  if (process.env.PORTALS_PARTNER_ADDRESS) {
    console.log("  Setting Portals partner...");
    tx = await vault.setPortalsConfig(
      process.env.PORTALS_PARTNER_ADDRESS,
      0 // 0% fee initially
    );
    await tx.wait();
    console.log("    ✅ Portals partner:", process.env.PORTALS_PARTNER_ADDRESS);
  }

  // =================================
  // ADD STRATEGY (Optional)
  // =================================
  
  const CHARM_STRATEGY = process.env.CHARM_STRATEGY_ADDRESS;
  
  if (CHARM_STRATEGY) {
    console.log("\n🎯 Adding Charm strategy...");
    console.log("  Strategy address:", CHARM_STRATEGY);
    
    tx = await vault.addStrategy(CHARM_STRATEGY, 7000); // 70% allocation
    await tx.wait();
    console.log("  ✅ Strategy added with 70% allocation");
  }

  // =================================
  // DEPLOYMENT SUMMARY
  // =================================
  
  console.log("\n📝 Deployment Summary:");
  console.log("  ═══════════════════════════════════════");
  console.log("  Network:", network.name);
  console.log("  Vault:", vault.address);
  console.log("  Owner:", deployer.address);
  console.log("  ───────────────────────────────────────");
  console.log("  WLFI:", WLFI_ADDRESS);
  console.log("  USD1:", USD1_ADDRESS);
  console.log("  Uniswap Router:", UNISWAP_ROUTER);
  console.log("  Portals Router:", PORTALS_ROUTER);
  console.log("  WETH9:", WETH9_ADDRESS);
  
  if (CHARM_STRATEGY) {
    console.log("  ───────────────────────────────────────");
    console.log("  Strategy:", CHARM_STRATEGY);
  }
  console.log("  ═══════════════════════════════════════");

  // =================================
  // VERIFY INTEGRATION
  // =================================
  
  console.log("\n🔍 Verifying integration...");
  
  const [uniRouter, portalsRouter, weth] = await vault.getIntegrationAddresses();
  console.log("  Uniswap Router:", uniRouter);
  console.log("  Portals Router:", portalsRouter);
  console.log("  WETH9:", weth);
  
  const [wlfiBalance, usd1Balance] = await vault.getVaultBalances();
  console.log("  Initial balances:");
  console.log("    WLFI:", ethers.utils.formatEther(wlfiBalance));
  console.log("    USD1:", ethers.utils.formatEther(usd1Balance));

  // =================================
  // VERIFICATION COMMAND
  // =================================
  
  console.log("\n🔍 To verify on Etherscan, run:");
  console.log(`\nnpx hardhat verify --network ${network.name} ${vault.address} \\`);
  console.log(`  ${WLFI_ADDRESS} \\`);
  console.log(`  ${USD1_ADDRESS} \\`);
  console.log(`  ${UNISWAP_ROUTER} \\`);
  console.log(`  ${PORTALS_ROUTER} \\`);
  console.log(`  ${WETH9_ADDRESS} \\`);
  console.log(`  ${deployer.address}`);

  // =================================
  // USAGE EXAMPLES
  // =================================
  
  console.log("\n📖 How to use:");
  console.log("\n  Method 1: Portals Zap (ANY token)");
  console.log("  ────────────────────────────────────");
  console.log("  1. Call Portals API: GET /v2/portal");
  console.log("  2. Get transaction data");
  console.log("  3. Call: vault.zapViaPortals(portalsCallData, mins)");
  console.log("  Use for: Exotic tokens, best prices, large trades");
  
  console.log("\n  Method 2: Direct Uniswap (ETH/Common tokens)");
  console.log("  ────────────────────────────────────");
  console.log("  Call: vault.zapDepositETH(receiver, minShares)");
  console.log("  Call: vault.zapDeposit(tokenIn, amount, receiver, minShares)");
  console.log("  Use for: ETH, USDC, WBTC - Fast & efficient");
  
  console.log("\n  Method 3: Direct Deposit (WLFI+USD1)");
  console.log("  ────────────────────────────────────");
  console.log("  Call: vault.depositDual(wlfi, usd1, receiver)");
  console.log("  Use for: Power users, lowest gas");

  // =================================
  // NEXT STEPS
  // =================================
  
  console.log("\n✅ Deployment complete!");
  console.log("\n📋 Next steps:");
  console.log("  1. Verify contract on Etherscan");
  console.log("  2. Test each deposit method:");
  console.log("     - Portals zap with USDC");
  console.log("     - Direct Uniswap zap with ETH");
  console.log("     - Direct deposit with WLFI+USD1");
  console.log("  3. Add strategies (Charm, etc.)");
  console.log("  4. Integrate with frontend");
  console.log("  5. Launch! 🚀");

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId,
    vault: vault.address,
    tokens: {
      wlfi: WLFI_ADDRESS,
      usd1: USD1_ADDRESS,
      weth9: WETH9_ADDRESS
    },
    integrations: {
      uniswapRouter: UNISWAP_ROUTER,
      portalsRouter: PORTALS_ROUTER
    },
    owner: deployer.address,
    strategy: CHARM_STRATEGY || null,
    methods: {
      portalsZap: "zapViaPortals(bytes,uint256,uint256)",
      uniswapZapETH: "zapDepositETH(address,uint256)",
      uniswapZap: "zapDeposit(address,uint256,address,uint256)",
      directDeposit: "depositDual(uint256,uint256,address)"
    },
    deployedAt: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber()
  };

  console.log("\n💾 Deployment info saved:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  console.log("\n🎉 Ready to accept deposits from ANY token!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

