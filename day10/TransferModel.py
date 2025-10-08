from sqlalchemy import create_engine, Column, Integer, String, DateTime,Numeric
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

Base = declarative_base()


class Transfer(Base):
    __tablename__ = 'transfer'

    id = Column(Integer, primary_key=True, autoincrement=True)
    fromaddr = Column(String(100), nullable=False)
    toaddr = Column(String(100), nullable=False)
    txhash= Column(String(100), nullable=False,unique=True)
    blocknum = Column(String(20), nullable=False)
    balance = Column(Numeric(precision=10, scale=2), nullable=False)
    created_at = Column(DateTime, default=datetime.now)


def sqlalchemy_orm():
    # 创建引擎和会话
    engine = create_engine('mysql+pymysql://root:root123456@localhost/transfer')
    Session = sessionmaker(bind=engine)
    session = Session()

    try:
        # 创建表
        Base.metadata.create_all(engine)

        # 提交事务
        session.commit()

        # # 查询数据
        # users = session.query(User).filter(User.name.like('%赵%')).all()
        # for user in users:
        #     print(f"ID: {user.id}, 姓名: {user.name}, 邮箱: {user.email}")
        #
        # # 更新数据
        # user = session.query(User).filter_by(email='zhaoliu@example.com').first()
        # if user:
        #     user.name = '赵六（修改后）'
        #     session.commit()
        #
        # # 删除数据
        # user_to_delete = session.query(User).filter_by(email='zhouba@example.com').first()
        # if user_to_delete:
        #     session.delete(user_to_delete)
        #     session.commit()

    except Exception as e:
        session.rollback()
        print(f"操作失败: {e}")
    finally:
        session.close()