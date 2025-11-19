// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../../contracts/layerzero/oft/EagleShareOFT.sol";

/**
 * @title DeployEagleShareOFTExact
 * @notice Deploy EagleShareOFT with EXACT same parameters as Ethereum
 * 
 * @dev Replicates Ethereum deployment:
 *      - TX: 0x5a49e5f8874ab3955e50dd3f187af9dd0593b0f76c0f2fbb9cccf59c4a9aa38f
 *      - Factory: 0x4e59b44847b379578588920cA78FbF26c0B4956C (Arachnid's Deterministic Deployer)
 *      - Deployed: 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E
 *      - Constructor: ("Eagle", "EAGLE", 0x47c81c9a70ca7518d3b911bc8c8b11000e92f59e, 0x7310dd6ef89b7f829839f140c6840bc929ba2031)
 * 
 * Usage (for any chain with EagleRegistry deployed):
 *   forge script script/multi-chain/DeployEagleShareOFTExact.s.sol:DeployEagleShareOFTExact \
 *     --rpc-url <YOUR_RPC_URL> --broadcast --verify --legacy
 * 
 * Examples:
 *   # Base
 *   forge script script/multi-chain/DeployEagleShareOFTExact.s.sol:DeployEagleShareOFTExact \
 *     --rpc-url $BASE_RPC_URL --broadcast --verify --legacy
 * 
 *   # Arbitrum
 *   forge script script/multi-chain/DeployEagleShareOFTExact.s.sol:DeployEagleShareOFTExact \
 *     --rpc-url $ARBITRUM_RPC_URL --broadcast --verify --legacy
 */
contract DeployEagleShareOFTExact is Script {
    
    // ==========================================
    // EXACT CONSTANTS FROM ETHEREUM DEPLOYMENT
    // ==========================================
    
    /// @notice Arachnid's Deterministic Deployer
    address constant DETERMINISTIC_CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    /// @notice Target address (deployed on Ethereum)
    address constant TARGET_ADDRESS = 0x474eD38C256A7FA0f3B8c48496CE1102ab0eA91E;
    
    /// @notice EagleRegistry (same on all chains)
    address constant REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e;
    
    /// @notice Original deployer
    address constant DEPLOYER = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;
    
    /// @notice Salt (extracted from Ethereum tx)
    bytes32 constant SALT = 0x000000000000000000000000000000000000000000000000200000000c9234d8;
    
    /// @notice Token name
    string constant NAME = "Eagle";
    
    /// @notice Token symbol
    string constant SYMBOL = "EAGLE";
    
    // ==========================================
    // DEPLOYMENT FUNCTION
    // ==========================================
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("EAGLE SHARE OFT - EXACT REPLICATION");
        console.log("==============================================");
        console.log("");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Target:  ", TARGET_ADDRESS);
        console.log("");
        
        // CRITICAL: Must use same deployer as Ethereum
        require(
            deployer == DEPLOYER,
            "DEPLOYER MISMATCH - Must use 0x7310Dd6EF89b7f829839F140C6840bc929ba2031"
        );
        
        // Verify prerequisites
        require(DETERMINISTIC_CREATE2_FACTORY.code.length > 0, "CREATE2 factory not on this chain");
        require(REGISTRY.code.length > 0, "EagleRegistry not deployed - deploy it first");
        
        // Check if already deployed
        if (TARGET_ADDRESS.code.length > 0) {
            console.log("Already deployed!");
            _verifyDeployment();
            return;
        }
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Prepare exact creation bytecode
        bytes memory creationCode = abi.encodePacked(
            type(EagleShareOFT).creationCode,
            abi.encode(NAME, SYMBOL, REGISTRY, DEPLOYER)
        );
        
        // Predict address
        address predicted = _predictCreate2Address(SALT, creationCode);
        
        console.log("Predicted:", predicted);
        console.log("");
        
        require(predicted == TARGET_ADDRESS, "PREDICTION MISMATCH - Check compiler version/settings");
        
        // Deploy via CREATE2
        console.log("Deploying via Arachnid's CREATE2 factory...");
        
        (bool success, bytes memory returnData) = DETERMINISTIC_CREATE2_FACTORY.call(
            abi.encodePacked(SALT, creationCode)
        );
        
        require(success, "CREATE2 deployment failed");
        address deployed = abi.decode(returnData, (address));
        
        console.log("");
        console.log("Deployed:", deployed);
        console.log("");
        
        require(deployed == TARGET_ADDRESS, "DEPLOYED ADDRESS MISMATCH");
        
        vm.stopBroadcast();
        
        // Verify deployment
        _verifyDeployment();
        
        console.log("==============================================");
        console.log("SUCCESS! Contract at same address as Ethereum");
        console.log("==============================================");
        console.log("");
        console.log("Next steps:");
        console.log("1. Configure LayerZero peers");
        console.log("2. Set enforced options");
        console.log("3. Test bridging from Ethereum");
        console.log("");
    }
    
    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================
    
    function _predictCreate2Address(bytes32 salt, bytes memory code) internal pure returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                DETERMINISTIC_CREATE2_FACTORY,
                salt,
                keccak256(code)
            )
        );
        return address(uint160(uint256(hash)));
    }
    
    function _verifyDeployment() internal view {
        EagleShareOFT oft = EagleShareOFT(TARGET_ADDRESS);
        
        console.log("Verification:");
        console.log("  Name:    ", oft.name());
        console.log("  Symbol:  ", oft.symbol());
        console.log("  Registry:", address(oft.registry()));
        console.log("  Owner:   ", oft.owner());
        console.log("  Version: ", oft.version());
        console.log("");
        
        require(
            keccak256(bytes(oft.name())) == keccak256(bytes(NAME)),
            "Name mismatch"
        );
        require(
            keccak256(bytes(oft.symbol())) == keccak256(bytes(SYMBOL)),
            "Symbol mismatch"
        );
        require(address(oft.registry()) == REGISTRY, "Registry mismatch");
        require(oft.owner() == DEPLOYER, "Owner mismatch");
    }
}

