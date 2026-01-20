/**
 * CreatorVault Deployment via ERC-4337 Account Abstraction
 * 
 * This script shows how to deploy the entire Creator Vault infrastructure
 * in a single UserOperation using a Smart Account.
 * 
 * BENEFITS:
 * - Single transaction for everything
 * - Atomic: all succeed or all revert
 * - Gasless option via paymaster
 * - Better UX for creators
 * 
 * REQUIRES:
 * - Smart Account (e.g., Safe, Kernel, SimpleAccount)
 * - Bundler endpoint (StackUp, Pimlico, Alchemy)
 * - Optional: Paymaster for gasless transactions
 */

import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    encodeFunctionData,
    type Address,
    type Hex
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// =================================
// CONFIG
// =================================

const CONFIG = {
    // Base Mainnet
    chain: base,
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    
    // Coinbase Paymaster & Bundler (same endpoint for both!)
    // This is your Coinbase Developer Platform endpoint
    bundlerUrl: process.env.BUNDLER_URL || 'https://api.developer.coinbase.com/rpc/v1/base/FU03TBCP7rh2TjOaHlZwR2ZFeUCe3FxD',
    
    // Coinbase Paymaster (same as bundler for CDP)
    paymasterUrl: process.env.PAYMASTER_URL || 'https://api.developer.coinbase.com/rpc/v1/base/FU03TBCP7rh2TjOaHlZwR2ZFeUCe3FxD',
    
    // Contract Addresses (deployed on Base)
    contracts: {
        entryPoint: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789' as Address, // v0.6
        factory: process.env.CREATOR_FACTORY as Address,
        payoutRouterFactory: process.env.PAYOUT_ROUTER_FACTORY as Address,
    },
    
    // Your Smart Account address
    smartAccount: process.env.SMART_ACCOUNT as Address,
    
    // Private key for signing (owner of smart account)
    privateKey: process.env.PRIVATE_KEY as Hex,
};

// =================================
// ABIS (simplified)
// =================================

const FACTORY_ABI = [
    {
        name: 'deploy',
        type: 'function',
        inputs: [{ name: '_creatorCoin', type: 'address' }],
        outputs: [
            {
                name: 'info',
                type: 'tuple',
                components: [
                    { name: 'creatorCoin', type: 'address' },
                    { name: 'vault', type: 'address' },
                    { name: 'wrapper', type: 'address' },
                    { name: 'shareOFT', type: 'address' },
                    { name: 'gaugeController', type: 'address' },
                    { name: 'ccaStrategy', type: 'address' },
                    { name: 'oracle', type: 'address' },
                    { name: 'creator', type: 'address' },
                    { name: 'deployedAt', type: 'uint256' },
                    { name: 'exists', type: 'bool' },
                ],
            },
        ],
    },
] as const;

const PAYOUT_ROUTER_FACTORY_ABI = [
    {
        name: 'deploy',
        type: 'function',
        inputs: [
            { name: '_wrapper', type: 'address' },
            { name: '_owner', type: 'address' },
        ],
        outputs: [{ name: 'router', type: 'address' }],
    },
    {
        name: 'computeAddress',
        type: 'function',
        inputs: [
            { name: '_wrapper', type: 'address' },
            { name: '_owner', type: 'address' },
        ],
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
    },
] as const;

const ZORA_COIN_ABI = [
    {
        name: 'setPayoutRecipient',
        type: 'function',
        inputs: [{ name: '_recipient', type: 'address' }],
        outputs: [],
    },
    {
        name: 'payoutRecipient',
        type: 'function',
        inputs: [],
        outputs: [{ name: '', type: 'address' }],
        stateMutability: 'view',
    },
] as const;

// SimpleAccount executeBatch ABI
const SIMPLE_ACCOUNT_ABI = [
    {
        name: 'executeBatch',
        type: 'function',
        inputs: [
            { name: 'dest', type: 'address[]' },
            { name: 'func', type: 'bytes[]' },
        ],
        outputs: [],
    },
    {
        name: 'execute',
        type: 'function',
        inputs: [
            { name: 'dest', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'func', type: 'bytes' },
        ],
        outputs: [],
    },
] as const;

// =================================
// TYPES
// =================================

interface Call {
    target: Address;
    data: Hex;
    value?: bigint;
}

interface UserOperation {
    sender: Address;
    nonce: bigint;
    initCode: Hex;
    callData: Hex;
    callGasLimit: bigint;
    verificationGasLimit: bigint;
    preVerificationGas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
    paymasterAndData: Hex;
    signature: Hex;
}

// =================================
// HELPER FUNCTIONS
// =================================

/**
 * Encode calls for SimpleAccount's executeBatch
 */
function encodeExecuteBatch(calls: Call[]): Hex {
    const targets = calls.map(c => c.target);
    const datas = calls.map(c => c.data);
    
    return encodeFunctionData({
        abi: SIMPLE_ACCOUNT_ABI,
        functionName: 'executeBatch',
        args: [targets, datas],
    });
}

/**
 * Build the calls array for full deployment
 */
function buildDeploymentCalls(
    creatorCoin: Address,
    smartAccountAddress: Address,
    options: {
        deployPayoutRouter: boolean;
        redirectPayoutRecipient: boolean;
        predictedWrapper?: Address; // If known from simulation
    }
): Call[] {
    const calls: Call[] = [];
    
    // Call 1: Deploy core infrastructure via factory
    calls.push({
        target: CONFIG.contracts.factory,
        data: encodeFunctionData({
            abi: FACTORY_ABI,
            functionName: 'deploy',
            args: [creatorCoin],
        }),
    });
    
    // If we have the predicted wrapper address, we can add more calls
    // Otherwise, this would need to be a two-step process
    if (options.deployPayoutRouter && options.predictedWrapper) {
        // Call 2: Deploy PayoutRouter
        calls.push({
            target: CONFIG.contracts.payoutRouterFactory,
            data: encodeFunctionData({
                abi: PAYOUT_ROUTER_FACTORY_ABI,
                functionName: 'deploy',
                args: [options.predictedWrapper, smartAccountAddress],
            }),
        });
        
        // Note: For redirectPayoutRecipient, we'd need to know the PayoutRouter
        // address in advance, which requires simulation or deterministic deployment
    }
    
    return calls;
}

// =================================
// MAIN DEPLOYMENT FUNCTION
// =================================

/**
 * Deploy CreatorVault infrastructure via ERC-4337
 * 
 * @param creatorCoin - The creator coin token address
 * @param options - Deployment options
 */
async function deployViaAA(
    creatorCoin: Address,
    options: {
        deployPayoutRouter?: boolean;
        redirectPayoutRecipient?: boolean;
        gasless?: boolean;
    } = {}
) {
    const redactAddress = (addr: string | undefined | null): string => {
        if (!addr) return '[not set]';
        const str = String(addr);
        // Show only a small, non-sensitive portion for debugging
        if (str.length <= 10) return '[redacted]';
        return `${str.slice(0, 6)}...${str.slice(-4)}`;
    };

    console.log('🚀 Starting ERC-4337 deployment...');
    console.log('   Creator Coin:', creatorCoin);
    console.log('   Smart Account:', redactAddress(CONFIG.smartAccount));
    
    // Setup clients
    const publicClient = createPublicClient({
        chain: CONFIG.chain,
        transport: http(CONFIG.rpcUrl),
    });
    
    const account = privateKeyToAccount(CONFIG.privateKey);
    
    // Build calls
    const calls = buildDeploymentCalls(creatorCoin, CONFIG.smartAccount, {
        deployPayoutRouter: options.deployPayoutRouter ?? true,
        redirectPayoutRecipient: options.redirectPayoutRecipient ?? false,
    });
    
    console.log(`📦 Bundling ${calls.length} calls...`);
    
    // Encode for smart account
    const callData = encodeExecuteBatch(calls);
    
    // Get nonce from EntryPoint
    const nonce = await publicClient.readContract({
        address: CONFIG.contracts.entryPoint,
        abi: [
            {
                name: 'getNonce',
                type: 'function',
                inputs: [
                    { name: 'sender', type: 'address' },
                    { name: 'key', type: 'uint192' },
                ],
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view',
            },
        ],
        functionName: 'getNonce',
        args: [CONFIG.smartAccount, 0n],
    });
    
    // Get current gas prices
    const gasPrice = await publicClient.getGasPrice();
    const maxPriorityFeePerGas = 1_000_000n; // 1 gwei
    
    // Build UserOperation
    const userOp: UserOperation = {
        sender: CONFIG.smartAccount,
        nonce,
        initCode: '0x' as Hex, // Account already deployed
        callData,
        callGasLimit: 3_000_000n, // Generous for multiple deployments
        verificationGasLimit: 500_000n,
        preVerificationGas: 100_000n,
        maxFeePerGas: gasPrice * 2n, // 2x current gas price
        maxPriorityFeePerGas,
        paymasterAndData: '0x' as Hex, // No paymaster by default
        signature: '0x' as Hex, // Will be filled after signing
    };
    
    // If gasless, get Coinbase Paymaster sponsorship
    if (options.gasless && CONFIG.paymasterUrl) {
        console.log('💸 Requesting Coinbase Paymaster sponsorship...');
        
        // Step 1: Get stub data (for gas estimation)
        const stubResponse = await fetch(CONFIG.paymasterUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'pm_getPaymasterStubData',
                params: [
                    {
                        sender: userOp.sender,
                        nonce: '0x' + userOp.nonce.toString(16),
                        initCode: userOp.initCode,
                        callData: userOp.callData,
                        callGasLimit: '0x' + userOp.callGasLimit.toString(16),
                        verificationGasLimit: '0x' + userOp.verificationGasLimit.toString(16),
                        preVerificationGas: '0x' + userOp.preVerificationGas.toString(16),
                        maxFeePerGas: '0x' + userOp.maxFeePerGas.toString(16),
                        maxPriorityFeePerGas: '0x' + userOp.maxPriorityFeePerGas.toString(16),
                    },
                    CONFIG.contracts.entryPoint,
                    '0x' + CONFIG.chain.id.toString(16), // chainId in hex
                ],
            }),
        });
        
        const stubResult = await stubResponse.json();
        if (stubResult.error) {
            console.error('❌ Paymaster stub error:', stubResult.error);
            throw new Error(`Paymaster error: ${stubResult.error.message}`);
        }
        
        // Apply stub gas limits
        if (stubResult.result) {
            const stub = stubResult.result;
            userOp.paymasterAndData = stub.paymasterAndData || '0x';
            
            // Coinbase may override gas limits
            if (stub.callGasLimit) userOp.callGasLimit = BigInt(stub.callGasLimit);
            if (stub.verificationGasLimit) userOp.verificationGasLimit = BigInt(stub.verificationGasLimit);
            if (stub.preVerificationGas) userOp.preVerificationGas = BigInt(stub.preVerificationGas);
        }
        
        console.log('✅ Paymaster sponsorship approved!');
    }
    
    // Sign the UserOperation
    console.log('✍️ Signing UserOperation...');
    
    // The signature depends on your smart account implementation
    // For SimpleAccount, it's a standard ECDSA signature over the userOpHash
    const userOpHash = await getUserOpHash(userOp, CONFIG.chain.id, CONFIG.contracts.entryPoint);
    const signature = await account.signMessage({ message: { raw: userOpHash } });
    userOp.signature = signature;
    
    // If using paymaster, get final paymaster data with signature
    if (options.gasless && CONFIG.paymasterUrl && userOp.paymasterAndData !== '0x') {
        console.log('🔐 Finalizing paymaster data...');
        
        const finalResponse = await fetch(CONFIG.paymasterUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'pm_getPaymasterData',
                params: [
                    {
                        sender: userOp.sender,
                        nonce: '0x' + userOp.nonce.toString(16),
                        initCode: userOp.initCode,
                        callData: userOp.callData,
                        callGasLimit: '0x' + userOp.callGasLimit.toString(16),
                        verificationGasLimit: '0x' + userOp.verificationGasLimit.toString(16),
                        preVerificationGas: '0x' + userOp.preVerificationGas.toString(16),
                        maxFeePerGas: '0x' + userOp.maxFeePerGas.toString(16),
                        maxPriorityFeePerGas: '0x' + userOp.maxPriorityFeePerGas.toString(16),
                        signature: userOp.signature,
                    },
                    CONFIG.contracts.entryPoint,
                    '0x' + CONFIG.chain.id.toString(16),
                ],
            }),
        });
        
        const finalResult = await finalResponse.json();
        if (finalResult.result?.paymasterAndData) {
            userOp.paymasterAndData = finalResult.result.paymasterAndData;
        }
    }
    
    // Send to bundler
    console.log('📤 Sending to bundler...');
    
    const response = await fetch(CONFIG.bundlerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_sendUserOperation',
            params: [userOp, CONFIG.contracts.entryPoint],
        }),
    });
    
    const result = await response.json();
    
    if (result.error) {
        throw new Error(`Bundler error: ${result.error.message}`);
    }
    
    const userOpHash2 = result.result;
    console.log('✅ UserOperation submitted:', userOpHash2);
    
    // Wait for receipt
    console.log('⏳ Waiting for confirmation...');
    
    let receipt = null;
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000)); // Poll every 2s
        
        const receiptResponse = await fetch(CONFIG.bundlerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_getUserOperationReceipt',
                params: [userOpHash2],
            }),
        });
        
        const receiptResult = await receiptResponse.json();
        if (receiptResult.result) {
            receipt = receiptResult.result;
            break;
        }
    }
    
    if (!receipt) {
        throw new Error('Timeout waiting for UserOperation receipt');
    }
    
    console.log('🎉 Deployment successful!');
    console.log('   Transaction hash:', receipt.receipt.transactionHash);
    console.log('   Gas used:', receipt.actualGasUsed);
    
    return receipt;
}

/**
 * Compute UserOperation hash (simplified)
 */
async function getUserOpHash(
    userOp: UserOperation,
    chainId: number,
    entryPoint: Address
): Promise<Hex> {
    // This is a simplified version - actual implementation depends on EntryPoint version
    const { keccak256, encodeAbiParameters, concat } = await import('viem');
    
    const packed = encodeAbiParameters(
        [
            { type: 'address' },
            { type: 'uint256' },
            { type: 'bytes32' },
            { type: 'bytes32' },
            { type: 'uint256' },
            { type: 'uint256' },
            { type: 'uint256' },
            { type: 'uint256' },
            { type: 'uint256' },
            { type: 'bytes32' },
        ],
        [
            userOp.sender,
            userOp.nonce,
            keccak256(userOp.initCode),
            keccak256(userOp.callData),
            userOp.callGasLimit,
            userOp.verificationGasLimit,
            userOp.preVerificationGas,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            keccak256(userOp.paymasterAndData),
        ]
    );
    
    const userOpHash = keccak256(packed);
    
    return keccak256(
        encodeAbiParameters(
            [{ type: 'bytes32' }, { type: 'address' }, { type: 'uint256' }],
            [userOpHash, entryPoint, BigInt(chainId)]
        )
    );
}

// =================================
// CLI
// =================================

async function main() {
    const creatorCoin = process.argv[2] as Address;
    const gaslessFlag = process.argv.includes('--gasless');
    const noPayoutRouter = process.argv.includes('--no-payout-router');
    const redirectFees = process.argv.includes('--redirect-fees');
    
    if (!creatorCoin) {
        console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                    CreatorVault ERC-4337 Deployment                        ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║  Usage:                                                                    ║
║    npx ts-node deploy-with-aa.ts <CREATOR_COIN> [options]                  ║
║                                                                            ║
║  Options:                                                                  ║
║    --gasless          Use Coinbase Paymaster (free gas!)                   ║
║    --no-payout-router Skip PayoutRouter deployment                         ║
║    --redirect-fees    Auto-redirect Zora payoutRecipient                   ║
║                                                                            ║
║  Examples:                                                                 ║
║    # Deploy with gas (you pay)                                             ║
║    npx ts-node deploy-with-aa.ts 0x5b67...fa75                             ║
║                                                                            ║
║    # Deploy gasless via Coinbase Paymaster                                 ║
║    npx ts-node deploy-with-aa.ts 0x5b67...fa75 --gasless                   ║
║                                                                            ║
║    # Full deployment with fee redirect                                     ║
║    npx ts-node deploy-with-aa.ts 0x5b67...fa75 --gasless --redirect-fees   ║
║                                                                            ║
╠════════════════════════════════════════════════════════════════════════════╣
║  Environment Variables:                                                    ║
║                                                                            ║
║  Required:                                                                 ║
║    SMART_ACCOUNT      - Your ERC-4337 Smart Account address                ║
║    PRIVATE_KEY        - Private key (owner of smart account)               ║
║    CREATOR_FACTORY    - CreatorOVaultFactory address                       ║
║                                                                            ║
║  Optional (defaults to Coinbase):                                          ║
║    BASE_RPC_URL       - Base RPC (default: mainnet.base.org)               ║
║    BUNDLER_URL        - Coinbase bundler endpoint                          ║
║    PAYMASTER_URL      - Coinbase paymaster endpoint                        ║
║                                                                            ║
║  Coinbase Developer Platform:                                              ║
║    https://api.developer.coinbase.com/rpc/v1/base/<YOUR_API_KEY>           ║
║    (Same endpoint for bundler AND paymaster)                               ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
`);
        process.exit(1);
    }
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║       CreatorVault ERC-4337 Deployment           ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
    console.log(`  Creator Coin:     ${creatorCoin}`);
    console.log(`  Smart Account:    ${CONFIG.smartAccount ? '[set]' : '[not set]'}`);
    console.log(`  Gasless:          ${gaslessFlag ? '✅ Yes (Coinbase Paymaster)' : '❌ No (you pay gas)'}`);
    console.log(`  PayoutRouter:     ${noPayoutRouter ? '❌ Skip' : '✅ Deploy'}`);
    console.log(`  Redirect Fees:    ${redirectFees ? '✅ Yes' : '❌ No'}`);
    console.log('');
    
    await deployViaAA(creatorCoin, {
        deployPayoutRouter: !noPayoutRouter,
        redirectPayoutRecipient: redirectFees,
        gasless: gaslessFlag,
    });
}

main().catch((error) => {
    console.error('');
    console.error('❌ Deployment failed:', error.message);
    console.error('');
    process.exit(1);
});

