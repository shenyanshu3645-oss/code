# database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from TransferModel import Base  #导入 Base


class Database:
    def __init__(self, database_url):
        self.engine = create_engine(database_url)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.Base = Base

    def create_tables(self):
        """创建所有表"""
        self.Base.metadata.create_all(bind=self.engine)

    def get_session(self):
        """获取数据库会话"""
        return self.SessionLocal()

    def close_connection(self):
        """关闭数据库连接"""
        self.engine.dispose()


# 数据库实例
DATABASE_URL = "mysql+pymysql://root:root123456@localhost/transfer"
db = Database(DATABASE_URL)