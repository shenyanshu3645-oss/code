import hashlib
import json
import time
from uuid import uuid4

from flask import Flask, request, jsonify


class Blockchain:
    def __init__(self):
        self.chain = []
        self.current_transactions = []

        # 创世块（没有前区块的第一个区块）
        self.new_block(previous_hash='0', proof=100)

    def new_transaction(self, sender, recipient, amount):
        self.current_transactions.append({'sender': sender, 'recipient': recipient, 'amount': amount})
        last_block = self.last_block()
        return last_block['index'] + 1

    def new_block(self, proof, previous_hash=None):
        block = {
            'index': len(self.chain) + 1,
            'timestamp': time.time(),
            'transactions': self.current_transactions,
            'proof': proof,
            'previous_hash': previous_hash or self.hash_block(self.chain[-1])
        }

        # 这里为啥要重置，没明白
        self.current_transactions = []

        self.chain.append(block)
        return block

    def hash_block(self, block):
        encodebytes = json.dumps(block, sort_keys=True).encode('utf-8')
        hash = hashlib.sha256(encodebytes).hexdigest()
        return hash

    def last_block(self):
        if len(self.chain) == 0:
            return None
        return self.chain[-1]

    def proof_of_work(self, last_proof):
        proof = 0
        while True:
            str_proof_ = str(last_proof) + str(proof)
            hexdigest = hashlib.sha256(str_proof_.encode('utf-8')).hexdigest()
            if hexdigest.startswith('0000'):
                return proof
            proof += 1


app = Flask(__name__)
blockchain = Blockchain()

node_identifier = str(uuid4()).replace('-', '')


@app.route('/mine', methods=['GET'])
def mine():
    last_block = blockchain.last_block()
    if last_block is None:
        # 一个区块都没有
        proof_of_work = blockchain.proof_of_work(0)
        block = blockchain.new_block(proof_of_work)
        last_proof = block['proof']
        proof = blockchain.proof_of_work(last_proof)
        # return jsonify({'message': 'last_block not found'}), 404
    else:
        last_proof = last_block['proof']
        proof = blockchain.proof_of_work(last_proof)
        block = blockchain.new_block(proof)

    # 给工作量证明的节点提供奖励
    blockchain.new_transaction(sender='0', recipient=node_identifier, amount=1)

    rsp = {'message': 'success',
           'index': block['index'],
           'transactions': block['transactions'],
           'proof': block['proof'],
           'previous_hash': block['previous_hash']
           }

    return jsonify(rsp), 200


@app.route('/transactions/new', methods=['POST'])
def new_transaction():
    transaction = request.get_json()
    index = blockchain.new_transaction(transaction['sender'], transaction['recipient'], transaction['amount'])
    rsp = {
        'status': 'success',
        'index': index
    }
    return jsonify(rsp)


@app.route('/fullchain', methods=['GET'])
def full_chain():
    rsp = {'chain': blockchain.chain, 'length': len(blockchain.chain)}
    return jsonify(rsp)


if __name__ == '__main__':
    app.run(debug=True)
