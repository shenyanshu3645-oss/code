import json
from BlockchainClient import *
from database import db

def read_json_file(filename):
    with open(filename, 'r', encoding='utf-8') as file:
        content = file.read()
        data = json.loads(content)
    return data

async def getTrans():
    # http_url='https://sepolia.infura.io/v3/96cccf096cc34e82a7f6a132994f4898'
    # websocket_url='wss://sepolia.infura.io/ws/v3/cf090d46f8a3441a9f414b85259ace02'
    http_url='https://0xrpc.io/sep'
    websocket_url='wss://ethereum-sepolia-rpc.publicnode.com'
    erc20contractaddr = '0x1099454e0CE6E28Be836470982CAF2bfc88E3a72'
    erc20abi = read_json_file('./erc20.json')
    blockchain = BlockchainClient(db,http_url,websocket_url)
    # 先获取历史交易
    blockchain.gethistorytrans(erc20contractaddr,erc20abi)
    #监听实时交易
    await blockchain.listen_new_trans(erc20contractaddr,erc20abi)

if __name__ == '__main__':
    try:
        # 创建数据表
        db.create_tables()
        asyncio.run(getTrans())
    except Exception as e:
        print(str(e))
    finally:
        db.close_connection()