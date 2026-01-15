# CREATE2 Registry Deployment

This repo deploys `CreatorRegistry` via CREATE2 for deterministic addresses across chains.

## Deterministic address requirements
- Use the EIP-2470 factory at `0x4e59b44847b379578588920cA78FbF26c0B4956C`
- Use the same salt on every chain
- Keep the init code identical (bytecode + constructor args)

Any change to the owner address or compiler settings changes the init code hash.

## Vanity salt search
Use `script/FindRegistryCreate2Salt.s.sol` to search for a salt that yields a vanity address:

```
SALT_START=0 SALT_ITERS=1000000 forge script script/FindRegistryCreate2Salt.s.sol:FindRegistryCreate2Salt -vvvv
```

Copy the salt into `REGISTRY_SALT` in `script/DeployBaseMainnet.s.sol` before deploying.

## AA deployment (optional)
Account abstraction is optional for protocol deployments. Deterministic CREATE2 does not require AA.
Use AA/bundlers only if you want a single-click or paymaster-managed deploy flow.
