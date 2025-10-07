import React, { useState, useEffect, useRef } from 'react';
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { sepolia } from '@reown/appkit/networks';
import { Contract } from 'ethers';
// 导入整个ethers库以使用BrowserProvider
import * as ethers from 'ethers';

// 导入ABI文件
import NFTMarketABI from './contracts/NFTMarket.json';
import ERC721ABI from './contracts/ERC721Fixed.json';
import ERC20ABI from './contracts/ERC20.json';

// 合约地址
const NFT_MARKET_ADDRESS = '0x45E62735ba934568b057b9184C738A34998f1bb7';
const NFT_CONTRACT_ADDRESS = '0x8E464A7b6aD7366B15Ac451A7b3142710CCfef45';
const PAYMENT_TOKEN_ADDRESS = '0x1099454e0CE6E28Be836470982CAF2bfc88E3a72';

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
        const sellInfo = await nftMarketContract.sellnft(tokenIdNum);
        console.log(`NFT #${tokenId} 销售信息:`, sellInfo);
        
        // 检查NFT是否有效（价格大于0表示在售）
        if (sellInfo.price <= 0n) {
          throw new Error(`NFT #${tokenId} 不在售`);
        }
        
        // 保存NFT详情用于显示
        setNftDetails({
          price: sellInfo.price,
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
        </div>
      )}
      
      {isConnected && (
        <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <h2>NFT市场功能</h2>
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
        </div>
      )}
    </div>
  );
};

export default App;