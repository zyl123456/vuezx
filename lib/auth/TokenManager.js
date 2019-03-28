/**
 * Token管理
 */
import Storage from '../cache/Storage'
import Session from '../cache/Session'
import DateUtil from '../utils/DateUtil'
import CryptoJS from 'crypto-js/core'
import AES from 'crypto-js/aes'

// token缓存
var tokenCacheKey = global.TOKEN_CACHE_KEY

// TOKEN 加密码秘钥
var SECRET_KEY = global.APP_SECRET_KEY || 'YT79jp64wJWqfvqY'
// 是否开启TOKEN加密
var TOKEN_ENCRYPT_ENABLE = global.TOKEN_ENCRYPT_ENABLE

var TokenStorage = global.TOKEN_STORAGE_METHOD === 'SESSION' ? Session : Storage

var TokenManager = {
  refreshLocked: false,
  loginLocked: false,
  // 获取token
  getToken: function () {
    // 获取token注入
    if(global.getToken){
      token = global.getToken();
      if(token){
        return token;
      }
    }
    var data = TokenStorage.get(tokenCacheKey)
    var token = data
    if (data && TOKEN_ENCRYPT_ENABLE) {
      try {
        var bytes = AES.decrypt(data, SECRET_KEY)
        token = JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
      } catch (e) {
        console.log(e.message)
        token = null
      }
    }
    return token
  },
  get: function () {
    var token = TokenManager.getToken()
    if (!token || DateUtil.isExpired(token.expires_at)) {
      token = null
      this.clear(tokenCacheKey)
    }
    return token
  },
  // 设置token
  set: function (token) {
    if (TOKEN_ENCRYPT_ENABLE) {
      var tokenString = AES.encrypt(JSON.stringify(token), SECRET_KEY).toString();
      TokenStorage.set(tokenCacheKey, tokenString)
    } else {
      TokenStorage.set(tokenCacheKey, token)
    }
  },
  // 清理token
  clear: function () {
    TokenStorage.remove(tokenCacheKey)
  },
}

export default TokenManager
