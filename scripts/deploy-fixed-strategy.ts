import { ethers } from "hardhat";

async function main() {
  console.log("\n🚀 Deploying FIXED CharmStrategyUSD1...\n");

  const VAULT = "0x32a2544De7a644833fE7659dF95e5bC16E698d99";
  const CHARM_VAULT = "0x22828Dbf15f5FBa2394Ba7Cf8fA9A96BdB444B71";
  const WLFI = "0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6";
  const USD1 = "0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d";
  const UNISWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const Strategy = await ethers.getContractFactory("CharmStrategyUSD1");
  const strategy = await Strategy.deploy(
    VAULT,
    CHARM_VAULT,
    WLFI,
    USD1,
    UNISWAP_ROUTER,
    deployer.address,
    { gasLimit: 3000000 }
  );

  await strategy.waitForDeployment();
  const address = await strategy.getAddress();

  console.log("\n✅ Strategy deployed:", address);
  console.log("\nRun these commands:");
  console.log(`  export STRATEGY_ADDRESS=${address}`);
  console.log(`  
  # Remove old strategy
  cast send ${VAULT} "removeStrategy(address)" 0x8d32D6aEd976dC80880f3eF708ecB2169FEe26a8 --rpc-url https://eth.llamarpc.com --private-key $PK --legacy
  
  # Add new strategy
  cast send ${VAULT} "addStrategy(address,uint256)" ${address} 10000 --rpc-url https://eth.llamarpc.com --private-key $PK --legacy
  
  # Initialize approvals
  cast send ${address} "initializeApprovals()" --rpc-url https://eth.llamarpc.com --private-key $PK --legacy
  `);
}

main();

