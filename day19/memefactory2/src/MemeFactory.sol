// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
// import "./MemeToken.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";

interface IMemeToken {
    function initialize(
        address _factory,
        address _issuer,
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        uint256 _perMint,
        uint256 _price
    ) external;

    function perMint() external view returns (uint256);

    function price() external view returns (uint256);

    function availableMints() external view returns (uint256);

    function issuer() external view returns (address);

    function mint(address to) external returns (uint256);
    
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IUniswapV2Factory {
    function getPair(
        address tokenA,
        address tokenB
    ) external view returns (address pair);
    
    function createPair(
        address tokenA,
        address tokenB
    ) external returns (address pair);
}

interface IUniswapV2Pair {
    function getReserves()
        external
        view
        returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
}

interface IUniswapV2Router02 {
    function addLiquidityETH(
        address token,
        uint amountTokenDesired,
        uint amountTokenMin,
        uint amountETHMin,
        address to,
        uint deadline
    ) external payable returns (uint amountA, uint amountB, uint liquidity);

    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);

    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts);
}

contract MemeFactory {
    // 主实现合约地址
    address public immutable implementation;

    address public owner; //项目方

    uint256 public constant PLATFORM_FEE_BPS = 500; // 5% 平台费用 (100 basis points = 5%)

    // 代币管理
    address[] public allTokens;
    mapping(address => address) public tokenIssuer; // 代币 => 发行者
    mapping(address => bool) public isMemeToken;

    // 记录代币的名称和符号
    mapping(address => string) public tokenNames;
    mapping(address => string) public tokenSymbols;

    // 费用统计
    uint256 public totalPlatformFees; // 累计平台费用
    uint256 public totalIssuerRevenue; // 累计发行者收入

    //uniswap router
    address public uniswapRouter;
    //uniswap factory
    address public uniswapFactory;

    //weth合约地址（通过构造函数传入）
    address public WETH;

    //在添加流动性时使用
    //eth的损耗
    uint public constant ethDiff = 10 ** 15; //最多0.001个eth
    //token的损耗
    uint public constant tokenDiff = 10 ** 15; //最多少0.001个token

    event MemeDeployed(
        address indexed token,
        address indexed issuer,
        string name,
        string symbol,
        uint256 totalSupply,
        uint256 perMint,
        uint256 price
    );

    event MemeMinted(
        address indexed token,
        address indexed minter,
        uint256 amount,
        uint256 platformFee,
        uint256 issuerRevenue
    );

    event BuyMeme(address indexed token, address indexed buyer, uint256 amount);

    event OwnerChanged(address indexed oldOwner, address indexed newOwner);

    /**
     * @dev 构造函数，设置主实现合约地址
     * @param _implementation 主实现合约地址
     */
    constructor(
        address _implementation,
        address _uniswapFactory,
        address _uniswapRouter,
        address _weth
    ) {
        implementation = _implementation;
        uniswapFactory = _uniswapFactory;
        uniswapRouter = _uniswapRouter;
        WETH = _weth;
        owner = msg.sender; // 设置合约创建者为 owner
    }

    /**
     * @dev 更改 owner（仅限当前 owner）
     * @param _newOwner 新的 owner 地址
     */
    function changeOwner(address _newOwner) external {
        require(msg.sender == owner, "Only owner can change owner");
        require(_newOwner != address(0), "New owner cannot be zero address");

        emit OwnerChanged(owner, _newOwner);
        owner = _newOwner;
    }

    /**
     * @dev 获取已部署的所有代理数量
     * @return 代理合约总数
     */
    function getCloneCount() public view returns (uint256) {
        return allTokens.length;
    }

    /**
     * @dev 获取所有已部署的代理地址
     * @return 代理地址数组
     */
    function getAllClones() public view returns (address[] memory) {
        return allTokens;
    }

    //部署代币
    function deployMeme(
        string memory _name,
        string memory _symbol,
        uint _totalSupply,
        uint _perMint,
        uint _price
    ) external returns (address token) {
        require(_totalSupply > 0, "Total supply must be positive");
        require(_perMint > 0 && _perMint <= _totalSupply, "Invalid perMint");
        require(_price > 0, "Price must be positive");
        require(bytes(_name).length > 0, "Symbol cannot be empty");
        require(bytes(_symbol).length > 0, "Symbol cannot be empty");
        bytes32 salt = keccak256(
            abi.encode(msg.sender, _symbol, block.timestamp)
        );

        //调用cloneDeterministic创建最小代理
        token = Clones.cloneDeterministic(implementation, salt);
        IMemeToken(token).initialize(
            address(this), // 传递工厂合约地址作为 factory 参数
            msg.sender,
            _name,
            _symbol,
            _totalSupply,
            _perMint,
            _price
        );

        allTokens.push(token);
        tokenIssuer[token] = msg.sender;
        isMemeToken[token] = true;

        // 记录名称和符号
        tokenNames[token] = _name;
        tokenSymbols[token] = _symbol;

        emit MemeDeployed(
            token,
            msg.sender,
            _name,
            _symbol,
            _totalSupply,
            _perMint,
            _price
        );
    }

    /**
     * @dev 铸造代币,将5%的费用和铸造的token添加到流动性中
     * @param tokenAddr 代币地址
     */
    function mintMeme(address tokenAddr) external payable {
        require(isMemeToken[tokenAddr], "Invalid token");
        // 通过接口获取代币信息
        IMemeToken token = IMemeToken(tokenAddr);
        //铸造需要的费用 
        // perMint: 1000000000000000000 (表示1个代币，即1 ETH)
        // price: 1000000000000000000 (表示1个ETH兑换1个代币)
        // requiredAmount = perMint = 1000000000000000000 wei
        uint256 requiredAmount = token.perMint();
        require(msg.value == requiredAmount, "Incorrect payment amount");
        require(token.availableMints() > 0, "No more tokens to mint");

        //每次铸造费用分为两部分，一部分（5%）给到项目方（你），一部分给到 Meme 的发行者（即调用该方法的用户）
        uint256 platformFee = (msg.value * PLATFORM_FEE_BPS) / 10000;
        uint256 issuerRevenue = msg.value - platformFee;

        address issuer = token.issuer();

        // 转账给发行者
        (bool success1, ) = issuer.call{value: issuerRevenue}("");
        require(success1, "Issuer transfer failed");

        // 转账给平台所有者（如果失败则将资金留在合约中）
        (bool success2, ) = address(this).call{value: platformFee}("");
        require(success2, "Platform transfer failed");

        totalPlatformFees += platformFee;

        // 更新发行者收入统计
        totalIssuerRevenue += issuerRevenue;

        // 通过接口调用mint,不再给用户了，铸造给 factory合约，这样用户就不用approve
        uint256 mintedAmount = token.mint(address(this));

        //第一次添加流动性按mint 价格作为流动性价格
        address pairaddress = IUniswapV2Factory(uniswapFactory).getPair(
            WETH,
            tokenAddr
        );
        if (pairaddress == address(0)) {
            // 添加流动性时会自动创建交易对
            uint amountTokenDesired = token.perMint();
            // 防止算术下溢
            uint amountTokenMin = amountTokenDesired > tokenDiff ? amountTokenDesired - tokenDiff : 0;
            uint amountETHMin = platformFee > ethDiff ? platformFee - ethDiff : 0;
            
            // 批准 Uniswap Router 使用代币
            token.approve(uniswapRouter, type(uint256).max);
            
            IUniswapV2Router02(uniswapRouter).addLiquidityETH{
                value: platformFee
            }(
                tokenAddr,
                amountTokenDesired,
                amountTokenMin,
                amountETHMin,
                msg.sender,
                block.timestamp + 30000
            );
        } else {
            (uint reserve0, uint reserve1, ) = IUniswapV2Pair(pairaddress)
                .getReserves();
            // 计算需要添加的 Token 数量
            uint tokenAmount = (platformFee * reserve1) / reserve0;
            
            // 防止算术下溢
            uint amountTokenMin = tokenAmount > tokenDiff ? tokenAmount - tokenDiff : 0;
            uint amountETHMin = platformFee > ethDiff ? platformFee - ethDiff : 0;
            
            // 批准 Uniswap Router 使用代币
            token.approve(uniswapRouter, type(uint256).max);
            
            IUniswapV2Router02(uniswapRouter).addLiquidityETH{
                value: platformFee
            }(
                tokenAddr,
                tokenAmount,
                amountTokenMin,
                amountETHMin,
                msg.sender,
                block.timestamp + 30000
            );
        }

        emit MemeMinted(
            tokenAddr,
            msg.sender,
            mintedAmount,
            platformFee,
            issuerRevenue
        );
    }

    function buyMeme(address tokenAddr) external payable {
        require(isMemeToken[tokenAddr], "Invalid token");
        // 通过接口获取代币信息
        IMemeToken token = IMemeToken(tokenAddr);
        //购买需要的费用 
        // perMint: 1000000000000000000 (表示1个代币，即1 ETH)
        // price: 1000000000000000000 (表示1个ETH兑换1个代币)
        // requiredAmount = perMint = 1000000000000000000 wei
        uint256 requiredAmount = token.perMint();
        require(msg.value == requiredAmount, "Incorrect payment amount");

        address[] memory path = new address[](2);
        path[0] = WETH; // WETH 地址
        path[1] = tokenAddr; // 目标代币

        // 获取预期输出数量
        uint[] memory amounts = IUniswapV2Router02(uniswapRouter).getAmountsOut(
            msg.value,
            path
        );
        uint expectedOutput = amounts[1];
        uint minexpectedOutput = (expectedOutput * 99) / 100;

        uint[] memory amountsout = IUniswapV2Router02(uniswapRouter)
            .swapExactETHForTokens{value: msg.value}(
            minexpectedOutput,
            path,
            msg.sender,
            block.timestamp + 30000
        );

        emit BuyMeme(tokenAddr, msg.sender, amountsout[1]);
    }

    // 接收 ETH 的函数
    receive() external payable {}

    // 提取 ETH 的函数（仅限 owner）
    function withdraw() external {
        require(msg.sender == owner, "Only owner can withdraw");
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "Transfer failed");
    }
}