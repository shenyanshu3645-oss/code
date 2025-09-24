import hashlib
import time
import rsa

def fourzero():
    nickname = 'taiyang'
    i = 0
    starttime = time.time()
    while True:
        nicknamenew = nickname + str(i)
        hexdigest = hashlib.sha256(nicknamenew.encode()).hexdigest()
        if hexdigest.startswith('0000'):
            print(hexdigest)
            endtime = time.time()
            print(endtime - starttime)
            return nicknamenew
        print(hexdigest)
        i = i + 1

def fivezero():
    nickname = 'taiyang'
    i = 0
    starttime = time.time()
    while True:
        nicknamenew = nickname + str(i)
        hexdigest = hashlib.sha256(nicknamenew.encode()).hexdigest()
        if hexdigest.startswith('00000'):
            print(hexdigest)
            endtime = time.time()
            print(endtime - starttime)
            return nicknamenew
        print(hexdigest)
        i = i + 1


def genkeys():
    (publickey,privkey) = rsa.newkeys(1024)
    # publickeystr = publickey.save_pkcs1().decode()
    # privkeystr = privkey.save_pkcs1().decode()
    # print(publickeystr)
    # print(privkeystr)
    return publickey, privkey

def encrypt(powstr,publickey):

    encrypt = rsa.encrypt(powstr.encode(), publickey)
    print("加密后:"+str(encrypt))
    return encrypt

def decrypt(enstr,privkey):
    decrypt = rsa.decrypt(enstr, privkey).decode()
    print("解密后:"+decrypt)

if __name__ == '__main__':
    # fourzero()#17秒
    # fivezero()#54秒

    publickeystr, privkeystr = genkeys()
    nickname = fourzero()
    encryptstr = encrypt(nickname, publickeystr)
    decryptstr = decrypt(encryptstr, privkeystr)

