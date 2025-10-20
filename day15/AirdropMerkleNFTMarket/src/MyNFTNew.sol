// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 引入 OpenZeppelin 合约
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFTNew is ERC721, Ownable {
    uint256 private _tokenIdCounter; // 用于生成 tokenId 的计数器

    // 构造函数：初始化 NFT 名称和符号
    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {}

    // 安全铸造函数：只有合约所有者可以调用，为指定地址铸造一个 NFT
    function safeMint(address to) public onlyOwner {
        uint256 tokenId = _tokenIdCounter; // 获取当前 tokenId
        _tokenIdCounter++; // 递增 tokenId 计数器
        _safeMint(to, tokenId); // 执行安全铸造
    }

    function _baseURI() internal pure override returns (string memory) {
        return "https://xxxxxxx.com/";
    }
}