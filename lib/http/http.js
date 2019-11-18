/**
 * ajax 请求
 * Created by Administrator on 2019-04-18
 */
import axios from 'axios'
import AuthEncrypt from '../auth/AuthEncrypt'
import DateUtil from '../utils/DateUtil'
import TokenManager from '../auth/TokenManager'
import Cache from '../cache/Cache'

var METHOD_GET = 'GET'
var METHOD_POST = 'POST'
var METHOD_PUT = 'PUT'
var METHOD_DELETE = 'DELETE'

/**
 * 错误提示
 * @type {Function}
 */
function showError(message){
  (global.showError || window.alert)(message)
}

/**
 * 参数重组
 * @param args
 */
function rebuild(args){
  var config = {};
  if(args.length === 1){
    if (typeof args[0] === 'string') {
      config.url = args[0]
    }
    else{
      config = args[0]
    }
  } else if (args.length === 2) {
    config = args[1] ? args[1] : {}
    config.url = args[0]
  }
  else if(args.length === 3) {
    config = args[2] ? args[2] : {}
    config.url = args[0]
    if(args[1] !== null){
      config.data = args[1]
    }
  }
  return config
}

var Http = {
  get: function () {
    var config = rebuild(arguments)
    config.method = METHOD_GET
    return Http.execute(config)
  },
  post: function () {
    var config = rebuild(arguments)
    config.method = METHOD_POST
    return Http.execute(config)
  },
  put: function () {
    var config = rebuild(arguments)
    config.method = METHOD_PUT
    return Http.execute(config)
  },
  delete: function () {
    var config = rebuild(arguments)
    config.method = METHOD_DELETE
    return Http.execute(config)
  },
  execute: function (config) {
    // 使用Promise 处理成功
    if (config.success == null) {
      return new Promise(function (resolve, reject) {
          config.success = function(res){
              resolve(res)
          }
          Http.doExecute(config)
      })
    } else {
        Http.doExecute(config)
    }
  },
  doExecute: function (config) {
    config.cache = config.cache || config.useLast;
    config.method = (config.method || config.type || METHOD_GET).toUpperCase()

    // 设置头部
    config.headers = config.headers || {}
    // 普通表单方式提交
    if(config.form && config.method === METHOD_POST){
      config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/x-www-form-urlencoded'
    }
    else{
      config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json'
    }

    //获取到app的token并且赋值
    if(!TokenManager.get() && navigator.userAgent.indexOf('Platform/') != -1 && navigator.userAgent.indexOf('version/3.0.0') == -1 && global.getCookie('token')){
    	TokenManager.set(global.getCookie('token'))
    }
    // 设置headers
    if(TokenManager.get()){
    	config.headers['token'] = TokenManager.get()
    }
    // 只添加headers
    if(global.appIdHeaders){
      // 设置appId(机构id)
      if(global.appId){
        config.headers['appId'] = global.appId
      }
      // 设置orgCode(机构code)
      if(global.orgCode){
        config.headers['orgCode'] = global.orgCode
      }
    }

    Http.combine(config)

    // 配置 DEBUG userId 方便调试
    if(global.DEBUG_USERID){
        config.headers['Authorization'] = "DEBUG userId=" + global.DEBUG_USERID;
    }
    else{
        // 设置授权头部
        var token = TokenManager.get()
        config.headers['Authorization'] = ''
    }

    // 成功回调
    var successCallback = config.success || function (response, isCache) {
    }

    config.success = null
    delete config.success

    // 失败回调
    var errorCallback = config.error || function (response, status) {
        /* if(status && (status === 403 || status === 503)) {
            return
        } */
        if (response && response.message) {
            showError(response.message)
        }
    }
    config.error = null
    delete config.error

    var completeCallback = function (response) {
      if(config.loading !== false){
          global.hideLoading && global.hideLoading();
      }
      if (typeof config.complete === 'function') {
        config.complete()
      }
    }

    // 使用缓存数据
    if (config.method === METHOD_GET && config.cache) {
      var cacheData = Cache.get(config.url)
      if (cacheData) {
        var timestamp = cacheData.timestamp || 0;
        var res = cacheData.res;
        successCallback(res, true);

        var diffTime = (new Date().getTime() - timestamp) / 1000;  // 距离上次请求时间间隔 （秒）
        // 设置缓存过期时间则不再查询
        if(config.cacheTimeout && config.cacheTimeout > diffTime){
            completeCallback()
          return ;
        }
      }
    }

    config.timeout = 10000
    axios(config).then(function (result) {
      var response = result.data
      if(response!== null && response !=='' && response !== undefined && response !== 'undefined'){
        if (response.code&&response.code == '2004'||response.code == '1001') {
          global.authorize(0)
          }
      }
      successCallback(response)
      completeCallback(response)

      // 设置数据缓存
      if (config.cache) {
        var cacheData = {
          timestamp: new Date().getTime(),  // 新增时间戳
          res: response
        }
        Cache.set(config.url, cacheData)
      }
    }).catch(function (error) {
      if (error && error.response) {
        if (config.ignore) {
          completeCallback()
          return
        }
        var response = error.response || {}
        var status = response.status

        // 返回true 将忽略系统处理
        if(!errorCallback(response.data || {}, response.status)) {
            /* if (status && status === 403) {
                global.login && global.login()
            } else if (status && status === 503) {
                global.sysLocked && global.sysLocked(response)
            } */
        }
      } else {
        console.log('Error', error.message)
          /* errorCallback({
            message: '网络异常'
          }, 500) */
      }
      completeCallback()
    })
  },

  /**
    * 文件上传
    * @param config
    */
  upload: function (config) {
    var uploadPromises = []
    var uploadRet = []
    var uploadUrl = config.uploadUrl
    var headers = config.headers || {}
    var success = config.success
    var uploaders = config.uploaders
    for (var j = 0; j < uploaders.length; j++) {
        let index = j
        let uploader = uploaders[index]
        uploadPromises.push(new Promise((resolve, reject) => {
            let formData = new window.FormData()
            for (let [key, value] of Object.entries(uploader)) {
              formData.append(key,value)
            }
            axios.post(uploadUrl, formData, {
                headers: headers
            }).then((res) => {
                var data = global.IMG_BASE_PATH+uploader.key
                uploadRet[index] = data
                success && success(data)
                resolve(data)
            }).catch(() => {
                reject()
            })
        }))
    }
    Promise.all(uploadPromises).then(() => {
        config.complete && config.complete(uploadRet)
    }).catch((error) => {
      config.fail && config.fail(error)
    })
  },
  /**
   * 获取授权信息
   * @param config
   */
  getAuthorization: function (config) {
    config.method = (config.method || config.type || METHOD_GET).toUpperCase()
    Http.combine(config)
    var token = TokenManager.get()
    return AuthEncrypt.getMac(config.method, config.baseURL + config.url, token)
  },
  /**
   * 数据合并
   * @param config
   */
  combine: function (config) {
    // 替换路径占位符号
    if (config.path) {
      for (var key in config.path) {
          config.url = config.url.replace('{' + key + '}', config.path[key])
      }
      delete config.path
    }
    config.data = config.data || config.body || config.form;

    var isFormData = config.data instanceof window.FormData
    if (!isFormData) {
      // 过滤掉null数据
      var data = config.data;
      var method = config.method
      if(config.query){
        data = config.query
        method = METHOD_GET
      }
      config.data = Http.filter(config.data)
      data = Http.filter(data)
      config.url = AuthEncrypt.httpUrlFormat(config.url, data, method)
    }
    // 机构id不是只添加headers
    if(global.appId&&!global.appIdHeaders){
      config.params = {
        appId: global.appId,
        orgCode: global.orgCode
      }
    }
    // 非http开头的加上API_BASE_PATH
    if (config.url.indexOf('http') !== 0) {
      if (!global.API_BASE_PATH) {
        throw new Error('请配置接口基本地址global.API_BASE_PATH')
      }
      config.baseURL = global.API_BASE_PATH

      // 确保以斜杠开头
      if(config.url.indexOf('/') !== 0){
        config.url = '/' + config.url
      }
    }
    delete config.body
    delete config.query
    delete config.form
  },
  filter: function (data) {
    var _data = {}
    for (var i in data) {
      var val = data[i]
      if (val === null || typeof val === 'undefined') {
        continue
      }
      if (/\d{4}-\d{1,2}-\d{1,2} {1}\d{1,2}:\d{1,2}:\d{1,2}$/.test(val)) {
        val = DateUtil.toDate(val)
      }
      _data[i] = val
    }
    return _data
  }
}
export default Http
