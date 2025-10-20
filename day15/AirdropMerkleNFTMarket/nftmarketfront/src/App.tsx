import React, { useState, useEffect, useRef } from 'react';
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { sepolia } from '@reown/appkit/networks';
import { Contract } from 'ethers';
// 导入整个ethers库以使用BrowserProvider
import * as ethers from 'ethers';

// 导入ABI文件
import NFTMarketABI from './contracts/NFTMarketPermitBuy.json';
import ERC721ABI from './contracts/ERC721Fixed.json';
import ERC20ABI from './contracts/ERC20.json';

// 合约地址
const NFT_MARKET_ADDRESS = '0xE98A52b2155329592edB7C9DeB72A97ceA0118E3';
const NFT_CONTRACT_ADDRESS = '0xcd5DAFE8f175f1f2495097AFE8d9B00f0E5E1417';
const PAYMENT_TOKEN_ADDRESS = '0x5F1B85e1930b31c8FcD174bDE0C96c2F7FA0f23e';

// 创建AppKit实例
const projectId = 'dec75313906337ce9a49c5c94bdfec6d';

const metadata = {
  name: 'NFT Market',
  description: 'NFT Marketplace with AppKit',
  url: 'https://reown.com/appkit',
  icons: ['https://learnblockchain.cn/image/avatar/412_big.jpg']
};

const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  metadata,
  projectId,
  networks: [sepolia],
  // 确保WalletConnect显示
  enableWalletConnect: true,
  enableWallets: true,
  allWallets: "SHOW",
  // 添加调试模式
  debug: true
});

const App: React.FC = () => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [userAddress, setUserAddress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [networkStatus, setNetworkStatus] = useState<string>('unknown');
  const [nftMarketContract, setNftMarketContract] = useState<Contract | null>(null);
  const [nftContract, setNftContract] = useState<Contract | null>(null);
  const [paymentTokenContract, setPaymentTokenContract] = useState<Contract | null>(null);
  const [listingStatus, setListingStatus] = useState<string>(''); // 上架状态
  const [buyingStatus, setBuyingStatus] = useState<string>(''); // 购买状态
  const [nftDetails, setNftDetails] = useState<{price?: bigint, seller?: string} | null>(null); // NFT详情
  
  // 添加签名购买相关的状态变量
  const [signedBuyingStatus, setSignedBuyingStatus] = useState<string>(''); // 签名购买状态
  const [signedBuyTokenId, setSignedBuyTokenId] = useState<string>(''); // 签名购买的Token ID
  const [signedBuySignature, setSignedBuySignature] = useState<string>(''); // 签名信息
  const [signedBuyDeadline, setSignedBuyDeadline] = useState<string>(''); // 签名截止时间

  // 添加Merkle购买相关的状态变量
  const [merkleBuyingStatus, setMerkleBuyingStatus] = useState<string>(''); // Merkle购买状态
  const [merkleBuyTokenId, setMerkleBuyTokenId] = useState<string>(''); // Merkle购买的Token ID
  const [merkleBuySignature, setMerkleBuySignature] = useState<string>(''); // Merkle购买签名信息
  const [merkleBuyDeadline, setMerkleBuyDeadline] = useState<string>(''); // Merkle购买签名截止时间
  const [merkleProof, setMerkleProof] = useState<string>(''); // Merkle证明

  const connectWallet = () => {
    try {
      console.log('尝试连接钱包...');
      appKit.open();
      setError('');
    } catch (err) {
      console.error('连接钱包失败:', err);
      setError('连接钱包失败: ' + (err as Error).message);
    }
  };

  // 初始化合约实例
  const initializeContracts = async () => {
    try {
      const walletProvider = appKit.getWalletProvider();
      if (!walletProvider) {
        throw new Error('钱包未连接');
      }
      
      // 使用更宽松的网络配置
      const ethersProvider = new ethers.BrowserProvider(walletProvider as ethers.Eip1193Provider, "any");
      
      // 添加超时处理
      const signerPromise = ethersProvider.getSigner();
      
      // 设置5秒超时
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('获取签名器超时，请检查网络连接')), 5000);
      });
      
      // 等待签名器或超时
      const signer = await Promise.race([signerPromise, timeoutPromise]) as ethers.Signer;
      
      // 初始化NFT市场合约
      const nftMarket = new Contract(NFT_MARKET_ADDRESS, NFTMarketABI, signer);
      setNftMarketContract(nftMarket);
      
      // 初始化NFT合约
      const nft = new Contract(NFT_CONTRACT_ADDRESS, ERC721ABI, signer);
      setNftContract(nft);
      
      // 初始化Payment Token合约
      const paymentToken = new Contract(PAYMENT_TOKEN_ADDRESS, ERC20ABI, signer);
      setPaymentTokenContract(paymentToken);
      
      console.log('合约初始化完成');
    } catch (err) {
      console.error('合约初始化失败:', err);
      setError('合约初始化失败: ' + (err as Error).message);
    }
  };

  // 监听账户状态变化
  useEffect(() => {
    console.log('初始化钱包监听器...');
    
    const unsubscribe = appKit.subscribeAccount((account) => {
      console.log('账户状态变化:', account);
      if (account?.address) {
        console.log('钱包已连接:', account.address);
        setUserAddress(account.address);
        setIsConnected(true);
        setError('');
        
        // 初始化合约
        initializeContracts();
      } else {
        console.log('钱包已断开');
        setIsConnected(false);
        setUserAddress('');
        setNftMarketContract(null);
        setNftContract(null);
        setPaymentTokenContract(null);
      }
    });

    // 监听连接状态变化
    const unsubscribeState = appKit.subscribeState((state) => {
      console.log('AppKit状态变化:', state);
    });

    return () => {
      console.log('清理监听器...');
    };
  }, []);

  // 上架NFT功能
  const listNFT = async (tokenId: string, price: string) => {
    try {
      // 清除之前的错误和状态
      setError('');
      setListingStatus('正在验证输入...');
      
      // 验证输入
      if (!tokenId || !price) {
        throw new Error('请输入Token ID和价格');
      }
      
      // 验证是否为有效数字
      if (!/^\d+$/.test(tokenId)) {
        throw new Error('Token ID必须为正整数');
      }
      
      if (!/^\d+(\.\d+)?$/.test(price)) {
        throw new Error('价格必须为有效的数字');
      }
      
      const tokenIdNum = BigInt(tokenId);
      
      // 将价格转换为wei单位 (假设输入的是ETH)
      let priceNum: bigint;
      if (price.includes('.')) {
        // 处理小数价格 (例如: 0.1 ETH)
        const [whole, decimal] = price.split('.');
        const decimalPlaces = decimal.length;
        if (decimalPlaces > 18) {
          throw new Error('价格小数位数不能超过18位');
        }
        const multiplier = 10n ** BigInt(18 - decimalPlaces);
        priceNum = BigInt(whole) * 10n ** 18n + BigInt(decimal) * multiplier;
      } else {
        // 处理整数价格 (例如: 1 ETH)
        priceNum = BigInt(price) * 10n ** 18n;
      }
      
      // 验证价格是否大于0
      if (priceNum <= 0n) {
        throw new Error('价格必须大于0');
      }
      
      if (!nftMarketContract || !nftContract) {
        throw new Error('合约未初始化，请重新连接钱包');
      }
      
      setListingStatus(`正在检查NFT #${tokenId} 的所有权...`);
      console.log(`正在上架NFT #${tokenId}，价格: ${price} ETH (${priceNum} wei)`);
      
      // 首先检查NFT所有权
      try {
        const owner = await nftContract.ownerOf(tokenIdNum);
        console.log(`NFT #${tokenId} 所有者:`, owner);
        console.log(`所有者类型:`, typeof owner);
        console.log(`所有者JSON:`, JSON.stringify(owner));
        
        // 安全地获取地址字符串
        let ownerStr: string;
        if (typeof owner === 'string') {
          ownerStr = owner;
        } else if (typeof owner === 'object' && owner !== null) {
          // 尝试获取对象的地址属性
          if ('address' in owner) {
            ownerStr = String(owner.address);
          } else if ('toString' in owner && typeof owner.toString === 'function') {
            ownerStr = owner.toString();
          } else {
            ownerStr = JSON.stringify(owner);
          }
        } else {
          // 其他类型直接转换为字符串
          ownerStr = String(owner);
        }
        
        // 获取当前用户地址
        console.log(`当前用户地址:`, userAddress);
        
        if (ownerStr.toLowerCase() !== userAddress.toLowerCase()) {
          throw new Error(`您不是此NFT的所有者。所有者地址: ${ownerStr.substring(0, 6)}...${ownerStr.substring(ownerStr.length - 4)}`);
        }
      } catch (err: any) {
        if (err.message.includes('ERC721: invalid token ID')) {
          throw new Error(`Token ID ${tokenId} 不存在`);
        }
        throw new Error('无法验证NFT所有权: ' + err.message);
      }
      
      // 检查NFT是否已经被批准给市场合约
      setListingStatus(`正在检查NFT #${tokenId} 的授权状态...`);
      try {
        const approvedAddress = await nftContract.getApproved(tokenIdNum);
        console.log(`NFT #${tokenId} 当前批准地址:`, approvedAddress);
        console.log(`批准地址类型:`, typeof approvedAddress);
        console.log(`批准地址JSON:`, JSON.stringify(approvedAddress));
        
        // 安全地获取批准地址字符串
        let approvedStr: string;
        if (typeof approvedAddress === 'string') {
          approvedStr = approvedAddress;
        } else if (typeof approvedAddress === 'object' && approvedAddress !== null) {
          // 尝试获取对象的地址属性
          if ('address' in approvedAddress) {
            approvedStr = String(approvedAddress.address);
          } else if ('toString' in approvedAddress && typeof approvedAddress.toString === 'function') {
            approvedStr = approvedAddress.toString();
          } else {
            approvedStr = JSON.stringify(approvedAddress);
          }
        } else {
          // 其他类型直接转换为字符串
          approvedStr = String(approvedAddress);
        }
        
        if (approvedStr.toLowerCase() !== NFT_MARKET_ADDRESS.toLowerCase()) {
          // 需要授权NFT给市场合约
          setListingStatus(`正在授权NFT #${tokenId} 给市场合约...`);
          console.log('正在授权NFT...');
          
          // 显示预计Gas费用
          try {
            const gasEstimate = await nftContract.approve.estimateGas(NFT_MARKET_ADDRESS, tokenIdNum);
            console.log(`预计授权Gas: ${gasEstimate.toString()}`);
          } catch (gasErr) {
            console.warn('无法估算Gas费用:', gasErr);
          }
          
          const approveTx = await nftContract.approve(NFT_MARKET_ADDRESS, tokenIdNum);
          setListingStatus(`授权交易已发送: ${approveTx.hash.substring(0, 10)}...${approveTx.hash.substring(approveTx.hash.length - 8)}，正在等待确认...`);
          console.log('授权交易已发送，等待确认...', approveTx.hash);
          await approveTx.wait();
          console.log('NFT授权成功');
        } else {
          console.log('NFT已经授权给市场合约');
        }
      } catch (err: any) {
        console.error('检查或授权NFT时出错:', err);
        if (err.message.includes('user rejected')) {
          throw new Error('用户取消了授权操作');
        }
        throw new Error('检查或授权NFT时出错: ' + err.message);
      }
      
      // 在市场合约上架NFT
      setListingStatus(`正在上架NFT #${tokenId}...`);
      console.log('正在上架NFT到市场...');
      
      // 显示预计Gas费用
      try {
        const gasEstimate = await nftMarketContract.list.estimateGas(tokenIdNum, priceNum);
        console.log(`预计上架Gas: ${gasEstimate.toString()}`);
      } catch (gasErr) {
        console.warn('无法估算Gas费用:', gasErr);
      }
      
      const listTx = await nftMarketContract.list(tokenIdNum, priceNum);
      setListingStatus(`上架交易已发送: ${listTx.hash.substring(0, 10)}...${listTx.hash.substring(listTx.hash.length - 8)}，正在等待确认...`);
      console.log('上架交易已发送，等待确认...', listTx.hash);
      await listTx.wait();
      console.log('NFT上架成功');
      
      setListingStatus('上架成功！');
      alert(`NFT #${tokenId} 上架成功！\n价格: ${price} ETH\n交易哈希: ${listTx.hash}`);
      
      // 清空输入框
      (document.getElementById('tokenId') as HTMLInputElement).value = '';
      (document.getElementById('price') as HTMLInputElement).value = '';
    } catch (err: any) {
      console.error('上架NFT失败:', err);
      const errorMsg = '上架NFT失败: ' + err.message;
      setError(errorMsg);
      setListingStatus('上架失败');
      
      // 提供更友好的错误提示
      if (err.message.includes('user rejected')) {
        alert('操作被用户取消');
      } else if (err.message.includes('insufficient funds')) {
        alert('Gas费用不足，请确保账户有足够的ETH支付手续费');
      } else if (err.message.includes('网络不可用')) {
        alert('网络连接不稳定，请检查网络连接或稍后重试');
      } else {
        alert(errorMsg);
      }
    }
  };

  // 购买NFT功能
  const buyNFT = async (tokenId: string) => {
    try {
      // 清除之前的错误和状态
      setError('');
      setBuyingStatus('正在验证输入...');
      
      // 验证输入
      if (!tokenId) {
        throw new Error('请输入Token ID');
      }
      
      // 验证是否为有效数字
      if (!/^\d+$/.test(tokenId)) {
        throw new Error('Token ID必须为正整数');
      }
      
      const tokenIdNum = BigInt(tokenId);
      
      if (!nftMarketContract || !nftContract || !paymentTokenContract) {
        throw new Error('合约未初始化，请重新连接钱包');
      }
      
      setBuyingStatus(`正在检查NFT #${tokenId} 是否在售...`);
      console.log(`正在检查NFT #${tokenId} 是否在售`);
      
      // 检查NFT是否在售
      try {
        // 获取NFT销售信息
        let sellInfo;
        try {
          sellInfo = await nftMarketContract.sellnft(tokenIdNum);
          console.log(`NFT #${tokenId} 销售信息:`, sellInfo);
        } catch (callErr: any) {
          console.error('调用sellnft函数时出错:', callErr);
          throw new Error(`无法获取NFT #${tokenId} 的销售信息: ${callErr.message || callErr}`);
        }
        
        // 验证返回的数据是否有效
        if (!sellInfo) {
          throw new Error(`NFT #${tokenId} 不存在或未上架`);
        }
        
        // 检查seller字段
        if (!sellInfo.seller || sellInfo.seller === ethers.ZeroAddress || sellInfo.seller === '0x0000000000000000000000000000000000000000') {
          throw new Error(`NFT #${tokenId} 不存在或未上架`);
        }
        
        // 检查price字段
        if (sellInfo.price === undefined || sellInfo.price === null) {
          throw new Error(`NFT #${tokenId} 价格信息无效`);
        }
        
        // 转换price为bigint（如果需要）
        let priceBigInt: bigint;
        if (typeof sellInfo.price === 'string') {
          priceBigInt = BigInt(sellInfo.price);
        } else if (typeof sellInfo.price === 'number') {
          priceBigInt = BigInt(Math.floor(sellInfo.price));
        } else {
          priceBigInt = sellInfo.price;
        }
        
        // 检查NFT是否有效（价格大于0表示在售）
        if (priceBigInt <= 0n) {
          throw new Error(`NFT #${tokenId} 不在售`);
        }
        
        // 保存NFT详情用于显示
        setNftDetails({
          price: priceBigInt,
          seller: sellInfo.seller
        });
        
        // 检查用户是否是NFT所有者（不能购买自己的NFT）
        if (sellInfo.seller.toLowerCase() === userAddress.toLowerCase()) {
          throw new Error('不能购买自己上架的NFT');
        }
        
        // 显示购买确认
        const priceInEth = Number(sellInfo.price) / 1e18;
        const confirmed = window.confirm(`确认购买NFT #${tokenId} 吗？\n价格: ${priceInEth} ETH`);
        if (!confirmed) {
          setBuyingStatus('购买已取消');
          return;
        }
        
        // 授权代币给市场合约
        setBuyingStatus(`正在授权代币...`);
        console.log('正在授权代币...');
        
        // 显示预计Gas费用
        try {
          const gasEstimate = await paymentTokenContract.approve.estimateGas(NFT_MARKET_ADDRESS, sellInfo.price);
          console.log(`预计授权Gas: ${gasEstimate.toString()}`);
        } catch (gasErr) {
          console.warn('无法估算Gas费用:', gasErr);
        }
        
        // 调用授权函数
        const approveTx = await paymentTokenContract.approve(NFT_MARKET_ADDRESS, sellInfo.price);
        
        setBuyingStatus(`授权交易已发送: ${approveTx.hash.substring(0, 10)}...${approveTx.hash.substring(approveTx.hash.length - 8)}，正在等待确认...`);
        console.log('授权交易已发送，等待确认...', approveTx.hash);
        await approveTx.wait();
        console.log('代币授权成功');
        
        setBuyingStatus(`正在购买NFT #${tokenId}...`);
        console.log('正在购买NFT...');
        
        // 显示预计Gas费用
        try {
          const gasEstimate = await nftMarketContract.buyNFT.estimateGas(tokenIdNum);
          console.log(`预计购买Gas: ${gasEstimate.toString()}`);
        } catch (gasErr) {
          console.warn('无法估算Gas费用:', gasErr);
        }
        
        // 调用购买函数
        const buyTx = await nftMarketContract.buyNFT(tokenIdNum);
        
        setBuyingStatus(`购买交易已发送: ${buyTx.hash.substring(0, 10)}...${buyTx.hash.substring(buyTx.hash.length - 8)}，正在等待确认...`);
        console.log('购买交易已发送，等待确认...', buyTx.hash);
        await buyTx.wait();
        console.log('NFT购买成功');
        
        setBuyingStatus('购买成功！');
        alert(`NFT #${tokenId} 购买成功！\n交易哈希: ${buyTx.hash}`);
        
        // 清空输入框
        const buyInput = document.querySelector('input[placeholder="要购买的NFT Token ID"]') as HTMLInputElement;
        if (buyInput) buyInput.value = '';
        
        // 清除NFT详情
        setNftDetails(null);
      } catch (err: any) {
        if (err.message.includes('ERC721: invalid token ID')) {
          throw new Error(`Token ID ${tokenId} 不存在`);
        }
        throw new Error('检查NFT时出错: ' + err.message);
      }
    } catch (err: any) {
      console.error('购买NFT失败:', err);
      const errorMsg = '购买NFT失败: ' + err.message;
      setError(errorMsg);
      setBuyingStatus('购买失败');
      
      // 提供更友好的错误提示
      if (err.message.includes('user rejected')) {
        alert('操作被用户取消');
      } else if (err.message.includes('insufficient funds')) {
        alert('余额不足，请确保账户有足够的ETH支付NFT价格和手续费');
      } else if (err.message.includes('网络不可用')) {
        alert('网络连接不稳定，请检查网络连接或稍后重试');
      } else {
        alert(errorMsg);
      }
      
      // 清除NFT详情
      setNftDetails(null);
    }
  };

  // 通过签名购买NFT功能
  const permitBuyNFT = async (tokenId: string, signature: string, deadline: string) => {
    try {
      // 清除之前的错误和状态
      setError('');
      setSignedBuyingStatus('正在验证输入...');
      
      // 验证输入
      if (!tokenId) {
        throw new Error('请输入Token ID');
      }
      
      if (!signature) {
        throw new Error('请输入签名信息');
      }
      
      if (!deadline) {
        throw new Error('请输入截止时间戳');
      }
      
      // 验证是否为有效数字
      if (!/^\d+$/.test(tokenId)) {
        throw new Error('Token ID必须为正整数');
      }
      
      // 验证签名格式
      if (!/^0x[a-fA-F0-9]{130}$/.test(signature)) {
        throw new Error('签名格式不正确，应为0x开头的132位十六进制字符串');
      }
      
      // 验证截止时间格式
      if (!/^\d+$/.test(deadline)) {
        throw new Error('截止时间必须为有效的时间戳');
      }
      
      const tokenIdNum = BigInt(tokenId);
      const deadlineNum = BigInt(deadline);
      
      if (!nftMarketContract || !paymentTokenContract) {
        throw new Error('合约未初始化，请重新连接钱包');
      }
      
      setSignedBuyingStatus(`正在检查NFT #${tokenId} 是否在售...`);
      console.log(`正在检查NFT #${tokenId} 是否在售`);
      
      // 检查NFT是否在售
      try {
        // 获取NFT销售信息
        let sellInfo;
        try {
          sellInfo = await nftMarketContract.sellnft(tokenIdNum);
          console.log(`NFT #${tokenId} 销售信息:`, sellInfo);
        } catch (callErr: any) {
          console.error('调用sellnft函数时出错:', callErr);
          throw new Error(`无法获取NFT #${tokenId} 的销售信息: ${callErr.message || callErr}`);
        }
        
        // 验证返回的数据是否有效
        if (!sellInfo) {
          throw new Error(`NFT #${tokenId} 不存在或未上架`);
        }
        
        // 检查seller字段
        if (!sellInfo.seller || sellInfo.seller === ethers.ZeroAddress || sellInfo.seller === '0x0000000000000000000000000000000000000000') {
          throw new Error(`NFT #${tokenId} 不存在或未上架`);
        }
        
        // 检查price字段
        if (sellInfo.price === undefined || sellInfo.price === null) {
          throw new Error(`NFT #${tokenId} 价格信息无效`);
        }
        
        // 转换price为bigint（如果需要）
        let priceBigInt: bigint;
        if (typeof sellInfo.price === 'string') {
          priceBigInt = BigInt(sellInfo.price);
        } else if (typeof sellInfo.price === 'number') {
          priceBigInt = BigInt(Math.floor(sellInfo.price));
        } else {
          priceBigInt = sellInfo.price;
        }
        
        // 检查NFT是否有效（价格大于0表示在售）
        if (priceBigInt <= 0n) {
          throw new Error(`NFT #${tokenId} 不在售`);
        }
        
        // 保存NFT详情用于显示
        setNftDetails({
          price: priceBigInt,
          seller: sellInfo.seller
        });
        
        // 检查用户是否是NFT所有者（不能购买自己的NFT）
        if (sellInfo.seller.toLowerCase() === userAddress.toLowerCase()) {
          throw new Error('不能购买自己上架的NFT');
        }
        
        // 显示购买确认
        const priceInEth = Number(sellInfo.price) / 1e18;
        const confirmed = window.confirm(`确认通过签名购买NFT #${tokenId} 吗？\n价格: ${priceInEth} ETH`);
        if (!confirmed) {
          setSignedBuyingStatus('购买已取消');
          return;
        }
        
        // 授权代币给市场合约
        setSignedBuyingStatus(`正在授权代币...`);
        console.log('正在授权代币...');
        
        // 显示预计Gas费用
        try {
          const gasEstimate = await paymentTokenContract.approve.estimateGas(NFT_MARKET_ADDRESS, sellInfo.price);
          console.log(`预计授权Gas: ${gasEstimate.toString()}`);
        } catch (gasErr) {
          console.warn('无法估算Gas费用:', gasErr);
        }
        
        // 调用授权函数
        const approveTx = await paymentTokenContract.approve(NFT_MARKET_ADDRESS, sellInfo.price);
        
        setSignedBuyingStatus(`授权交易已发送: ${approveTx.hash.substring(0, 10)}...${approveTx.hash.substring(approveTx.hash.length - 8)}，正在等待确认...`);
        console.log('授权交易已发送，等待确认...', approveTx.hash);
        await approveTx.wait();
        console.log('代币授权成功');
        
        setSignedBuyingStatus(`正在通过签名购买NFT #${tokenId}...`);
        console.log('正在通过签名购买NFT...');
        
        // 使用用户输入的截止时间
        console.log('使用截止时间:', deadlineNum.toString());
        
        // 显示预计Gas费用
        try {
          const gasEstimate = await nftMarketContract.permitBuy.estimateGas(tokenIdNum, deadlineNum, signature);
          console.log(`预计签名购买Gas: ${gasEstimate.toString()}`);
        } catch (gasErr) {
          console.warn('无法估算Gas费用:', gasErr);
        }
        
        // 调用签名购买函数 - 传入用户输入的截止时间
        const permitBuyTx = await nftMarketContract.permitBuy(tokenIdNum, deadlineNum, signature);
        
        setSignedBuyingStatus(`签名购买交易已发送: ${permitBuyTx.hash.substring(0, 10)}...${permitBuyTx.hash.substring(permitBuyTx.hash.length - 8)}，正在等待确认...`);
        console.log('签名购买交易已发送，等待确认...', permitBuyTx.hash);
        await permitBuyTx.wait();
        console.log('NFT签名购买成功');
        
        setSignedBuyingStatus('签名购买成功！');
        alert(`NFT #${tokenId} 签名购买成功！\n交易哈希: ${permitBuyTx.hash}`);
        
        // 清空输入框
        setSignedBuyTokenId('');
        setSignedBuySignature('');
        setSignedBuyDeadline('');
        
        // 清除NFT详情
        setNftDetails(null);
      } catch (err: any) {
        if (err.message.includes('ERC721: invalid token ID')) {
          throw new Error(`Token ID ${tokenId} 不存在`);
        }
        // 提供更具体的错误信息
        if (err.message.includes('Invalid signer or not authorized')) {
          throw new Error('签名验证失败：签名不是由合约所有者(0x2B472592c4A67f890E823eb741942fce2ae474C1)生成的，请确保使用正确的私钥生成签名');
        }
        if (err.message.includes('Permission expired')) {
          throw new Error('签名已过期：请生成新的签名');
        }
        if (err.message.includes('Signature already used')) {
          throw new Error('签名已被使用：请生成新的签名');
        }
        throw new Error('检查NFT时出错: ' + err.message);
      }
    } catch (err: any) {
      console.error('签名购买NFT失败:', err);
      const errorMsg = '签名购买NFT失败: ' + err.message;
      setError(errorMsg);
      setSignedBuyingStatus('签名购买失败');
      
      // 提供更友好的错误提示
      if (err.message.includes('user rejected')) {
        alert('操作被用户取消');
      } else if (err.message.includes('insufficient funds')) {
        alert('余额不足，请确保账户有足够的ETH支付NFT价格和手续费');
      } else if (err.message.includes('网络不可用')) {
        alert('网络连接不稳定，请检查网络连接或稍后重试');
      } else if (err.message.includes('签名验证失败')) {
        alert('签名验证失败：签名不是由合约所有者(0x2B472592c4A67f890E823eb741942fce2ae474C1)生成的，请确保使用正确的私钥生成签名');
      } else if (err.message.includes('签名已过期')) {
        alert('签名已过期：请生成新的签名');
      } else if (err.message.includes('签名已被使用')) {
        alert('签名已被使用：请生成新的签名');
      } else {
        alert(errorMsg);
      }
      
      // 清除NFT详情
      setNftDetails(null);
    }
  };

  // 生成Merkle证明
  const generateMerkleProof = async () => {
    try {
      if (!userAddress) {
        setMerkleBuyingStatus('请先连接钱包');
        return;
      }

      // 使用viem生成Merkle证明
      const { keccak256, encodePacked } = await import('viem');
      const { MerkleTree } = await import('merkletreejs');
      
      // 白名单地址（与合约中使用的相同）
      const users = [
        "0x2B472592c4A67f890E823eb741942fce2ae474C1",
        "0xf6E14B5b166AeA7b02a1a77e88b14402fFE39e4D",
        "0x9d5cc9928CDb4eB943e2e716aa1c54c6c6eD2eFE"
      ];

      // 生成Merkle树元素（使用viem的哈希函数）
      const elements = users.map((x: string) =>
        keccak256(encodePacked(["address"], [x as `0x${string}`]))
      );

      // 创建Merkle树（使用viem的哈希函数）
      const merkleTree = new MerkleTree(elements, keccak256, { sort: true });

      // 生成当前地址的叶子节点
      const leaf = keccak256(encodePacked(["address"], [userAddress as `0x${string}`]));
      console.log('当前地址的叶子节点:', leaf);
      
      // 使用完整的Merkle树为当前地址生成证明
      const proof = merkleTree.getHexProof(leaf);
      console.log('Merkle证明:', proof);
      
      setMerkleProof(JSON.stringify(proof));
      setMerkleBuyingStatus('Merkle证明已生成');
    } catch (err: any) {
      setMerkleBuyingStatus('生成证明失败: ' + err.message);
    }
  };

  // 通过multicall购买NFT (Merkle白名单购买)
  const merkleBuyNFT = async () => {
    try {
      // 清除之前的错误和状态
      setError('');
      setMerkleBuyingStatus('正在验证输入...');
      
      // 验证输入
      if (!merkleBuyTokenId) {
        throw new Error('请输入Token ID');
      }
      
      if (!merkleBuySignature) {
        throw new Error('请输入签名信息');
      }
      
      if (!merkleBuyDeadline) {
        throw new Error('请输入截止时间戳');
      }
      
      // 不再需要检查merkleProof输入，因为我们是自动生成的
      // 但我们仍然需要确保证明已生成
      if (!merkleProof) {
        throw new Error('请先生成Merkle证明');
      }
      
      // 验证是否为有效数字
      if (!/^\d+$/.test(merkleBuyTokenId)) {
        throw new Error('Token ID必须为正整数');
      }
      
      // 验证签名格式
      if (!/^0x[a-fA-F0-9]{130}$/.test(merkleBuySignature)) {
        throw new Error('签名格式不正确，应为0x开头的132位十六进制字符串');
      }
      
      // 验证截止时间格式
      if (!/^\d+$/.test(merkleBuyDeadline)) {
        throw new Error('截止时间必须为有效的时间戳');
      }
      
      // 验证Merkle证明格式
      let proofArray: string[];
      try {
        proofArray = JSON.parse(merkleProof);
        if (!Array.isArray(proofArray)) {
          throw new Error('Merkle证明格式不正确');
        }
      } catch (parseErr) {
        throw new Error('Merkle证明格式不正确');
      }
      
      const tokenIdNum = BigInt(merkleBuyTokenId);
      const deadlineNum = BigInt(merkleBuyDeadline);
      
      if (!nftMarketContract || !paymentTokenContract) {
        throw new Error('合约未初始化，请重新连接钱包');
      }
      
      setMerkleBuyingStatus(`正在检查NFT #${merkleBuyTokenId} 是否在售...`);
      console.log(`正在检查NFT #${merkleBuyTokenId} 是否在售`);
      
      // 检查NFT是否在售
      try {
        // 获取NFT销售信息
        let sellInfo;
        try {
          sellInfo = await nftMarketContract.sellnft(tokenIdNum);
          console.log(`NFT #${merkleBuyTokenId} 销售信息:`, sellInfo);
        } catch (callErr: any) {
          console.error('调用sellnft函数时出错:', callErr);
          throw new Error(`无法获取NFT #${merkleBuyTokenId} 的销售信息: ${callErr.message || callErr}`);
        }
        
        // 验证返回的数据是否有效
        if (!sellInfo) {
          throw new Error(`NFT #${merkleBuyTokenId} 不存在或未上架`);
        }
        
        // 检查seller字段
        if (!sellInfo.seller || sellInfo.seller === ethers.ZeroAddress || sellInfo.seller === '0x0000000000000000000000000000000000000000') {
          throw new Error(`NFT #${merkleBuyTokenId} 不存在或未上架`);
        }
        
        // 检查price字段
        if (sellInfo.price === undefined || sellInfo.price === null) {
          throw new Error(`NFT #${merkleBuyTokenId} 价格信息无效`);
        }
        
        // 转换price为bigint（如果需要）
        let priceBigInt: bigint;
        if (typeof sellInfo.price === 'string') {
          priceBigInt = BigInt(sellInfo.price);
        } else if (typeof sellInfo.price === 'number') {
          priceBigInt = BigInt(Math.floor(sellInfo.price));
        } else {
          priceBigInt = sellInfo.price;
        }
        
        // 检查NFT是否有效（价格大于0表示在售）
        if (priceBigInt <= 0n) {
          throw new Error(`NFT #${merkleBuyTokenId} 不在售`);
        }
        
        // 保存NFT详情用于显示
        setNftDetails({
          price: priceBigInt,
          seller: sellInfo.seller
        });
        
        // 检查用户是否是NFT所有者（不能购买自己的NFT）
        if (sellInfo.seller.toLowerCase() === userAddress.toLowerCase()) {
          throw new Error('不能购买自己上架的NFT');
        }
        
        // 显示购买确认
        const priceInEth = Number(sellInfo.price) / 1e18;
        const confirmed = window.confirm(`确认通过Merkle白名单购买NFT #${merkleBuyTokenId} 吗？\n价格: ${priceInEth} ETH`);
        if (!confirmed) {
          setMerkleBuyingStatus('购买已取消');
          return;
        }
        
        setMerkleBuyingStatus(`正在构造multicall数据...`);
        console.log('正在构造multicall数据...');
        
        // 使用viem构造permitPrePay的calldata
        const { encodeFunctionData } = await import('viem');
        const permitPrePayData = encodeFunctionData({
          abi: NFTMarketABI,
          functionName: 'permitPrePay',
          args: [tokenIdNum, deadlineNum, merkleBuySignature as `0x${string}`]
        });
        console.log('permitPrePay calldata:', permitPrePayData);
        
        // 使用viem构造claimNFT的calldata
        const claimNFTData = encodeFunctionData({
          abi: NFTMarketABI,
          functionName: 'claimNFT',
          args: [userAddress as `0x${string}`, tokenIdNum, proofArray]
        });
        console.log('claimNFT calldata:', claimNFTData);
        
        // 构造multicall的参数
        const multicallData = [permitPrePayData, claimNFTData];
        console.log('multicall data:', multicallData);
        
        setMerkleBuyingStatus(`正在通过multicall执行Merkle购买...`);
        console.log('正在通过multicall执行Merkle购买...');
        
        // // 显示预计Gas费用
        // try {
        //   const gasEstimate = await nftMarketContract.multicall.estimateGas(multicallData);
        //   console.log(`预计multicall Gas: ${gasEstimate.toString()}`);
        // } catch (gasErr) {
        //   console.warn('无法估算Gas费用:', gasErr);
        // }

        // 调用multicall函数
        let multicallTx;
        try {
          multicallTx = await nftMarketContract.multicall(multicallData);
          
          setMerkleBuyingStatus(`multicall交易已发送: ${multicallTx.hash.substring(0, 10)}...${multicallTx.hash.substring(multicallTx.hash.length - 8)}，正在等待确认...`);
          console.log('multicall交易已发送，等待确认...', multicallTx.hash);
          await multicallTx.wait();
          console.log('NFT Merkle购买成功');
          
          setMerkleBuyingStatus('Merkle购买成功！');
          alert(`NFT #${merkleBuyTokenId} Merkle购买成功！\n交易哈希: ${multicallTx.hash}`);
          
          // 清空输入框
          setMerkleBuyTokenId('');
          setMerkleBuySignature('');
          setMerkleBuyDeadline('');
          setMerkleProof('');
          
          // 清除NFT详情
          setNftDetails(null);
        } catch (multicallErr: any) {
          console.error('Multicall执行失败:', multicallErr);
          throw new Error(`Multicall执行失败: ${multicallErr.message || multicallErr}`);
        }
      } catch (err: any) {
        console.error('NFT检查阶段发生错误:', err);
        if (err.message.includes('ERC721: invalid token ID')) {
          throw new Error(`Token ID ${merkleBuyTokenId} 不存在`);
        }
        // 提供更具体的错误信息
        if (err.message.includes('Invalid signer or not authorized')) {
          throw new Error('签名验证失败：签名不是由合约所有者生成的，请确保使用正确的私钥生成签名');
        }
        if (err.message.includes('Permission expired')) {
          throw new Error('签名已过期：请生成新的签名');
        }
        if (err.message.includes('Signature already used')) {
          throw new Error('签名已被使用：请生成新的签名');
        }
        if (err.message.includes('MerkleDistributor: Invalid proof')) {
          throw new Error('Merkle证明无效：您不在白名单中或证明已过期');
        }
        throw new Error('检查NFT时出错: ' + err.message);
      }
    } catch (err: any) {
      console.error('Merkle购买NFT失败:', err);
      const errorMsg = 'Merkle购买NFT失败: ' + err.message;
      setError(errorMsg);
      setMerkleBuyingStatus('Merkle购买失败');
      
      // 提供更友好的错误提示
      if (err.message.includes('user rejected')) {
        alert('操作被用户取消');
      } else if (err.message.includes('insufficient funds')) {
        alert('余额不足，请确保账户有足够的ETH支付NFT价格和手续费');
      } else if (err.message.includes('网络不可用')) {
        alert('网络连接不稳定，请检查网络连接或稍后重试');
      } else if (err.message.includes('签名验证失败')) {
        alert('签名验证失败：签名不是由合约所有者生成的，请确保使用正确的私钥生成签名');
      } else if (err.message.includes('签名已过期')) {
        alert('签名已过期：请生成新的签名');
      } else if (err.message.includes('签名已被使用')) {
        alert('签名已被使用：请生成新的签名');
      } else if (err.message.includes('Merkle证明无效')) {
        alert('Merkle证明无效：您不在白名单中或证明已过期');
      } else {
        alert(errorMsg);
      }
      
      // 清除NFT详情
      setNftDetails(null);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>NFT Marketplace</h1>
      
      {/* 错误信息显示 */}
      {error && (
        <div style={{ 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          padding: '10px', 
          borderRadius: '4px', 
          marginBottom: '15px',
          border: '1px solid #f5c6cb'
        }}>
          错误: {error}
        </div>
      )}
      
      {!isConnected ? (
        <button 
          onClick={connectWallet}
          style={{ 
            padding: '10px 20px', 
            fontSize: '16px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: 'pointer' 
          }}
        >
          连接钱包
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <span>已连接: {userAddress.substring(0, 6)}...{userAddress.substring(userAddress.length - 4)}</span>
          <button 
            onClick={() => {
              appKit.disconnect();
              setIsConnected(false);
              setUserAddress('');
              setNftMarketContract(null);
              setNftContract(null);
              setPaymentTokenContract(null);
            }}
            style={{ 
              padding: '10px 20px', 
              fontSize: '16px', 
              backgroundColor: '#dc3545', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: 'pointer' 
            }}
          >
            断开连接
          </button>
        </div>
      )}
      
      {isConnected && (
        <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <h2>NFT市场功能</h2>
          
          {/* 传统功能区域 - 保持不变 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '15px' }}>
            <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3>上架NFT</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input 
                  type="text" 
                  id="tokenId"
                  placeholder="NFT Token ID" 
                  style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
                <input 
                  type="text" 
                  id="price"
                  placeholder="价格 (wei)" 
                  style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
                {listingStatus && (
                  <div style={{ 
                    padding: '8px', 
                    borderRadius: '4px',
                    backgroundColor: listingStatus.includes('成功') ? '#d4edda' : 
                                   listingStatus.includes('失败') ? '#f8d7da' : '#d1ecf1',
                    color: listingStatus.includes('成功') ? '#155724' : 
                          listingStatus.includes('失败') ? '#721c24' : '#0c5460',
                    fontSize: '14px'
                  }}>
                    {listingStatus}
                  </div>
                )}
                <button 
                  onClick={() => {
                    const tokenId = (document.getElementById('tokenId') as HTMLInputElement).value;
                    const price = (document.getElementById('price') as HTMLInputElement).value;
                    listNFT(tokenId, price);
                  }}
                  style={{ 
                    padding: '10px', 
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer' 
                  }}
                >
                  上架
                </button>
              </div>
            </div>
            
            <div style={{ backgroundColor: 'white', padding: '15px', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3>购买NFT</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input 
                  type="text" 
                  placeholder="要购买的NFT Token ID" 
                  style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
                />
                {buyingStatus && (
                  <div style={{ 
                    padding: '8px', 
                    borderRadius: '4px',
                    backgroundColor: buyingStatus.includes('成功') ? '#d4edda' : 
                                   buyingStatus.includes('失败') ? '#f8d7da' : '#d1ecf1',
                    color: buyingStatus.includes('成功') ? '#155724' : 
                          buyingStatus.includes('失败') ? '#721c24' : '#0c5460',
                    fontSize: '14px'
                  }}>
                    {buyingStatus}
                  </div>
                )}
                <button 
                  onClick={() => {
                    const buyInput = document.querySelector('input[placeholder="要购买的NFT Token ID"]') as HTMLInputElement;
                    if (buyInput) buyNFT(buyInput.value);
                  }}
                  style={{ 
                    padding: '10px', 
                    backgroundColor: '#007bff', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer' 
                  }}
                >
                  购买
                </button>
              </div>
            </div>
          </div>
          
          {/* 签名购买功能区域 */}
          <div style={{ 
            marginTop: '30px', 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '4px', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3>通过签名购买NFT</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
              <input 
                type="text" 
                value={signedBuyTokenId}
                onChange={(e) => setSignedBuyTokenId(e.target.value)}
                placeholder="要购买的NFT Token ID" 
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <input
                type="text"
                value={signedBuyDeadline}
                onChange={(e) => setSignedBuyDeadline(e.target.value)}
                placeholder="截止时间戳 (例如: 1760545760)"
                style={{ 
                  padding: '8px', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px' 
                }}
              />
              <textarea
                value={signedBuySignature}
                onChange={(e) => setSignedBuySignature(e.target.value)}
                placeholder="签名信息 (0x...)"
                style={{ 
                  padding: '8px', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px', 
                  minHeight: '100px',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}
              />
              {signedBuyingStatus && (
                <div style={{ 
                  padding: '8px', 
                  borderRadius: '4px',
                  backgroundColor: signedBuyingStatus.includes('成功') ? '#d4edda' : 
                                 signedBuyingStatus.includes('失败') ? '#f8d7da' : '#d1ecf1',
                  color: signedBuyingStatus.includes('成功') ? '#155724' : 
                        signedBuyingStatus.includes('失败') ? '#721c24' : '#0c5460',
                  fontSize: '14px'
                }}>
                  {signedBuyingStatus}
                </div>
              )}
              <button 
                onClick={() => {
                  permitBuyNFT(signedBuyTokenId, signedBuySignature, signedBuyDeadline);
                }}
                style={{ 
                  padding: '10px', 
                  backgroundColor: '#6f42c1', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer' 
                }}
              >
                通过签名购买
              </button>
            </div>
          </div>
          
          {/* Merkle白名单购买功能区域 */}
          <div style={{ 
            marginTop: '30px', 
            padding: '20px', 
            backgroundColor: 'white', 
            borderRadius: '4px', 
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <h3>通过Merkle白名单购买NFT</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px' }}>
              <input 
                type="text" 
                value={merkleBuyTokenId}
                onChange={(e) => setMerkleBuyTokenId(e.target.value)}
                placeholder="要购买的NFT Token ID" 
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={merkleBuyDeadline}
                  onChange={(e) => setMerkleBuyDeadline(e.target.value)}
                  placeholder="截止时间戳 (例如: 1760545760)"
                  style={{ 
                    padding: '8px', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px',
                    flex: 1
                  }}
                />
                <button
                  onClick={() => {
                    const hours = prompt('请输入小时数 (1-48):', '24');
                    if (hours) {
                      const hoursNum = parseInt(hours);
                      if (hoursNum > 0 && hoursNum <= 48) {
                        const deadline = Math.floor(Date.now() / 1000) + (hoursNum * 3600);
                        setMerkleBuyDeadline(deadline.toString());
                      } else {
                        alert('请输入1-48之间的有效数字');
                      }
                    }
                  }}
                  style={{ 
                    padding: '8px 12px', 
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer'
                  }}
                >
                  快捷设置
                </button>
              </div>
              <textarea
                value={merkleBuySignature}
                onChange={(e) => setMerkleBuySignature(e.target.value)}
                placeholder="签名信息 (0x...)"
                style={{ 
                  padding: '8px', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px', 
                  minHeight: '100px',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={generateMerkleProof}
                  style={{ 
                    padding: '10px', 
                    backgroundColor: '#17a2b8', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '4px', 
                    cursor: 'pointer',
                    flex: 1
                  }}
                >
                  生成Merkle证明
                </button>
              </div>
              {merkleProof && (
                <div style={{ 
                  padding: '8px', 
                  borderRadius: '4px',
                  backgroundColor: '#d1ecf1',
                  color: '#0c5460',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all'
                }}>
                  <strong>生成的Merkle证明:</strong>
                  <div>{merkleProof}</div>
                </div>
              )}
              {merkleBuyingStatus && (
                <div style={{ 
                  padding: '8px', 
                  borderRadius: '4px',
                  backgroundColor: merkleBuyingStatus.includes('成功') ? '#d4edda' : 
                                 merkleBuyingStatus.includes('失败') ? '#f8d7da' : '#d1ecf1',
                  color: merkleBuyingStatus.includes('成功') ? '#155724' : 
                        merkleBuyingStatus.includes('失败') ? '#721c24' : '#0c5460',
                  fontSize: '14px'
                }}>
                  {merkleBuyingStatus}
                </div>
              )}
              <button 
                onClick={merkleBuyNFT}
                style={{ 
                  padding: '10px', 
                  backgroundColor: '#fd7e14', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  cursor: 'pointer' 
                }}
              >
                通过Merkle白名单购买
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;