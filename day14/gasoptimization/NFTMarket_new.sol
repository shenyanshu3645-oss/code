// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract NFTMarket {
    // Gas优化：使用packed结构体减少存储槽使用
    struct NFT {
        uint128 price;      // 假设价格不会超过uint128的最大值
        address seller;
    }

    // 出售的NFT列表
    mapping(uint256 => NFT) public sellnft;

    // 支付代币合约
    IERC20 public immutable paymentToken;  // Gas优化：使用immutable

    // ERC721 NFT合约
    ERC721URIStorage public immutable erc721;  // Gas优化：使用immutable

    // 事件
    event NFTListed(
        uint256 indexed tokenId,
        address indexed seller,
        uint256 price
    );
    event NFTSold(
        uint256 indexed tokenId,
        address indexed buyer,
        address indexed seller,
        uint256 price
    );

    event TokensReceived(address from, uint256 amount, uint256 tokenId);

    // Gas优化：在构造函数中使用immutable变量
    constructor(IERC20 _ierc20, ERC721URIStorage _erc721) {
        paymentToken = _ierc20;
        erc721 = _erc721;
    }

    // 上架NFT
    function list(uint256 tokenId, uint256 price) external {
        // Gas优化：提前检查价格以节省gas
        if (price == 0) revert("Price must be greater than zero");
        
        // Gas优化：缓存owner以减少外部调用
        address owner = erc721.ownerOf(tokenId);
        if (owner != msg.sender) revert("Not the owner of this NFT");

        // Gas优化：使用packed结构体
        sellnft[tokenId] = NFT({
            price: uint128(price),
            seller: msg.sender
        });

        emit NFTListed(tokenId, msg.sender, price);
    }

    // 购买NFT
    function buyNFT(uint256 tokenId) external {
        // Gas优化：直接从存储中读取并检查
        NFT memory nft = sellnft[tokenId];
        if (nft.seller == address(0)) revert("NFT not listed for sale");
        if (nft.seller == msg.sender) revert("Cannot buy your own NFT");

        uint256 price = uint256(nft.price);
        address seller = nft.seller;

        // Gas优化：合并检查以减少外部调用
        // 检查买家是否已授权足够的代币给市场合约
        uint256 allowance = paymentToken.allowance(msg.sender, address(this));
        if (allowance < price) revert("Insufficient token allowance");

        // 检查买家是否有足够的代币余额
        uint256 buyerBalance = paymentToken.balanceOf(msg.sender);
        if (buyerBalance < price) revert("Insufficient token balance");

        // Gas优化：先转移代币再转移NFT，失败时回滚
        // 转移支付代币给卖家
        bool success = paymentToken.transferFrom(msg.sender, seller, price);
        if (!success) revert("Payment to seller failed");

        // 转移NFT从卖家到买家
        // 卖家必须事先批准市场合约可以转移该NFT
        erc721.transferFrom(seller, msg.sender, tokenId);

        // Gas优化：使用delete清除存储
        delete sellnft[tokenId];
        emit NFTSold(tokenId, msg.sender, seller, price);
    }

    // 用户主动给市场转币的回调
    function tokensReceived(
        address from,
        uint256 amount,
        uint256 tokenId
    ) public returns (bool) {
        // Gas优化：合并检查
        if (msg.sender != address(paymentToken)) revert("Invalid caller");
        if (amount == 0) revert("Invalid amount");
        if (tokenId == 0) revert("Invalid tokenId");

        // 检查NFT是否在售
        NFT memory nft = sellnft[tokenId];
        if (nft.seller == address(0)) revert("NFT not listed for sale");
        
        uint256 price = uint256(nft.price);
        if (amount < price) revert("Insufficient amount");
        
        // 如果用户转多了，退还给用户
        if (amount > price) {
            bool success = paymentToken.transfer(from, amount - price);
            if (!success) revert("Transfer to buyer failed");
        }
        
        // 转NFT给买家
        // 卖家必须事先批准市场合约可以转移该NFT
        erc721.transferFrom(nft.seller, from, tokenId);
        
        // 清除市场记录
        delete sellnft[tokenId];
        emit TokensReceived(from, amount, tokenId);
        return true;
    }
}