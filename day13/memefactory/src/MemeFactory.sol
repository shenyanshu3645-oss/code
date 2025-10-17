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
}

contract MemeFactory {
    // 主实现合约地址
    address public immutable implementation;

    address public owner; //项目方

    uint256 public constant PLATFORM_FEE_BPS = 100; // 1% 平台费用 (100 basis points = 1%)

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

    event OwnerChanged(
        address indexed oldOwner,
        address indexed newOwner
    );


    /**
     * @dev 构造函数，设置主实现合约地址
     * @param _implementation 主实现合约地址
     */
    constructor(address _implementation) {
        implementation = _implementation;
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
     * @dev 铸造代币
     * @param tokenAddr 代币地址
     */
    function mintMeme(address tokenAddr) external payable {
        require(isMemeToken[tokenAddr], "Invalid token");
        // 通过接口获取代币信息
        IMemeToken token = IMemeToken(tokenAddr);
        //铸造需要的费用
        uint256 requiredAmount = token.perMint() * token.price();
        require(msg.value == requiredAmount, "Incorrect payment amount");
        require(token.availableMints() > 0, "No more tokens to mint");
        

        //每次铸造费用分为两部分，一部分（1%）给到项目方（你），一部分给到 Meme 的发行者（即调用该方法的用户）
        uint256 platformFee = (msg.value * PLATFORM_FEE_BPS) / 10000;
        uint256 issuerRevenue = msg.value - platformFee;
        
        address issuer = token.issuer();
        
        // 转账给发行者
        (bool success1, ) = issuer.call{value: issuerRevenue}("");
        require(success1, "Issuer transfer failed");
        
        // 转账给平台所有者（如果失败则将资金留在合约中）
        (bool success2, ) = owner.call{value: platformFee}("");
        if (!success2) {
            // 如果转账给 owner 失败，将资金留在合约中
            totalPlatformFees += platformFee;
        } else {
            totalPlatformFees += platformFee;
        }
        
        // 更新发行者收入统计
        totalIssuerRevenue += issuerRevenue;
        
        // 通过接口调用mint
        uint256 mintedAmount = token.mint(msg.sender);
        
        emit MemeMinted(tokenAddr, msg.sender, mintedAmount, platformFee, issuerRevenue);
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