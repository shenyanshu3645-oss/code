// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/MemeFactory.sol";
import "../src/MemeToken.sol";

contract WorkingMemeFactoryTest is Test {
    MemeFactory public factory;
    MemeToken public implementation;
    
    // 测试账户
    address public issuer = address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8);
    address public user = address(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266);
    

    address public constant UNISWAP_FACTORY = address(0x5FbDB2315678afecb367f032d93F642f64180aa3);
    address public constant UNISWAP_ROUTER = address(0xa513E6E4b8f2a923D98304ec87F64353C4D5C853);
    address public constant WETH = address(0x0165878A594ca255338adfa4d48449f69242Eb8F);

    // 添加接收ETH的fallback函数
    receive() external payable {}

    function setUp() public {
        // 创建实现合约
        implementation = new MemeToken();
        
        // 创建工厂合约，传入实际的 Uniswap 地址和 WETH 地址
        factory = new MemeFactory(address(implementation), UNISWAP_FACTORY, UNISWAP_ROUTER, WETH);
        
        // 设置余额
        vm.deal(issuer, 100 ether);
        vm.deal(user, 100 ether);
    }

    function testDeployment() public {
        // 测试部署 meme 代币
        // perMint: 1000000000000000000 (表示1个代币)
        // price: 1000000000000000000 (表示1个ETH兑换1个代币)
        vm.startPrank(issuer);
        address tokenAddress = factory.deployMeme("Test Token", "TEST", 1000 * 10**18, 1 * 10**18, 1 * 10**18);
        vm.stopPrank();
        
        // 验证部署结果
        assertNotEq(tokenAddress, address(0));
        assertTrue(factory.isMemeToken(tokenAddress));
        assertEq(factory.tokenIssuer(tokenAddress), issuer);
        assertEq(factory.getCloneCount(), 1);
        assertEq(factory.tokenNames(tokenAddress), "Test Token");
        assertEq(factory.tokenSymbols(tokenAddress), "TEST");
    }

    function testMintMeme() public {
        // 先部署代币
        // perMint: 1000000000000000000 (表示1个代币)
        // price: 1000000000000000000 (表示1个ETH兑换1个代币)
        // 所需支付金额 = 1000000000000000000 * 1000000000000000000 = 1 ETH
        vm.startPrank(issuer);
        address tokenAddress = factory.deployMeme("Test Token", "TEST", 1000 * 10**18, 1 * 10**18, 1 * 10**18);
        vm.stopPrank();
        
        // 用户铸造代币 (需要支付 1 ETH)
        vm.prank(user);
        vm.deal(user, 2 ether);
        factory.mintMeme{value: 1 ether}(tokenAddress);
        
        // 验证铸造结果
        // 工厂合约不再持有代币，因为代币已经添加到流动性池中
        // 取而代之的是验证流动性池已经创建并且有正确的代币数量
        address pairAddress = IUniswapV2Factory(UNISWAP_FACTORY).getPair(WETH, tokenAddress);
        assertTrue(pairAddress != address(0)); // 确保交易对已创建
        
        // 验证交易对中有正确的代币数量
        IUniswapV2Pair pair = IUniswapV2Pair(pairAddress);
        (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();
        assertTrue(reserve0 > 0); // WETH 储备
        assertTrue(reserve1 > 0); // Token 储备
    }
    
    function testGetAllClones() public {
        // 部署多个代币
        vm.startPrank(issuer);
        factory.deployMeme("Test Token 1", "TEST1", 1000 * 10**18, 1 * 10**18, 1 * 10**18);
        factory.deployMeme("Test Token 2", "TEST2", 2000 * 10**18, 1 * 10**18, 1 * 10**18);
        vm.stopPrank();
        
        // 验证克隆数量和地址
        assertEq(factory.getCloneCount(), 2);
        address[] memory clones = factory.getAllClones();
        assertEq(clones.length, 2);
    }
    
    function testBuyMeme() public {
        // 先部署代币
        // perMint: 1000000000000000000 (表示1个代币)
        // price: 1000000000000000000 (表示1个ETH兑换1个代币)
        // 所需支付金额 = 1000000000000000000 * 1000000000000000000 = 1 ETH
        vm.startPrank(issuer);
        address tokenAddress = factory.deployMeme("Test Token", "TEST", 1000 * 10**18, 1 * 10**18, 1 * 10**18);
        vm.stopPrank();
        
        // 先铸造代币以创建流动性池
        vm.prank(user);
        vm.deal(user, 2 ether);
        factory.mintMeme{value: 1 ether}(tokenAddress);
        
        // 记录用户购买前的代币余额
        MemeToken token = MemeToken(tokenAddress);
        uint256 userBalanceBefore = token.balanceOf(user);
        
        // 用户购买代币 (需要支付 1 ETH)
        vm.prank(user);
        vm.deal(user, 2 ether);
        factory.buyMeme{value: 1 ether}(tokenAddress);
        
        // 验证用户获得了代币
        uint256 userBalanceAfter = token.balanceOf(user);
        assertTrue(userBalanceAfter > userBalanceBefore);
    }
    
    function testChangeOwner() public {
        address newOwner = address(0x444);
        
        // 获取当前 owner 地址
        address currentOwner = factory.owner();
        
        // 更改 owner
        vm.prank(currentOwner);
        factory.changeOwner(newOwner);
        
        assertEq(factory.owner(), newOwner);
    }
    
    // 添加测试 pairFor 和 createPair 的方法
    function testPairForAndCreatePair() public {
        // 创建两个测试代币地址
        address tokenA = address(0x1234567890123456789012345678901234567890);
        address tokenB = address(0xabCDEF1234567890ABcDEF1234567890aBCDeF12);
        
        // 确保 tokenA 和 tokenB 不相等且不为0
        vm.assume(tokenA != tokenB);
        vm.assume(tokenA != address(0));
        vm.assume(tokenB != address(0));
        
        // 使用 pairFor 计算预期的 pair 地址
        address expectedPair = calculatePairFor(UNISWAP_FACTORY, tokenA, tokenB);
        
        // 真实调用 Uniswap Factory 的 createPair 方法
        address createdPair = IUniswapV2Factory(UNISWAP_FACTORY).createPair(tokenA, tokenB);
        
        // 验证两个地址是否相同
        assertEq(expectedPair, createdPair, "pairFor and createPair should return the same address");
    }
    
    // 实现 sortTokens 函数
    function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "ZERO_ADDRESS");
    }
    
    // 实现 pairFor 函数
    function calculatePairFor(address factoryAddr, address tokenA, address tokenB) internal pure returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        pair = address(uint160(uint(keccak256(abi.encodePacked(
                hex'ff',
                factoryAddr,
                keccak256(abi.encodePacked(token0, token1)),
                hex'b758cea4266e33a3e61792b119275b03e758033302ac6b78ca6b19c75e362c0a' // init code hash
            )))));
    }
}