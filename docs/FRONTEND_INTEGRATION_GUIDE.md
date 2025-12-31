# 🎨 **FRONTEND INTEGRATION GUIDE**

## 📋 **OVERVIEW**

This guide shows how to integrate the CreatorVault platform into your frontend.

**Tech Stack:**
- React/Next.js
- Wagmi v2
- Viem v2
- Biconomy SDK (Account Abstraction)
- TypeScript

---

## 🔧 **CONTRACT ADDRESSES**

```typescript
// contracts.ts
export const CONTRACTS = {
  // ✅ Deployed
  VAULT_ACTIVATION_BATCHER: '0x6d796554698f5Ddd74Ff20d745304096aEf93CB6',
  
  // 🔨 Deploy next
  CREATOR_VAULT_FACTORY: '<YOUR_FACTORY_ADDRESS>',
  STRATEGY_DEPLOYMENT_BATCHER: '<PENDING>',
} as const;
```

---

## 🎯 **COMPONENT 1: CREATE VAULT**

```typescript
// components/CreateVaultButton.tsx
import { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseAbiItem } from 'viem';
import { CONTRACTS } from '@/lib/contracts';
import { CreatorVaultFactoryABI } from '@/lib/abis';

export function CreateVaultButton() {
  const { address } = useAccount();
  const [tokenAddress, setTokenAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [vaultInfo, setVaultInfo] = useState<any>(null);
  
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  async function createVault() {
    if (!tokenAddress || !address) return;
    
    setIsLoading(true);
    try {
      // Call factory to deploy vault infrastructure
      await writeContract({
        address: CONTRACTS.CREATOR_VAULT_FACTORY,
        abi: CreatorVaultFactoryABI,
        functionName: 'deployCreatorVaultAuto',
        args: [tokenAddress, address],
      });
      
      // Wait for transaction and parse events
      // ... (see event parsing below)
      
    } catch (error) {
      console.error('Failed to create vault:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Token Address (e.g., 0x...)"
        value={tokenAddress}
        onChange={(e) => setTokenAddress(e.target.value)}
        className="w-full p-3 border rounded"
      />
      
      <button
        onClick={createVault}
        disabled={!tokenAddress || isLoading || isConfirming}
        className="w-full bg-blue-600 text-white p-3 rounded font-bold"
      >
        {isLoading || isConfirming ? 'Creating Vault...' : '🚀 Create Vault'}
      </button>
      
      {vaultInfo && (
        <div className="p-4 bg-green-100 rounded">
          <p className="font-bold">✅ Vault Created!</p>
          <p className="text-sm">Vault: {vaultInfo.vault}</p>
          <p className="text-sm">Wrapper: {vaultInfo.wrapper}</p>
          <p className="text-sm">wsToken: {vaultInfo.shareOFT}</p>
        </div>
      )}
    </div>
  );
}
```

---

## 📊 **PARSING DEPLOYMENT EVENTS**

```typescript
// lib/parseDeploymentEvent.ts
import { parseAbiItem, decodeEventLog } from 'viem';
import { publicClient } from '@/lib/wagmi';

export async function parseDeploymentEvent(txHash: `0x${string}`) {
  const receipt = await publicClient.waitForTransactionReceipt({ 
    hash: txHash 
  });
  
  // Find VaultInfrastructureDeployed event
  const eventAbi = parseAbiItem(
    'event VaultInfrastructureDeployed(address indexed creatorCoin, address indexed vault, address wrapper, address shareOFT, address gaugeController, address ccaStrategy, address creator)'
  );
  
  const log = receipt.logs.find(log => {
    try {
      const decoded = decodeEventLog({
        abi: [eventAbi],
        data: log.data,
        topics: log.topics,
      });
      return decoded.eventName === 'VaultInfrastructureDeployed';
    } catch {
      return false;
    }
  });
  
  if (!log) throw new Error('Deployment event not found');
  
  const decoded = decodeEventLog({
    abi: [eventAbi],
    data: log.data,
    topics: log.topics,
  });
  
  return {
    creatorCoin: decoded.args.creatorCoin,
    vault: decoded.args.vault,
    wrapper: decoded.args.wrapper,
    shareOFT: decoded.args.shareOFT,
    gaugeController: decoded.args.gaugeController,
    ccaStrategy: decoded.args.ccaStrategy,
    creator: decoded.args.creator,
  };
}
```

---

## 🎯 **COMPONENT 2: LAUNCH CCA**

```typescript
// components/LaunchCCAButton.tsx
import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits } from 'viem';
import { CONTRACTS } from '@/lib/contracts';
import { VaultActivationBatcherABI } from '@/lib/abis';

interface LaunchCCAProps {
  creatorToken: string;
  vault: string;
  wrapper: string;
  ccaStrategy: string;
}

export function LaunchCCAButton({ 
  creatorToken, 
  vault, 
  wrapper, 
  ccaStrategy 
}: LaunchCCAProps) {
  const [depositAmount, setDepositAmount] = useState('');
  const [auctionPercent, setAuctionPercent] = useState(69);
  const [requiredRaise, setRequiredRaise] = useState('');
  
  const { writeContract, data: hash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  async function launchCCA() {
    try {
      await writeContract({
        address: CONTRACTS.VAULT_ACTIVATION_BATCHER,
        abi: VaultActivationBatcherABI,
        functionName: 'batchActivate',
        args: [
          creatorToken,
          vault,
          wrapper,
          ccaStrategy,
          parseUnits(depositAmount, 18),  // Assuming 18 decimals
          auctionPercent,
          parseEther(requiredRaise),
        ],
      });
    } catch (error) {
      console.error('Failed to launch CCA:', error);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Deposit Amount
        </label>
        <input
          type="text"
          placeholder="e.g., 50000000"
          value={depositAmount}
          onChange={(e) => setDepositAmount(e.target.value)}
          className="w-full p-3 border rounded"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">
          Auction % (amount to auction)
        </label>
        <input
          type="number"
          min="1"
          max="100"
          value={auctionPercent}
          onChange={(e) => setAuctionPercent(Number(e.target.value))}
          className="w-full p-3 border rounded"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium mb-2">
          Required Raise (ETH)
        </label>
        <input
          type="text"
          placeholder="e.g., 10"
          value={requiredRaise}
          onChange={(e) => setRequiredRaise(e.target.value)}
          className="w-full p-3 border rounded"
        />
      </div>
      
      <button
        onClick={launchCCA}
        disabled={!depositAmount || !requiredRaise || isConfirming}
        className="w-full bg-purple-600 text-white p-3 rounded font-bold"
      >
        {isConfirming ? 'Launching...' : '🎉 Launch CCA'}
      </button>
    </div>
  );
}
```

---

## 🤖 **ACCOUNT ABSTRACTION INTEGRATION**

### **Setup Biconomy**

```typescript
// lib/smartAccount.ts
import { createSmartAccountClient } from '@biconomy/account';
import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';

export async function createSmartAccount(owner: `0x${string}`) {
  const bundlerUrl = process.env.NEXT_PUBLIC_BICONOMY_BUNDLER_URL!;
  const paymasterUrl = process.env.NEXT_PUBLIC_BICONOMY_PAYMASTER_URL!;
  
  const walletClient = createWalletClient({
    account: owner,
    chain: base,
    transport: http(),
  });
  
  const smartAccount = await createSmartAccountClient({
    signer: walletClient,
    bundlerUrl,
    biconomyPaymasterApiKey: paymasterUrl,
  });
  
  return smartAccount;
}
```

### **One-Click Vault Creation with AA**

```typescript
// components/CreateVaultAA.tsx
import { useState } from 'react';
import { useAccount } from 'wagmi';
import { encodeFunctionData } from 'viem';
import { createSmartAccount } from '@/lib/smartAccount';
import { CONTRACTS } from '@/lib/contracts';
import { CreatorVaultFactoryABI } from '@/lib/abis';

export function CreateVaultAA() {
  const { address } = useAccount();
  const [tokenAddress, setTokenAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function createVaultWithAA() {
    if (!address || !tokenAddress) return;
    
    setIsLoading(true);
    try {
      // Create smart account
      const smartAccount = await createSmartAccount(address);
      
      // Encode function call
      const data = encodeFunctionData({
        abi: CreatorVaultFactoryABI,
        functionName: 'deployCreatorVaultAuto',
        args: [tokenAddress, smartAccount.address],
      });
      
      // Send transaction (gasless!)
      const userOpResponse = await smartAccount.sendTransaction({
        to: CONTRACTS.CREATOR_VAULT_FACTORY,
        data,
      });
      
      const receipt = await userOpResponse.wait();
      console.log('Vault created:', receipt);
      
      // Parse events to get addresses
      // ...
      
    } catch (error) {
      console.error('Failed to create vault:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Token Address"
        value={tokenAddress}
        onChange={(e) => setTokenAddress(e.target.value)}
        className="w-full p-3 border rounded"
      />
      
      <button
        onClick={createVaultWithAA}
        disabled={!tokenAddress || isLoading}
        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 rounded font-bold"
      >
        {isLoading ? 'Creating...' : '✨ Create Vault (Gasless!)'}
      </button>
    </div>
  );
}
```

### **Deploy + Launch in ONE Signature**

```typescript
// lib/deployAndLaunch.ts
import { encodeFunctionData } from 'viem';
import { createSmartAccount } from './smartAccount';
import { CONTRACTS } from './contracts';
import { 
  CreatorVaultFactoryABI, 
  VaultActivationBatcherABI,
  erc20Abi 
} from './abis';

export async function deployAndLaunchVaultAtomic(
  owner: `0x${string}`,
  tokenAddress: `0x${string}`,
  depositAmount: bigint,
  auctionPercent: number,
  requiredRaise: bigint
) {
  const smartAccount = await createSmartAccount(owner);
  
  // Predict addresses (or read from event in next tx)
  // For simplicity, we'll do this in two batches:
  
  // BATCH 1: Deploy vault
  const deployData = encodeFunctionData({
    abi: CreatorVaultFactoryABI,
    functionName: 'deployCreatorVaultAuto',
    args: [tokenAddress, smartAccount.address],
  });
  
  const deployResponse = await smartAccount.sendTransaction({
    to: CONTRACTS.CREATOR_VAULT_FACTORY,
    data: deployData,
  });
  
  const receipt = await deployResponse.wait();
  const { vault, wrapper, ccaStrategy } = parseDeploymentEvent(receipt.receipt.transactionHash);
  
  // BATCH 2: Approve + Launch
  const approveTx = {
    to: tokenAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [CONTRACTS.VAULT_ACTIVATION_BATCHER, depositAmount],
    }),
  };
  
  const launchTx = {
    to: CONTRACTS.VAULT_ACTIVATION_BATCHER,
    data: encodeFunctionData({
      abi: VaultActivationBatcherABI,
      functionName: 'batchActivate',
      args: [
        tokenAddress,
        vault,
        wrapper,
        ccaStrategy,
        depositAmount,
        auctionPercent,
        requiredRaise,
      ],
    }),
  };
  
  // Send both in one batch
  const batchResponse = await smartAccount.sendTransaction([approveTx, launchTx]);
  await batchResponse.wait();
  
  return { vault, wrapper, ccaStrategy };
}
```

---

## 📱 **COMPLETE FLOW COMPONENT**

```typescript
// components/CreateVaultFlow.tsx
import { useState } from 'react';
import { CreateVaultButton } from './CreateVaultButton';
import { LaunchCCAButton } from './LaunchCCAButton';

export function CreateVaultFlow() {
  const [step, setStep] = useState<'create' | 'launch' | 'complete'>('create');
  const [vaultInfo, setVaultInfo] = useState<any>(null);

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className={`flex-1 text-center ${step === 'create' ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
            1. Create Vault
          </div>
          <div className={`flex-1 text-center ${step === 'launch' ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
            2. Launch CCA
          </div>
          <div className={`flex-1 text-center ${step === 'complete' ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>
            3. Complete
          </div>
        </div>
        <div className="w-full bg-gray-200 h-2 rounded-full mt-4">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ 
              width: step === 'create' ? '33%' : step === 'launch' ? '66%' : '100%' 
            }}
          />
        </div>
      </div>

      {step === 'create' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4">Step 1: Create Your Vault</h2>
          <p className="text-gray-600 mb-6">
            Deploy your vault infrastructure in one transaction.
          </p>
          <CreateVaultButton
            onSuccess={(info) => {
              setVaultInfo(info);
              setStep('launch');
            }}
          />
        </div>
      )}

      {step === 'launch' && vaultInfo && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4">Step 2: Launch Your CCA</h2>
          <p className="text-gray-600 mb-6">
            Configure and launch your 7-day Continuous Clearing Auction.
          </p>
          <LaunchCCAButton
            {...vaultInfo}
            onSuccess={() => setStep('complete')}
          />
        </div>
      )}

      {step === 'complete' && (
        <div className="bg-green-100 p-6 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">🎉 Vault Launched!</h2>
          <p className="text-gray-800 mb-4">
            Your CCA is now live for 7 days. Users can bid on your auction.
          </p>
          <a 
            href={`/auction/${vaultInfo.ccaStrategy}`}
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded font-bold"
          >
            View Auction
          </a>
        </div>
      )}
    </div>
  );
}
```

---

## 🎯 **DEPLOYMENT CHECKLIST**

- [ ] Deploy CreatorVaultFactory
- [ ] Update frontend with factory address
- [ ] Implement CreateVaultButton component
- [ ] Implement LaunchCCAButton component
- [ ] Add event parsing logic
- [ ] Test on testnet
- [ ] (Optional) Add Account Abstraction
- [ ] Deploy to production

---

## 📚 **EXAMPLE ABIS**

```typescript
// lib/abis.ts
export const CreatorVaultFactoryABI = [
  {
    type: 'function',
    name: 'deployCreatorVaultAuto',
    inputs: [
      { name: '_creatorCoin', type: 'address' },
      { name: '_creator', type: 'address' },
    ],
    outputs: [
      { name: 'vault', type: 'address' },
      { name: 'wrapper', type: 'address' },
      { name: 'shareOFT', type: 'address' },
      { name: 'gaugeController', type: 'address' },
      { name: 'ccaStrategy', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  // ... other functions
] as const;

export const VaultActivationBatcherABI = [
  {
    type: 'function',
    name: 'batchActivate',
    inputs: [
      { name: 'creatorToken', type: 'address' },
      { name: 'vault', type: 'address' },
      { name: 'wrapper', type: 'address' },
      { name: 'ccaStrategy', type: 'address' },
      { name: 'depositAmount', type: 'uint256' },
      { name: 'auctionPercent', type: 'uint8' },
      { name: 'requiredRaise', type: 'uint128' },
    ],
    outputs: [
      { name: 'auction', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
] as const;
```

---

## 🚀 **READY TO BUILD!**

You now have everything you need to build a complete frontend for CreatorVault!

**Questions? Need help implementing?** Just ask! 🎯

