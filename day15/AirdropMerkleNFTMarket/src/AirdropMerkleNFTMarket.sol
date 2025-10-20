// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import "forge-std/console.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

contract NFTMarket is Ownable {
    struct NFT {
        uint256 tokenId;
        uint256 price;
        address seller;
    }

    // 出售的NFT列表
    mapping(uint256 => NFT) public sellnft;

    // 支付代币合约
    IERC20Permit public paymentToken;

    //出售合约
    ERC721 public erc721;

    bytes32 public immutable merkleRoot;

    // EIP-712 相关
    bytes32 public DOMAIN_SEPARATOR;
    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("PermitPrePay(address buyer,uint256 deadline)");

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

    event Claimed(address account, uint256 tokenId);

    event MulticallExecuted(address indexed to, bytes[] data);

    constructor(
        IERC20Permit _ierc20Permit,
        ERC721 _erc721,
        bytes32 merkleRoot_,
        address initialOwner
    ) Ownable(initialOwner) {
        paymentToken = _ierc20Permit;
        erc721 = _erc721;

        merkleRoot = merkleRoot_;

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
        IERC20 token = IERC20(address(paymentToken));
        uint256 allowance = token.allowance(msg.sender, address(this));
        console.log("allowance msg.sender: %s", msg.sender);
        console.log("allowance: %s", allowance);

        require(
            allowance >= price,
            "Insufficient token allowance. Please approve tokens first"
        );

        // 检查买家是否有足够的代币余额
        uint256 buyerBalance = token.balanceOf(msg.sender);
        require(buyerBalance >= price, "Insufficient token balance");

        // 转移支付代币给卖家
        bool transferret = IERC20(address(paymentToken)).transferFrom(
            msg.sender,
            seller,
            price
        );
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
            IERC20 token = IERC20(address(paymentToken));
            bool transferret = token.transfer(from, amount - nft.price);
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
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public returns (bool) {
        require(block.timestamp <= deadline, "Permission expired");

        NFT memory nftItem = sellnft[tokenId];
        require(nftItem.seller != address(0), "NFT not listed");

        // 使用 permit 方法授权代币
        paymentToken.permit(
            msg.sender,
            address(this),
            nftItem.price,
            deadline,
            v,
            r,
            s
        );

        // 检查买家是否已授权足够的代币给市场合约
        IERC20 token = IERC20(address(paymentToken));
        uint256 allowance = token.allowance(msg.sender, address(this));
        require(
            allowance >= nftItem.price,
            "Insufficient token allowance. Please approve tokens first"
        );

        // 检查买家是否有足够的代币余额
        uint256 buyerBalance = token.balanceOf(msg.sender);
        require(buyerBalance >= nftItem.price, "Insufficient token balance");

        // 执行购买
        _executePurchase(
            tokenId,
            msg.sender,
            nftItem.price,
            nftItem.seller,
            false
        );
        return true;
    }

    // 执行购买的内部函数
    function _executePurchase(
        uint256 tokenId,
        address buyer,
        uint256 price,
        address seller,
        bool isWhitelist
    ) internal {
        uint payamount = price;
        // 转移支付代币给卖家
        if (isWhitelist) {
            payamount = price / 2;
        }
        IERC20 token = IERC20(address(paymentToken));
        bool transferret = token.transferFrom(buyer, seller, payamount);
        require(transferret, "Payment to seller failed");

        // 转移NFT从卖家到买家
        erc721.transferFrom(seller, buyer, tokenId);

        // 清除市场记录
        delete sellnft[tokenId];
        emit NFTSold(tokenId, buyer, seller, payamount);
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

    function permitPrePay(
        uint256 tokenId,
        uint256 deadline,
        bytes memory signature
    ) public returns (bool) {
        require(block.timestamp <= deadline, "Permission expired");

        NFT memory nft = sellnft[tokenId];
        require(nft.seller != address(0), "NFT not listed");

        // 防止签名重放
        bytes32 signatureHash = keccak256(signature);
        require(!usedSignatures[signatureHash], "Signature already used");
        usedSignatures[signatureHash] = true;

        // 恢复签名者地址
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(signature);

        paymentToken.permit(
            msg.sender,
            address(this),
            nft.price,
            deadline,
            v,
            r,
            s
        );

        return true;
    }

    //基于 Merkel 树验证某用户是否在白名单中
    function claimNFT(
        address account,
        uint256 tokenId,
        bytes32[] memory proof
    ) public returns (bool) {
        // Verify the merkle proof.
        bytes32 node = keccak256(abi.encodePacked(account));
        require(
            MerkleProof.verify(proof, merkleRoot, node),
            "MerkleDistributor: Invalid proof."
        );

        emit Claimed(account, tokenId);

        NFT memory nftItem = sellnft[tokenId];
        require(nftItem.seller != address(0), "NFT not listed");

        // 检查买家是否已授权足够的代币给市场合约
        IERC20 token = IERC20(address(paymentToken));
        uint256 allowance = token.allowance(msg.sender, address(this));
        require(
            allowance >= nftItem.price,
            "Insufficient token allowance. Please approve tokens first"
        );

        // 检查买家是否有足够的代币余额
        uint256 buyerBalance = token.balanceOf(msg.sender);
        require(buyerBalance >= nftItem.price, "Insufficient token balance");

        // 执行购买
        _executePurchase(
            tokenId,
            msg.sender,
            nftItem.price,
            nftItem.seller,
            true
        );

        return true;
    }

    function multicall(
        bytes[] calldata data
    ) external returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            //调用自己内部的函数，用 delegatecall
            results[i] = Address.functionDelegateCall(address(this), data[i]);
        }
        emit MulticallExecuted(msg.sender, data);
        return results;
    }
}
