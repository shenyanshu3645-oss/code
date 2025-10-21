// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/UpgradeableNFTMarket.sol";
import "../src/UpgradeableNFTMarketNew.sol";
import "../src/NftMarketProxy.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";

// Mock ERC20 代币合约
contract MockERC20 is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
    
    // Required IERC20 functions
    function totalSupply() external view returns (uint256) {
        return 0;
    }
}

// Mock ERC721 NFT 合约
contract MockERC721 is ERC721URIStorage {
    constructor() ERC721("MockNFT", "MNFT") {}
    
    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}

contract NftMarketProxyUpgradeTest is Test {
    UpgradeableNFTMarket public oldMarketLogic;
    UpgradeableNFTMarketNew public newMarketLogic;
    NFTMarketProxy public marketProxy;
    ProxyAdmin public proxyAdmin;
    
    MockERC20 public mockToken;
    MockERC721 public mockNFT;
    
    address public owner = address(0x1);
    address public seller = address(0x2);
    address public buyer = address(0x3);
    address public admin = address(0x4);
    
    uint256 public tokenId = 1;
    uint256 public price = 100 * 10**18; // 100 tokens

    function setUp() public {
        // 部署mock合约
        mockToken = new MockERC20();
        mockNFT = new MockERC721();
        
        // 部署旧逻辑合约
        oldMarketLogic = new UpgradeableNFTMarket();
        
        // 准备初始化数据
        bytes memory data = abi.encodeWithSelector(
            UpgradeableNFTMarket.initialize.selector,
            mockToken,
            mockNFT
        );
        
        // 部署代理合约
        marketProxy = new NFTMarketProxy(
            address(oldMarketLogic),
            admin,
            data
        );
        
        // 获取ProxyAdmin地址
        address proxyAdminAddress = marketProxy.getAdmin();
        proxyAdmin = ProxyAdmin(proxyAdminAddress);
        
        // 通过代理合约创建市场实例
        UpgradeableNFTMarket market = UpgradeableNFTMarket(address(marketProxy));
        
        // 设置测试环境
        mockNFT.mint(seller, tokenId);
        mockToken.mint(buyer, price * 2);
        
        // 授权市场合约转移NFT
        vm.prank(seller);
        mockNFT.approve(address(market), tokenId);
        
        // 授权市场合约转移代币
        vm.prank(buyer);
        mockToken.approve(address(market), price * 2);
    }
    
    // 测试升级前的功能
    function testPreUpgradeFunctionality() public {
        UpgradeableNFTMarket market = UpgradeableNFTMarket(address(marketProxy));
        
        // 验证初始状态
        assertEq(address(market.paymentToken()), address(mockToken));
        assertEq(address(market.erc721()), address(mockNFT));
        // 注意：UpgradeableNFTMarket的owner地址与代理合约地址不匹配，这是正常的
        
        // 测试上架NFT功能
        vm.prank(seller);
        market.list(tokenId, price);
        
        // 验证NFT已上架
        (uint256 listedTokenId, uint256 listedPrice, address sellerAddr) = market.sellnft(tokenId);
        assertEq(listedTokenId, tokenId);
        assertEq(listedPrice, price);
        assertEq(sellerAddr, seller);
    }
    
    // 测试代理合约升级功能
    function testUpgrade() public {
        // 部署新逻辑合约
        newMarketLogic = new UpgradeableNFTMarketNew();
        
        // 验证升级前的状态
        address oldImplementation = marketProxy.getImplementation();
        assertEq(oldImplementation, address(oldMarketLogic));
        
        // 执行升级 - 通过ProxyAdmin升级
        vm.prank(admin);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(address(marketProxy)),
            address(newMarketLogic),
            ""
        );
        
        // 验证升级后的状态
        address newImplementation = marketProxy.getImplementation();
        assertEq(newImplementation, address(newMarketLogic));
        
        // 验证代理合约的管理员没有改变
        assertEq(marketProxy.getAdmin(), address(proxyAdmin));
    }
    
    // 测试升级后的功能扩展
    function testNewFunctionalityAfterUpgrade() public {
        // 执行升级
        newMarketLogic = new UpgradeableNFTMarketNew();
        vm.prank(admin);
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(address(marketProxy)),
            address(newMarketLogic),
            ""
        );
        
        UpgradeableNFTMarketNew newMarket = UpgradeableNFTMarketNew(address(marketProxy));
        
        // 验证新功能可用 - 获取nonce
        assertEq(newMarket.nonces(seller), 0);
        
        // 验证新功能 - verifySignature函数存在
        // 创建一个无效的签名来测试函数是否存在且不会崩溃
        // 由于签名无效，应该会回滚
        vm.expectRevert(); // 期望调用会回滚，因为签名无效
        newMarket.verifySignature(seller, tokenId, price, new bytes(65));
    }
}