import { ProjectSigner } from './projectSigner';

async function main() {
  // 请在这里输入你的实际私钥和合约地址
  const actualPrivateKey = '0xf83246fcbae7346cd7f2bef2dac7476d0204f7a58621e36130056af1aa8d86c4'; // 请替换为你的实际私钥
  const actualContractAddress = '0x576DDdE60ea999d690Ff29742D4E4A8c070864DE'; // 请替换为你的实际合约地址
  const buyerAddress = '0xf6E14B5b166AeA7b02a1a77e88b14402fFE39e4D'; // 买家地址
  const tokenId = BigInt(1); // NFT Token ID
  
  if (actualPrivateKey === ('YOUR_ACTUAL_PRIVATE_KEY_HERE' as string) || actualContractAddress === ('YOUR_ACTUAL_CONTRACT_ADDRESS_HERE' as string)) {
    console.log('请先在脚本中设置你的实际私钥和合约地址！');
    console.log('\n使用方法：');
    console.log('1. 编辑此文件，设置 actualPrivateKey 和 actualContractAddress');
    console.log('2. 运行: npx tsx generate_real_signature.ts');
    return;
  }
  
  try {
    // 创建 ProjectSigner 实例
    const projectSigner = new ProjectSigner(actualPrivateKey as `0x${string}`);
    
    // 设置实际的市场合约地址
    projectSigner.setMarketContractAddress(actualContractAddress as `0x${string}`);
    
    console.log('开始生成实际签名...')
    console.log('项目方地址:', projectSigner.getProjectAddress())
    console.log('市场合约地址:', projectSigner.getMarketContractAddress())
    
    // 验证项目方地址是否正确
    if (projectSigner.getProjectAddress().toLowerCase() !== '0x2B472592c4A67f890E823eb741942fce2ae474C1'.toLowerCase()) {
      console.warn('⚠️  警告：当前使用的私钥对应的地址与实际部署者地址不匹配')
      console.warn('当前地址:', projectSigner.getProjectAddress())
      console.warn('实际部署者地址:', '0x2B472592c4A67f890E823eb741942fce2ae474C1')
      console.warn('请确保使用正确的私钥！')
    }
    
    // 生成签名
    const permitSignature = await projectSigner.createPermitSignature(
      buyerAddress,
      tokenId,
      24 // 24小时有效期
    );
    
    console.log('\n✅ 成功生成签名!')
    console.log('签名详情:');
    console.log('- 签名:', permitSignature.signature);
    console.log('- 截止时间戳:', permitSignature.deadline.toString());
    console.log('- 截止时间:', new Date(Number(permitSignature.deadline) * 1000).toISOString());
    console.log('- 买家地址:', permitSignature.buyer);
    console.log('- Token ID:', tokenId.toString());
    
    console.log('\n请在前端使用此签名进行NFT购买');
    
  } catch (error) {
    console.error('❌ 生成签名失败:', error);
  }
}

main().catch(console.error);