// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../src/Bank.sol";

contract BankTest is Test {
    Bank public bank;
    address public owner;
    address public user1;
    address public user2;
    address public user3;
    address public user4;
    address public user5;
    address public nonOwner;

    function setUp() public {
        // 设置测试地址
        owner = address(this); // 部署者是owner
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");
        user4 = makeAddr("user4");
        user5 = makeAddr("user5");
        nonOwner = makeAddr("nonOwner");

        // 部署合约
        bank = new Bank();

        // 给测试地址一些ETH
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        vm.deal(user3, 10 ether);
        vm.deal(user4, 10 ether);
        vm.deal(user5, 10 ether);
        vm.deal(nonOwner, 10 ether);
    }

    // 添加receive函数以接收ETH
    receive() external payable {}

    // 测试存款前后用户余额更新
    function test_DepositUpdatesBalance() public {
        uint256 depositAmount = 1 ether;
        
        // 检查存款前余额
        assertEq(bank.balances(user1), 0, "Initial balance should be 0");
        
        // 用户1存款
        vm.prank(user1);
        (bool success,) = address(bank).call{value: depositAmount}("");
        assertTrue(success, "Deposit should succeed");
        
        // 检查存款后余额
        assertEq(bank.balances(user1), depositAmount, "Balance should be updated after deposit");
        assertEq(address(bank).balance, depositAmount, "Contract balance should be updated");
    }

    // 测试多次存款累积
    function test_MultipleDepositsAccumulate() public {
        uint256 firstDeposit = 1 ether;
        uint256 secondDeposit = 2 ether;
        
        // 第一次存款
        vm.prank(user1);
        (bool success1,) = address(bank).call{value: firstDeposit}("");
        assertTrue(success1, "First deposit should succeed");
        assertEq(bank.balances(user1), firstDeposit, "First deposit balance check");
        
        // 第二次存款
        vm.prank(user1);
        (bool success2,) = address(bank).call{value: secondDeposit}("");
        assertTrue(success2, "Second deposit should succeed");
        assertEq(bank.balances(user1), firstDeposit + secondDeposit, "Accumulated balance check");
    }

    // 测试1个用户的情况
    function test_TopThreeWithOneUser() public {
        // 用户1存款
        vm.prank(user1);
        (bool success,) = address(bank).call{value: 5 ether}("");
        assertTrue(success, "Deposit should succeed");
        
        Bank.TopThreeUser[] memory top3 = bank.gettop3();
        
        // 检查前3名
        assertEq(top3[0].addr, user1, "First place should be user1");
        assertEq(top3[0].amount, 5 ether, "First place amount should be 5 ether");
        assertEq(top3[1].addr, address(0), "Second place should be empty");
        assertEq(top3[1].amount, 0, "Second place amount should be 0");
        assertEq(top3[2].addr, address(0), "Third place should be empty");
        assertEq(top3[2].amount, 0, "Third place amount should be 0");
    }

    // 测试2个用户的情况
    function test_TopThreeWithTwoUsers() public {
        // 用户存款，注意顺序
        vm.prank(user1);
        (bool success1,) = address(bank).call{value: 3 ether}("");
        assertTrue(success1, "User1 deposit should succeed");
        
        vm.prank(user2);
        (bool success2,) = address(bank).call{value: 5 ether}("");
        assertTrue(success2, "User2 deposit should succeed");
        
        Bank.TopThreeUser[] memory top3 = bank.gettop3();
        
        // 检查排序：user2(5) > user1(3)
        assertEq(top3[0].addr, user2, "First place should be user2");
        assertEq(top3[0].amount, 5 ether, "First place amount should be 5 ether");
        assertEq(top3[1].addr, user1, "Second place should be user1");
        assertEq(top3[1].amount, 3 ether, "Second place amount should be 3 ether");
        assertEq(top3[2].addr, address(0), "Third place should be empty");
        assertEq(top3[2].amount, 0, "Third place amount should be 0");
    }

    // 测试3个用户的情况
    function test_TopThreeWithThreeUsers() public {
        // 用户存款
        vm.prank(user1);
        (bool success1,) = address(bank).call{value: 2 ether}("");
        assertTrue(success1, "User1 deposit should succeed");
        
        vm.prank(user2);
        (bool success2,) = address(bank).call{value: 5 ether}("");
        assertTrue(success2, "User2 deposit should succeed");
        
        vm.prank(user3);
        (bool success3,) = address(bank).call{value: 3 ether}("");
        assertTrue(success3, "User3 deposit should succeed");
        
        Bank.TopThreeUser[] memory top3 = bank.gettop3();
        
        // 检查排序：user2(5) > user3(3) > user1(2)
        assertEq(top3[0].addr, user2, "First place should be user2");
        assertEq(top3[0].amount, 5 ether, "First place amount should be 5 ether");
        assertEq(top3[1].addr, user3, "Second place should be user3");
        assertEq(top3[1].amount, 3 ether, "Second place amount should be 3 ether");
        assertEq(top3[2].addr, user1, "Third place should be user1");
        assertEq(top3[2].amount, 2 ether, "Third place amount should be 2 ether");
    }

    // 测试4个用户的情况
    function test_TopThreeWithFourUsers() public {
        // 用户存款
        vm.prank(user1);
        (bool success1,) = address(bank).call{value: 2 ether}("");
        assertTrue(success1, "User1 deposit should succeed");
        
        vm.prank(user2);
        (bool success2,) = address(bank).call{value: 5 ether}("");
        assertTrue(success2, "User2 deposit should succeed");
        
        vm.prank(user3);
        (bool success3,) = address(bank).call{value: 3 ether}("");
        assertTrue(success3, "User3 deposit should succeed");
        
        vm.prank(user4);
        (bool success4,) = address(bank).call{value: 1 ether}("");
        assertTrue(success4, "User4 deposit should succeed");
        
        Bank.TopThreeUser[] memory top3 = bank.gettop3();
        
        // 检查排序：user2(5) > user3(3) > user1(2)，user4不在前3名
        assertEq(top3[0].addr, user2, "First place should be user2");
        assertEq(top3[0].amount, 5 ether, "First place amount should be 5 ether");
        assertEq(top3[1].addr, user3, "Second place should be user3");
        assertEq(top3[1].amount, 3 ether, "Second place amount should be 3 ether");
        assertEq(top3[2].addr, user1, "Third place should be user1");
        assertEq(top3[2].amount, 2 ether, "Third place amount should be 2 ether");
    }

    // 测试同一用户多次存款的情况
    function test_SameUserMultipleDeposits() public {
        // 其他用户先存款建立基础排名
        vm.prank(user2);
        (bool success2,) = address(bank).call{value: 3 ether}("");
        assertTrue(success2, "User2 initial deposit should succeed");
        
        vm.prank(user3);
        (bool success3,) = address(bank).call{value: 2 ether}("");
        assertTrue(success3, "User3 initial deposit should succeed");
        
        // user1 多次存款
        vm.prank(user1);
        (bool success1a,) = address(bank).call{value: 1 ether}("");
        assertTrue(success1a, "User1 first deposit should succeed");
        
        vm.prank(user1);
        (bool success1b,) = address(bank).call{value: 3 ether}("");
        assertTrue(success1b, "User1 second deposit should succeed");
        
        // 检查user1的累积余额
        assertEq(bank.balances(user1), 4 ether, "User1 should have accumulated 4 ether");
        
        Bank.TopThreeUser[] memory top3 = bank.gettop3();
        
        // 注意：每次存款都会更新排名，最后一次存款的金额会作为排序依据
        // 所以这里需要检查最终排名
    }

    // 测试管理员取款权限
    function test_OnlyOwnerCanWithdraw() public {
        // 先存入一些资金
        vm.prank(user1);
        (bool success,) = address(bank).call{value: 5 ether}("");
        assertTrue(success, "Deposit should succeed");
        
        assertEq(address(bank).balance, 5 ether, "Contract should have 5 ether");
        
        // 管理员可以取款
        uint256 ownerBalanceBefore = owner.balance;
        bank.withDraw();
        uint256 ownerBalanceAfter = owner.balance;
        
        assertEq(ownerBalanceAfter - ownerBalanceBefore, 5 ether, "Owner should receive 5 ether");
        assertEq(address(bank).balance, 0, "Contract balance should be 0 after withdrawal");
    }

    // 测试非管理员不能取款
    function test_NonOwnerCannotWithdraw() public {
        // 先存入一些资金
        vm.prank(user1);
        (bool success,) = address(bank).call{value: 5 ether}("");
        assertTrue(success, "Deposit should succeed");
        
        // 非管理员尝试取款应该失败
        vm.prank(nonOwner);
        vm.expectRevert(unicode"仅管理员可以提取资金");
        bank.withDraw();
        
        // 确认合约余额没有改变
        assertEq(address(bank).balance, 5 ether, "Contract balance should remain unchanged");
    }

    // 测试空存款（0 ETH）
    function test_ZeroDeposit() public {
        vm.prank(user1);
        (bool success,) = address(bank).call{value: 0}("");
        assertTrue(success, "Zero deposit should succeed");
        
        assertEq(bank.balances(user1), 0, "Balance should remain 0");
        assertEq(address(bank).balance, 0, "Contract balance should remain 0");
    }

    // 测试排序的边界情况
    function test_EqualAmountSorting() public {
        // 多个用户存入相同金额
        vm.prank(user1);
        (bool success1,) = address(bank).call{value: 3 ether}("");
        assertTrue(success1, "User1 deposit should succeed");
        
        vm.prank(user2);
        (bool success2,) = address(bank).call{value: 3 ether}("");
        assertTrue(success2, "User2 deposit should succeed");
        
        vm.prank(user3);
        (bool success3,) = address(bank).call{value: 3 ether}("");
        assertTrue(success3, "User3 deposit should succeed");
        
        Bank.TopThreeUser[] memory top3 = bank.gettop3();
        
        // 检查所有前3名都有相同金额
        assertEq(top3[0].amount, 3 ether, "First place should have 3 ether");
        assertEq(top3[1].amount, 3 ether, "Second place should have 3 ether");
        assertEq(top3[2].amount, 3 ether, "Third place should have 3 ether");
    }
}