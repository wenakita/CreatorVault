// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";

/**
 * @title MockLzEndpoint
 * @notice Simple mock for LayerZero endpoint
 */
contract MockLzEndpoint {
    function setDelegate(address) external {}
    function eid() external pure returns (uint32) {
        return 1; // Ethereum mainnet
    }
}

/**
 * @title EagleShareOFTTest
 * @notice Comprehensive tests for simplified EagleShareOFT
 */
contract EagleShareOFTTest is Test {
    EagleShareOFT public oft;
    MockLzEndpoint public mockLzEndpoint;
    
    address public owner = address(0x1);
    address public minter = address(0x2);
    address public user1 = address(0x3);
    address public user2 = address(0x4);
    
    // Events
    event MinterUpdated(address indexed minter, bool status);
    event Transfer(address indexed from, address indexed to, uint256 value);
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy mock LayerZero endpoint
        mockLzEndpoint = new MockLzEndpoint();
        
        // Deploy EagleShareOFT
        oft = new EagleShareOFT(
            "Eagle Share Token",
            "EAGLE",
            address(mockLzEndpoint),
            owner
        );
        
        vm.stopPrank();
    }
    
    // =================================
    // CONSTRUCTOR TESTS
    // =================================
    
    function test_Constructor() public {
        assertEq(oft.name(), "Eagle Share Token");
        assertEq(oft.symbol(), "EAGLE");
        assertEq(oft.decimals(), 18);
        assertEq(oft.owner(), owner);
        assertEq(oft.version(), "2.0.0-mainnet-simple");
    }
    
    function test_Constructor_RevertsOnZeroDelegate() public {
        vm.startPrank(owner);
        mockLzEndpoint = new MockLzEndpoint();
        // Note: Ownable throws OwnableInvalidOwner error, not our custom ZeroAddress
        vm.expectRevert();
        new EagleShareOFT(
            "Eagle Share Token",
            "EAGLE",
            address(mockLzEndpoint),
            address(0) // Zero delegate should revert
        );
        vm.stopPrank();
    }
    
    function test_Constructor_RevertsOnZeroEndpoint() public {
        vm.startPrank(owner);
        // LayerZero throws its own error, not our custom ZeroAddress
        vm.expectRevert();
        new EagleShareOFT(
            "Eagle Share Token",
            "EAGLE",
            address(0), // Zero endpoint should revert
            owner
        );
        vm.stopPrank();
    }
    
    // =================================
    // MINTER MANAGEMENT TESTS
    // =================================
    
    function test_SetMinter() public {
        vm.startPrank(owner);
        
        // Set minter
        vm.expectEmit(true, false, false, true);
        emit MinterUpdated(minter, true);
        oft.setMinter(minter, true);
        
        // Verify minter status
        assertTrue(oft.isMinter(minter));
        assertTrue(oft.checkMinter(minter));
        
        vm.stopPrank();
    }
    
    function test_SetMinter_OnlyOwner() public {
        vm.startPrank(user1);
        
        vm.expectRevert();
        oft.setMinter(minter, true);
        
        vm.stopPrank();
    }
    
    function test_SetMinter_RevertsOnZeroAddress() public {
        vm.startPrank(owner);
        
        vm.expectRevert(EagleShareOFT.ZeroAddress.selector);
        oft.setMinter(address(0), true);
        
        vm.stopPrank();
    }
    
    function test_RemoveMinter() public {
        vm.startPrank(owner);
        
        // Set minter
        oft.setMinter(minter, true);
        assertTrue(oft.isMinter(minter));
        
        // Remove minter
        vm.expectEmit(true, false, false, true);
        emit MinterUpdated(minter, false);
        oft.setMinter(minter, false);
        
        // Verify minter removed
        assertFalse(oft.isMinter(minter));
        assertFalse(oft.checkMinter(minter));
        
        vm.stopPrank();
    }
    
    function test_CheckMinter_OwnerIsAlwaysMinter() public {
        // Owner should always return true for checkMinter
        assertTrue(oft.checkMinter(owner));
        assertFalse(oft.isMinter(owner)); // But not in isMinter mapping
    }
    
    // =================================
    // MINT TESTS
    // =================================
    
    function test_Mint_ByOwner() public {
        vm.startPrank(owner);
        
        uint256 amount = 1000 ether;
        oft.mint(user1, amount);
        
        assertEq(oft.balanceOf(user1), amount);
        assertEq(oft.totalSupply(), amount);
        
        vm.stopPrank();
    }
    
    function test_Mint_ByAuthorizedMinter() public {
        // Setup: Owner authorizes minter
        vm.prank(owner);
        oft.setMinter(minter, true);
        
        // Test: Minter mints tokens
        vm.startPrank(minter);
        
        uint256 amount = 500 ether;
        oft.mint(user1, amount);
        
        assertEq(oft.balanceOf(user1), amount);
        assertEq(oft.totalSupply(), amount);
        
        vm.stopPrank();
    }
    
    function test_Mint_RevertsForUnauthorized() public {
        vm.startPrank(user1);
        
        vm.expectRevert(EagleShareOFT.NotMinter.selector);
        oft.mint(user2, 100 ether);
        
        vm.stopPrank();
    }
    
    function test_Mint_RevertsOnZeroAddress() public {
        vm.startPrank(owner);
        
        vm.expectRevert(EagleShareOFT.ZeroAddress.selector);
        oft.mint(address(0), 100 ether);
        
        vm.stopPrank();
    }
    
    function test_Mint_MultipleMintsAccumulate() public {
        vm.startPrank(owner);
        
        oft.mint(user1, 100 ether);
        oft.mint(user1, 200 ether);
        oft.mint(user2, 300 ether);
        
        assertEq(oft.balanceOf(user1), 300 ether);
        assertEq(oft.balanceOf(user2), 300 ether);
        assertEq(oft.totalSupply(), 600 ether);
        
        vm.stopPrank();
    }
    
    // =================================
    // BURN TESTS
    // =================================
    
    function test_Burn_ByOwner() public {
        // Setup: Mint tokens
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        // Test: Owner burns user's tokens
        vm.startPrank(owner);
        
        uint256 burnAmount = 300 ether;
        oft.burn(user1, burnAmount);
        
        assertEq(oft.balanceOf(user1), 700 ether);
        assertEq(oft.totalSupply(), 700 ether);
        
        vm.stopPrank();
    }
    
    function test_Burn_ByAuthorizedMinter() public {
        // Setup
        vm.startPrank(owner);
        oft.setMinter(minter, true);
        oft.mint(user1, 1000 ether);
        vm.stopPrank();
        
        // Test: Minter burns tokens
        vm.startPrank(minter);
        
        uint256 burnAmount = 400 ether;
        oft.burn(user1, burnAmount);
        
        assertEq(oft.balanceOf(user1), 600 ether);
        assertEq(oft.totalSupply(), 600 ether);
        
        vm.stopPrank();
    }
    
    function test_Burn_BySelfWithoutAllowance() public {
        // Setup: Mint tokens to user1
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        // Setup: Give user1 minter role so they can burn their own tokens
        vm.prank(owner);
        oft.setMinter(user1, true);
        
        // Test: User burns own tokens (no allowance needed)
        vm.startPrank(user1);
        
        uint256 burnAmount = 250 ether;
        oft.burn(user1, burnAmount);
        
        assertEq(oft.balanceOf(user1), 750 ether);
        assertEq(oft.totalSupply(), 750 ether);
        
        vm.stopPrank();
    }
    
    function test_Burn_WithAllowance() public {
        // Setup: Mint and approve
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.prank(user1);
        oft.approve(minter, 500 ether);
        
        // Setup minter permission
        vm.prank(owner);
        oft.setMinter(minter, true);
        
        // Test: Minter burns WITHOUT using allowance (minter privilege)
        vm.startPrank(minter);
        
        uint256 burnAmount = 200 ether;
        oft.burn(user1, burnAmount);
        
        assertEq(oft.balanceOf(user1), 800 ether);
        assertEq(oft.allowance(user1, minter), 500 ether); // Allowance NOT reduced (minter doesn't need it)
        assertEq(oft.totalSupply(), 800 ether);
        
        vm.stopPrank();
    }
    
    function test_Burn_RevertsForUnauthorized() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(user2);
        
        vm.expectRevert(EagleShareOFT.NotMinter.selector);
        oft.burn(user1, 100 ether);
        
        vm.stopPrank();
    }
    
    function test_Burn_RevertsOnZeroAddress() public {
        vm.startPrank(owner);
        
        vm.expectRevert(EagleShareOFT.ZeroAddress.selector);
        oft.burn(address(0), 100 ether);
        
        vm.stopPrank();
    }
    
    function test_Burn_RevertsOnInsufficientBalance() public {
        vm.prank(owner);
        oft.mint(user1, 100 ether);
        
        vm.startPrank(owner);
        
        vm.expectRevert();
        oft.burn(user1, 200 ether); // Try to burn more than balance
        
        vm.stopPrank();
    }
    
    // =================================
    // TRANSFER TESTS (No Fees)
    // =================================
    
    function test_Transfer_NoFees() public {
        // Setup: Mint tokens
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        // Test: Transfer should work without fees
        vm.startPrank(user1);
        
        uint256 transferAmount = 300 ether;
        oft.transfer(user2, transferAmount);
        
        assertEq(oft.balanceOf(user1), 700 ether);
        assertEq(oft.balanceOf(user2), 300 ether); // Full amount received (no fees)
        assertEq(oft.totalSupply(), 1000 ether);
        
        vm.stopPrank();
    }
    
    function test_TransferFrom_NoFees() public {
        // Setup: Mint and approve
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.prank(user1);
        oft.approve(user2, 500 ether);
        
        // Test: TransferFrom should work without fees
        vm.startPrank(user2);
        
        uint256 transferAmount = 400 ether;
        oft.transferFrom(user1, user2, transferAmount);
        
        assertEq(oft.balanceOf(user1), 600 ether);
        assertEq(oft.balanceOf(user2), 400 ether); // Full amount received (no fees)
        assertEq(oft.allowance(user1, user2), 100 ether); // Allowance reduced
        
        vm.stopPrank();
    }
    
    function test_Transfer_MultipleTransfers() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(user1);
        
        oft.transfer(user2, 100 ether);
        oft.transfer(user2, 200 ether);
        oft.transfer(user2, 300 ether);
        
        assertEq(oft.balanceOf(user1), 400 ether);
        assertEq(oft.balanceOf(user2), 600 ether);
        
        vm.stopPrank();
    }
    
    // =================================
    // STANDARD ERC20 TESTS
    // =================================
    
    function test_Approve() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(user1);
        
        uint256 approvalAmount = 500 ether;
        oft.approve(user2, approvalAmount);
        
        assertEq(oft.allowance(user1, user2), approvalAmount);
        
        vm.stopPrank();
    }
    
    function test_IncreaseAllowance() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(user1);
        
        oft.approve(user2, 100 ether);
        oft.approve(user2, 300 ether); // Overwrites previous
        
        assertEq(oft.allowance(user1, user2), 300 ether);
        
        vm.stopPrank();
    }
    
    function test_TotalSupply() public {
        assertEq(oft.totalSupply(), 0);
        
        vm.startPrank(owner);
        
        oft.mint(user1, 100 ether);
        assertEq(oft.totalSupply(), 100 ether);
        
        oft.mint(user2, 200 ether);
        assertEq(oft.totalSupply(), 300 ether);
        
        oft.burn(user1, 50 ether);
        assertEq(oft.totalSupply(), 250 ether);
        
        vm.stopPrank();
    }
    
    // =================================
    // ACCESS CONTROL TESTS
    // =================================
    
    function test_Ownership() public {
        assertEq(oft.owner(), owner);
        
        vm.prank(owner);
        oft.transferOwnership(user1);
        
        assertEq(oft.owner(), user1);
    }
    
    function test_OnlyOwner_SetMinter() public {
        vm.expectRevert();
        vm.prank(user1);
        oft.setMinter(minter, true);
    }
    
    // =================================
    // INTEGRATION TESTS
    // =================================
    
    function test_Integration_MintTransferBurn() public {
        vm.startPrank(owner);
        
        // 1. Mint tokens
        oft.mint(user1, 1000 ether);
        assertEq(oft.balanceOf(user1), 1000 ether);
        
        vm.stopPrank();
        
        // 2. Transfer tokens
        vm.startPrank(user1);
        oft.transfer(user2, 300 ether);
        vm.stopPrank();
        
        assertEq(oft.balanceOf(user1), 700 ether);
        assertEq(oft.balanceOf(user2), 300 ether);
        
        // 3. Burn tokens
        vm.startPrank(owner);
        oft.burn(user1, 200 ether);
        oft.burn(user2, 100 ether);
        vm.stopPrank();
        
        assertEq(oft.balanceOf(user1), 500 ether);
        assertEq(oft.balanceOf(user2), 200 ether);
        assertEq(oft.totalSupply(), 700 ether);
    }
    
    function test_Integration_MultipleMinters() public {
        address minter2 = address(0x6);
        
        vm.startPrank(owner);
        
        // Setup multiple minters
        oft.setMinter(minter, true);
        oft.setMinter(minter2, true);
        
        vm.stopPrank();
        
        // Minter 1 mints
        vm.prank(minter);
        oft.mint(user1, 100 ether);
        
        // Minter 2 mints
        vm.prank(minter2);
        oft.mint(user2, 200 ether);
        
        assertEq(oft.balanceOf(user1), 100 ether);
        assertEq(oft.balanceOf(user2), 200 ether);
        assertEq(oft.totalSupply(), 300 ether);
    }
    
    // =================================
    // VIEW FUNCTION TESTS
    // =================================
    
    function test_Version() public {
        assertEq(oft.version(), "2.0.0-mainnet-simple");
    }
    
    function test_CheckMinter() public {
        // Owner should always be considered a minter
        assertTrue(oft.checkMinter(owner));
        
        // Regular address should not be minter
        assertFalse(oft.checkMinter(user1));
        
        // Add minter
        vm.prank(owner);
        oft.setMinter(minter, true);
        
        // Minter should now be true
        assertTrue(oft.checkMinter(minter));
        
        // Remove minter
        vm.prank(owner);
        oft.setMinter(minter, false);
        
        // Should be false again
        assertFalse(oft.checkMinter(minter));
    }
    
    // =================================
    // EDGE CASE TESTS
    // =================================
    
    function test_MintZeroAmount() public {
        vm.startPrank(owner);
        
        vm.expectRevert("Mint amount must be greater than 0");
        oft.mint(user1, 0);
        
        vm.stopPrank();
    }
    
    function test_BurnZeroAmount() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(owner);
        
        oft.burn(user1, 0);
        assertEq(oft.balanceOf(user1), 1000 ether);
        
        vm.stopPrank();
    }
    
    function test_TransferZeroAmount() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(user1);
        
        oft.transfer(user2, 0);
        assertEq(oft.balanceOf(user1), 1000 ether);
        assertEq(oft.balanceOf(user2), 0);
        
        vm.stopPrank();
    }
    
    function test_SelfTransfer() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(user1);
        
        oft.transfer(user1, 500 ether); // Transfer to self
        assertEq(oft.balanceOf(user1), 1000 ether); // Balance unchanged
        
        vm.stopPrank();
    }
}

