// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../../contracts/layerzero/composers/EagleOVaultComposerV2.sol";

/**
 * @title DeployComposerV2
 * @notice Deploy EagleOVaultComposerV2 on Ethereum
 * 
 * @dev Usage:
 *      forge script script/layerzero/DeployComposerV2.s.sol:DeployComposerV2 \
 *        --rpc-url $ETHEREUM_RPC_URL \
 *        --broadcast \
 *        --verify
 */
contract DeployComposerV2 is Script {
    
    // =================================
    // ETHEREUM MAINNET ADDRESSES
    // =================================
    
    /// @notice EagleOVault (ERC4626)
    address constant VAULT = 0x47b3ef629D9cB8DFcF8A6c61058338f4e99d7953;
    
    /// @notice EagleVaultWrapper
    address constant WRAPPER = 0x47dAc5063c526dBc6f157093DD1D62d9DE8891c5;
    
    /// @notice EagleShareOFT (EAGLE token)
    address constant SHARE_OFT = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    
    /// @notice WLFI Token (native on Ethereum)
    address constant WLFI = 0xdA5e1988097297dCdc1f90D4dFE7909e847CBeF6;
    
    /// @notice WLFI OFT Adapter (for cross-chain WLFI)
    address constant WLFI_ADAPTER = 0x2437F6555350c131647daA0C655c4B49A7aF3621;
    
    /// @notice USD1 Token
    address constant USD1 = 0x8d0D000Ee44948FC98c9B98A4FA4921476f08B0d;
    
    /// @notice EagleRegistry
    address constant REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e;
    
    /// @notice Owner (multisig or deployer)
    address constant OWNER = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("DEPLOY: EagleOVaultComposerV2 on Ethereum");
        console.log("==============================================");
        console.log("");
        console.log("Deployer:", deployer);
        console.log("Vault:", VAULT);
        console.log("Wrapper:", WRAPPER);
        console.log("ShareOFT:", SHARE_OFT);
        console.log("WLFI:", WLFI);
        console.log("WLFI Adapter:", WLFI_ADAPTER);
        console.log("USD1:", USD1);
        console.log("Registry:", REGISTRY);
        console.log("Owner:", OWNER);
        console.log("");
        
        require(block.chainid == 1, "Must run on Ethereum mainnet");
        
        vm.startBroadcast(deployerPrivateKey);
        
        console.log("Deploying EagleOVaultComposerV2...");
        
        EagleOVaultComposerV2 composer = new EagleOVaultComposerV2(
            VAULT,
            SHARE_OFT,
            WRAPPER,
            WLFI_ADAPTER,
            WLFI,
            USD1,
            REGISTRY,
            OWNER
        );
        
        console.log("");
        console.log("==============================================");
        console.log("SUCCESS!");
        console.log("==============================================");
        console.log("ComposerV2:", address(composer));
        console.log("Owner:", composer.owner());
        console.log("");
        console.log("Next steps:");
        console.log("1. Set delegate on ComposerV2");
        console.log("2. Configure as lzCompose endpoint on ShareOFT");
        console.log("3. Test composed flow from Base");
        console.log("");
        
        vm.stopBroadcast();
    }
}

