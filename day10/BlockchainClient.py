import time
from web3 import Web3,AsyncWeb3
import asyncio
from web3.providers.persistent import WebSocketProvider
from sqlalchemy.orm import Session
from TransferModel import Transfer  # 导入 Transfer 模型
from database import db  # 导入数据库实例


class BlockchainClient:
    def __init__(self,db,http_url,websocket_url):
        # 数据库实例
        self.db=db
        # 同步客户断
        self.sync_client = Web3(Web3.HTTPProvider(http_url))
        # 异步客户端
        self.async_client = None
        self.websocket_url = websocket_url

    async def init_async_client(self):
        self.async_client = await AsyncWeb3(WebSocketProvider(self.websocket_url))

    async def get_multiple_balances(self,addresses):
        if not self.async_client:
            await self.init_async_client()

        """并发获取多个地址余额"""
        tasks = [self.async_client.eth.get_balance(address) for address in addresses]
        balances = await asyncio.gather(*tasks)

        return {
            address: self.async_client.from_wei(balance, 'ether')
            for address, balance in zip(addresses, balances)
        }

    #获取实时的交易
    async def listen_new_trans(self,erc20contractaddr,erc20abi):
        try:
            if not self.async_client:
                await self.init_async_client()
            print("监听新的交易")

            session = self.db.get_session()
            while True:
                erc20contract = self.async_client.eth.contract(address=erc20contractaddr, abi=erc20abi)
                events = await erc20contract.events.Transfer.get_logs(from_block='latest')
                for event in events:
                    blocknum = event.blockNumber
                    txhash = event.transactionHash.hex()
                    fromaddr = event.args['from']
                    toaddr = event.args['to']
                    balance = self.async_client.from_wei(event.args['value'],'ether')
                    print(f"区块: {blocknum}")
                    print(f"交易哈希: {txhash}")
                    print(f"从: {fromaddr}")
                    print(f"到: {toaddr}")
                    print(f"金额: {balance}")
                    print("-" * 50)
                    # 插入数据库
                    # 检查交易是否已存在
                    existing_tx = session.query(Transfer).filter(Transfer.txhash == txhash).first()
                    if existing_tx:
                        time.sleep(3)
                        continue
                    new_trans = Transfer(fromaddr=fromaddr, toaddr=toaddr,txhash=txhash,blocknum=blocknum,balance=balance)
                    session.add(new_trans)
                    session.commit()
                time.sleep(3)
        except Exception as e:
            print('监听错误:',str(e))

    # 获取历史的交易
    def gethistorytrans(self,erc20contractaddr,erc20abi):
        try:
            print("获取历史交易")
            erc20contract = self.sync_client.eth.contract(address=erc20contractaddr, abi=erc20abi)
            events = erc20contract.events.Transfer.get_logs(from_block=0,to_block='latest')
            session = self.db.get_session()
            for event in events:
                blocknum = event.blockNumber
                txhash = event.transactionHash.hex()
                fromaddr = event.args['from']
                toaddr = event.args['to']
                balance = self.sync_client.from_wei(event.args['value'], 'ether')
                print(f"区块: {blocknum}")
                print(f"交易哈希: {txhash}")
                print(f"从: {fromaddr}")
                print(f"到: {toaddr}")
                print(f"金额: {balance}")
                print("-" * 50)
                # 插入数据库
                # 检查交易是否已存在
                existing_tx = session.query(Transfer).filter(Transfer.txhash == txhash).first()
                if existing_tx:
                    continue
                new_trans = Transfer(fromaddr=fromaddr, toaddr=toaddr, txhash=txhash, blocknum=blocknum,
                                     balance=balance)
                session.add(new_trans)
                session.commit()
        except Exception as e:
            print('监听错误:',str(e))