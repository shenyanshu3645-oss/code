pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract MemeToken is ERC20 {
    address public factory;
    bool private initialized;
    string private tokenName;
    string private tokenSymbol;
    address public issuer;
    uint256 private totalSupplyCap;
    uint256 public perMint;
    uint256 public price;

    uint256 public mintedAmount; //总的 mint数量

    constructor() ERC20("", "") {
        // 不再在构造函数中设置 factory，而是在 initialize 中设置
    }

    function initialize(
        address _factory,
        address _issuer,
        string memory _name,
        string memory _symbol,
        uint256 _totalSupply,
        uint256 _perMint,
        uint256 _price
    ) external {
        require(!initialized, "Already initialized");
        factory = _factory;
        issuer = _issuer;
        totalSupplyCap = _totalSupply;
        perMint = _perMint;
        price = _price;
        tokenName = _name;
        tokenSymbol = _symbol;

        initialized = true;
    }

    /**
     * @dev 重写 name() 函数返回自定义名称
     */
    function name() public view virtual override returns (string memory) {
        return tokenName;
    }

    /**
     * @dev 重写 symbol() 函数返回自定义符号
     */
    function symbol() public view virtual override returns (string memory) {
        return tokenSymbol;
    }

    /**
     * @dev 重写 totalSupply() 函数返回总供应量上限
     * 注意：这里返回的是设定的总供应量上限，不是实际已铸造的数量
     */
    function totalSupply() public view virtual override returns (uint256) {
        return totalSupplyCap;
    }
    /**
     * @dev 获取可铸造数量
     */
    function availableMints() public view returns (uint256) {
        return totalSupplyCap - mintedAmount;
    }

    function mint(address to) external returns (uint256) {
        require(msg.sender == factory, "Only factory can mint");
        require(
            mintedAmount + perMint <= totalSupplyCap,
            "Exceeds total supply"
        );

        _mint(to, perMint);
        mintedAmount += perMint;
        return perMint;
    }
}