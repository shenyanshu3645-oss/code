// utils/loadABI.ts
import { Abi } from 'viem';

export const loadABIFromFile = async (fileName: string): Promise<Abi> => {
    try {
        // 从 src/abi 目录加载本地JSON文件
        console.log(`Loading ABI from src/abi/${fileName}`);
        
        // 构建相对路径
        const filePath = `../abi/${fileName}`;
        
        // 使用动态导入加载JSON文件
        const module = await import(filePath);
        const contractJson = module.default || module;
        
        // 解析ABI数据
        let abi: Abi;
        
        if (Array.isArray(contractJson)) {
            // 如果直接是ABI数组
            abi = contractJson as Abi;
        } else if (contractJson.abi && Array.isArray(contractJson.abi)) {
            // 如果是包含abi字段的对象（如Foundry编译输出）
            abi = contractJson.abi as Abi;
        } else {
            throw new Error('Invalid ABI format: expected array or object with abi field');
        }
        
        console.log(`Successfully loaded ABI for ${fileName}, found ${abi.length} functions/events`);
        return abi;
    } catch (error) {
        console.error(`Failed to load ABI from ${fileName}:`, error);
        throw error;
    }
};

// 从 src/abi 目录直接导入ABI文件
export const loadABIFromSrc = (contractName: string): Abi => {
    try {
        console.log(`Loading ABI for ${contractName} from src/abi`);
        
        // 根据合约名称导入对应的ABI文件
        let contractJson: any;
        
        switch (contractName) {
            case 'TokenBank':
                contractJson = require('../abi/TokenBank.json');
                break;
            case 'MyToken':
            case 'ERC20':
                contractJson = require('../abi/ERC20.json');
                break;
            default:
                throw new Error(`Unsupported contract: ${contractName}`);
        }
        
        // 支持不同的ABI格式
        let abi: Abi;
        if (Array.isArray(contractJson)) {
            abi = contractJson as Abi;  // 直接是ABI数组
        } else if (contractJson.abi && Array.isArray(contractJson.abi)) {
            abi = contractJson.abi as Abi;  // 包含abi字段的对象
        } else {
            throw new Error('Invalid ABI format: expected array or object with abi field');
        }
        
        console.log(`✅ Successfully loaded ABI for ${contractName}, found ${abi.length} functions/events`);
        return abi;
    } catch (error) {
        console.error(`❌ Failed to load ABI for ${contractName}:`, error);
        throw error;
    }
};

// 异步版本，保持兼容性
export const loadABIFromSrcAsync = async (contractName: string): Promise<Abi> => {
    return loadABIFromSrc(contractName);
};

// 使用示例
export const loadContractABIs = async () => {
    try {
        // 加载多个合约的ABI
        const [tokenBankABI, myTokenABI] = await Promise.all([
            loadABIFromFile('TokenBank.json'),
            loadABIFromFile('MyToken.json')
        ]);

        return {
            TokenBank: tokenBankABI,
            MyToken: myTokenABI
        };
    } catch (error) {
        console.error('Failed to load contract ABIs:', error);
        throw error;
    }
};