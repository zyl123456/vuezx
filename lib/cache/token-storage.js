import Storage from './storage'
var tokenSave = Storage;
var TokenStorage = {
	set: function(token){
	  Storage.set('TokenManager', token)
	},
	// 清理token
	clear: function () {
	  Storage.remove('TokenManager')
	},
	get: function(){
	  return Storage.get('TokenManager')
	}
}
export default TokenStorage