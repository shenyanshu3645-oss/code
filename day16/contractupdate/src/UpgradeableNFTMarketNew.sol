// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract UpgradeableNFTMarketNew is Initializable, OwnableUpgradeable, EIP712 {
    using ECDSA for bytes32;

    struct NFT {
        uint256 tokenId;
        uint256 price;
        address seller;
    }

    // EIP-712类型哈希
    bytes32 private constant LISTING_TYPEHASH = keccak256(
        "Listing(uint256 tokenId,uint256 price,uint256 nonce)"
    );

    // 出售的NFT列表
    mapping(uint256 => NFT) public sellnft;

    // 支付代币合约
    IERC20 public paymentToken;

    // 出售合约
    ERC721URIStorage public erc721;

    // 用户nonce，防止重放攻击
    mapping(address => uint256) public nonces;

    // 事件
    event NFTListed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );
    event NFTListedWithSignature(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price,
        uint256 nonce
    );
    event NFTSold(
        uint256 indexed tokenId,
        address indexed buyer,
        address indexed seller,
        uint256 price
    );
    event TokensReceived(address from, uint256 amount, uint256 tokenId);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() EIP712("UpgradeableNFTMarket", "1") {
        _disableInitializers();
    }

    /**
     * @dev 初始化函数 - 仅在首次部署时调用，升级时不应调用
     */
    function initialize(IERC20 _ierc20, ERC721URIStorage _erc721) public initializer {
        __Ownable_init(msg.sender);
        paymentToken = _ierc20;
        erc721 = _erc721;
    }


    // 普通上架NFT
    function list(uint256 tokenId, uint256 price) external {
        require(
            erc721.ownerOf(tokenId) == msg.sender,
            "Not the owner of this NFT"
        );
        require(price > 0, "Price must be greater than zero");

        // 检查用户是否已授权市场合约可以转移此NFT
        require(
            erc721.isApprovedForAll(msg.sender, address(this)) || 
            erc721.getApproved(tokenId) == address(this),
            "Market contract not approved to transfer this NFT"
        );

        NFT memory nft = NFT({
            tokenId: tokenId,
            price: price,
            seller: msg.sender
        });
        sellnft[tokenId] = nft;

        emit NFTListed(tokenId, msg.sender, price);
    }

    /**
     * @dev EIP-712离线签名上架NFT
     * @param tokenId NFT tokenId
     * @param price 价格
     * @param signature 用户签名
     */
    function listWithSignature(
        uint256 tokenId,
        uint256 price,
        bytes memory signature
    ) external {
        require(price > 0, "Price must be greater than zero");
        
        // 验证签名并获取签名者
        address signer = _verifyListingSignature(tokenId, price, signature);
        
        // 检查签名者是否是NFT所有者
        require(
            erc721.ownerOf(tokenId) == signer,
            "Signer is not the owner of this NFT"
        );

        // 检查用户是否已通过setApprovalForAll授权市场合约
        require(
            erc721.isApprovedForAll(signer, address(this)),
            "Market contract not approved for all NFTs"
        );

        // 创建并存储NFT信息
        NFT memory nft = NFT({
            tokenId: tokenId,
            price: price,
            seller: signer
        });
        sellnft[tokenId] = nft;

        // 增加nonce
        nonces[signer]++;

        emit NFTListedWithSignature(tokenId, signer, price, nonces[signer] - 1);
    }

    /**
     * @dev 验证EIP-712签名
     */
    function _verifyListingSignature(
        uint256 tokenId,
        uint256 price,
        bytes memory signature
    ) internal view returns (address) {
        // 获取当前nonce
        uint256 currentNonce = nonces[msg.sender];
        
        // 构建结构化哈希
        bytes32 structHash = keccak256(
            abi.encode(
                LISTING_TYPEHASH,
                tokenId,
                price,
                currentNonce
            )
        );
        
        // 获取完整EIP-712消息哈希
        bytes32 hash = _hashTypedDataV4(structHash);
        
        // 恢复签名者地址
        address signer = ECDSA.recover(hash, signature);
        require(signer != address(0), "Invalid signature");
        require(signer == msg.sender, "Signature does not match caller");

        return signer;
    }

    
    /**
     * @dev 验证签名（只读）
     */
    function verifySignature(
        address signer,
        uint256 tokenId,
        uint256 price,
        bytes memory signature
    ) external view returns (bool) {
        uint256 currentNonce = nonces[signer];
        
        bytes32 structHash = keccak256(
            abi.encode(
                LISTING_TYPEHASH,
                tokenId,
                price,
                currentNonce
            )
        );
        
        bytes32 hash = _hashTypedDataV4(structHash);
        address recoveredSigner = ECDSA.recover(hash, signature);
        
        return recoveredSigner == signer;
    }


    // 购买NFT
    function buyNFT(uint256 tokenId) external {
        NFT memory nft = sellnft[tokenId];
        require(nft.seller != address(0), "nft not exist!");
        require(nft.seller != msg.sender, "Cannot buy your own NFT");

        uint256 price = nft.price;
        address seller = nft.seller;

        // 检查买家是否已授权足够的代币给市场合约
        uint256 allowance = paymentToken.allowance(msg.sender, address(this));
        require(
            allowance >= price,
            "Insufficient token allowance. Please approve tokens first"
        );

        // 检查买家是否有足够的代币余额
        uint256 buyerBalance = paymentToken.balanceOf(msg.sender);
        require(buyerBalance >= price, "Insufficient token balance");

        // 转移支付代币给卖家
        bool transferret = paymentToken.transferFrom(msg.sender, seller, price);
        require(transferret, "Payment to seller failed");

        // 转移NFT从卖家到买家
        erc721.transferFrom(seller, msg.sender, tokenId);

        // 清除市场记录
        delete sellnft[tokenId];
        emit NFTSold(tokenId, msg.sender, seller, price);
    }

    // 用户主动给市场转币的回调
    function tokensReceived(
        address from,
        uint256 amount,
        uint256 tokenId
    ) public returns (bool) {
        require(from == address(paymentToken), "Invalid from address");
        require(amount > 0, "Invalid amount");
        require(tokenId > 0, "Invalid tokenId");

        // 检查nft是否在售
        NFT memory nft = sellnft[tokenId];
        require(nft.seller != address(0), "nft not exist!");
        require(amount >= nft.price, "Insufficient amount");
        
        // 如果用户转多了，退还给用户
        if (amount > nft.price) {
            bool transferret = paymentToken.transfer(from, amount - nft.price);
            require(transferret, "Transfer to buyer failed");
        }
        
        // 转nft给买家
        erc721.transferFrom(nft.seller, from, tokenId);
        
        // 清除市场记录
        delete sellnft[tokenId];
        
        emit TokensReceived(from, amount, tokenId);
        return true;
    }
}