from flask import Flask, jsonify, request
from sqlalchemy.orm import Session
from TransferModel import Transfer  # 导入 Transfer 模型
from database import db  # 导入数据库实例
from sqlalchemy import or_
app = Flask(__name__)

session = db.get_session()

@app.route('/transactions',methods=['POST'])
def transactions():
    address = request.args.get("address")
    rspstr = {
        'status_code':200,
        'data':[],
        'msg':'success'
    }
    if not address:
        rspstr['status_code']=500
        rspstr['msg']='fail:address is null'
        return jsonify(rspstr)

    transitems = session.query(Transfer).filter(or_(Transfer.fromaddr==address,Transfer.toaddr==address)).all()
    if not transitems:
        #未查询到
        rspstr['status_code'] = 200
        rspstr['msg'] = 'success'
        return jsonify(rspstr)
    for item in transitems:
        id = item.id
        fromaddr = item.fromaddr
        toaddr = item.toaddr
        txhash = item.txhash
        blocknum = item.blocknum
        balance = item.balance
        created_at = item.created_at
        itemjson={"id":id,"fromaddr":fromaddr,"toaddr":toaddr,"txhash":txhash,"blocknum":blocknum,"balance":balance,"created_at":created_at}
        rspstr['data'].append(itemjson)

    return jsonify(rspstr)

if __name__ == '__main__':
    app.run(debug=True)