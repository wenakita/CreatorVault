// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "../../contracts/layerzero/oft/WLFIOFT.sol";

/**
 * @title DeployWLFIOFTExact
 * @notice Deploy WLFI OFT at exact same address on all chains using CREATE2
 * 
 * @dev Process:
 *      1. Run ComputeWLFIOFTHash.s.sol to get init code hash
 *      2. Run create2-miner-wlfi to find salt for 0x47... address
 *      3. Update SALT constant below
 *      4. Deploy on Base, Arbitrum, Optimism, etc.
 * 
 * Usage:
 *   forge script script/layerzero/DeployWLFIOFTExact.s.sol:DeployWLFIOFTExact \
 *     --rpc-url $BASE_RPC_URL --broadcast --verify
 */
contract DeployWLFIOFTExact is Script {
    
    // ==========================================
    // CONFIGURATION
    // ==========================================
    
    /// @notice Arachnid's Deterministic Deployer
    address constant DETERMINISTIC_CREATE2_FACTORY = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    /// @notice EagleRegistry (same on all chains)
    address constant REGISTRY = 0x47c81c9a70CA7518d3b911bC8C8b11000e92F59e;
    
    /// @notice Owner (your address)
    address constant OWNER = 0x7310Dd6EF89b7f829839F140C6840bc929ba2031;
    
    /// @notice Salt from create2-miner-wlfi
    bytes32 constant SALT = 0x00000000000000000000000000000000000000000000000028000000010e2aab;
    
    /// @notice Token name
    string constant NAME = "World Liberty Financial";
    
    /// @notice Token symbol
    string constant SYMBOL = "WLFI";
    
    /// @notice Target address (computed from salt)
    address constant TARGET_ADDRESS = 0x47af3595BFBE6c86E59a13d5db91AEfbFF0eA91e;
    
    // ==========================================
    // DEPLOYMENT
    // ==========================================
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("==============================================");
        console.log("WLFI OFT - CREATE2 DEPLOYMENT");
        console.log("==============================================");
        console.log("");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Target:  ", TARGET_ADDRESS);
        console.log("");
        
        // Check salt is set
        require(SALT != bytes32(0), "SALT not set - run create2-miner-wlfi first!");
        require(TARGET_ADDRESS != address(0), "TARGET_ADDRESS not set - update from miner output!");
        
        // Check deployer matches
        require(
            deployer == OWNER,
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
            type(WLFIOFT).creationCode,
            abi.encode(NAME, SYMBOL, REGISTRY, OWNER)
        );
        
        // Predict address
        address predicted = _predictCreate2Address(SALT, creationCode);
        
        console.log("Predicted:", predicted);
        console.log("");
        
        require(predicted == TARGET_ADDRESS, "PREDICTION MISMATCH - Check compiler version/settings");
        
        // Deploy via CREATE2
        console.log("Deploying via Arachnid's CREATE2 factory...");
        
        (bool success, ) = DETERMINISTIC_CREATE2_FACTORY.call(
            abi.encodePacked(SALT, creationCode)
        );
        
        require(success, "CREATE2 deployment failed");
        
        // Verify deployment succeeded by checking code
        require(TARGET_ADDRESS.code.length > 0, "DEPLOYMENT FAILED - No code at target address");
        
        console.log("");
        console.log("Deployed:", TARGET_ADDRESS);
        console.log("");
        
        vm.stopBroadcast();
        
        // Verify deployment
        _verifyDeployment();
        
        console.log("==============================================");
        console.log("SUCCESS! WLFI OFT deployed at 0x47... address");
        console.log("==============================================");
        console.log("");
        console.log("Next steps:");
        console.log("1. Deploy on other chains (Arbitrum, Optimism, etc.)");
        console.log("2. Deploy WLFI Adapter on Ethereum");
        console.log("3. Configure peer connections");
        console.log("4. Test bridging");
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
        WLFIOFT oft = WLFIOFT(TARGET_ADDRESS);
        
        console.log("Verification:");
        console.log("  Name:    ", oft.name());
        console.log("  Symbol:  ", oft.symbol());
        console.log("  Registry:", address(oft.registry()));
        console.log("  Endpoint:", address(oft.endpoint()));
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
        require(oft.owner() == OWNER, "Owner mismatch");
    }
}

