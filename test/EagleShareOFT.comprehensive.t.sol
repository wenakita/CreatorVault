// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "../contracts/layerzero/oft/EagleShareOFT.sol";
import { MessagingFee, MessagingReceipt, OFTReceipt } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";
import { SendParam, OFTLimit, OFTFeeDetail } from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

/**
 * @title MockLzEndpoint
 * @notice Mock for LayerZero endpoint with extended functionality
 */
contract MockLzEndpoint {
    mapping(address => address) public delegates;
    mapping(uint32 => bool) public supportedEids;
    
    uint32 private _eid;
    
    constructor(uint32 eid_) {
        _eid = eid_;
        supportedEids[eid_] = true;
    }
    
    function setDelegate(address _delegate) external {
        delegates[msg.sender] = _delegate;
    }
    
    function eid() external view returns (uint32) {
        return _eid;
    }
    
    // Mock send function for LayerZero messaging
    function send(
        uint32 /*_dstEid*/,
        bytes32 /*_receiver*/,
        bytes calldata /*_message*/,
        address /*_refundAddress*/
    ) external payable returns (MessagingReceipt memory receipt) {
        receipt.guid = bytes32(uint256(1));
        receipt.nonce = 1;
        receipt.fee.nativeFee = msg.value;
    }
    
    function quote(
        uint32 /*_dstEid*/,
        bytes32 /*_receiver*/,
        bytes calldata /*_message*/,
        bool /*_payInLzToken*/
    ) external pure returns (MessagingFee memory fee) {
        fee.nativeFee = 0.01 ether;
        fee.lzTokenFee = 0;
    }
}

/**
 * @title EagleShareOFTComprehensiveTest
 * @notice Comprehensive test suite covering all aspects of EagleShareOFT
 * 
 * TEST COVERAGE:
 * 1. Constructor & Initialization
 * 2. Minting & Burning
 * 3. Minter Role Management
 * 4. LayerZero Integration
 * 5. ERC20 Functionality
 * 6. Edge Cases & Error Conditions
 * 7. Access Control
 * 8. Integration Scenarios
 * 9. Fuzz Testing
 */
contract EagleShareOFTComprehensiveTest is Test {
    EagleShareOFT public oft;
    MockLzEndpoint public lzEndpoint;
    MockLzEndpoint public remoteLzEndpoint;
    
    address public owner = address(0x1);
    address public minter1 = address(0x2);
    address public minter2 = address(0x3);
    address public user1 = address(0x4);
    address public user2 = address(0x5);
    address public malicious = address(0x6);
    
    uint32 public constant LOCAL_EID = 1; // Ethereum
    uint32 public constant REMOTE_EID = 110; // Arbitrum
    
    // Events
    event MinterUpdated(address indexed minter, bool status);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy mock LayerZero endpoints
        lzEndpoint = new MockLzEndpoint(LOCAL_EID);
        remoteLzEndpoint = new MockLzEndpoint(REMOTE_EID);
        
        // Deploy EagleShareOFT
        oft = new EagleShareOFT(
            "Eagle Share Token",
            "EAGLE",
            address(lzEndpoint),
            owner
        );
        
        vm.stopPrank();
    }
    
    // ========================================================================
    // CONSTRUCTOR & INITIALIZATION TESTS
    // ========================================================================
    
    function test_Constructor_Success() public {
        assertEq(oft.name(), "Eagle Share Token");
        assertEq(oft.symbol(), "EAGLE");
        assertEq(oft.decimals(), 18);
        assertEq(oft.owner(), owner);
        assertEq(oft.totalSupply(), 0);
        assertEq(oft.version(), "2.0.0-mainnet-simple");
    }
    
    function test_Constructor_RevertsOnZeroDelegate() public {
        vm.startPrank(owner);
        MockLzEndpoint endpoint = new MockLzEndpoint(LOCAL_EID);
        
        // Expecting revert from Ownable or custom error
        vm.expectRevert();
        new EagleShareOFT(
            "Eagle Share Token",
            "EAGLE",
            address(endpoint),
            address(0)
        );
        vm.stopPrank();
    }
    
    function test_Constructor_RevertsOnZeroEndpoint() public {
        vm.startPrank(owner);
        vm.expectRevert();
        new EagleShareOFT(
            "Eagle Share Token",
            "EAGLE",
            address(0),
            owner
        );
        vm.stopPrank();
    }
    
    function test_Constructor_NoInitialSupply() public {
        assertEq(oft.totalSupply(), 0);
        assertEq(oft.balanceOf(owner), 0);
        assertEq(oft.balanceOf(address(oft)), 0);
    }
    
    // ========================================================================
    // MINTING TESTS
    // ========================================================================
    
    function test_Mint_ByOwner() public {
        vm.startPrank(owner);
        
        uint256 amount = 1000 ether;
        vm.expectEmit(true, true, false, true);
        emit Transfer(address(0), user1, amount);
        
        oft.mint(user1, amount);
        
        assertEq(oft.balanceOf(user1), amount);
        assertEq(oft.totalSupply(), amount);
        
        vm.stopPrank();
    }
    
    function test_Mint_ByAuthorizedMinter() public {
        vm.prank(owner);
        oft.setMinter(minter1, true);
        
        vm.startPrank(minter1);
        
        uint256 amount = 500 ether;
        oft.mint(user1, amount);
        
        assertEq(oft.balanceOf(user1), amount);
        assertEq(oft.totalSupply(), amount);
        
        vm.stopPrank();
    }
    
    function test_Mint_RevertsForUnauthorized() public {
        vm.startPrank(malicious);
        
        vm.expectRevert(EagleShareOFT.NotMinter.selector);
        oft.mint(user1, 100 ether);
        
        vm.stopPrank();
    }
    
    function test_Mint_RevertsOnZeroAddress() public {
        vm.startPrank(owner);
        
        vm.expectRevert(EagleShareOFT.ZeroAddress.selector);
        oft.mint(address(0), 100 ether);
        
        vm.stopPrank();
    }
    
    function test_Mint_RevertsOnZeroAmount() public {
        vm.startPrank(owner);
        
        vm.expectRevert("Mint amount must be greater than 0");
        oft.mint(user1, 0);
        
        vm.stopPrank();
    }
    
    function test_Mint_MultipleMintersSequentially() public {
        vm.prank(owner);
        oft.setMinter(minter1, true);
        
        vm.prank(owner);
        oft.setMinter(minter2, true);
        
        vm.prank(minter1);
        oft.mint(user1, 100 ether);
        
        vm.prank(minter2);
        oft.mint(user1, 200 ether);
        
        assertEq(oft.balanceOf(user1), 300 ether);
    }
    
    function test_Mint_LargeAmount() public {
        vm.startPrank(owner);
        
        uint256 largeAmount = type(uint256).max / 2; // Half of max uint256
        oft.mint(user1, largeAmount);
        
        assertEq(oft.balanceOf(user1), largeAmount);
        
        vm.stopPrank();
    }
    
    function test_Mint_MultipleRecipients() public {
        vm.startPrank(owner);
        
        oft.mint(user1, 100 ether);
        oft.mint(user2, 200 ether);
        oft.mint(minter1, 300 ether);
        
        assertEq(oft.balanceOf(user1), 100 ether);
        assertEq(oft.balanceOf(user2), 200 ether);
        assertEq(oft.balanceOf(minter1), 300 ether);
        assertEq(oft.totalSupply(), 600 ether);
        
        vm.stopPrank();
    }
    
    // ========================================================================
    // BURNING TESTS
    // ========================================================================
    
    function test_Burn_ByOwner() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(owner);
        
        uint256 burnAmount = 300 ether;
        vm.expectEmit(true, true, false, true);
        emit Transfer(user1, address(0), burnAmount);
        
        oft.burn(user1, burnAmount);
        
        assertEq(oft.balanceOf(user1), 700 ether);
        assertEq(oft.totalSupply(), 700 ether);
        
        vm.stopPrank();
    }
    
    function test_Burn_ByAuthorizedMinter() public {
        vm.startPrank(owner);
        oft.setMinter(minter1, true);
        oft.mint(user1, 1000 ether);
        vm.stopPrank();
        
        vm.startPrank(minter1);
        
        uint256 burnAmount = 400 ether;
        oft.burn(user1, burnAmount);
        
        assertEq(oft.balanceOf(user1), 600 ether);
        assertEq(oft.totalSupply(), 600 ether);
        
        vm.stopPrank();
    }
    
    function test_Burn_RevertsForUnauthorized() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(malicious);
        
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
        oft.burn(user1, 200 ether);
        
        vm.stopPrank();
    }
    
    function test_Burn_AllBalance() public {
        vm.startPrank(owner);
        
        oft.mint(user1, 1000 ether);
        oft.burn(user1, 1000 ether);
        
        assertEq(oft.balanceOf(user1), 0);
        assertEq(oft.totalSupply(), 0);
        
        vm.stopPrank();
    }
    
    function test_Burn_WithAllowance_NonMinterRequiresAllowance() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.prank(user1);
        oft.approve(malicious, 500 ether);
        
        // Malicious user is NOT a minter, so burn should revert with NotMinter
        vm.startPrank(malicious);
        vm.expectRevert(EagleShareOFT.NotMinter.selector);
        oft.burn(user1, 200 ether);
        vm.stopPrank();
    }
    
    function test_Burn_MinterDoesNotNeedAllowance() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.prank(owner);
        oft.setMinter(minter1, true);
        
        // Minter can burn without approval
        vm.startPrank(minter1);
        oft.burn(user1, 200 ether);
        
        assertEq(oft.balanceOf(user1), 800 ether);
        assertEq(oft.allowance(user1, minter1), 0); // No allowance was set
        
        vm.stopPrank();
    }
    
    // ========================================================================
    // MINTER ROLE MANAGEMENT TESTS
    // ========================================================================
    
    function test_SetMinter_Success() public {
        vm.startPrank(owner);
        
        vm.expectEmit(true, false, false, true);
        emit MinterUpdated(minter1, true);
        
        oft.setMinter(minter1, true);
        
        assertTrue(oft.isMinter(minter1));
        assertTrue(oft.checkMinter(minter1));
        
        vm.stopPrank();
    }
    
    function test_SetMinter_OnlyOwner() public {
        vm.startPrank(malicious);
        
        vm.expectRevert();
        oft.setMinter(minter1, true);
        
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
        
        oft.setMinter(minter1, true);
        assertTrue(oft.isMinter(minter1));
        
        vm.expectEmit(true, false, false, true);
        emit MinterUpdated(minter1, false);
        
        oft.setMinter(minter1, false);
        
        assertFalse(oft.isMinter(minter1));
        assertFalse(oft.checkMinter(minter1));
        
        vm.stopPrank();
    }
    
    function test_RemoveMinter_PreventsSubsequentMinting() public {
        vm.prank(owner);
        oft.setMinter(minter1, true);
        
        vm.prank(minter1);
        oft.mint(user1, 100 ether);
        
        vm.prank(owner);
        oft.setMinter(minter1, false);
        
        vm.startPrank(minter1);
        vm.expectRevert(EagleShareOFT.NotMinter.selector);
        oft.mint(user1, 100 ether);
        vm.stopPrank();
    }
    
    function test_CheckMinter_OwnerIsAlwaysMinter() public {
        assertTrue(oft.checkMinter(owner));
        assertFalse(oft.isMinter(owner)); // Not in mapping, but checkMinter returns true
    }
    
    function test_CheckMinter_NonMinterReturnsFalse() public {
        assertFalse(oft.checkMinter(user1));
        assertFalse(oft.isMinter(user1));
    }
    
    function test_MultipleMinters_CanCoexist() public {
        vm.startPrank(owner);
        
        oft.setMinter(minter1, true);
        oft.setMinter(minter2, true);
        
        assertTrue(oft.isMinter(minter1));
        assertTrue(oft.isMinter(minter2));
        
        vm.stopPrank();
        
        vm.prank(minter1);
        oft.mint(user1, 100 ether);
        
        vm.prank(minter2);
        oft.mint(user2, 200 ether);
        
        assertEq(oft.balanceOf(user1), 100 ether);
        assertEq(oft.balanceOf(user2), 200 ether);
    }
    
    // ========================================================================
    // ERC20 STANDARD FUNCTIONALITY TESTS
    // ========================================================================
    
    function test_Transfer_Success() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(user1);
        
        vm.expectEmit(true, true, false, true);
        emit Transfer(user1, user2, 300 ether);
        
        oft.transfer(user2, 300 ether);
        
        assertEq(oft.balanceOf(user1), 700 ether);
        assertEq(oft.balanceOf(user2), 300 ether);
        
        vm.stopPrank();
    }
    
    function test_Transfer_NoFees() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(user1);
        
        uint256 transferAmount = 300 ether;
        oft.transfer(user2, transferAmount);
        
        assertEq(oft.balanceOf(user2), transferAmount); // Exact amount, no fees
        
        vm.stopPrank();
    }
    
    function test_TransferFrom_Success() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.prank(user1);
        oft.approve(user2, 500 ether);
        
        vm.startPrank(user2);
        
        oft.transferFrom(user1, user2, 400 ether);
        
        assertEq(oft.balanceOf(user1), 600 ether);
        assertEq(oft.balanceOf(user2), 400 ether);
        assertEq(oft.allowance(user1, user2), 100 ether);
        
        vm.stopPrank();
    }
    
    function test_TransferFrom_RevertsOnInsufficientAllowance() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.prank(user1);
        oft.approve(user2, 100 ether);
        
        vm.startPrank(user2);
        
        vm.expectRevert();
        oft.transferFrom(user1, user2, 200 ether);
        
        vm.stopPrank();
    }
    
    function test_Approve_Success() public {
        vm.startPrank(user1);
        
        vm.expectEmit(true, true, false, true);
        emit Approval(user1, user2, 500 ether);
        
        oft.approve(user2, 500 ether);
        
        assertEq(oft.allowance(user1, user2), 500 ether);
        
        vm.stopPrank();
    }
    
    function test_Approve_CanOverwrite() public {
        vm.startPrank(user1);
        
        oft.approve(user2, 100 ether);
        assertEq(oft.allowance(user1, user2), 100 ether);
        
        oft.approve(user2, 300 ether);
        assertEq(oft.allowance(user1, user2), 300 ether);
        
        vm.stopPrank();
    }
    
    function test_TotalSupply_Tracking() public {
        assertEq(oft.totalSupply(), 0);
        
        vm.startPrank(owner);
        
        oft.mint(user1, 100 ether);
        assertEq(oft.totalSupply(), 100 ether);
        
        oft.mint(user2, 200 ether);
        assertEq(oft.totalSupply(), 300 ether);
        
        oft.burn(user1, 50 ether);
        assertEq(oft.totalSupply(), 250 ether);
        
        oft.burn(user2, 200 ether);
        assertEq(oft.totalSupply(), 50 ether);
        
        vm.stopPrank();
    }
    
    // ========================================================================
    // LAYERZERO INTEGRATION TESTS
    // ========================================================================
    
    function test_LayerZero_EndpointConfiguration() public {
        // Verify LayerZero endpoint is set correctly
        assertEq(address(oft.endpoint()), address(lzEndpoint));
    }
    
    function test_LayerZero_OwnerCanSetDelegate() public {
        vm.startPrank(owner);
        
        address newDelegate = address(0x999);
        oft.setDelegate(newDelegate);
        
        // Verify delegate was set (we can check through the endpoint mock)
        assertEq(lzEndpoint.delegates(address(oft)), newDelegate);
        
        vm.stopPrank();
    }
    
    function test_LayerZero_NonOwnerCannotSetDelegate() public {
        vm.startPrank(malicious);
        
        vm.expectRevert();
        oft.setDelegate(address(0x999));
        
        vm.stopPrank();
    }
    
    function test_LayerZero_TokenDecimals() public {
        // OFT should use standard 18 decimals
        assertEq(oft.decimals(), 18);
    }
    
    function test_LayerZero_TokenMetadata() public {
        assertEq(oft.name(), "Eagle Share Token");
        assertEq(oft.symbol(), "EAGLE");
    }
    
    // ========================================================================
    // ACCESS CONTROL TESTS
    // ========================================================================
    
    function test_Ownership_Transfer() public {
        assertEq(oft.owner(), owner);
        
        vm.prank(owner);
        oft.transferOwnership(user1);
        
        // Ownership transfers immediately with standard Ownable
        assertEq(oft.owner(), user1);
    }
    
    function test_Ownership_RevertsOnZeroAddress() public {
        vm.startPrank(owner);
        
        vm.expectRevert();
        oft.transferOwnership(address(0));
        
        vm.stopPrank();
    }
    
    function test_Ownership_NonOwnerCannotTransfer() public {
        vm.startPrank(malicious);
        
        vm.expectRevert();
        oft.transferOwnership(malicious);
        
        vm.stopPrank();
    }
    
    function test_OnlyOwner_CanSetMinter() public {
        vm.startPrank(malicious);
        
        vm.expectRevert();
        oft.setMinter(minter1, true);
        
        vm.stopPrank();
    }
    
    function test_OnlyOwnerOrMinter_CanMint() public {
        vm.startPrank(malicious);
        
        vm.expectRevert(EagleShareOFT.NotMinter.selector);
        oft.mint(user1, 100 ether);
        
        vm.stopPrank();
    }
    
    function test_OnlyOwnerOrMinter_CanBurn() public {
        vm.prank(owner);
        oft.mint(user1, 100 ether);
        
        vm.startPrank(malicious);
        
        vm.expectRevert(EagleShareOFT.NotMinter.selector);
        oft.burn(user1, 50 ether);
        
        vm.stopPrank();
    }
    
    // ========================================================================
    // EDGE CASES & ERROR CONDITIONS
    // ========================================================================
    
    function test_EdgeCase_TransferZeroAmount() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(user1);
        
        oft.transfer(user2, 0);
        assertEq(oft.balanceOf(user1), 1000 ether);
        assertEq(oft.balanceOf(user2), 0);
        
        vm.stopPrank();
    }
    
    function test_EdgeCase_BurnZeroAmount() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(owner);
        
        oft.burn(user1, 0);
        assertEq(oft.balanceOf(user1), 1000 ether);
        
        vm.stopPrank();
    }
    
    function test_EdgeCase_SelfTransfer() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(user1);
        
        oft.transfer(user1, 500 ether);
        assertEq(oft.balanceOf(user1), 1000 ether);
        
        vm.stopPrank();
    }
    
    function test_EdgeCase_ApproveZeroAmount() public {
        vm.startPrank(user1);
        
        oft.approve(user2, 0);
        assertEq(oft.allowance(user1, user2), 0);
        
        vm.stopPrank();
    }
    
    function test_EdgeCase_MultipleApprovalChanges() public {
        vm.startPrank(user1);
        
        oft.approve(user2, 100 ether);
        oft.approve(user2, 200 ether);
        oft.approve(user2, 0);
        oft.approve(user2, 50 ether);
        
        assertEq(oft.allowance(user1, user2), 50 ether);
        
        vm.stopPrank();
    }
    
    function test_EdgeCase_TransferAfterAllowanceExpended() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.prank(user1);
        oft.approve(user2, 100 ether);
        
        vm.startPrank(user2);
        
        oft.transferFrom(user1, user2, 100 ether);
        
        vm.expectRevert();
        oft.transferFrom(user1, user2, 1 ether);
        
        vm.stopPrank();
    }
    
    function test_EdgeCase_MintAfterRoleRemoved() public {
        vm.prank(owner);
        oft.setMinter(minter1, true);
        
        vm.prank(minter1);
        oft.mint(user1, 100 ether);
        
        vm.prank(owner);
        oft.setMinter(minter1, false);
        
        vm.startPrank(minter1);
        vm.expectRevert(EagleShareOFT.NotMinter.selector);
        oft.mint(user1, 100 ether);
        vm.stopPrank();
    }
    
    function test_EdgeCase_BurnAfterRoleRemoved() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.prank(owner);
        oft.setMinter(minter1, true);
        
        vm.prank(minter1);
        oft.burn(user1, 100 ether);
        
        vm.prank(owner);
        oft.setMinter(minter1, false);
        
        vm.startPrank(minter1);
        vm.expectRevert(EagleShareOFT.NotMinter.selector);
        oft.burn(user1, 100 ether);
        vm.stopPrank();
    }
    
    function test_EdgeCase_MaxUint256Approval() public {
        vm.startPrank(user1);
        
        oft.approve(user2, type(uint256).max);
        assertEq(oft.allowance(user1, user2), type(uint256).max);
        
        vm.stopPrank();
    }
    
    // ========================================================================
    // INTEGRATION TESTS
    // ========================================================================
    
    function test_Integration_CompleteWorkflow() public {
        // 1. Setup minters
        vm.startPrank(owner);
        oft.setMinter(minter1, true);
        vm.stopPrank();
        
        // 2. Minter mints tokens
        vm.prank(minter1);
        oft.mint(user1, 1000 ether);
        
        // 3. User transfers tokens
        vm.prank(user1);
        oft.transfer(user2, 300 ether);
        
        // 4. User approves and transferFrom
        vm.prank(user1);
        oft.approve(user2, 200 ether);
        
        vm.prank(user2);
        oft.transferFrom(user1, user2, 150 ether);
        
        // 5. Burn tokens
        vm.prank(minter1);
        oft.burn(user1, 100 ether);
        
        // Verify final state
        assertEq(oft.balanceOf(user1), 450 ether); // 1000 - 300 - 150 - 100
        assertEq(oft.balanceOf(user2), 450 ether); // 300 + 150
        assertEq(oft.totalSupply(), 900 ether);
        assertEq(oft.allowance(user1, user2), 50 ether); // 200 - 150
    }
    
    function test_Integration_MultipleMinters() public {
        vm.startPrank(owner);
        oft.setMinter(minter1, true);
        oft.setMinter(minter2, true);
        vm.stopPrank();
        
        vm.prank(minter1);
        oft.mint(user1, 100 ether);
        
        vm.prank(minter2);
        oft.mint(user2, 200 ether);
        
        vm.prank(owner);
        oft.mint(user1, 50 ether);
        
        assertEq(oft.balanceOf(user1), 150 ether);
        assertEq(oft.balanceOf(user2), 200 ether);
        assertEq(oft.totalSupply(), 350 ether);
    }
    
    function test_Integration_MinterRoleTransition() public {
        // Give role to minter1
        vm.prank(owner);
        oft.setMinter(minter1, true);
        
        vm.prank(minter1);
        oft.mint(user1, 100 ether);
        
        // Transfer role to minter2
        vm.startPrank(owner);
        oft.setMinter(minter1, false);
        oft.setMinter(minter2, true);
        vm.stopPrank();
        
        // minter1 can no longer mint
        vm.startPrank(minter1);
        vm.expectRevert(EagleShareOFT.NotMinter.selector);
        oft.mint(user1, 100 ether);
        vm.stopPrank();
        
        // minter2 can mint
        vm.prank(minter2);
        oft.mint(user2, 200 ether);
        
        assertEq(oft.balanceOf(user1), 100 ether);
        assertEq(oft.balanceOf(user2), 200 ether);
    }
    
    function test_Integration_OwnershipTransferRetainsMinters() public {
        vm.prank(owner);
        oft.setMinter(minter1, true);
        
        vm.prank(owner);
        oft.transferOwnership(user1);
        
        // Ownership transfers immediately
        assertEq(oft.owner(), user1);
        
        // Minter1 should still be a minter
        assertTrue(oft.isMinter(minter1));
        
        vm.prank(minter1);
        oft.mint(user2, 100 ether);
        
        assertEq(oft.balanceOf(user2), 100 ether);
    }
    
    // ========================================================================
    // FUZZ TESTS
    // ========================================================================
    
    function testFuzz_Mint(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(amount > 0);
        vm.assume(amount <= type(uint256).max / 2); // Prevent overflow
        
        vm.startPrank(owner);
        oft.mint(to, amount);
        
        assertEq(oft.balanceOf(to), amount);
        assertEq(oft.totalSupply(), amount);
        
        vm.stopPrank();
    }
    
    function testFuzz_Burn(uint256 mintAmount, uint256 burnAmount) public {
        vm.assume(mintAmount > 0);
        vm.assume(burnAmount <= mintAmount);
        vm.assume(mintAmount <= type(uint256).max / 2);
        
        vm.startPrank(owner);
        
        oft.mint(user1, mintAmount);
        oft.burn(user1, burnAmount);
        
        assertEq(oft.balanceOf(user1), mintAmount - burnAmount);
        assertEq(oft.totalSupply(), mintAmount - burnAmount);
        
        vm.stopPrank();
    }
    
    function testFuzz_Transfer(uint256 mintAmount, uint256 transferAmount) public {
        vm.assume(mintAmount > 0);
        vm.assume(transferAmount <= mintAmount);
        vm.assume(mintAmount <= type(uint256).max / 2);
        
        vm.prank(owner);
        oft.mint(user1, mintAmount);
        
        vm.prank(user1);
        oft.transfer(user2, transferAmount);
        
        assertEq(oft.balanceOf(user1), mintAmount - transferAmount);
        assertEq(oft.balanceOf(user2), transferAmount);
    }
    
    function testFuzz_Approve(uint256 approvalAmount) public {
        vm.assume(approvalAmount <= type(uint256).max);
        
        vm.prank(user1);
        oft.approve(user2, approvalAmount);
        
        assertEq(oft.allowance(user1, user2), approvalAmount);
    }
    
    function testFuzz_SetMinter(address minterAddr) public {
        vm.assume(minterAddr != address(0));
        
        vm.prank(owner);
        oft.setMinter(minterAddr, true);
        
        assertTrue(oft.isMinter(minterAddr));
        assertTrue(oft.checkMinter(minterAddr));
    }
    
    function testFuzz_MultipleMints(uint256 amount1, uint256 amount2) public {
        vm.assume(amount1 > 0 && amount2 > 0);
        vm.assume(amount1 <= type(uint256).max / 4);
        vm.assume(amount2 <= type(uint256).max / 4);
        
        vm.startPrank(owner);
        
        oft.mint(user1, amount1);
        oft.mint(user1, amount2);
        
        assertEq(oft.balanceOf(user1), amount1 + amount2);
        assertEq(oft.totalSupply(), amount1 + amount2);
        
        vm.stopPrank();
    }
    
    // ========================================================================
    // GAS OPTIMIZATION TESTS
    // ========================================================================
    
    function test_Gas_Mint() public {
        vm.startPrank(owner);
        
        uint256 gasBefore = gasleft();
        oft.mint(user1, 1000 ether);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas used for mint", gasUsed);
        
        vm.stopPrank();
    }
    
    function test_Gas_Burn() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(owner);
        
        uint256 gasBefore = gasleft();
        oft.burn(user1, 500 ether);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas used for burn", gasUsed);
        
        vm.stopPrank();
    }
    
    function test_Gas_Transfer() public {
        vm.prank(owner);
        oft.mint(user1, 1000 ether);
        
        vm.startPrank(user1);
        
        uint256 gasBefore = gasleft();
        oft.transfer(user2, 500 ether);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas used for transfer", gasUsed);
        
        vm.stopPrank();
    }
    
    function test_Gas_SetMinter() public {
        vm.startPrank(owner);
        
        uint256 gasBefore = gasleft();
        oft.setMinter(minter1, true);
        uint256 gasUsed = gasBefore - gasleft();
        
        emit log_named_uint("Gas used for setMinter", gasUsed);
        
        vm.stopPrank();
    }
}

