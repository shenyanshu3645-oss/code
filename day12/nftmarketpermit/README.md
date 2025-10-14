# NFT Market with AppKit

这是一个使用AppKit集成钱包功能的NFT市场前端项目框架。

## 项目结构

```
appkitfront/
├── public/                 # 静态资源文件
├── src/                    # 源代码目录
│   ├── components/         # React组件
│   ├── contracts/          # 合约ABI文件
│   ├── hooks/              # 自定义React hooks
│   ├── utils/              # 工具函数
│   ├── App.tsx             # 主应用组件
│   ├── index.tsx           # 入口文件
│   └── index.css           # 全局样式
├── package.json            # 项目依赖和脚本
├── tsconfig.json           # TypeScript配置
└── vite.config.ts          # Vite配置
```

## 功能模块

1. **钱包连接** - 使用AppKit集成多种钱包
2. **NFT列表展示** - 显示市场上在售的NFT
3. **NFT购买功能** - 用户可以购买在售的NFT
4. **NFT上架功能** - 用户可以上架自己的NFT出售

## 安装依赖

```bash
npm install
```

## 启动开发服务器

```bash
npm run dev
```

项目将在 http://localhost:3001 上运行（如果3000端口被占用，会自动使用其他端口）

## 配置说明

1. 替换`App.tsx`中的合约地址为实际部署地址
2. 在[WalletConnect](https://cloud.walletconnect.com/)创建项目并替换`projectId`
3. 将实际的ABI文件内容复制到`src/contracts/`目录下的对应JSON文件中

## 待实现功能

- NFT列表获取和展示
- NFT购买流程
- NFT上架功能
- 支付代币授权逻辑
- 错误处理和用户反馈

## 技术栈

- React 18 with TypeScript
- AppKit for wallet integration
- Vite as build tool
- Ethers.js for blockchain interactions
- CSS for styling

## 项目特点

- 使用AppKit提供多种钱包连接选项
- 模块化组件设计，易于扩展
- TypeScript类型安全
- 响应式设计
- 清晰的代码结构和注释