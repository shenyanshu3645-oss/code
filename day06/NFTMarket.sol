// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract NFTMarket {
    struct NFT {
        uint256 tokenId;
        uint256 price;
        address seller;
    }

    // 出售的NFT列表
    mapping(uint256 => NFT) public sellnft;

    // 支付代币合约
    IERC20 public paymentToken;

    //出售合约
    ERC721URIStorage public erc721;

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

    constructor(IERC20 _ierc20, ERC721URIStorage _erc721) {
        paymentToken = _ierc20;
        erc721 = _erc721;
    }

    // 上架NFT
    function list(uint256 tokenId, uint256 price) external {
        require(
            erc721.ownerOf(tokenId) == msg.sender,
            "Not the owner of this NFT"
        );
        require(price > 0, "Price must be greater than zero");

        //授权
        // erc721.approve(address(this), tokenId);

        NFT memory nft = NFT({
            tokenId: tokenId,
            price: price,
            seller: msg.sender
        });
        sellnft[tokenId] = nft;

        emit NFTListed(tokenId, msg.sender, price);
    }

    // 购买NFT
    function buyNFT(uint256 tokenId) external {
        NFT memory nft = sellnft[tokenId];
        require(nft.seller != address(0), "nft not exist!");
        require(nft.seller != msg.sender, "Cannot buy your own NFT");

        uint256 price = nft.price;
        address seller = nft.seller;
        //授权应该是前端操作的
        // paymentToken.approve(address(this), price);

        // 检查买家是否已授权足够的代币给市场合约
        uint256 allowance = paymentToken.allowance(msg.sender, address(this));
        console.log("allowance msg.sender: %s", msg.sender);
        console.log("allowance: %s", allowance);

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

    //用户主动给市场转币的回调
    function tokensReceived(
        address from,
        uint256 amount,
        uint256 tokenId
    ) public returns (bool) {
        console.log("market tokensReceived: %s", msg.sender);
        require(from==address(paymentToken), "Invalid from address");//必须是支付代币合约地址

        require(amount > 0, "Invalid amount");
        require(tokenId > 0, "Invalid tokenId");
        
        //检查nft是否在售
        NFT memory nft = sellnft[tokenId];
        require(nft.seller != address(0), "nft not exist!");
        require(amount>=nft.price, "Insufficient amount");
        //如果用户转多了，退还给用户
        if(amount>nft.price){
            bool transferret = paymentToken.transfer(from, amount-nft.price);
            require(transferret, "Transfer to buyer failed");
        }
        //转nft给买家
        erc721.transferFrom(nft.seller, from, tokenId);
        return true;
    }
}
