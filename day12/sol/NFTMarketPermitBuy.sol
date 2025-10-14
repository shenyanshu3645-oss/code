// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "forge-std/console.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract NFTMarket is Ownable {
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

    // EIP-712 相关
    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("PermitBuy(address buyer,uint256 deadline)");

    mapping(bytes32 => bool) public usedSignatures;

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

    constructor(
        IERC20 _ierc20,
        ERC721URIStorage _erc721,
        address initialOwner
    ) Ownable(initialOwner) {
        paymentToken = _ierc20;
        erc721 = _erc721;
        // 初始化 EIP-712 域分隔符
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256("NTFMarket"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
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
        require(from == address(paymentToken), "Invalid from address"); //必须是支付代币合约地址

        require(amount > 0, "Invalid amount");
        require(tokenId > 0, "Invalid tokenId");

        //检查nft是否在售
        NFT memory nft = sellnft[tokenId];
        require(nft.seller != address(0), "nft not exist!");
        require(amount >= nft.price, "Insufficient amount");
        //如果用户转多了，退还给用户
        if (amount > nft.price) {
            bool transferret = paymentToken.transfer(from, amount - nft.price);
            require(transferret, "Transfer to buyer failed");
        }
        //转nft给买家
        erc721.transferFrom(nft.seller, from, tokenId);
        emit TokensReceived(from, amount, tokenId);
        return true;
    }

    //只有白名单用户可以调用
    function permitBuy(
        uint256 tokenId,
        uint256 deadline,
        bytes memory signature
    ) public returns (bool) {
        require(block.timestamp <= deadline, "Permission expired");
        // 验证签名是否有效且未使用过
        address signer = _verifyPermit(msg.sender, deadline, signature);
        require(signer == owner(), "Invalid signer or not authorized");

        NFT memory nftItem = sellnft[tokenId];
        require(nftItem.seller != address(0), "NFT not listed");

        // 检查买家是否已授权足够的代币给市场合约
        uint256 allowance = paymentToken.allowance(msg.sender, address(this));
        require(
            allowance >= nftItem.price,
            "Insufficient token allowance. Please approve tokens first"
        );

        // 检查买家是否有足够的代币余额
        uint256 buyerBalance = paymentToken.balanceOf(msg.sender);
        require(buyerBalance >= nftItem.price, "Insufficient token balance");

        // 执行购买
        _executePurchase(tokenId, msg.sender, nftItem.price, nftItem.seller);
        return true;
    }

    // 执行购买的内部函数
    function _executePurchase(
        uint256 tokenId,
        address buyer,
        uint256 price,
        address seller
    ) internal {
        // 转移支付代币给卖家
        bool transferret = paymentToken.transferFrom(buyer, seller, price);
        require(transferret, "Payment to seller failed");

        // 转移NFT从卖家到买家
        erc721.transferFrom(seller, buyer, tokenId);

        // 清除市场记录
        delete sellnft[tokenId];
        emit NFTSold(tokenId, buyer, seller, price);
    }

    // 验证签名
    function _verifyPermit(
        address buyer,
        uint256 deadline,
        bytes memory signature
    ) internal returns (address) {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(abi.encode(PERMIT_TYPEHASH, buyer, deadline))
            )
        );

        // 防止签名重放
        bytes32 signatureHash = keccak256(signature);
        require(!usedSignatures[signatureHash], "Signature already used");
        usedSignatures[signatureHash] = true;

        // 恢复签名者地址
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(signature);
        address signer = ecrecover(digest, v, r, s);

        return signer;
    }

    // 拆分签名辅助函数
    function splitSignature(
        bytes memory sig
    ) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid signature length");

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        if (v < 27) v += 27;
    }
}
