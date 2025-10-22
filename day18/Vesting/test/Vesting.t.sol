// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/Vesting.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock ERC20 token for testing
contract MockToken is ERC20 {
    constructor() ERC20("Mock Token", "MTK") {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract VestingTest is Test {
    Vesting public vesting;
    MockToken public token;
    
    address public beneficiary = address(0x1);
    address public owner = address(this);
    
    uint64 public start = uint64(block.timestamp);
    uint64 public cliff = 365 days * 1; // 12 months
    uint64 public duration = 365 days * 2; // 24 months
    uint256 public totalAmount = 1_000_000 * 1e18; // 100万 ERC20

    function setUp() public {
        // Deploy vesting contract
        vesting = new Vesting(beneficiary, start, cliff, duration);
        
        // Deploy mock token
        token = new MockToken();
        
        // Mint tokens to owner
        token.mint(owner, totalAmount);
        
        // Transfer tokens to vesting contract
        token.transfer(address(vesting), totalAmount);
        
        // Verify initial state
        assertEq(token.balanceOf(address(vesting)), totalAmount);
        assertEq(token.balanceOf(beneficiary), 0);
    }

    function test_CliffPeriod() public {
        // During cliff period, no tokens should be releasable
        vm.warp(start + cliff - 1 days); // Just before cliff ends
        assertEq(vesting.releasable(address(token)), 0);
        
        // Try to release tokens (should release 0)
        vm.prank(beneficiary);
        vesting.release(address(token));
        assertEq(token.balanceOf(beneficiary), 0);
    }

    function test_FirstMonthAfterCliff() public {
        // Move to first month after cliff
        vm.warp(start + cliff + 30 days);
        
        // Calculate expected releasable amount
        // After 30 days of the 24-month (730 days) vesting period
        uint256 expectedReleasable = (totalAmount * 30 days) / duration;
        uint256 actualReleasable = vesting.releasable(address(token));
        
        // Allow small difference due to timestamp precision
        assertApproxEqRel(actualReleasable, expectedReleasable, 0.05e18);
        
        // Release tokens
        vm.prank(beneficiary);
        vesting.release(address(token));
        
        // Check beneficiary received tokens
        assertEq(token.balanceOf(beneficiary), actualReleasable);
    }

    function test_MidVestingPeriod() public {
        // Move to middle of vesting period (12 months cliff + 12 months vesting)
        vm.warp(start + cliff + (duration / 2));
        
        // Should have about 50% of tokens releasable
        uint256 expectedReleasable = totalAmount / 2;
        uint256 actualReleasable = vesting.releasable(address(token));
        
        // Allow small difference due to timestamp precision
        assertApproxEqRel(actualReleasable, expectedReleasable, 0.01e18);
        
        // Release tokens
        vm.prank(beneficiary);
        vesting.release(address(token));
        
        // Check beneficiary received tokens
        assertEq(token.balanceOf(beneficiary), actualReleasable);
    }

    function test_EndOfVestingPeriod() public {
        // Move to end of vesting period
        vm.warp(start + cliff + duration + 1 days);
        
        // All tokens should be releasable
        uint256 actualReleasable = vesting.releasable(address(token));
        assertEq(actualReleasable, totalAmount);
        
        // Release tokens
        vm.prank(beneficiary);
        vesting.release(address(token));
        
        // Check beneficiary received all tokens
        assertEq(token.balanceOf(beneficiary), totalAmount);
        assertEq(token.balanceOf(address(vesting)), 0);
    }

    function test_MultipleReleases() public {
        // Move to first month after cliff
        vm.warp(start + cliff + 30 days);
        
        // Release first portion
        vm.prank(beneficiary);
        vesting.release(address(token));
        uint256 firstRelease = token.balanceOf(beneficiary);
        
        // Move to second month
        vm.warp(start + cliff + 60 days);
        
        // Release second portion
        vm.prank(beneficiary);
        vesting.release(address(token));
        uint256 secondRelease = token.balanceOf(beneficiary) - firstRelease;
        
        // Second release should be approximately equal to first release
        assertApproxEqRel(firstRelease, secondRelease, 0.1e18);
    }

    // Specific test case as requested:
    // Cliff: 12 months, next 24 months, starting from the 13th month, 
    // monthly unlock 1/24 of ERC20, after contract deployment, 
    // cliff calculation begins, and 1 million ERC20 assets are transferred
    function test_SpecificVestingScenario() public {
        // Verify initial state - 1 million tokens transferred to contract
        assertEq(token.balanceOf(address(vesting)), totalAmount);
        
        // During cliff period (first 12 months), no tokens should be releasable
        vm.warp(start + 364 days); // Just before 12 months
        assertEq(vesting.releasable(address(token)), 0);
        
        // At exactly 12 months (cliff ends), still 0 tokens releasable
        vm.warp(start + cliff);
        assertEq(vesting.releasable(address(token)), 0);
        
        // At 13 months (1 month into vesting period)
        vm.warp(start + cliff + 30 days);
        // Should have 1/24 of tokens releasable (about 41,666.67 tokens)
        uint256 expectedReleasableMonth1 = totalAmount / 24;
        uint256 actualReleasableMonth1 = vesting.releasable(address(token));
        assertApproxEqRel(actualReleasableMonth1, expectedReleasableMonth1, 0.05e18);
        
        // Release first month's tokens
        vm.prank(beneficiary);
        vesting.release(address(token));
        assertEq(token.balanceOf(beneficiary), actualReleasableMonth1);
        
        // At 14 months (2 months into vesting period)
        vm.warp(start + cliff + 60 days);
        // Should have 2/24 of total tokens releasable minus what was already released
        uint256 expectedReleasableMonth2 = (totalAmount * 2 / 24) - actualReleasableMonth1;
        uint256 actualReleasableMonth2 = vesting.releasable(address(token));
        assertApproxEqRel(actualReleasableMonth2, expectedReleasableMonth2, 0.05e18);
        
        // Release second month's tokens
        vm.prank(beneficiary);
        vesting.release(address(token));
        assertEq(token.balanceOf(beneficiary), actualReleasableMonth1 + actualReleasableMonth2);
        
        // Fast forward to end of vesting period (36 months total)
        vm.warp(start + cliff + duration);
        // All remaining tokens should be releasable
        uint256 remainingTokens = vesting.releasable(address(token));
        assertGt(remainingTokens, 0); // Verify there are tokens to release
        vm.prank(beneficiary);
        vesting.release(address(token));
        
        // Beneficiary should have received all tokens
        uint256 totalReleased = token.balanceOf(beneficiary);
        assertEq(totalReleased, totalAmount);
        assertEq(token.balanceOf(address(vesting)), 0);
    }
}