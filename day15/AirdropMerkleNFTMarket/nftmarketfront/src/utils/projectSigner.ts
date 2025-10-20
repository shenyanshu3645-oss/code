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
    deadlineInHours: number = 24
  ): Promise<SignedPermit> {
    const deadline = BigInt(Math.floor(Date.now() / 1000) + (deadlineInHours * 3600))

    // 确保设置了市场合约地址
    if (!this.marketContractAddress) {
      throw new Error('请先设置市场合约地址')
    }

    const TOKEN_ADDRESS = '0x5F1B85e1930b31c8FcD174bDE0C96c2F7FA0f23e'
  
    // 构造EIP-712签名消息
    const domain = {
      name: 'PermitERC20',  // 与合约中的域名匹配
      version: '1',
      chainId: sepolia.id,
      verifyingContract: TOKEN_ADDRESS,
    };

    const types = {
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    };

    const message = {
      owner: buyerAddress,
      spender: this.marketContractAddress,
      value: 400000000000000000000n,
      nonce: 1,
      deadline: deadline,
    };

    console.log('签名消息:', { domain, types, message });



    // 使用 viem 进行 EIP-712 签名
    const signature = await (this.account as any).signTypedData({
      domain,
      types,
      primaryType: 'Permit',
      message,
      // account: buyerAddress as `0x${string}`,
    })

    console.log('生成签名详情:')
    console.log('- 买家地址:', buyerAddress)
    console.log('- 截止时间:', new Date(Number(deadline) * 1000).toISOString())
    console.log('- 域名参数:', domain)
    console.log('- 签名:', signature)

    return {
      signature,
      deadline,
      buyer: buyerAddress
    }
  }


}

// 导出一个函数来执行示例代码
export async function runExample() {

  const projectPrivateKey = '0x45902ab34eafef7d981b8198a1005c4f8527ce312c57f7fe858d2ca90e01baa6' as `0x${string}`;

  // 创建 ProjectSigner 实例
  const projectSigner = new ProjectSigner(projectPrivateKey);

  const actualMarketContractAddress = '0xE98A52b2155329592edB7C9DeB72A97ceA0118E3' as `0x${string}`;
  projectSigner.setMarketContractAddress(actualMarketContractAddress);

  // 为特定用户生成购买许可签名
  const buyerAddress = '0xf6E14B5b166AeA7b02a1a77e88b14402fFE39e4D'; // 买家地址 (需要是有效的校验和地址)
  const deadlineInHours = 24; // 签名有效期（小时）

  try {
    console.log('开始生成签名...')

    console.log('市场合约地址:', projectSigner.getMarketContractAddress())


    const permitSignature = await projectSigner.createPermitSignature(
      buyerAddress, // 不需要转换为小写，保持原始格式
      deadlineInHours
    );

    console.log('\n生成的签名:', permitSignature);
    
  } catch (error) {
    console.error('生成签名失败:', error);
  }
}

// 如果直接运行此文件，则执行示例
// if (typeof require !== 'undefined' && require.main === module) {
runExample().catch(console.error);
// }