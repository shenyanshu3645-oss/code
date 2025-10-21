// scripts/check-admin.js
import { ethers } from "ethers";

async function main() {
  // 请替换为实际的代理合约地址
  const proxyAddress = "0xD4CdF3Da2aa3B3dD41002013305f10Db055F4036"; // 占位符地址
  
  
  
  // 连接到以太坊网络（请根据需要修改RPC URL）
  const provider = new ethers.JsonRpcProvider("https://0xrpc.io/sep");
  
  console.log("代理合约地址:", proxyAddress);
  
  try {
    // ERC1967标准的admin存储槽
    const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
    
    // 获取admin地址
    const adminStorage = await provider.getStorage(proxyAddress, ADMIN_SLOT);
    const adminAddress = "0x" + adminStorage.slice(-40);
    console.log("Admin地址:", adminAddress);
    
    // ERC1967标准的实现合约存储槽
    const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
    
    // 获取实现合约地址
    const implementationStorage = await provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
    const implementationAddress = "0x" + implementationStorage.slice(-40);
    console.log("实现合约地址:", implementationAddress);
    
  } catch (error) {
    console.error("检查代理合约时出错:", error.message);
    console.log("请确保：");
    console.log("1. 代理合约地址是有效的");
    console.log("2. 本地节点正在运行");
    console.log("3. 合约确实使用了ERC1967标准的存储槽");
  }
}

main();