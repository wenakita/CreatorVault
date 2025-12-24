/*
 * Example: Create and send a bundled ERC‑4337 UserOperation on the Base network
 *
 * This script shows how to use the StackUp `useropjs` library together with
 * EthersJS to assemble a smart‑contract account (Smart Account) transaction that
 * performs multiple actions in a single UserOperation.  The flow follows the
 * typical steps defined in the account‑abstraction documentation: construct a
 * partial user operation (sender, nonce, initCode, callData), estimate gas,
 * populate gas and fee fields, sign the operation and send it to a bundler
 * using the `eth_sendUserOperation` RPC method【891604300495144†L72-L99】.  A bundler
 * collects these operations and submits them to the EntryPoint contract’s
 * `handleOps()` function【262067579972891†L96-L117】.  The example below uses
 * `approve` and `swap` calls as placeholders; you should replace the
 * addresses, amounts and call parameters with values appropriate to your use case.
 *
 * To run this example you need Node.js v18+ and must install the following
 * dependencies in your project:
 *   npm install ethers@5.0.5 useropjs
 * The versions mirror the GoldRush example which notes that the BaseWallet
 * object in ethers v6 causes issues with StackUp【10929386761584†L152-L155】.
 *
 * SECURITY WARNING: Never hard‑code your real private keys in code.  Use
 * environment variables or a secure secret manager instead.  This script is
 * provided for educational purposes; always test on a test network first.
 */

const { ethers } = require('ethers');
const { Client, Presets } = require('userop');

// -----------------------------------------------------------------------------
// Configuration
//
// Replace the placeholder values below with your own configuration.  You can
// optionally define environment variables (RPC_URL, SIGNING_KEY, BUNDLER_URL)
// when running this script to avoid embedding sensitive information in the
// source code.
//
const RPC_URL = process.env.RPC_URL || '<YOUR_BASE_RPC_URL>'; // Base or other ERC‑4337 network RPC
const SIGNING_KEY = process.env.SIGNING_KEY || '<YOUR_PRIVATE_KEY>'; // EOA key that owns the smart account
const BUNDLER_URL = process.env.BUNDLER_URL || '<BUNDLER_RPC_URL>'; // Bundler RPC endpoint from StackUp/Pimlico/etc.

// EntryPoint on Base.  The transaction we analysed interacted with the
// EntryPoint 0.6.0 contract at this address【129826219303957†screenshot】.
const ENTRY_POINT_ADDRESS = '0x5ff137d4b0fdcd49dca30c7cf575e7382026d2789';

// Token and router addresses for your use case.  In the analysed transaction
// multiple ERC‑20 tokens were swapped via Uniswap V4’s Universal Router.  Here
// we show how to approve a token and then call a swap function.  Replace
// TOKEN_IN_ADDRESS with the ERC‑20 you wish to spend, TOKEN_OUT_ADDRESS with
// the asset you want to receive and ROUTER_ADDRESS with the router contract.
const TOKEN_IN_ADDRESS = '<TOKEN_IN_ADDRESS>';   // e.g., WETH address on Base
const TOKEN_OUT_ADDRESS = '<TOKEN_OUT_ADDRESS>'; // e.g., another ERC‑20 token
const ROUTER_ADDRESS = '<UNISWAP_ROUTER_ADDRESS>'; // Uniswap V4 universal router on Base
const SWAP_FEE = 500; // pool fee (e.g., 500 = 0.05%). Adjust as needed.

// Recipient address for the output of the swap.  This can be your smart account
// or another address.  During our analysis the universal router forwarded
// amounts to pool contracts【535641728110427†screenshot】; here we specify a simple
// recipient.
const RECIPIENT_ADDRESS = '<RECIPIENT_ADDRESS>';

// Amount of the input token to swap.  Set as a string without decimals; the
// script converts it to the correct unit using the token’s decimals.
const AMOUNT_IN_STRING = '10';

// -----------------------------------------------------------------------------
// Helper function to encode the swap call.  This example encodes the
// `exactInputSingle` function of Uniswap V3/V4 routers.  Consult the router’s
// ABI if you need to call a different method.  The function takes a tuple
// describing the trade (tokenIn, tokenOut, fee, recipient, amountIn,
// amountOutMinimum, sqrtPriceLimitX96).
const ROUTER_ABI = [
  'function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) external payable returns (uint256)'
];

const ERC20_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function decimals() view returns (uint8)'
];

async function main() {
  // Step 1: Initialize provider and signer
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(SIGNING_KEY, provider);

  // Step 2: Initialise a Smart Account builder.  The StackUp SDK uses the
  // `Presets.Builder.Kernel` or `SimpleAccount` classes to create smart
  // contract accounts.  In this example we use the Kernel preset because it
  // exposes an `executeBatch` method for bundling multiple calls【10929386761584†L343-L350】.
  const builder = await Presets.Builder.Kernel.init(signer, RPC_URL);
  const smartAccountAddress = builder.getSender();
  console.log(`Smart account address: ${smartAccountAddress}`);

  // Step 3: Prepare the approve and swap calls.  First determine the token’s
  // decimals so that we can convert the human‑readable amount to base units.
  const erc20 = new ethers.Contract(TOKEN_IN_ADDRESS, ERC20_ABI, provider);
  const decimals = await erc20.decimals();
  const amountIn = ethers.utils.parseUnits(AMOUNT_IN_STRING, decimals);

  // Encode approve call: allow the router to spend our token.  Without this
  // approval, the router cannot transfer tokens from the smart account.  The
  // GoldRush guide explains that approve and transfer calls can be bundled into
  // one UserOperation using `executeBatch`【10929386761584†L319-L317】.
  const approveCalldata = erc20.interface.encodeFunctionData('approve', [ROUTER_ADDRESS, amountIn]);
  const approveCall = {
    to: TOKEN_IN_ADDRESS,
    value: ethers.constants.Zero,
    data: approveCalldata
  };

  // Encode swap call using the router.  We set `amountOutMinimum` to 0 and
  // `sqrtPriceLimitX96` to 0 so the trade executes at the prevailing price; adjust
  // these for slippage control.
  const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, provider);
  const swapParams = {
    tokenIn: TOKEN_IN_ADDRESS,
    tokenOut: TOKEN_OUT_ADDRESS,
    fee: SWAP_FEE,
    recipient: RECIPIENT_ADDRESS,
    amountIn: amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0
  };
  const swapCalldata = router.interface.encodeFunctionData('exactInputSingle', [Object.values(swapParams)]);
  const swapCall = {
    to: ROUTER_ADDRESS,
    value: ethers.constants.Zero,
    data: swapCalldata
  };

  // Step 4: Batch the calls.  Using the builder, we append the approve and
  // swap operations.  The builder will store the calls internally until the
  // UserOperation is sent.
  const calls = [approveCall, swapCall];
  builder.executeBatch(calls);

  // Step 5: Send the UserOperation.  A client connects to the bundler’s RPC
  // endpoint and sends the builder object.  The bundler validates the
  // operation, estimates gas, requests paymaster data if needed, signs the
  // user operation and broadcasts it to the EntryPoint via `eth_sendUserOperation`.
  // This method returns a `userOpHash` analogous to a transaction hash【10929386761584†L99-L116】.
  const client = await Client.init(BUNDLER_URL);
  const res = await client.sendUserOperation(builder, {
    onBuild: (op) => {
      // Optional: Inspect the user operation before it is sent
      console.log('Built UserOperation:', op);
    }
  });
  console.log('UserOpHash:', res.userOpHash);
  console.log('Waiting for transaction confirmation...');
  const receipt = await res.wait();
  console.log('Transaction hash:', receipt?.transactionHash ?? null);
}

main().catch((err) => {
  console.error(err);
});