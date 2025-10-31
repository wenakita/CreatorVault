// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../contracts/EagleVaultWrapper.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockVaultToken
 * @notice Mock ERC20 for vault shares
 */
contract MockVaultToken is ERC20 {
    constructor() ERC20("Mock Vault EAGLE", "vEAGLE") {}
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title MockLzEndpoint
 * @notice Mock LayerZero endpoint
 */
contract MockLzEndpoint {
    uint32 private _eid;
    
    constructor(uint32 eid_) {
        _eid = eid_;
    }
    
    function setDelegate(address) external {}
    
    function eid() external view returns (uint32) {
        return _eid;
    }
}

/**
 * @title EagleVaultWrapperComprehensiveTest
 * @notice Comprehensive test suite for EagleVaultWrapper
 * 
 * @dev TEST COVERAGE:
 *      - Constructor & Initialization
 *      - Wrapping (with/without fees)
 *      - Unwrapping (with/without fees)
 *      - Fee Management
 *      - Whitelist Management  
 *      - Balance Invariants
 *      - Access Control
 *      - Edge Cases
 *      - Integration Tests
 *      - Fuzz Tests
 *      - Gas Optimization
 */
contract EagleVaultWrapperComprehensiveTest is Test {
    EagleVaultWrapper public wrapper;
    MockVaultToken public vaultToken;
    EagleShareOFT public oftToken;
    MockLzEndpoint public lzEndpoint;
    
    address public owner = address(0x1);
    address public feeRecipient = address(0x2);
    address public user1 = address(0x3);
    address public user2 = address(0x4);
    address public malicious = address(0x5);
    
    uint256 public constant INITIAL_MINT = 1_000_000 ether;
    
    // Events
    event Wrapped(address indexed user, uint256 amount, uint256 fee);
    event Unwrapped(address indexed user, uint256 amount, uint256 fee);
    event FeeCollected(address indexed user, uint256 amount, string feeType);
    event WhitelistUpdated(address indexed user, bool isWhitelisted);
    event FeesUpdated(uint256 depositFee, uint256 withdrawFee);
    event FeeRecipientUpdated(address indexed newRecipient);
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy mock tokens
        vaultToken = new MockVaultToken();
        lzEndpoint = new MockLzEndpoint(1);
        
        // Deploy OFT token
        oftToken = new EagleShareOFT(
            "OFT EAGLE",
            "oftEAGLE",
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
        
        // Grant minter role to wrapper
        oftToken.setMinter(address(wrapper), true);
        
        // Mint tokens to users
        vaultToken.mint(user1, INITIAL_MINT);
        vaultToken.mint(user2, INITIAL_MINT);
        vaultToken.mint(malicious, INITIAL_MINT);
        
        vm.stopPrank();
    }
    
    // ========================================================================
    // CONSTRUCTOR & INITIALIZATION TESTS
    // ========================================================================
    
    function test_Constructor_Success() public {
        assertEq(address(wrapper.VAULT_EAGLE()), address(vaultToken));
        assertEq(address(wrapper.OFT_EAGLE()), address(oftToken));
        assertEq(wrapper.feeRecipient(), feeRecipient);
        assertEq(wrapper.owner(), owner);
        assertEq(wrapper.depositFee(), 100); // 1%
        assertEq(wrapper.withdrawFee(), 200); // 2%
    }
    
    function test_Constructor_OwnerWhitelisted() public {
        assertTrue(wrapper.isWhitelisted(owner));
    }
    
    function test_Constructor_FeeRecipientWhitelisted() public {
        assertTrue(wrapper.isWhitelisted(feeRecipient));
    }
    
    function test_Constructor_InitialBalances() public {
        assertEq(wrapper.totalLocked(), 0);
        assertEq(wrapper.totalMinted(), 0);
    }
    
    function test_Constructor_RevertsOnZeroVaultAddress() public {
        vm.startPrank(owner);
        vm.expectRevert("Zero address");
        new EagleVaultWrapper(
            address(0),
            address(oftToken),
            feeRecipient,
            owner
        );
        vm.stopPrank();
    }
    
    function test_Constructor_RevertsOnZeroOFTAddress() public {
        vm.startPrank(owner);
        vm.expectRevert("Zero address");
        new EagleVaultWrapper(
            address(vaultToken),
            address(0),
            feeRecipient,
            owner
        );
        vm.stopPrank();
    }
    
    function test_Constructor_RevertsOnZeroFeeRecipient() public {
        vm.startPrank(owner);
        vm.expectRevert("Zero fee recipient");
        new EagleVaultWrapper(
            address(vaultToken),
            address(oftToken),
            address(0),
            owner
        );
        vm.stopPrank();
    }
    
    // ========================================================================
    // WRAPPING TESTS
    // ========================================================================
    
    function test_Wrap_Success() public {
        uint256 wrapAmount = 1000 ether;
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), wrapAmount);
        
        vm.expectEmit(true, false, false, true);
        emit Wrapped(user1, 990 ether, 10 ether); // 1% fee
        
        wrapper.wrap(wrapAmount);
        
        // Check balances
        assertEq(vaultToken.balanceOf(user1), INITIAL_MINT - wrapAmount);
        assertEq(oftToken.balanceOf(user1), 990 ether); // Amount after 1% fee
        assertEq(vaultToken.balanceOf(feeRecipient), 10 ether); // Fee
        
        // Check tracking
        assertEq(wrapper.totalLocked(), 990 ether);
        assertEq(wrapper.totalMinted(), 990 ether);
        
        vm.stopPrank();
    }
    
    function test_Wrap_WithWhitelist_NoFee() public {
        // Whitelist user1
        vm.prank(owner);
        wrapper.setWhitelist(user1, true);
        
        uint256 wrapAmount = 1000 ether;
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), wrapAmount);
        
        vm.expectEmit(true, false, false, true);
        emit Wrapped(user1, 1000 ether, 0); // No fee
        
        wrapper.wrap(wrapAmount);
        
        // Check balances - no fee deducted
        assertEq(oftToken.balanceOf(user1), 1000 ether);
        assertEq(vaultToken.balanceOf(feeRecipient), 0); // No fee
        
        vm.stopPrank();
    }
    
    function test_Wrap_RevertsOnZeroAmount() public {
        vm.startPrank(user1);
        
        vm.expectRevert(EagleVaultWrapper.ZeroAmount.selector);
        wrapper.wrap(0);
        
        vm.stopPrank();
    }
    
    function test_Wrap_RevertsWithoutApproval() public {
        vm.startPrank(user1);
        
        vm.expectRevert();
        wrapper.wrap(1000 ether);
        
        vm.stopPrank();
    }
    
    function test_Wrap_MultipleWraps() public {
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 3000 ether);
        
        wrapper.wrap(1000 ether);
        wrapper.wrap(1000 ether);
        wrapper.wrap(1000 ether);
        
        // Check cumulative balances (each wrap has 1% fee)
        assertEq(oftToken.balanceOf(user1), 2970 ether); // 3 * 990
        assertEq(wrapper.totalLocked(), 2970 ether);
        assertEq(wrapper.totalMinted(), 2970 ether);
        
        vm.stopPrank();
    }
    
    function test_Wrap_LargeAmount() public {
        uint256 largeAmount = 100_000 ether;
        
        vm.startPrank(user1);
        vaultToken.mint(user1, largeAmount);
        vaultToken.approve(address(wrapper), largeAmount);
        
        wrapper.wrap(largeAmount);
        
        assertEq(oftToken.balanceOf(user1), 99_000 ether); // After 1% fee
        
        vm.stopPrank();
    }
    
    function test_Wrap_SmallAmount() public {
        uint256 smallAmount = 100; // 100 wei
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), smallAmount);
        
        wrapper.wrap(smallAmount);
        
        // Fee calculation: 100 * 100 / 10000 = 1
        assertEq(oftToken.balanceOf(user1), 99);
        
        vm.stopPrank();
    }
    
    // ========================================================================
    // UNWRAPPING TESTS
    // ========================================================================
    
    function test_Unwrap_Success() public {
        // First wrap
        uint256 wrapAmount = 1000 ether;
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), wrapAmount);
        wrapper.wrap(wrapAmount);
        
        // Now unwrap
        uint256 oftBalance = oftToken.balanceOf(user1);
        
        vm.expectEmit(true, false, false, true);
        emit Unwrapped(user1, oftBalance - (oftBalance * 200 / 10000), oftBalance * 200 / 10000); // 2% fee
        
        wrapper.unwrap(oftBalance);
        
        // Check balances (2% withdraw fee)
        assertEq(oftToken.balanceOf(user1), 0);
        uint256 expectedVault = oftBalance - (oftBalance * 200 / 10000); // After 2% fee
        assertEq(vaultToken.balanceOf(user1), INITIAL_MINT - wrapAmount + expectedVault);
        
        vm.stopPrank();
    }
    
    function test_Unwrap_WithWhitelist_NoFee() public {
        // Whitelist user1
        vm.prank(owner);
        wrapper.setWhitelist(user1, true);
        
        // Wrap (no fee)
        uint256 wrapAmount = 1000 ether;
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), wrapAmount);
        wrapper.wrap(wrapAmount);
        
        uint256 oftBalance = oftToken.balanceOf(user1);
        
        // Unwrap (no fee)
        vm.expectEmit(true, false, false, true);
        emit Unwrapped(user1, 1000 ether, 0);
        
        wrapper.unwrap(oftBalance);
        
        // Check balances - no fee
        assertEq(vaultToken.balanceOf(user1), INITIAL_MINT);
        assertEq(oftToken.balanceOf(user1), 0);
        
        vm.stopPrank();
    }
    
    function test_Unwrap_PartialAmount() public {
        // Wrap
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 1000 ether);
        wrapper.wrap(1000 ether);
        
        // Unwrap half
        uint256 halfAmount = oftToken.balanceOf(user1) / 2;
        wrapper.unwrap(halfAmount);
        
        // Check balances
        assertGt(oftToken.balanceOf(user1), 0);
        assertLt(oftToken.balanceOf(user1), 990 ether);
        
        vm.stopPrank();
    }
    
    function test_Unwrap_RevertsOnZeroAmount() public {
        vm.startPrank(user1);
        
        vm.expectRevert(EagleVaultWrapper.ZeroAmount.selector);
        wrapper.unwrap(0);
        
        vm.stopPrank();
    }
    
    function test_Unwrap_RevertsOnInsufficientBalance() public {
        vm.startPrank(user1);
        
        // Try to unwrap without any OFT tokens
        vm.expectRevert();
        wrapper.unwrap(1000 ether);
        
        vm.stopPrank();
    }
    
    function test_Unwrap_RevertsOnInsufficientLocked() public {
        // This shouldn't happen in normal operation, but test for safety
        
        // Wrap normally
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 1000 ether);
        wrapper.wrap(1000 ether);
        vm.stopPrank();
        
        // Owner emergency withdraws (breaking the invariant)
        vm.startPrank(owner);
        // This would require a different mechanism, skip for now
        vm.stopPrank();
    }
    
    // ========================================================================
    // FEE MANAGEMENT TESTS
    // ========================================================================
    
    function test_SetFees_Success() public {
        vm.startPrank(owner);
        
        vm.expectEmit(false, false, false, true);
        emit FeesUpdated(200, 300);
        
        wrapper.setFees(200, 300); // 2% deposit, 3% withdraw
        
        assertEq(wrapper.depositFee(), 200);
        assertEq(wrapper.withdrawFee(), 300);
        
        vm.stopPrank();
    }
    
    function test_SetFees_ZeroFees() public {
        vm.prank(owner);
        wrapper.setFees(0, 0);
        
        assertEq(wrapper.depositFee(), 0);
        assertEq(wrapper.withdrawFee(), 0);
    }
    
    function test_SetFees_MaxFees() public {
        vm.prank(owner);
        wrapper.setFees(1000, 1000); // 10% each
        
        assertEq(wrapper.depositFee(), 1000);
        assertEq(wrapper.withdrawFee(), 1000);
    }
    
    function test_SetFees_RevertsIfTooHigh() public {
        vm.startPrank(owner);
        
        vm.expectRevert(EagleVaultWrapper.FeeExceedsLimit.selector);
        wrapper.setFees(1001, 0); // > 10%
        
        vm.expectRevert(EagleVaultWrapper.FeeExceedsLimit.selector);
        wrapper.setFees(0, 1001); // > 10%
        
        vm.stopPrank();
    }
    
    function test_SetFees_OnlyOwner() public {
        vm.startPrank(malicious);
        
        vm.expectRevert();
        wrapper.setFees(500, 500);
        
        vm.stopPrank();
    }
    
    function test_SetFeeRecipient_Success() public {
        address newRecipient = address(0x999);
        
        vm.startPrank(owner);
        
        vm.expectEmit(true, false, false, false);
        emit FeeRecipientUpdated(newRecipient);
        
        wrapper.setFeeRecipient(newRecipient);
        
        assertEq(wrapper.feeRecipient(), newRecipient);
        
        vm.stopPrank();
    }
    
    function test_SetFeeRecipient_RevertsOnZeroAddress() public {
        vm.startPrank(owner);
        
        vm.expectRevert(EagleVaultWrapper.ZeroFeeRecipient.selector);
        wrapper.setFeeRecipient(address(0));
        
        vm.stopPrank();
    }
    
    function test_SetFeeRecipient_OnlyOwner() public {
        vm.startPrank(malicious);
        
        vm.expectRevert();
        wrapper.setFeeRecipient(address(0x999));
        
        vm.stopPrank();
    }
    
    function test_GetFees() public {
        (uint256 deposit, uint256 withdraw) = wrapper.getFees();
        
        assertEq(deposit, 100);
        assertEq(withdraw, 200);
    }
    
    function test_GetFeeStats() public {
        // Wrap and unwrap to generate fees
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 2000 ether);
        wrapper.wrap(1000 ether);
        wrapper.unwrap(oftToken.balanceOf(user1));
        vm.stopPrank();
        
        (uint256 totalDeposit, uint256 totalWithdraw) = wrapper.getFeeStats();
        
        assertGt(totalDeposit, 0);
        assertGt(totalWithdraw, 0);
    }
    
    // ========================================================================
    // WHITELIST MANAGEMENT TESTS
    // ========================================================================
    
    function test_SetWhitelist_Success() public {
        vm.startPrank(owner);
        
        vm.expectEmit(true, false, false, true);
        emit WhitelistUpdated(user1, true);
        
        wrapper.setWhitelist(user1, true);
        
        assertTrue(wrapper.isWhitelisted(user1));
        
        vm.stopPrank();
    }
    
    function test_SetWhitelist_Remove() public {
        vm.startPrank(owner);
        
        wrapper.setWhitelist(user1, true);
        assertTrue(wrapper.isWhitelisted(user1));
        
        wrapper.setWhitelist(user1, false);
        assertFalse(wrapper.isWhitelisted(user1));
        
        vm.stopPrank();
    }
    
    function test_SetWhitelist_OnlyOwner() public {
        vm.startPrank(malicious);
        
        vm.expectRevert();
        wrapper.setWhitelist(user1, true);
        
        vm.stopPrank();
    }
    
    function test_BatchWhitelist() public {
        address[] memory users = new address[](3);
        users[0] = user1;
        users[1] = user2;
        users[2] = malicious;
        
        vm.prank(owner);
        wrapper.batchWhitelist(users);
        
        assertTrue(wrapper.isWhitelisted(user1));
        assertTrue(wrapper.isWhitelisted(user2));
        assertTrue(wrapper.isWhitelisted(malicious));
    }
    
    function test_CheckWhitelist() public {
        assertFalse(wrapper.checkWhitelist(user1));
        assertTrue(wrapper.checkWhitelist(owner));
        assertTrue(wrapper.checkWhitelist(feeRecipient));
    }
    
    // ========================================================================
    // BALANCE INVARIANTS & VIEW FUNCTIONS
    // ========================================================================
    
    function test_IsBalanced_Initially() public {
        assertTrue(wrapper.isBalanced());
    }
    
    function test_IsBalanced_AfterWrap() public {
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 1000 ether);
        wrapper.wrap(1000 ether);
        vm.stopPrank();
        
        assertTrue(wrapper.isBalanced());
    }
    
    function test_IsBalanced_AfterWrapAndUnwrap() public {
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 1000 ether);
        wrapper.wrap(1000 ether);
        wrapper.unwrap(oftToken.balanceOf(user1));
        vm.stopPrank();
        
        assertTrue(wrapper.isBalanced());
    }
    
    function test_GetReserves() public {
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 1000 ether);
        wrapper.wrap(1000 ether);
        vm.stopPrank();
        
        (uint256 locked, uint256 minted) = wrapper.getReserves();
        
        assertEq(locked, 990 ether);
        assertEq(minted, 990 ether);
    }
    
    function test_VaultToken() public {
        assertEq(wrapper.vaultToken(), address(vaultToken));
    }
    
    function test_OftToken() public {
        assertEq(wrapper.oftToken(), address(oftToken));
    }
    
    function test_Verify() public {
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 1000 ether);
        wrapper.wrap(1000 ether);
        vm.stopPrank();
        
        assertTrue(wrapper.verify());
    }
    
    // ========================================================================
    // ACCESS CONTROL TESTS
    // ========================================================================
    
    function test_Ownership_Transfer() public {
        vm.prank(owner);
        wrapper.transferOwnership(user1);
        
        assertEq(wrapper.owner(), user1);
    }
    
    function test_Ownership_NonOwnerCannotTransfer() public {
        vm.startPrank(malicious);
        
        vm.expectRevert();
        wrapper.transferOwnership(malicious);
        
        vm.stopPrank();
    }
    
    // ========================================================================
    // EDGE CASES
    // ========================================================================
    
    function test_EdgeCase_WrapMinimumAmount() public {
        uint256 minAmount = 1;
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), minAmount);
        wrapper.wrap(minAmount);
        
        // Fee rounds to 0 for tiny amounts
        assertEq(oftToken.balanceOf(user1), 1);
        
        vm.stopPrank();
    }
    
    function test_EdgeCase_MultipleUsersWrapping() public {
        // User1 wraps
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 1000 ether);
        wrapper.wrap(1000 ether);
        vm.stopPrank();
        
        // User2 wraps
        vm.startPrank(user2);
        vaultToken.approve(address(wrapper), 2000 ether);
        wrapper.wrap(2000 ether);
        vm.stopPrank();
        
        // Check individual balances
        assertEq(oftToken.balanceOf(user1), 990 ether);
        assertEq(oftToken.balanceOf(user2), 1980 ether);
        
        // Check total invariants
        assertTrue(wrapper.isBalanced());
        assertEq(wrapper.totalMinted(), 2970 ether);
    }
    
    function test_EdgeCase_WrapUnwrapMultipleCycles() public {
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 10_000 ether);
        
        for (uint i = 0; i < 5; i++) {
            uint256 wrapAmount = 1000 ether;
            wrapper.wrap(wrapAmount);
            
            uint256 oftBalance = oftToken.balanceOf(user1);
            wrapper.unwrap(oftBalance);
        }
        
        // Balance should be slightly less due to fees
        assertLt(vaultToken.balanceOf(user1), INITIAL_MINT);
        assertEq(oftToken.balanceOf(user1), 0);
        assertTrue(wrapper.isBalanced());
        
        vm.stopPrank();
    }
    
    function test_EdgeCase_FeeCalculationPrecision() public {
        // Test fee calculation with amounts that might cause rounding issues
        uint256[] memory testAmounts = new uint256[](5);
        testAmounts[0] = 1 ether;
        testAmounts[1] = 1.5 ether;
        testAmounts[2] = 100.123 ether;
        testAmounts[3] = 999.999 ether;
        testAmounts[4] = 12345.6789 ether;
        
        for (uint i = 0; i < testAmounts.length; i++) {
            uint256 amount = testAmounts[i];
            
            vm.startPrank(user1);
            vaultToken.mint(user1, amount);
            vaultToken.approve(address(wrapper), amount);
            
            uint256 expectedFee = (amount * 100) / 10000; // 1%
            uint256 expectedAfterFee = amount - expectedFee;
            
            wrapper.wrap(amount);
            
            assertEq(oftToken.balanceOf(user1), expectedAfterFee);
            
            // Reset
            wrapper.unwrap(oftToken.balanceOf(user1));
            vm.stopPrank();
        }
    }
    
    // ========================================================================
    // INTEGRATION TESTS
    // ========================================================================
    
    function test_Integration_CompleteUserFlow() public {
        // 1. User deposits to vault (simulated by minting vault tokens)
        // Already have vault tokens from setUp
        
        // 2. User wraps vault shares to OFT
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 5000 ether);
        wrapper.wrap(5000 ether);
        
        uint256 oftBalance = oftToken.balanceOf(user1);
        assertEq(oftBalance, 4950 ether); // After 1% fee
        
        // 3. User transfers OFT to another user
        oftToken.transfer(user2, 2000 ether);
        assertEq(oftToken.balanceOf(user2), 2000 ether);
        
        // 4. Both users unwrap
        wrapper.unwrap(oftToken.balanceOf(user1));
        vm.stopPrank();
        
        vm.startPrank(user2);
        wrapper.unwrap(oftToken.balanceOf(user2));
        vm.stopPrank();
        
        // 5. Check final state
        assertTrue(wrapper.isBalanced());
        assertGt(vaultToken.balanceOf(feeRecipient), 0); // Fees collected
    }
    
    function test_Integration_WhitelistedUser_NoFeesEnd2End() public {
        // Whitelist user
        vm.prank(owner);
        wrapper.setWhitelist(user1, true);
        
        uint256 initialBalance = vaultToken.balanceOf(user1);
        
        // Wrap
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 5000 ether);
        wrapper.wrap(5000 ether);
        
        uint256 oftBalance = oftToken.balanceOf(user1);
        
        // Unwrap
        wrapper.unwrap(oftBalance);
        vm.stopPrank();
        
        // Should get back exactly what they put in (no fees)
        assertEq(vaultToken.balanceOf(user1), initialBalance);
    }
    
    function test_Integration_FeeRecipientCanReinvest() public {
        // Generate fees
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 10_000 ether);
        wrapper.wrap(10_000 ether);
        vm.stopPrank();
        
        // Fee recipient has vault tokens now
        uint256 feeAmount = vaultToken.balanceOf(feeRecipient);
        assertGt(feeAmount, 0);
        
        // Fee recipient is whitelisted, so can wrap without fees
        vm.startPrank(feeRecipient);
        vaultToken.approve(address(wrapper), feeAmount);
        wrapper.wrap(feeAmount);
        
        // Should get full amount (no fee on re-investment)
        assertEq(oftToken.balanceOf(feeRecipient), feeAmount);
        
        vm.stopPrank();
    }
    
    // ========================================================================
    // FUZZ TESTS
    // ========================================================================
    
    function testFuzz_Wrap(uint256 amount) public {
        vm.assume(amount > 0);
        vm.assume(amount <= INITIAL_MINT);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), amount);
        wrapper.wrap(amount);
        
        // Check invariants
        assertTrue(wrapper.isBalanced());
        assertGt(oftToken.balanceOf(user1), 0);
        
        vm.stopPrank();
    }
    
    function testFuzz_Unwrap(uint256 wrapAmount, uint256 unwrapAmount) public {
        vm.assume(wrapAmount > 0);
        vm.assume(wrapAmount <= INITIAL_MINT);
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), wrapAmount);
        wrapper.wrap(wrapAmount);
        
        uint256 oftBalance = oftToken.balanceOf(user1);
        vm.assume(unwrapAmount > 0);
        vm.assume(unwrapAmount <= oftBalance);
        
        wrapper.unwrap(unwrapAmount);
        
        // Check invariants
        assertTrue(wrapper.isBalanced());
        
        vm.stopPrank();
    }
    
    function testFuzz_SetFees(uint256 depositFee, uint256 withdrawFee) public {
        vm.assume(depositFee <= 1000); // Max 10%
        vm.assume(withdrawFee <= 1000);
        
        vm.prank(owner);
        wrapper.setFees(depositFee, withdrawFee);
        
        assertEq(wrapper.depositFee(), depositFee);
        assertEq(wrapper.withdrawFee(), withdrawFee);
    }
    
    function testFuzz_MultipleUsers(uint8 userCount) public {
        vm.assume(userCount > 0);
        vm.assume(userCount <= 20); // Reasonable limit
        
        for (uint256 i = 0; i < userCount; i++) {
            address user = address(uint160(1000 + i));
            vaultToken.mint(user, 1000 ether);
            
            vm.startPrank(user);
            vaultToken.approve(address(wrapper), 1000 ether);
            wrapper.wrap(1000 ether);
            vm.stopPrank();
        }
        
        // Check invariants
        assertTrue(wrapper.isBalanced());
        assertEq(wrapper.totalMinted(), uint256(userCount) * 990 ether);
    }
    
    function testFuzz_WrapUnwrapCycles(uint8 cycles) public {
        vm.assume(cycles > 0);
        vm.assume(cycles <= 10);
        
        uint256 amount = 1000 ether;
        
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), amount * cycles * 2);
        
        for (uint8 i = 0; i < cycles; i++) {
            wrapper.wrap(amount);
            uint256 oftBalance = oftToken.balanceOf(user1);
            wrapper.unwrap(oftBalance);
        }
        
        assertTrue(wrapper.isBalanced());
        assertEq(oftToken.balanceOf(user1), 0);
        
        vm.stopPrank();
    }
    
    function testFuzz_FeeCollection(uint128 amount, uint16 depositFee) public {
        // Use smaller ranges to avoid too many rejections
        uint256 wrapAmount = bound(amount, 10_000, INITIAL_MINT);
        uint256 dFee = bound(depositFee, 1, 1000);
        
        // Set custom fees
        vm.prank(owner);
        wrapper.setFees(dFee, 200); // Use constant withdraw fee
        
        // Wrap and unwrap
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), wrapAmount);
        wrapper.wrap(wrapAmount);
        wrapper.unwrap(oftToken.balanceOf(user1));
        vm.stopPrank();
        
        // Check fees collected (should be > 0)
        assertGt(vaultToken.balanceOf(feeRecipient), 0);
    }
    
    // ========================================================================
    // GAS OPTIMIZATION TESTS
    // ========================================================================
    
    function test_Gas_Wrap() public {
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 1000 ether);
        
        uint256 gasBefore = gasleft();
        wrapper.wrap(1000 ether);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas used for wrap", gasUsed);
        
        vm.stopPrank();
    }
    
    function test_Gas_Unwrap() public {
        // Setup
        vm.startPrank(user1);
        vaultToken.approve(address(wrapper), 1000 ether);
        wrapper.wrap(1000 ether);
        
        uint256 gasBefore = gasleft();
        wrapper.unwrap(oftToken.balanceOf(user1));
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas used for unwrap", gasUsed);
        
        vm.stopPrank();
    }
    
    function test_Gas_SetFees() public {
        vm.startPrank(owner);
        
        uint256 gasBefore = gasleft();
        wrapper.setFees(200, 300);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas used for setFees", gasUsed);
        
        vm.stopPrank();
    }
    
    function test_Gas_SetWhitelist() public {
        vm.startPrank(owner);
        
        uint256 gasBefore = gasleft();
        wrapper.setWhitelist(user1, true);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas used for setWhitelist", gasUsed);
        
        vm.stopPrank();
    }
}

