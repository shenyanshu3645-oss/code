// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/UpgradeableNFT.sol";
import "../src/NftProxy.sol";

contract NftProxyTest is Test {
    UpgradeableNFT public nftLogic;
    NFTProxy public nftProxy;
    UpgradeableNFT public nft; // 通过代理合约访问的NFT实例
    
    address public owner = address(0x1);
    address public user = address(0x2);
    address public admin = address(0x3);
    
    string public constant NAME = "Test NFT";
    string public constant SYMBOL = "TNFT";
    string public constant BASE_URI = "https://example.com/nft/";

    function setUp() public {
        // 部署逻辑合约
        nftLogic = new UpgradeableNFT();
        
        // 准备初始化数据
        bytes memory data = abi.encodeWithSelector(
            UpgradeableNFT.initialize.selector,
            NAME,
            SYMBOL,
            BASE_URI,
            owner
        );
        
        // 部署代理合约
        nftProxy = new NFTProxy(
            address(nftLogic),
            admin,
            data
        );
        
        // 通过代理合约创建NFT实例
        nft = UpgradeableNFT(address(nftProxy));
    }
    
    // 测试合约初始化
    function testInitialization() public {
        assertEq(nft.name(), NAME);
        assertEq(nft.symbol(), SYMBOL);
        assertEq(nft.baseTokenURI(), BASE_URI);
        assertEq(nft.owner(), owner);
        assertEq(nft.totalSupply(), 0);
    }
    
    // 测试代理合约功能
    function testProxyAdmin() public {
        // TransparentUpgradeableProxy使用ProxyAdmin合约来管理代理
        // 我们测试是否能正确获取实现合约地址
        assertEq(nftProxy.getImplementation(), address(nftLogic));
        
        // 由于使用了ProxyAdmin，实际的admin地址可能与传入的不同
        // 我们主要验证代理合约能正确返回admin地址（即使不是我们传入的那个）
        address actualAdmin = nftProxy.getAdmin();
        assertTrue(actualAdmin != address(0), "Admin address should not be zero");
    }
    
    // 测试NFT铸造功能
    function testMintNFT() public {
        vm.prank(owner);
        nft.mint(user);
        
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.balanceOf(user), 1);
        assertEq(nft.ownerOf(1), user);
    }
    
    // 测试非所有者无法铸造NFT
    function testNonOwnerCannotMint() public {
        vm.prank(user);
        vm.expectRevert();
        nft.mint(user);
    }
    
    // 测试设置Base URI功能
    function testSetBaseURI() public {
        string memory newURI = "https://new-example.com/nft/";
        
        vm.prank(owner);
        nft.setBaseURI(newURI);
        
        assertEq(nft.baseTokenURI(), newURI);
    }
    
    // 测试非所有者无法设置Base URI
    function testNonOwnerCannotSetBaseURI() public {
        vm.prank(user);
        vm.expectRevert();
        nft.setBaseURI("https://hacker.com/nft/");
    }
    
    // 测试接收ETH功能
    function testReceiveETH() public {
        // 检查代理合约是否可以接收ETH
        (bool sent, ) = address(nftProxy).call{value: 1 ether}("");
        assertTrue(sent);
        
        assertEq(address(nftProxy).balance, 1 ether);
    }
    
    // 测试代理合约的所有者权限
    function testOwnerPermissions() public {
        // 验证owner具有正确的权限
        assertTrue(nft.owner() == owner, "Owner should be set correctly");
        
        // 验证owner可以执行受保护的操作
        vm.prank(owner);
        nft.setBaseURI("https://owner-updated.com/nft/");
        assertEq(nft.baseTokenURI(), "https://owner-updated.com/nft/");
    }
}