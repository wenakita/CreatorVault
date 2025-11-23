// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import { OFT } from "@layerzerolabs/oft-evm/contracts/OFT.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IEagleRegistry } from "../../interfaces/IEagleRegistry.sol";

/**
 * @title EagleShareOFT
 * @notice Standard LayerZero OFT for Eagle Vault Shares
 * 
 * @dev FEATURES:
 *      - Standard ERC20 functionality
 *      - LayerZero OFT cross-chain transfers
 *      - Minter role for EagleVaultWrapper integration
 *      - No fees on transfers
 * 
 * https://keybase.io/47eagle
 */
contract EagleShareOFT is OFT {
    // =================================
    // STATE VARIABLES
    // =================================
    
    /// @notice EagleRegistry for dynamic LayerZero endpoint retrieval
    IEagleRegistry public immutable registry;
    
    /// @notice Minter permissions (for EagleVaultWrapper integration)
    mapping(address => bool) public isMinter;
    
    // =================================
    // EVENTS
    // =================================

    event MinterUpdated(address indexed minter, bool status);

    // =================================
    // ERRORS
    // =================================

    error ZeroAddress();
    error NotMinter();

    // =================================
    // CONSTRUCTOR
    // =================================
    
    /**
     * @notice Creates Eagle Share OFT for spoke chains
     * @param _name Token name (e.g., "Eagle")
     * @param _symbol Token symbol (e.g., "EAGLE")
     * @param _registry EagleRegistry for dynamic LayerZero endpoint retrieval
     * @param _delegate Contract delegate/owner
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _registry,
        address _delegate
    ) OFT(_name, _symbol, _getLzEndpoint(_registry), _delegate) Ownable(_delegate) {
        if (_delegate == address(0)) revert ZeroAddress();
        if (_registry == address(0)) revert ZeroAddress();
        
        registry = IEagleRegistry(_registry);
        
        // WARNING: Do NOT mint shares here - breaks vault accounting
        // Shares are minted by the vault on hub chain only
    }
    
    /**
     * @notice Helper to get LayerZero endpoint from registry
     * @dev Used during construction to retrieve the endpoint
     */
    function _getLzEndpoint(address _registry) private view returns (address) {
        if (_registry == address(0)) revert ZeroAddress();
        address endpoint = IEagleRegistry(_registry).getLayerZeroEndpoint(uint16(block.chainid));
        if (endpoint == address(0)) revert ZeroAddress();
        return endpoint;
    }
    
    // =================================
    // VIEW FUNCTIONS
    // =================================

    /**
     * @notice Get contract version
     */
    function version() external pure returns (string memory) {
        return "2.0.0-mainnet-simple";
    }
    
    /**
     * @notice Returns the token category for this contract
     * @return Token category identifier
     */
    function category() external pure returns (string memory) {
        return "Vault Share Token";
    }
    
    /**
     * @notice Returns a description of this token's purpose
     * @return Human-readable description of the token
     */
    function description() external pure returns (string memory) {
        return "Eagle Vault Share Token - Represents proportional ownership of assets in the Eagle Omnichain Vault. Similar to Aave aTokens or Yearn vault tokens.";
    }
    
    // =================================
    // MINTER FUNCTIONS (For EagleVaultWrapper Integration)
    // =================================
    
    /**
     * @notice Set minter permission
     * @dev Allows EagleVaultWrapper to mint/burn tokens for wrapping/unwrapping
     * @param minter Address to grant/revoke minting permission
     * @param status True to grant, false to revoke
     */
    function setMinter(address minter, bool status) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        isMinter[minter] = status;
        emit MinterUpdated(minter, status);
    }
    
    /**
     * @notice Mint tokens (minter only)
     * @dev Used by EagleVaultWrapper when wrapping vault shares
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external {
        if (!isMinter[msg.sender] && msg.sender != owner()) revert NotMinter();
        if (to == address(0)) revert ZeroAddress();
        require(amount > 0, "Mint amount must be greater than 0");
        _mint(to, amount);
    }
    
    /**
     * @notice Burn tokens (minter only)
     * @dev Used by EagleVaultWrapper when unwrapping to vault shares
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external {
        if (!isMinter[msg.sender] && msg.sender != owner()) revert NotMinter();
        if (from == address(0)) revert ZeroAddress();
        
        // Check allowance if caller is not the token owner AND not a minter/owner
        // Minters and owners can burn without approval
        bool isAuthorizedBurner = isMinter[msg.sender] || msg.sender == owner();
        if (from != msg.sender && !isAuthorizedBurner) {
            uint256 currentAllowance = allowance(from, msg.sender);
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            _approve(from, msg.sender, currentAllowance - amount);
        }
        
        _burn(from, amount);
    }
    
    /**
     * @notice Check if address is a minter
     */
    function checkMinter(address account) external view returns (bool) {
        return isMinter[account] || account == owner();
    }
    
}
