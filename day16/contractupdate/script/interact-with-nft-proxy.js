// scripts/interact-with-nft-proxy.js
import { ethers } from "ethers";
import pkg from 'hardhat';
const { network } = pkg;

async function main() {
  // 连接到本地网络
  const provider = new ethers.JsonRpcProvider("https://0xrpc.io/sep");
  
  // 使用测试账户私钥（这是Hardhat的默认测试账户之一）
  const privateKey = "0xf83246fcbae7346cd7f2bef2dac7476d0204f7a58621e36130056af1aa8d86c4";
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("用户地址:", wallet.address);

  const nftProxyAddress = "0xD4CdF3Da2aa3B3dD41002013305f10Db055F4036";
  const nftImplementationABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)", 
    "function mint(address to) external",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function balanceOf(address owner) view returns (uint256)",
    "function setBaseURI(string memory _baseTokenURI) external",
    "function baseTokenURI() view returns (string)",
    "function totalSupply() view returns (uint256)",
    "function transferFrom(address from, address to, uint256 tokenId) external",
    "function approve(address to, uint256 tokenId) external",
    "function setApprovalForAll(address operator, bool approved) external",
    "function owner() view returns (address)"
  ];

  // 使用实现合约的ABI + 代理合约地址
  const nft = new ethers.Contract(nftProxyAddress, nftImplementationABI, wallet);

  console.log("NFT代理地址:", nftProxyAddress);

  console.log("=== 读取操作 ===");
  try {
    console.log("合约名称:", await nft.name());
    console.log("合约符号:", await nft.symbol());
    console.log("基础URI:", await nft.baseTokenURI());
    console.log("总供应量:", (await nft.totalSupply()).toString());
    console.log("用户NFT余额:", (await nft.balanceOf(wallet.address)).toString());
    
    // 获取合约所有者
    const owner = await nft.owner();
    console.log("合约所有者:", owner);

    // 如果是所有者，可以执行写入操作
    if (owner.toLowerCase() === wallet.address.toLowerCase()) {
      console.log("\n=== 写入操作 ===");
      
      // 铸造NFT
      console.log("铸造NFT...");
      const mintTx = await nft.mint(wallet.address);
      await mintTx.wait();
      console.log("NFT铸造成功，Token ID: 1");
      
      // 检查所有权
      console.log("Token 1 所有者:", await nft.ownerOf(1));
      
      // 更新BaseURI
      console.log("更新BaseURI...");
      const setTx = await nft.setBaseURI("https://new-api.mynft.com/");
      await setTx.wait();
      console.log("BaseURI更新成功");
    }
  } catch (error) {
    console.error("读取合约信息时出错:", error.message);
  }

  console.log("\n✅ NFT交互完成！");
}

main();