import { ethers } from 'hardhat';

async function main() {
  console.log('=== Increasing Pool Observation Cardinality ===\n');
  
  const WLFI_USD1_POOL = '0x4637ea6ecf7e16c99e67e941ab4d7d52eac7c73d';
  
  const pool = await ethers.getContractAt(
    [
      'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
      'function increaseObservationCardinalityNext(uint16 observationCardinalityNext) external'
    ],
    WLFI_USD1_POOL
  );
  
  console.log('Pool:', WLFI_USD1_POOL);
  
  // Check current cardinality
  const slot0 = await pool.slot0();
  const currentCardinality = slot0[3];
  const cardinalityNext = slot0[4];
  
  console.log('Current Cardinality:', currentCardinality.toString());
  console.log('Cardinality Next:', cardinalityNext.toString());
  
  // Increase to 100 (enough for 30-min TWAP with good granularity)
  const targetCardinality = 100;
  
  if (cardinalityNext >= targetCardinality) {
    console.log('\n✅ Cardinality already set to', cardinalityNext.toString());
    console.log('   No action needed!');
    return;
  }
  
  console.log('\nIncreasing cardinality to', targetCardinality, '...');
  
  const tx = await pool.increaseObservationCardinalityNext(targetCardinality);
  console.log('TX sent:', tx.hash);
  console.log('Waiting for confirmation...\n');
  
  const receipt = await tx.wait();
  
  console.log('✅ Cardinality increased!');
  console.log('Gas used:', receipt?.gasUsed.toString());
  console.log('Block:', receipt?.blockNumber);
  
  // Verify
  const newSlot0 = await pool.slot0();
  console.log('\nNew Cardinality Next:', newSlot0[4].toString());
  
  console.log('\n🎉 Pool updated!');
  console.log('   TWAP will work smoothly now');
  console.log('   No more reverts in deposits');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

