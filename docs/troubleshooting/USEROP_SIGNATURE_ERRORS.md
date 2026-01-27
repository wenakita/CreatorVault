# UserOperation Signature Validation Failures

When a bundler returns errors like:

```
UserOperation rejected because account signature check failed (or paymaster signature, if the paymaster uses its data as signature).
Details: Invalid UserOp signature or paymaster signature
```

it means `simulateValidation()` failed during signature checks. The failure can come from either:

* the account signature (`validateUserOp`)
* the paymaster signature (`validatePaymasterUserOp`)

Below are the most common causes and a quick isolation checklist.

## Most Common Causes

### 1) Mutating the UserOperation after signing
If you modify *any* field after a signature is generated, validation fails. This often happens when:

* You request paymaster data, then later re-estimate gas or tweak fees.
* You re-order steps and overwrite fields (e.g., callGasLimit, maxFeePerGas) after signing.

**Fix:** treat the UserOperation as immutable once it is signed. If any fields change, regenerate paymaster data and re-sign.

**Safe order of operations:**

1. Build the full UserOperation (all fields except `signature`).
2. Request paymaster data (sets `paymasterAndData`).
3. (Optional) estimate gas *before* signing, but do **not** mutate afterwards.
4. Sign and send.

### 2) EntryPoint version mismatch (v0.6 vs v0.7)
EntryPoint v0.7 introduces a packed user operation format. If your account/paymaster expects one format but your tooling signs the other, the hash will differ and validation fails.

**Check:**

* EntryPoint address and version on the target chain.
* Whether your SDK/client is generating legacy `UserOperation` or `PackedUserOperation`.
* That the same EntryPoint address/version is used when hashing and validating.

### 3) Paymaster signature formatting
Many paymasters embed their signature inside `paymasterAndData` with a strict byte layout. Re-encoding or truncating that data breaks validation.

**Fix:** treat `paymasterAndData` as opaque bytes unless you fully control the paymaster contract and encoding.

### 4) Signing the wrong hash or domain
Common causes include:

* wrong chain ID
* wrong EntryPoint address in the hash domain
* wrong signer (EOA vs session key vs module key)
* mismatched signing method (EIP-712 vs personal_sign expectations)

**Sanity check:** log the exact `userOpHash` that your client signs and compare it to the on-chain value in `validateUserOp`.

## Fast Isolation Checklist

1. **Try without a paymaster.**
   * Set `paymasterAndData = 0x` and fund the smart account or EntryPoint deposit.
   * If it works → paymaster signature/formatting or mutation is the culprit.
   * If it still fails → account signature or hashing is wrong.
2. **Confirm no field mutations after paymaster data.**
3. **Verify EntryPoint version and user op packing.**
4. **Compare hashes end-to-end.**

## Notes on Gas Settings
Low fee values typically cause inclusion issues rather than signature failures. However, many paymaster flows **recalculate or replace gas fields**, and if you mutate those after paymaster signing, you will invalidate the paymaster signature. In that case, request paymaster data again and re-sign.
