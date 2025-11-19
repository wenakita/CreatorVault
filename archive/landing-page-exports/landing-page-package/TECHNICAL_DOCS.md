# EagleOVaultComposerV2 - Production Documentation

## Overview

ComposerV2 enables seamless cross-chain redemption of EAGLE tokens for WLFI in a **single transaction** from Base to Ethereum and back.

**Production Address (Ethereum)**: `0x0c74174b5F04ec15d3Fb94D15Dc13c91fAc6C21F`

## Architecture

```
┌──────────┐                    ┌──────────────┐
│   Base   │ ──── EAGLE ────>  │  Ethereum    │
│          │                    │              │
│  User    │                    │  ComposerV2  │
│          │  <──── WLFI ─────  │              │
└──────────┘                    └──────────────┘

1 Transaction from Base → Entire flow → WLFI back to Base
```

## The Flow (Step-by-Step)

### User Initiates (Base Chain)
```typescript
// User sends 1 EAGLE from Base
eagleOFT.send({
  dstEid: ETHEREUM_EID,
  to: COMPOSER_ADDRESS,
  amountLD: 1e18,
  composeMsg: encodeComposeMessage(...)
})
```

### LayerZero Bridges (Base → Ethereum)
- EAGLE OFT on Base locks 1 EAGLE
- LayerZero relays message to Ethereum
- EAGLE OFT on Ethereum mints 1 EAGLE to ComposerV2

### ComposerV2 Executes (Ethereum)
1. **Receives `lzCompose` callback** from LayerZero Endpoint
2. **Unwraps EAGLE → vEAGLE**: Calls `EagleVaultWrapper.unwrap(1 EAGLE)`
   - Burns 1 EAGLE
   - Receives 0.98 vEAGLE shares (2% wrapper fee)
3. **Redeems vEAGLE → WLFI**: Calls `EagleOVault.redeem(0.98 vEAGLE)`
   - Burns 0.98 vEAGLE shares
   - Receives 0.000098 WLFI (due to 10,000x dilution)
4. **Bridges WLFI back**: Calls `WLFIAdapter.send()` to bridge WLFI to Base
5. **Emits `Sent` event** (or `Refunded` on failure)

### LayerZero Bridges (Ethereum → Base)
- WLFI Adapter on Ethereum locks WLFI
- LayerZero relays message to Base
- WLFI OFT on Base mints WLFI to user

### User Receives (Base Chain)
- User receives ~0.0001 WLFI on Base
- **Entire flow completed in 1 user transaction!**

## Important: 10,000x Vault Dilution

⚠️ **The EagleOVault is intentionally diluted by 10,000x.**

This was done to mint the full EAGLE token supply. As a result:

```
Vault Stats:
- Total Supply: 50,000,000 vEAGLE shares
- Total Assets: ~7,861 WLFI
- Share Price: 0.0001571 WLFI per vEAGLE share

Conversion:
1 EAGLE → 0.98 vEAGLE → 0.000098 WLFI (≈ 0.0001 WLFI)
```

**This is intentional and by design.** When using ComposerV2, always account for this 10,000x dilution factor in your slippage calculations.

## Usage Example

### TypeScript (ethers.js v5)

```typescript
import { ethers } from 'ethers'
import { Options } from '@layerzerolabs/lz-v2-utilities'

// Constants
const ETHEREUM_EID = 30101
const BASE_EID = 30184
const COMPOSER_ETH = '0x0c74174b5F04ec15d3Fb94D15Dc13c91fAc6C21F'
const EAGLE_OFT_BASE = '0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E'

// Amount to send
const amountToSend = ethers.utils.parseUnits('1', 18) // 1 EAGLE

// Expected WLFI output (accounting for 10,000x dilution)
// 1 EAGLE → 0.98 vEAGLE → 0.000098 WLFI
const expectedWLFI = ethers.utils.parseUnits('0.000098', 18)

// Slippage tolerance (50% = 0.000049 WLFI min)
const minWLFI = expectedWLFI.div(2)

// Build WLFI send param (for bridging WLFI back to Base)
const wlfiSendParam = {
  dstEid: BASE_EID,
  to: ethers.utils.hexZeroPad(userAddress, 32),
  amountLD: 0, // Filled by composer
  minAmountLD: minWLFI,
  extraOptions: '0x',
  composeMsg: '0x',
  oftCmd: '0x'
}

// Empty USD1 send param (disable USD1 send)
const usd1SendParam = {
  dstEid: 0,
  to: ethers.utils.hexZeroPad(ethers.constants.AddressZero, 32),
  amountLD: 0,
  minAmountLD: 0,
  extraOptions: '0x',
  composeMsg: '0x',
  oftCmd: '0x'
}

// Fee for WLFI bridge back to Base
const minMsgValue = ethers.utils.parseEther('0.0007')

// Encode inner compose message
const innerComposeMsg = ethers.utils.defaultAbiCoder.encode(
  [
    'uint256',
    'tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes)',
    'tuple(uint32,bytes32,uint256,uint256,bytes,bytes,bytes)',
    'uint256'
  ],
  [amountToSend, wlfiSendParam, usd1SendParam, minMsgValue]
)

// OFT requires: composeFrom (bytes32) + composeMsg (bytes)
const composeMsg = ethers.utils.solidityPack(
  ['bytes32', 'bytes'],
  [ethers.utils.hexZeroPad(userAddress, 32), innerComposeMsg]
)

// Build LayerZero options
const options = Options.newOptions()
  .addExecutorLzReceiveOption(200000, 0) // 200k gas for lzReceive
  .addExecutorComposeOption(0, 2000000, minMsgValue) // 2M gas + 0.0007 ETH for compose
  .toHex()

// Build send param
const sendParam = {
  dstEid: ETHEREUM_EID,
  to: ethers.utils.hexZeroPad(COMPOSER_ETH, 32),
  amountLD: amountToSend,
  minAmountLD: ethers.utils.parseUnits('0.98', 18), // 2% slippage on bridge
  extraOptions: options,
  composeMsg: composeMsg,
  oftCmd: '0x'
}

// Get fee quote
const [nativeFee] = await eagleOFT.quoteSend(sendParam, false)
const totalFee = nativeFee.add(minMsgValue)

// Send transaction
const tx = await eagleOFT.send(sendParam, { nativeFee, lzTokenFee: 0 }, userAddress, {
  value: totalFee
})

console.log('Transaction sent:', tx.hash)
console.log('Expected WLFI on Base:', ethers.utils.formatUnits(expectedWLFI, 18))
```

## Key Parameters

### Slippage Calculation

**CRITICAL**: Account for 10,000x dilution when setting `minAmountLD`!

```typescript
// ❌ WRONG (assumes 1:1 ratio)
const minAmountLD = ethers.utils.parseUnits('0.9', 18) // Will always revert!

// ✅ CORRECT (accounts for 10,000x dilution)
const minAmountLD = ethers.utils.parseUnits('0.00005', 18) // ~50% slippage on 0.0001 WLFI
```

### Gas Limits

- `lzReceive`: 200,000 gas (EAGLE minting on Ethereum)
- `lzCompose`: 2,000,000 gas (unwrap + redeem + bridge)

### Fees

- LayerZero Bridge Fee (Base → Ethereum): ~0.0012 ETH
- WLFI Bridge Fee (Ethereum → Base): ~0.0007 ETH
- **Total**: ~0.002 ETH per compose operation

## Error Handling

ComposerV2 has **automatic refund** on failure:

```solidity
try this.handleRedeemCompose{value: msg.value}(...) {
    emit Sent(_guid); // Success
} catch (bytes memory) {
    // Refund EAGLE on failure
    IERC20(SHARE_OFT).safeTransfer(composeSender, eagleAmount);
    emit Refunded(_guid); // Failure, EAGLE refunded
}
```

If any step fails (unwrap, redeem, or WLFI bridge), the user gets their **EAGLE back on Ethereum**.

## Events

### Success Flow
1. `ComposeSent` (Endpoint)
2. `ComposeDelivered` (Endpoint)
3. `Sent` (ComposerV2) ✅

### Failure Flow
1. `ComposeSent` (Endpoint)
2. `ComposeDelivered` (Endpoint)
3. `Refunded` (ComposerV2) ❌
4. `Transfer` (EAGLE refund to user)

## Security Features

1. **Access Control**: Only LayerZero Endpoint can call `lzCompose`
2. **Self-Call Protection**: `handleRedeemCompose` can only be called by the contract itself
3. **Slippage Protection**: User-defined minimum output amount
4. **Automatic Refund**: Try-catch ensures EAGLE is refunded on failure
5. **Peer Verification**: Only accepts messages from trusted EAGLE OFT on Base

## Contract Verification

All contracts are verified on Etherscan:

- ComposerV2: https://etherscan.io/address/0x0c74174b5F04ec15d3Fb94D15Dc13c91fAc6C21F
- EagleOVault: https://etherscan.io/address/0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953
- EagleVaultWrapper: https://etherscan.io/address/0x47dAc5063c526dBc6f157093DD1D62d9DE8891c5
- EAGLE OFT: https://etherscan.io/address/0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E
- WLFI Adapter: https://etherscan.io/address/0x2437F6555350c131647daA0C655c4B49A7aF3621

## Testing

Run the test script:

```bash
npx tsx scripts/testing/test-eagle-to-wlfi-compose.ts
```

Expected output:
- Transaction confirmed on Base
- EAGLE bridges to Ethereum (~5-15 min)
- Compose executes on Ethereum
- WLFI bridges back to Base (~5-15 min)
- User receives ~0.0001 WLFI on Base

## Monitoring

Track your transaction on LayerZero Scan:
https://layerzeroscan.com/

Look for:
1. `INFLIGHT` → Message being relayed
2. `DELIVERED` → Message delivered to Ethereum
3. `COMPOSE_DELIVERED` → Compose executed
4. `DELIVERED` (2nd) → WLFI delivered to Base

## Troubleshooting

### Transaction Reverts with `SlippageExceeded`
- **Cause**: `minAmountLD` too high for 10,000x dilution
- **Fix**: Lower `minAmountLD` to ~0.00005 WLFI

### `Refunded` Event Emitted
- **Cause**: Compose execution failed
- **Check**: LayerZero Scan for error details
- **Result**: EAGLE automatically refunded to your address on Ethereum

### WLFI Not Received on Base
- **Wait**: Cross-chain messages take 10-20 minutes
- **Check**: LayerZero Scan for message status
- **Verify**: WLFI balance on Base after completion

## Support

For issues or questions:
- Check LayerZero Scan for transaction status
- Review event logs on Etherscan
- Verify all peer configurations are correct

---

**Status**: Production Ready ✅  
**Version**: 1.0.0  
**Last Updated**: November 19, 2025

