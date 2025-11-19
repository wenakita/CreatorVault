# Eagle Protocol - Contract Addresses

## Mainnet Deployments

### Base (Primary Hub - Chain ID: 8453)

| Contract | Address | Explorer |
|----------|---------|----------|
| **Eagle OFT** | `0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E` | [View on Basescan](https://basescan.org/address/0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E) |
| **WLFI OFT** | `0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e` | [View on Basescan](https://basescan.org/address/0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e) |
| **LayerZero Endpoint** | `0x1a44076050125825900e736c501f859c50fe728c` | [View on Basescan](https://basescan.org/address/0x1a44076050125825900e736c501f859c50fe728c) |

### Ethereum (Chain ID: 1)

| Contract | Address | Explorer |
|----------|---------|----------|
| **Eagle OFT** | `0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E` | [View on Etherscan](https://etherscan.io/address/0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E) |
| **WLFI Adapter** | `0x2437F6555350c131647daA0C655c4B49A7aF3621` | [View on Etherscan](https://etherscan.io/address/0x2437F6555350c131647daA0C655c4B49A7aF3621) |
| **WLFI Token** | `0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6` | [View on Etherscan](https://etherscan.io/address/0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6) |
| **ComposerV2** | `0x0c74174b5F04ec15d3Fb94D15Dc13c91fAc6C21F` | [View on Etherscan](https://etherscan.io/address/0x0c74174b5F04ec15d3Fb94D15Dc13c91fAc6C21F) |
| **EagleOVault** | `0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953` | [View on Etherscan](https://etherscan.io/address/0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953) |
| **EagleVaultWrapper** | `0x47dAc5063c526dBc6f157093DD1D62d9DE8891c5` | [View on Etherscan](https://etherscan.io/address/0x47dAc5063c526dBc6f157093DD1D62d9DE8891c5) |
| **EagleRegistry** | `0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e` | [View on Etherscan](https://etherscan.io/address/0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e) |
| **LayerZero Endpoint** | `0x1a44076050125825900e736c501f859c50fe728c` | [View on Etherscan](https://etherscan.io/address/0x1a44076050125825900e736c501f859c50fe728c) |

### BNB Chain (Chain ID: 56)

| Contract | Address | Explorer |
|----------|---------|----------|
| **Eagle OFT** | `0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E` | [View on BscScan](https://bscscan.com/address/0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E) |
| **WLFI Adapter** | `0x2437F6555350c131647daA0C655c4B49A7aF3621` | [View on BscScan](https://bscscan.com/address/0x2437F6555350c131647daA0C655c4B49A7aF3621) |
| **LayerZero Endpoint** | `0x1a44076050125825900e736c501f859c50fe728c` | [View on BscScan](https://bscscan.com/address/0x1a44076050125825900e736c501f859c50fe728c) |

### Solana

| Contract | Address | Explorer |
|----------|---------|----------|
| **Eagle OFT** | (Solana Program ID) | [View on Solscan]() |
| **WLFI OFT** | (Solana Program ID) | [View on Solscan]() |

---

## LayerZero Configuration

### Endpoint IDs (EIDs)

| Chain | EID | Endpoint Address |
|-------|-----|------------------|
| Ethereum | `30101` | `0x1a44076050125825900e736c501f859c50fe728c` |
| Base | `30184` | `0x1a44076050125825900e736c501f859c50fe728c` |
| BNB Chain | `30102` | `0x1a44076050125825900e736c501f859c50fe728c` |
| Solana | `30168` | (Solana Program) |

### DVN Verification

All cross-chain messages are verified by **2 DVNs**:

1. **LayerZero Labs DVN**
   - Ethereum: `0x589dedbd617e0cbcb916a9223f4d1300c294236b`
   - Base: `0x9e059a54699a285714207b43b055483e78faac25`
   - BNB: `0x2e1e0256c14c5e2c5441379f8d6557d0218b7c7c`

2. **Google Cloud DVN**
   - Ethereum: `0xd56e4eab23cb81f43168f9f45211eb027b9ac7cc`
   - Base: `0xd56e4eab23cb81f43168f9f45211eb027b9ac7cc`
   - BNB: `0xd56e4eab23cb81f43168f9f45211eb027b9ac7cc`

---

## Quick Copy

### For Landing Page Implementation

```javascript
// Contract addresses for frontend integration
const CONTRACTS = {
  ethereum: {
    eagleOFT: '0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E',
    wlfiAdapter: '0x2437F6555350c131647daA0C655c4B49A7aF3621',
    composerV2: '0x0c74174b5F04ec15d3Fb94D15Dc13c91fAc6C21F',
    vault: '0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953',
    wrapper: '0x47dAc5063c526dBc6f157093DD1D62d9DE8891c5'
  },
  base: {
    eagleOFT: '0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E',
    wlfiOFT: '0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e'
  },
  bnb: {
    eagleOFT: '0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E',
    wlfiAdapter: '0x2437F6555350c131647daA0C655c4B49A7aF3621'
  },
  solana: {
    eagleOFT: 'SOLANA_PROGRAM_ID_HERE',
    wlfiOFT: 'SOLANA_PROGRAM_ID_HERE'
  }
}

const EXPLORERS = {
  ethereum: 'https://etherscan.io',
  base: 'https://basescan.org',
  bnb: 'https://bscscan.com',
  solana: 'https://solscan.io'
}

const CHAIN_IDS = {
  ethereum: 1,
  base: 8453,
  bnb: 56,
  solana: 'mainnet-beta'
}

const LAYER_ZERO_EIDS = {
  ethereum: 30101,
  base: 30184,
  bnb: 30102,
  solana: 30168
}
```

---

## For Copyable Address Blocks

### Eagle OFT (Same on all EVM chains)
```
0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E
```

### WLFI OFT (Base)
```
0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e
```

### WLFI Adapter (Ethereum & BNB)
```
0x2437F6555350c131647daA0C655c4B49A7aF3621
```

### ComposerV2 (Ethereum only)
```
0x0c74174b5F04ec15d3Fb94D15Dc13c91fAc6C21F
```

---

## Verification Links

### Etherscan Verified Contracts
- [Eagle OFT](https://etherscan.io/address/0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E#code)
- [WLFI Adapter](https://etherscan.io/address/0x2437F6555350c131647daA0C655c4B49A7aF3621#code)
- [ComposerV2](https://etherscan.io/address/0x0c74174b5F04ec15d3Fb94D15Dc13c91fAc6C21F#code)
- [EagleOVault](https://etherscan.io/address/0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953#code)

### Basescan Verified Contracts
- [Eagle OFT](https://basescan.org/address/0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E#code)
- [WLFI OFT](https://basescan.org/address/0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e#code)

### BscScan Verified Contracts
- [Eagle OFT](https://bscscan.com/address/0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E#code)
- [WLFI Adapter](https://bscscan.com/address/0x2437F6555350c131647daA0C655c4B49A7aF3621#code)

---

## LayerZero Scan

Track any cross-chain transaction:
https://layerzeroscan.com/

---

## Important Notes

1. **Same Address Benefit**: Eagle OFT uses the same address (`0x474e...A91E`) on all EVM chains for easy verification
2. **WLFI Adapters**: Use the same address on Ethereum and BNB for consistency
3. **All contracts verified**: Users can verify source code on respective block explorers
4. **LayerZero V2**: All OFTs use the latest LayerZero V2 protocol

---

**Last Updated**: November 19, 2025  
**Status**: Production ✅

