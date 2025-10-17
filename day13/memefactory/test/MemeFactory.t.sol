// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {MemeFactory, IMemeToken} from "../src/MemeFactory.sol";
import {MemeToken} from "../src/MemeToken.sol";

// 可接收 ETH 的地址
contract ReceivableAddress {
    receive() external payable {}
    
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}

// 专门用于测试的 owner 合约
contract TestOwner {
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    receive() external payable {}
    
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
    
    // 允许 owner 提取资金
    function withdraw() external {
        require(msg.sender == owner, "Only owner can withdraw");
        payable(owner).transfer(address(this).balance);
    }
}

contract MemeFactoryTest is Test {
    MemeFactory public factory;
    MemeToken public implementation;
    ReceivableAddress public issuer;
    TestOwner public platformOwner; // 平台所有者
    address public minter = address(3);

    function setUp() public {
        // 创建实现合约
        implementation = new MemeToken();
        
        // 创建可接收 ETH 的平台所有者
        platformOwner = new TestOwner();
        
        // 创建工厂合约
        factory = new MemeFactory(address(implementation));
        
        // 更改 owner 为我们的测试 owner
        factory.changeOwner(address(platformOwner));
        
        // 创建可接收 ETH 的发行者
        issuer = new ReceivableAddress();
    }

    function test_DeployMeme() public {
        string memory name = "Test Meme";
        string memory symbol = "TMEME";
        uint256 totalSupply = 1000 * 10**18;
        uint256 perMint = 10 * 10**18;
        uint256 price = 0.01 ether;

        vm.prank(address(issuer));
        address tokenAddr = factory.deployMeme(name, symbol, totalSupply, perMint, price);
        
        // 验证代币信息
        assertEq(factory.tokenIssuer(tokenAddr), address(issuer));
        assertEq(factory.isMemeToken(tokenAddr), true);
        assertEq(factory.getCloneCount(), 1);
        
        // 验证代币名称和符号
        assertEq(factory.tokenNames(tokenAddr), name);
        assertEq(factory.tokenSymbols(tokenAddr), symbol);
        
        // 验证通过接口获取的信息
        IMemeToken token = IMemeToken(tokenAddr);
        assertEq(token.issuer(), address(issuer));
        assertEq(token.perMint(), perMint);
        assertEq(token.price(), price);
        assertEq(token.availableMints(), totalSupply);
    }

    function test_MintMeme() public {
        string memory name = "Test Meme";
        string memory symbol = "TMEME";
        uint256 totalSupply = 1000 * 10**18;
        uint256 perMint = 10 * 10**18;
        uint256 price = 0.01 ether;
        uint256 requiredAmount = perMint * price;

        // 部署代币
        vm.prank(address(issuer));
        address tokenAddr = factory.deployMeme(name, symbol, totalSupply, perMint, price);

        // 记录初始余额
        uint256 issuerInitialBalance = issuer.getBalance();
        uint256 ownerInitialBalance = platformOwner.getBalance();

        // 铸造代币
        vm.deal(minter, requiredAmount);
        vm.prank(minter);
        factory.mintMeme{value: requiredAmount}(tokenAddr);

        // 验证余额变化 (99% 给发行者，1% 给平台)
        assertEq(issuer.getBalance(), issuerInitialBalance + (requiredAmount * 99 / 100));
        assertEq(platformOwner.getBalance(), ownerInitialBalance + (requiredAmount * 1 / 100));

        // 验证代币余额
        IMemeToken token = IMemeToken(tokenAddr);
        assertEq(MemeToken(tokenAddr).balanceOf(minter), perMint);
        assertEq(token.availableMints(), totalSupply - perMint);
    }

    function test_RevertWhen_InvalidPaymentAmount() public {
        string memory name = "Test Meme";
        string memory symbol = "TMEME";
        uint256 totalSupply = 1000 * 10**18;
        uint256 perMint = 10 * 10**18;
        uint256 price = 0.01 ether;
        uint256 wrongAmount = 0.005 ether; // 错误的金额

        // 部署代币
        vm.prank(address(issuer));
        address tokenAddr = factory.deployMeme(name, symbol, totalSupply, perMint, price);

        // 尝试用错误的金额铸造代币，应该失败
        vm.deal(minter, wrongAmount);
        vm.prank(minter);
        
        // 期望调用会回滚
        vm.expectRevert("Incorrect payment amount");
        factory.mintMeme{value: wrongAmount}(tokenAddr);
    }

    function test_RevertWhen_NoMoreTokensToMint() public {
        string memory name = "Test Meme";
        string memory symbol = "TMEME";
        uint256 totalSupply = 10 * 10**18; // 只有10个代币
        uint256 perMint = 10 * 10**18; // 每次铸造10个
        uint256 price = 0.01 ether;
        uint256 requiredAmount = perMint * price;

        // 部署代币
        vm.prank(address(issuer));
        address tokenAddr = factory.deployMeme(name, symbol, totalSupply, perMint, price);

        // 第一次铸造应该成功
        vm.deal(minter, requiredAmount);
        vm.prank(minter);
        factory.mintMeme{value: requiredAmount}(tokenAddr);

        // 第二次铸造应该失败，因为没有更多代币可以铸造
        vm.deal(minter, requiredAmount);
        vm.prank(minter);
        
        // 期望调用会回滚
        vm.expectRevert("No more tokens to mint");
        factory.mintMeme{value: requiredAmount}(tokenAddr);
    }
}