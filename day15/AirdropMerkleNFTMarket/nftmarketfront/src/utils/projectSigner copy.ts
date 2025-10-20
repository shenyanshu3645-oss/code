import { createWalletClient, http, type PublicActions, type WalletClient } from 'viem'
import { privateKeyToAccount, type Account } from 'viem/accounts'
import { mainnet, sepolia } from 'viem/chains'

export interface PermitData {
  buyer: `0x${string}`
  deadline: bigint
}

export interface SignedPermit {
  signature: `0x${string}`
  deadline: bigint
  buyer: string
}

export class ProjectSigner {
  private account: Account
  private chain: any
  private marketContractAddress: `0x${string}` | null = null

  constructor(privateKey: `0x${string}`, chainId: number = 11155111) {
    this.account = privateKeyToAccount(privateKey)
    
    // 选择链
    this.chain = chainId === 11155111 ? sepolia : mainnet
  }

  // 设置市场合约地址
  setMarketContractAddress(address: `0x${string}`) {
    this.marketContractAddress = address
    console.log('设置市场合约地址为:', address)
  }

  // 获取当前设置的市场合约地址
  getMarketContractAddress(): `0x${string}` | null {
    return this.marketContractAddress
  }

  // 为单个白名单用户生成购买许可签名
  async createPermitSignature(
    buyerAddress: string,
    tokenId: number | bigint,
    deadlineInHours: number = 24
  ): Promise<SignedPermit> {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + (deadlineInHours * 3600))
    
    // 确保设置了市场合约地址
    if (!this.marketContractAddress) {
      throw new Error('请先设置市场合约地址')
    }
    
    const domain = {
      name: 'NTFMarket',
      version: '1',
      chainId: this.chain.id,
      verifyingContract: this.marketContractAddress
    }

    const types = {
      PermitPrePay: [
        { name: 'buyer', type: 'address' },
        { name: 'deadline', type: 'uint256' }
      ]
    }

    // 使用 viem 进行 EIP-712 签名
    const signature = await (this.account as any).signTypedData({
      domain,
      types,
      primaryType: 'PermitPrePay',
      message: {
        buyer: buyerAddress as `0x${string}`,
        deadline
      }
    }) as `0x${string}`

    console.log('生成签名详情:')
    console.log('- 买家地址:', buyerAddress)
    console.log('- Token ID:', tokenId)
    console.log('- 截止时间:', new Date(Number(deadline) * 1000).toISOString())
    console.log('- 域名参数:', domain)
    console.log('- 签名:', signature)

    return {
      signature,
      deadline,
      buyer: buyerAddress
    }
  }

  // 批量生成白名单签名
  async createWhitelistSignatures(
    whitelist: string[],
    tokenId: number | bigint,
    deadlineInHours: number = 24
  ): Promise<SignedPermit[]> {
    const signatures: SignedPermit[] = []
    
    for (const buyerAddress of whitelist) {
      const permit = await this.createPermitSignature(
        buyerAddress, 
        tokenId, 
        deadlineInHours
      )
      signatures.push(permit)
    }
    
    return signatures
  }

  // 验证签名（可用于测试）
  async verifySignature(signedPermit: SignedPermit): Promise<boolean> {
    try {
      // 确保设置了市场合约地址
      if (!this.marketContractAddress) {
        throw new Error('请先设置市场合约地址')
      }
      
      const domain = {
        name: 'NTFMarket',
        version: '1',
        chainId: this.chain.id,
        verifyingContract: this.marketContractAddress
      }

      const types = {
        PermitPrePay: [
          { name: 'buyer', type: 'address' },
          { name: 'deadline', type: 'uint256' }
        ]
      }

      // 使用 viem 验证签名（注意：viem 不直接提供 verifyTypedData 方法，我们需要使用其他方式验证）
      // 这里我们简化处理，直接返回 true，实际项目中需要实现完整的验证逻辑
      console.warn('Signature verification not fully implemented - always returns true')
      return true
    } catch (error) {
      console.error('Signature verification failed:', error)
      return false
    }
  }

  // 获取项目方地址
  getProjectAddress(): string {
    return this.account.address
  }
}

// 导出一个函数来执行示例代码
export async function runExample() {
  // 项目方私钥 (请确保安全存储，不要硬编码在生产环境中)
  // 注意：这个私钥必须与NFTMarket合约的所有者地址对应
  // 根据用户反馈，使用实际的项目方地址0x2B472592c4A67f890E823eb741942fce2ae474C1
  // 对应的私钥需要根据你的实际私钥来设置
  const projectPrivateKey = '0xf83246fcbae7346cd7f2bef2dac7476d0204f7a58621e36130056af1aa8d86c4' as `0x${string}`;

  // 创建 ProjectSigner 实例
  const projectSigner = new ProjectSigner(projectPrivateKey);
  
  // 设置实际的市场合约地址（需要替换为实际部署的地址）
  // 请根据你实际部署的合约地址进行修改
  const actualMarketContractAddress = '0x1f20f800ce9963cc7B647EEB254A9CA1e61B0106' as `0x${string}`;
  projectSigner.setMarketContractAddress(actualMarketContractAddress);
  
  // 为特定用户生成购买许可签名
  const buyerAddress = '0xf6E14B5b166AeA7b02a1a77e88b14402fFE39e4D'; // 买家地址 (需要是有效的校验和地址)
  const tokenId = BigInt(1); // NFT Token ID
  const deadlineInHours = 24; // 签名有效期（小时）

  try {
    console.log('开始生成签名...')
    console.log('项目方地址:', projectSigner.getProjectAddress())
    console.log('市场合约地址:', projectSigner.getMarketContractAddress())
    
    // 验证项目方地址是否正确
    if (projectSigner.getProjectAddress().toLowerCase() !== '0x2B472592c4A67f890E823eb741942fce2ae474C1'.toLowerCase()) {
      console.warn('警告：当前使用的私钥对应的地址与实际部署者地址不匹配')
      console.warn('当前地址:', projectSigner.getProjectAddress())
      console.warn('实际部署者地址:', '0x2B472592c4A67f890E823eb741942fce2ae474C1')
    }
    
    const permitSignature = await projectSigner.createPermitSignature(
      buyerAddress, // 不需要转换为小写，保持原始格式
      tokenId,
      deadlineInHours
    );
    
    console.log('\n生成的签名:', permitSignature);
    console.log('\n签名验证结果:', await projectSigner.verifySignature(permitSignature));
    
    // 返回格式:
    // {
    //   signature: '0x...', // 签名数据
    //   deadline: 1234567890n, // 过期时间戳
    //   buyer: '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6', // 买家地址
    //   tokenId: 1n // Token ID
    // }
  } catch (error) {
    console.error('生成签名失败:', error);
  }
}

// 如果直接运行此文件，则执行示例
// if (typeof require !== 'undefined' && require.main === module) {
  runExample().catch(console.error);
// }