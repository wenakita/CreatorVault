// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../contracts/EagleVaultWrapper.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockVaultToken
 * @notice Mock ERC20 for vault shares
 */
contract MockVaultToken is ERC20 {
    constructor() ERC20("Mock Vault Shares", "vEAGLE") {}
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title MockLzEndpoint
 * @notice Simple mock for LayerZero endpoint
 */
contract MockLzEndpoint {
    function setDelegate(address) external {}
    function eid() external pure returns (uint32) {
        return 1;
    }
}

/**
 * @title EagleVaultWrapperTest
 * @notice Comprehensive tests for EagleVaultWrapper
 */
contract EagleVaultWrapperTest is Test {
    EagleVaultWrapper public wrapper;
    MockVaultToken public vaultToken;
    EagleShareOFT public oftToken;
    MockLzEndpoint public lzEndpoint;
    
    address public owner = address(0x1);
    address public user1 = address(0x2);
    address public user2 = address(0x3);
    address public feeRecipient = address(0x4);
    
    // Events
    event Wrapped(address indexed user, uint256 amount, uint256 fee);
    event Unwrapped(address indexed user, uint256 amount, uint256 fee);
    event WhitelistUpdated(address indexed user, bool isWhitelisted);
    event FeesUpdated(uint256 depositFee, uint256 withdrawFee);
    event FeeRecipientUpdated(address indexed newRecipient);
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy mock tokens
        vaultToken = new MockVaultToken();
        lzEndpoint = new MockLzEndpoint();
        
        // Deploy OFT
        oftToken = new EagleShareOFT(
            "Eagle Share Token",
            "EAGLE",
            address(lzEndpoint),
            owner
        );
        
        // Deploy wrapper
        wrapper = new EagleVaultWrapper(
            address(vaultToken),
            address(oftToken),
            feeRecipient,
            owner
        );
        
        // Set wrapper as minter of OFT
        oftToken.setMinter(address(wrapper), true);
        
        // Set fee recipient
        wrapper.setFeeRecipient(feeRecipient);
        
        vm.stopPrank();
    }
    
    // =================================
    // CONSTRUCTOR TESTS
    // =================================
    
    function test_Constructor() public {
        assertEq(address(wrapper.VAULT_EAGLE()), address(vaultToken));
        assertEq(address(wrapper.OFT_EAGLE()), address(oftToken));
        assertEq(wrapper.owner(), owner);
        assertEq(wrapper.totalLocked(), 0);
        assertEq(wrapper.totalMinted(), 0);
    }
    
    function test_Constructor_DefaultFees() public {
        assertEq(wrapper.depositFee(), 100); // 1%
        assertEq(wrapper.withdrawFee(), 200); // 2%
    }
    
    // =================================
    // WRAP TESTS (Vault Shares → EAGLE)
    // =================================
    
    function test_Wrap_Success() public {
        uint256 wrapAmount = 1000 ether;
        
        // Setup: Give user1 vault shares
        vm.prank(owner);
        vaultToken.mint(user1, wrapAmount);
        
        // User1 approves wrapper
        vm.prank(user1);
        vaultToken.approve(address(wrapper), wrapAmount);
        
        // Calculate expected fee
        uint256 fee = (wrapAmount * wrapper.depositFee()) / wrapper.BASIS_POINTS();
        uint256 netAmount = wrapAmount - fee;
        
        // Wrap
        vm.startPrank(user1);
        vm.expectEmit(true, false, false, true);
        emit Wrapped(user1, netAmount, fee); // Event emits net amount, not gross
        wrapper.wrap(wrapAmount);
        vm.stopPrank();
        
        // Verify balances
        assertEq(vaultToken.balanceOf(user1), 0); // All vault shares taken
        assertEq(vaultToken.balanceOf(address(wrapper)), netAmount); // Net locked in wrapper (fee sent out)
        assertEq(vaultToken.balanceOf(feeRecipient), fee); // Fee sent as vault shares
        assertEq(oftToken.balanceOf(user1), netAmount); // Received OFT (minus fee)
        
        // Verify tracking
        assertEq(wrapper.totalLocked(), netAmount); // Only net amount locked (fee sent out)
        assertEq(wrapper.totalMinted(), netAmount); // Minted = Locked
        assertEq(wrapper.totalDepositFees(), fee);
    }
    
    function test_Wrap_MultipleWraps() public {
        // Setup
        vm.prank(owner);
        vaultToken.mint(user1, 3000 ether);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 3000 ether);
        
        // Wrap 1000
        wrapper.wrap(1000 ether);
        uint256 fee1 = (1000 ether * wrapper.depositFee()) / wrapper.BASIS_POINTS();
        
        // Wrap 2000
        wrapper.wrap(2000 ether);
        uint256 fee2 = (2000 ether * wrapper.depositFee()) / wrapper.BASIS_POINTS();
        
        vm.stopPrank();
        
        // Verify accumulated balances
        uint256 totalNet = 3000 ether - fee1 - fee2;
        assertEq(wrapper.totalLocked(), totalNet); // Net locked (fees sent out)
        assertEq(wrapper.totalMinted(), totalNet); // Minted = Locked
        assertEq(oftToken.balanceOf(user1), totalNet);
        assertEq(wrapper.totalDepositFees(), fee1 + fee2);
    }
    
    function test_Wrap_WithWhitelist_NoFee() public {
        uint256 wrapAmount = 1000 ether;
        
        // Setup
        vm.prank(owner);
        vaultToken.mint(user1, wrapAmount);
        
        // Whitelist user1
        vm.prank(owner);
        wrapper.setWhitelist(user1, true);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), wrapAmount);
        wrapper.wrap(wrapAmount);
        vm.stopPrank();
        
        // Verify no fee charged
        assertEq(oftToken.balanceOf(user1), wrapAmount); // Full amount
        assertEq(oftToken.balanceOf(feeRecipient), 0); // No fee
        assertEq(wrapper.totalDepositFees(), 0);
    }
    
    function test_Wrap_RevertsOnZeroAmount() public {
        vm.expectRevert(EagleVaultWrapper.ZeroAmount.selector);
        vm.prank(user1);
        wrapper.wrap(0);
    }
    
    function test_Wrap_RevertsWithoutAllowance() public {
        vm.prank(owner);
        vaultToken.mint(user1, 1000 ether);
        
        // Don't approve
        vm.expectRevert();
        vm.prank(user1);
        wrapper.wrap(1000 ether);
    }
    
    // =================================
    // UNWRAP TESTS (EAGLE → Vault Shares)
    // =================================
    
    function test_Unwrap_Success() public {
        // Setup: Wrap first
        uint256 wrapAmount = 1000 ether;
        vm.prank(owner);
        vaultToken.mint(user1, wrapAmount);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), wrapAmount);
        wrapper.wrap(wrapAmount);
        vm.stopPrank();
        
        uint256 wrapFee = (wrapAmount * wrapper.depositFee()) / wrapper.BASIS_POINTS();
        uint256 oftBalance = wrapAmount - wrapFee;
        
        // Unwrap
        uint256 unwrapAmount = oftBalance;
        uint256 unwrapFee = (unwrapAmount * wrapper.withdrawFee()) / wrapper.BASIS_POINTS();
        uint256 netUnwrap = unwrapAmount - unwrapFee;
        
        vm.startPrank(user1);
        vm.expectEmit(true, false, false, true);
        emit Unwrapped(user1, netUnwrap, unwrapFee); // Event emits net amount, not gross
        wrapper.unwrap(unwrapAmount);
        vm.stopPrank();
        
        // Verify balances
        assertEq(oftToken.balanceOf(user1), 0); // All OFT burned
        assertEq(vaultToken.balanceOf(user1), netUnwrap); // Received vault shares (minus fee)
        assertEq(vaultToken.balanceOf(feeRecipient), wrapFee + unwrapFee); // Both fees to recipient
        
        // Verify tracking (should be 0 since fully unwrapped)
        assertEq(wrapper.totalLocked(), 0);
        assertEq(wrapper.totalMinted(), 0);
        assertEq(wrapper.totalWithdrawFees(), unwrapFee);
    }
    
    function test_Unwrap_WithWhitelist_NoFee() public {
        // Setup: Wrap first
        uint256 wrapAmount = 1000 ether;
        vm.prank(owner);
        vaultToken.mint(user1, wrapAmount);
        
        // Whitelist for both wrap and unwrap
        vm.prank(owner);
        wrapper.setWhitelist(user1, true);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), wrapAmount);
        wrapper.wrap(wrapAmount);
        
        // Unwrap with whitelist (no fee)
        wrapper.unwrap(wrapAmount);
        vm.stopPrank();
        
        // Verify no unwrap fee
        assertEq(vaultToken.balanceOf(user1), wrapAmount); // Full amount back
        assertEq(wrapper.totalWithdrawFees(), 0);
    }
    
    function test_Unwrap_PartialAmount() public {
        // Setup: Wrap
        uint256 wrapAmount = 1000 ether;
        vm.prank(owner);
        vaultToken.mint(user1, wrapAmount);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), wrapAmount);
        wrapper.wrap(wrapAmount);
        
        uint256 wrapFee = (wrapAmount * wrapper.depositFee()) / wrapper.BASIS_POINTS();
        uint256 oftBalance = wrapAmount - wrapFee;
        
        // Unwrap only half
        uint256 unwrapAmount = oftBalance / 2;
        wrapper.unwrap(unwrapAmount);
        vm.stopPrank();
        
        uint256 unwrapFee = (unwrapAmount * wrapper.withdrawFee()) / wrapper.BASIS_POINTS();
        uint256 netUnwrap = unwrapAmount - unwrapFee;
        
        // Verify partial unwrap
        assertEq(vaultToken.balanceOf(user1), netUnwrap);
        assertEq(oftToken.balanceOf(user1), oftBalance - unwrapAmount); // Still has remaining OFT
    }
    
    function test_Unwrap_RevertsOnZeroAmount() public {
        vm.expectRevert(EagleVaultWrapper.ZeroAmount.selector);
        vm.prank(user1);
        wrapper.unwrap(0);
    }
    
    function test_Unwrap_RevertsOnInsufficientBalance() public {
        // User has no OFT
        vm.expectRevert();
        vm.prank(user1);
        wrapper.unwrap(1000 ether);
    }
    
    function test_Unwrap_RevertsOnInsufficientLocked() public {
        // Edge case: Somehow OFT exists but wrapper has no locked shares
        // This should never happen in practice but test it
        
        // Manually mint OFT to user (bypassing wrapper)
        vm.prank(owner);
        oftToken.mint(user1, 1000 ether);
        
        // Try to unwrap (should fail - no locked shares)
        vm.expectRevert(EagleVaultWrapper.InsufficientLockedShares.selector);
        vm.prank(user1);
        wrapper.unwrap(1000 ether);
    }
    
    // =================================
    // FEE CONFIGURATION TESTS
    // =================================
    
    function test_SetFees() public {
        vm.startPrank(owner);
        
        vm.expectEmit(false, false, false, true);
        emit FeesUpdated(50, 100);
        wrapper.setFees(50, 100);
        
        assertEq(wrapper.depositFee(), 50);
        assertEq(wrapper.withdrawFee(), 100);
        
        vm.stopPrank();
    }
    
    function test_SetFees_RevertsIfTooHigh() public {
        vm.startPrank(owner);
        
        // Try to set > 10%
        vm.expectRevert(EagleVaultWrapper.FeeExceedsLimit.selector);
        wrapper.setFees(1001, 100);
        
        vm.expectRevert(EagleVaultWrapper.FeeExceedsLimit.selector);
        wrapper.setFees(100, 1001);
        
        vm.stopPrank();
    }
    
    function test_SetFees_OnlyOwner() public {
        vm.expectRevert();
        vm.prank(user1);
        wrapper.setFees(50, 100);
    }
    
    function test_SetFeeRecipient() public {
        address newRecipient = address(0x999);
        
        vm.startPrank(owner);
        
        vm.expectEmit(true, false, false, false);
        emit FeeRecipientUpdated(newRecipient);
        wrapper.setFeeRecipient(newRecipient);
        
        assertEq(wrapper.feeRecipient(), newRecipient);
        
        vm.stopPrank();
    }
    
    function test_SetFeeRecipient_RevertsOnZeroAddress() public {
        vm.expectRevert(EagleVaultWrapper.ZeroFeeRecipient.selector);
        vm.prank(owner);
        wrapper.setFeeRecipient(address(0));
    }
    
    function test_SetFeeRecipient_OnlyOwner() public {
        vm.expectRevert();
        vm.prank(user1);
        wrapper.setFeeRecipient(address(0x999));
    }
    
    // =================================
    // WHITELIST TESTS
    // =================================
    
    function test_SetWhitelist() public {
        vm.startPrank(owner);
        
        vm.expectEmit(true, false, false, true);
        emit WhitelistUpdated(user1, true);
        wrapper.setWhitelist(user1, true);
        
        assertTrue(wrapper.isWhitelisted(user1));
        
        // Remove from whitelist
        vm.expectEmit(true, false, false, true);
        emit WhitelistUpdated(user1, false);
        wrapper.setWhitelist(user1, false);
        
        assertFalse(wrapper.isWhitelisted(user1));
        
        vm.stopPrank();
    }
    
    function test_SetWhitelist_OnlyOwner() public {
        vm.expectRevert();
        vm.prank(user1);
        wrapper.setWhitelist(user2, true);
    }
    
    // =================================
    // INTEGRATION TESTS
    // =================================
    
    function test_Integration_WrapUnwrapFullCycle() public {
        uint256 initialAmount = 1000 ether;
        
        // Setup
        vm.prank(owner);
        vaultToken.mint(user1, initialAmount);
        
        vm.startPrank(user1);
        
        // 1. Wrap
        vaultToken.approve(address(wrapper), initialAmount);
        wrapper.wrap(initialAmount);
        
        uint256 wrapFee = (initialAmount * wrapper.depositFee()) / wrapper.BASIS_POINTS();
        uint256 oftReceived = initialAmount - wrapFee;
        
        assertEq(oftToken.balanceOf(user1), oftReceived);
        assertEq(vaultToken.balanceOf(user1), 0);
        
        // 2. Unwrap all
        wrapper.unwrap(oftReceived);
        
        uint256 unwrapFee = (oftReceived * wrapper.withdrawFee()) / wrapper.BASIS_POINTS();
        uint256 finalAmount = oftReceived - unwrapFee;
        
        assertEq(vaultToken.balanceOf(user1), finalAmount);
        assertEq(oftToken.balanceOf(user1), 0);
        
        vm.stopPrank();
        
        // Net loss due to fees
        assertLt(finalAmount, initialAmount);
        
        // Fee recipient got fees (as vault shares)
        assertEq(vaultToken.balanceOf(feeRecipient), wrapFee + unwrapFee);
    }
    
    function test_Integration_MultipleUsersWrapping() public {
        uint256 amount = 1000 ether;
        
        // Setup both users
        vm.startPrank(owner);
        vaultToken.mint(user1, amount);
        vaultToken.mint(user2, amount);
        vm.stopPrank();
        
        // User1 wraps
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), amount);
        wrapper.wrap(amount);
        vm.stopPrank();
        
        // User2 wraps
        vm.startPrank(user2);
        vaultToken.approve(address(wrapper), amount);
        wrapper.wrap(amount);
        vm.stopPrank();
        
        uint256 fee = (amount * wrapper.depositFee()) / wrapper.BASIS_POINTS();
        uint256 netAmount = amount - fee;
        
        // Verify both users got OFT
        assertEq(oftToken.balanceOf(user1), netAmount);
        assertEq(oftToken.balanceOf(user2), netAmount);
        
        // Verify wrapper locked net shares (after fees)
        uint256 totalNetLocked = (netAmount * 2);
        assertEq(wrapper.totalLocked(), totalNetLocked);
        assertEq(wrapper.totalMinted(), totalNetLocked);
    }
    
    function test_Integration_SupplyInvariant() public {
        // This test verifies the critical invariant:
        // totalMinted == totalLocked (at wrapper level)
        
        uint256 amount = 1000 ether;
        
        // Setup
        vm.prank(owner);
        vaultToken.mint(user1, amount * 3);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), amount * 3);
        
        // Multiple operations
        wrapper.wrap(1000 ether);
        assertEq(wrapper.totalMinted(), wrapper.totalLocked());
        
        wrapper.wrap(500 ether);
        assertEq(wrapper.totalMinted(), wrapper.totalLocked());
        
        uint256 wrapFee1 = (1000 ether * wrapper.depositFee()) / wrapper.BASIS_POINTS();
        uint256 wrapFee2 = (500 ether * wrapper.depositFee()) / wrapper.BASIS_POINTS();
        uint256 oftBalance = 1500 ether - wrapFee1 - wrapFee2;
        
        wrapper.unwrap(oftBalance / 2);
        assertEq(wrapper.totalMinted(), wrapper.totalLocked());
        
        vm.stopPrank();
        
        // Invariant holds throughout
    }
    
    // =================================
    // ACCESS CONTROL TESTS
    // =================================
    
    function test_Ownership() public {
        assertEq(wrapper.owner(), owner);
        
        vm.prank(owner);
        wrapper.transferOwnership(user1);
        
        assertEq(wrapper.owner(), user1);
    }
    
    function test_OnlyOwner_SetFees() public {
        vm.expectRevert();
        vm.prank(user1);
        wrapper.setFees(50, 100);
    }
    
    function test_OnlyOwner_SetFeeRecipient() public {
        vm.expectRevert();
        vm.prank(user1);
        wrapper.setFeeRecipient(address(0x999));
    }
    
    function test_OnlyOwner_SetWhitelist() public {
        vm.expectRevert();
        vm.prank(user1);
        wrapper.setWhitelist(user2, true);
    }
    
    // =================================
    // EDGE CASE TESTS
    // =================================
    
    function test_WrapWithZeroFee() public {
        // Set fees to 0
        vm.prank(owner);
        wrapper.setFees(0, 0);
        
        uint256 amount = 1000 ether;
        vm.prank(owner);
        vaultToken.mint(user1, amount);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), amount);
        wrapper.wrap(amount);
        vm.stopPrank();
        
        // Should receive full amount (no fee)
        assertEq(oftToken.balanceOf(user1), amount);
        assertEq(oftToken.balanceOf(feeRecipient), 0);
    }
    
    function test_UnwrapWithZeroFee() public {
        // Set fees to 0
        vm.prank(owner);
        wrapper.setFees(0, 0);
        
        uint256 amount = 1000 ether;
        vm.prank(owner);
        vaultToken.mint(user1, amount);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), amount);
        wrapper.wrap(amount);
        wrapper.unwrap(amount);
        vm.stopPrank();
        
        // Should get back full amount (no fees)
        assertEq(vaultToken.balanceOf(user1), amount);
    }
    
    function test_WrapUnwrapWithMaxFees() public {
        // Set maximum fees (10%)
        vm.prank(owner);
        wrapper.setFees(1000, 1000);
        
        uint256 amount = 1000 ether;
        vm.prank(owner);
        vaultToken.mint(user1, amount);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), amount);
        wrapper.wrap(amount);
        
        uint256 wrapFee = (amount * 1000) / 10000; // 10%
        uint256 oftReceived = amount - wrapFee;
        
        assertEq(oftToken.balanceOf(user1), oftReceived);
        
        wrapper.unwrap(oftReceived);
        
        uint256 unwrapFee = (oftReceived * 1000) / 10000; // 10%
        uint256 finalAmount = oftReceived - unwrapFee;
        
        assertEq(vaultToken.balanceOf(user1), finalAmount);
        
        vm.stopPrank();
        
        // Total fees: ~19% (compound effect)
        assertApproxEqRel(finalAmount, amount * 81 / 100, 0.01e18); // Within 1%
    }
    
    function test_VerySmallAmounts() public {
        uint256 amount = 100; // Very small amount
        
        vm.prank(owner);
        vaultToken.mint(user1, amount);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), amount);
        wrapper.wrap(amount);
        vm.stopPrank();
        
        // Should still work (no underflow)
        assertGt(oftToken.balanceOf(user1), 0);
    }
    
    function test_VeryLargeAmounts() public {
        uint256 amount = type(uint256).max / 1000; // Very large but safe
        
        vm.prank(owner);
        vaultToken.mint(user1, amount);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), amount);
        wrapper.wrap(amount);
        vm.stopPrank();
        
        // Should handle large numbers
        uint256 fee = (amount * wrapper.depositFee()) / wrapper.BASIS_POINTS();
        uint256 netAmount = amount - fee;
        assertGt(oftToken.balanceOf(user1), 0);
        assertEq(wrapper.totalLocked(), netAmount);
    }
    
    // =================================
    // VIEW FUNCTION TESTS
    // =================================
    
    function test_GetFeeStats() public {
        // Do some wraps and unwraps
        uint256 amount = 1000 ether;
        vm.prank(owner);
        vaultToken.mint(user1, amount);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), amount);
        wrapper.wrap(amount);
        
        uint256 wrapFee = (amount * wrapper.depositFee()) / wrapper.BASIS_POINTS();
        uint256 oftReceived = amount - wrapFee;
        
        wrapper.unwrap(oftReceived / 2);
        
        uint256 unwrapFee = ((oftReceived / 2) * wrapper.withdrawFee()) / wrapper.BASIS_POINTS();
        
        vm.stopPrank();
        
        // Check fee stats
        assertEq(wrapper.totalDepositFees(), wrapFee);
        assertEq(wrapper.totalWithdrawFees(), unwrapFee);
    }
    
    function test_ViewCurrentState() public {
        // Wrap some tokens
        uint256 amount = 5000 ether;
        vm.prank(owner);
        vaultToken.mint(user1, amount);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), amount);
        wrapper.wrap(amount);
        vm.stopPrank();
        
        // Verify state
        uint256 fee = (amount * wrapper.depositFee()) / wrapper.BASIS_POINTS();
        uint256 netAmount = amount - fee;
        assertEq(wrapper.totalLocked(), netAmount);
        assertEq(wrapper.totalMinted(), netAmount);
        assertEq(address(wrapper.VAULT_EAGLE()), address(vaultToken));
        assertEq(address(wrapper.OFT_EAGLE()), address(oftToken));
        assertEq(wrapper.feeRecipient(), feeRecipient);
    }
}

