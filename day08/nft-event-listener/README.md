# NFT Event Listener 框架 🎨

一个基于Viem框架用于监听NFT市场合约事件的Node.js框架。

## 📋 框架结构

```
nft-event-listener/
├── src/
│   ├── config/
│   │   └── config.js          # 基础配置（支持Viem链）
│   ├── handlers/
│   │   └── nftMarketEventHandler.js  # 事件处理框架（Viem版本）
│   ├── types/
│   │   └── events.js          # 事件类型定义（适配Viem）
│   ├── utils/
│   │   └── logger.js          # 简单日志工具
│   └── index.js               # 应用入口（使用Viem）
├── .env.example              # 环境变量模板（Viem配置）
├── package.json              # 项目配置（viem依赖）
└── start.sh                  # 启动脚本
```

## 🎯 监听的事件框架

- **NFTListed** - NFT上架事件
- **NFTSold** - NFT售出事件  
- **TokensReceived** - 代币接收事件

## 🚀 快速开始

1. 安装依赖：`npm install`
2. 配置环境：`cp .env.example .env`
3. 编辑.env文件，填入RPC_URL和NFT_MARKET_ADDRESS
4. 启动：`./start.sh dev`

## 🔧 Viem框架特性

- ✅ **类型安全** - 完整的TypeScript支持
- ✅ **现代化API** - 使用createPublicClient和watchContractEvent
- ✅ **性能优化** - 更高效的事件监听和处理
- ✅ **链配置** - 内置链配置支持（sepolia, mainnet等）
- ✅ **灵活传输** - 支持HTTP和WebSocket传输

## 🔧 开发说明

这是一个纯框架，所有业务逻辑都需要您自己实现：

- 在`src/handlers/nftMarketEventHandler.js`中实现事件处理逻辑
- 在`src/index.js`中实现Viem客户端连接和初始化逻辑
- 根据需要扩展配置文件和日志功能

## 📝 主要TODO项

- 使用`createPublicClient`初始化Viem客户端
- 使用`watchContractEvent`订阅实时事件
- 使用`getLogs`获取历史事件
- 实现事件处理业务逻辑
- 添加错误处理和重连机制

所有TODO注释标记的地方都需要您添加具体实现。