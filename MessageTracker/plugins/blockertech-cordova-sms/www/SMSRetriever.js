
var argscheck = require('cordova/argscheck'),
    exec = require('cordova/exec');

var safesmsExport = {};

/*
 * Methods
 */


safesmsExport.setOptions = function(options, successCallback, failureCallback) {
	  if(typeof options === 'object') {
		  cordova.exec( successCallback, failureCallback, 'SMSRetriever', 'setOptions', [options] );
	  } else {
		  if(typeof failureCallback === 'function') {
			  failureCallback('options should be specified.');
		  }
	  }
	};

safesmsExport.startWatch = function(successCallback, failureCallback) {
	cordova.exec( successCallback, failureCallback, 'SMSRetriever', 'startWatch', [] );
};

safesmsExport.stopWatch = function(successCallback, failureCallback) {
	cordova.exec( successCallback, failureCallback, 'SMSRetriever', 'stopWatch', [] );
};

safesmsExport.enableIntercept = function(on_off, successCallback, failureCallback) {
	on_off = !! on_off;
	cordova.exec( successCallback, failureCallback, 'SMSRetriever', 'enableIntercept', [ on_off ] );
};

safesmsExport.listSMS = function(filter, successCallback, failureCallback) {
	cordova.exec( successCallback, failureCallback, 'SMSRetriever', 'listSMS', [ filter ] );
};


/*
 * Events:
 * 
 * document.addEventListener('onSMSArrive', function(e) { var sms = e.data; }
 * 
 */

module.exports = safesmsExport;

