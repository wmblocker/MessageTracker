package com.blockertech;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.ContentObserver;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.telephony.SmsManager;
import android.telephony.SmsMessage;
import android.util.Log;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class SMSRetriever extends CordovaPlugin {
     private static final String LOGTAG = "SMSRetriever";
    
    public static final String ACTION_SET_OPTIONS = "setOptions";
    private static final String ACTION_START_WATCH = "startWatch";
    private static final String ACTION_STOP_WATCH = "stopWatch";
    private static final String ACTION_ENABLE_INTERCEPT = "enableIntercept";
    private static final String ACTION_LIST_SMS = "listSMS";
    private static final String ACTION_DELETE_SMS = "deleteSMS";
    private static final String ACTION_RESTORE_SMS = "restoreSMS";
    private static final String ACTION_SEND_SMS = "sendSMS";
    
    public static final String OPT_LICENSE = "license";
    private static final String SEND_SMS_ACTION = "SENT_SMS_ACTION";
    private static final String DELIVERED_SMS_ACTION = "DELIVERED_SMS_ACTION";
    private static final String SMS_RECEIVED = "android.provider.Telephony.SMS_RECEIVED";
    public static final String SMS_EXTRA_NAME = "pdus";
    
    public static final String SMS_URI_ALL = "content://sms/";
    public static final String SMS_URI_INBOX = "content://sms/inbox";
    public static final String SMS_URI_SEND = "content://sms/sent";
    public static final String SMS_URI_DRAFT = "content://sms/draft";
    public static final String SMS_URI_OUTBOX = "content://sms/outbox";
    public static final String SMS_URI_FAILED = "content://sms/failed";
    public static final String SMS_URI_QUEUED = "content://sms/queued";
    
    public static final String BOX = "box";
    public static final String ADDRESS = "address";
    public static final String BODY = "body";
    public static final String READ = "read";
    public static final String SEEN = "seen";
    public static final String SUBJECT = "subject";
    public static final String SERVICE_CENTER = "service_center";
    public static final String DATE = "date";
    public static final String DATE_SENT = "date_sent";
    public static final String STATUS = "status";
    public static final String REPLY_PATH_PRESENT = "reply_path_present";
    public static final String TYPE = "type";
    public static final String PROTOCOL = "protocol";
    
    public static final int MESSAGE_TYPE_INBOX = 1;
    public static final int MESSAGE_TYPE_SENT = 2;
    public static final int MESSAGE_IS_NOT_READ = 0;
    public static final int MESSAGE_IS_READ = 1;
    public static final int MESSAGE_IS_NOT_SEEN = 0;
    public static final int MESSAGE_IS_SEEN = 1;
    
    public static int MY_PERMISSIONS_REQUEST_READ_SMS = 0;

    private static final String SMS_GENERAL_ERROR = "SMS_GENERAL_ERROR";
    private static final String NO_SMS_SERVICE_AVAILABLE = "NO_SMS_SERVICE_AVAILABLE";
    private static final String SMS_FEATURE_NOT_SUPPORTED = "SMS_FEATURE_NOT_SUPPORTED";
    private static final String SENDING_SMS_ID = "SENDING_SMS";

    //public static final String [] PERMISSIONS = {Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS, Manifest.permission.RECEIVE_WAP_PUSH, Manifest.permission.RECEIVE_MMS, Manifest.permission.READ_PHONE_STATE};
    private ContentObserver mObserver = null;
    private BroadcastReceiver mReceiver = null;
    private boolean mIntercept = false;
    private String lastFrom = "";
    private String lastContent = "";

    public boolean execute(String action, JSONArray inputs, CallbackContext callbackContext) throws JSONException {
        PluginResult result = null;
        if (ACTION_SET_OPTIONS.equals(action)) {
            JSONObject options = inputs.optJSONObject(0);
            this.setOptions(options);
            result = new PluginResult(PluginResult.Status.OK);
        } else if (ACTION_START_WATCH.equals(action)) {
            result = this.startWatch(callbackContext);
        }  else if (ACTION_ENABLE_INTERCEPT.equals(action)) {
            boolean on_off = inputs.optBoolean(0);
            result = this.enableIntercept(on_off, callbackContext);
        } else if (ACTION_LIST_SMS.equals(action)) {
            JSONObject filters = inputs.optJSONObject(0);
            result = this.listSMS(filters, callbackContext);
        } else {
            Log.d(LOGTAG, String.format("Invalid action passed: %s", action));
            result = new PluginResult(PluginResult.Status.INVALID_ACTION);
        }
        if (result != null) {
            callbackContext.sendPluginResult(result);
        }
        return true;
    }


    public void setOptions(JSONObject options) {
        Log.d(LOGTAG, ACTION_SET_OPTIONS);
    }

    protected String __getProductShortName() {
        return "SMSRetriever";
    }

    public final String md5(String s) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            digest.update(s.getBytes());
            byte[] messageDigest = digest.digest();
            StringBuffer hexString = new StringBuffer();
            for (int i = 0; i < messageDigest.length; ++i) {
                String h = Integer.toHexString(255 & messageDigest[i]);
                while (h.length() < 2) {
                    h = "0" + h;
                }
                hexString.append(h);
            }
            return hexString.toString();
        }
        catch (NoSuchAlgorithmException digest) {
            return "";
        }
    }

    private PluginResult startWatch(CallbackContext callbackContext) {
        Log.d(LOGTAG, ACTION_START_WATCH);
        if (this.mObserver == null) {
            this.createContentObserver();
        }
        if (this.mReceiver == null) {
            this.createIncomingSMSReceiver();
        }
        if (callbackContext != null) {
            callbackContext.success();
        }
        return null;
    }

    private PluginResult enableIntercept(boolean on_off, CallbackContext callbackContext) {
        Log.d(LOGTAG, ACTION_ENABLE_INTERCEPT);
        this.mIntercept = on_off;
        if (callbackContext != null) {
            callbackContext.success();
        }
        return null;
    }

    private PluginResult listSMS(JSONObject filter, CallbackContext callbackContext) {
        Log.i(LOGTAG, ACTION_LIST_SMS);
        String uri_filter = filter.has(BOX) ? filter.optString(BOX) : "inbox";
        int fread = filter.has(READ) ? filter.optInt(READ) : -1;
        int fid = filter.has("_id") ? filter.optInt("_id") : -1;
        String faddress = filter.optString(ADDRESS);
        String fcontent = filter.optString(BODY);
        int indexFrom = filter.has("indexFrom") ? filter.optInt("indexFrom") : 0;
        int maxCount = filter.has("maxCount") ? filter.optInt("maxCount") : 10;
        JSONArray jsons = new JSONArray();
        Activity ctx = this.cordova.getActivity();
        Uri uri = Uri.parse((SMS_URI_ALL + uri_filter));
        Cursor cur = ctx.getContentResolver().query(uri, (String[])null, "", (String[])null, null);
        int i = 0;
        while (cur.moveToNext()) {
            JSONObject json;
            boolean matchFilter = false;
            if (fid > -1) {
                matchFilter = (fid == cur.getInt(cur.getColumnIndex("_id")));
            } else if (fread > -1) {
                matchFilter = (fread == cur.getInt(cur.getColumnIndex(READ)));
            } else if (faddress.length() > 0) {
                matchFilter = faddress.equals(cur.getString(cur.getColumnIndex(ADDRESS)).trim());
            } else if (fcontent.length() > 0) {
                matchFilter = fcontent.equals(cur.getString(cur.getColumnIndex(BODY)).trim());
            } else {
                matchFilter = true;
            }
            if (! matchFilter) continue;
            
            if (i < indexFrom) continue;
            if (i >= indexFrom + maxCount) break;
            ++i;

            if ((json = this.getJsonFromCursor(cur)) == null) {
                callbackContext.error("failed to get json from cursor");
                cur.close();
                return null;
            }
            jsons.put((Object)json);
        }
        cur.close();
        callbackContext.success(jsons);
        return null;
    }

    private JSONObject getJsonFromCursor(Cursor cur) {
		JSONObject json = new JSONObject();
		
		int nCol = cur.getColumnCount();
		String keys[] = cur.getColumnNames();

		try {
			for(int j=0; j<nCol; j++) {
				switch(cur.getType(j)) {
				case Cursor.FIELD_TYPE_NULL:
					json.put(keys[j], null);
					break;
				case Cursor.FIELD_TYPE_INTEGER:
					json.put(keys[j], cur.getLong(j));
					break;
				case Cursor.FIELD_TYPE_FLOAT:
					json.put(keys[j], cur.getFloat(j));
					break;
				case Cursor.FIELD_TYPE_STRING:
					json.put(keys[j], cur.getString(j));
					break;
				case Cursor.FIELD_TYPE_BLOB:
					json.put(keys[j], cur.getBlob(j));
					break;
				}
			}
		} catch (Exception e) {
			return null;
		}

		return json;
    }

    private void fireEvent(final String event, JSONObject json) {
    	final String str = json.toString();
    	Log.d(LOGTAG, "Event: " + event + ", " + str);
    	
        cordova.getActivity().runOnUiThread(new Runnable(){
            @Override
            public void run() {
            	String js = String.format("javascript:cordova.fireDocumentEvent(\"%s\", {\"data\":%s});", event, str);
            	webView.loadUrl( js );
            }
        });
    }
    
    private void onSMSArrive(JSONObject json) {
        String from = json.optString(ADDRESS);
        String content = json.optString(BODY);
        if (from.equals(this.lastFrom) && content.equals(this.lastContent)) {
            return;
        }
        this.lastFrom = from;
        this.lastContent = content;
        this.fireEvent("onSMSArrive", json);
    }

    protected void createIncomingSMSReceiver() {
        Activity ctx = this.cordova.getActivity();
        this.mReceiver = new BroadcastReceiver(){

            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                Log.d(LOGTAG, ("onRecieve: " + action));
                if (SMS_RECEIVED.equals(action)) {
                    Bundle bundle;
                    if (SMSRetriever.this.mIntercept) {
                        this.abortBroadcast();
                    }
                    if ((bundle = intent.getExtras()) != null) {
                        Object[] pdus;
                        if ((pdus = (Object[])bundle.get("pdus")).length != 0) {
                            for (int i = 0; i < pdus.length; ++i) {
                                SmsMessage sms = SmsMessage.createFromPdu((byte[])((byte[])pdus[i]));
                                JSONObject json = SMSRetriever.this.getJsonFromSmsMessage(sms);
                                SMSRetriever.this.onSMSArrive(json);
                            }
                        }
                    }
                }
            }
        };
        String[] filterstr = new String[]{SMS_RECEIVED};
        for (int i = 0; i < filterstr.length; ++i) {
            IntentFilter filter = new IntentFilter(filterstr[i]);
            filter.setPriority(100);
            ctx.registerReceiver(this.mReceiver, filter);
            Log.d(LOGTAG, ("broadcast receiver registered for: " + filterstr[i]));
        }
    }

    protected void createContentObserver() {
        Activity ctx = this.cordova.getActivity();
        this.mObserver = new ContentObserver(new Handler()){

            public void onChange(boolean selfChange) {
                this.onChange(selfChange, null);
            }

            public void onChange(boolean selfChange, Uri uri) {
                ContentResolver resolver = cordova.getActivity().getContentResolver(); 
                Log.d(LOGTAG, ("onChange, selfChange: " + selfChange + ", uri: " + (Object)uri));
                int id = -1;
                String str;
                if (uri != null && (str = uri.toString()).startsWith(SMS_URI_ALL)) {
                    try {
                        id = Integer.parseInt(str.substring(SMS_URI_ALL.length()));
                        Log.d(LOGTAG, ("sms id: " + id));
                    }
                    catch (NumberFormatException var6_6) {
                        // empty catch block
                    }
                }
                if (id == -1) {
                    uri = Uri.parse(SMS_URI_INBOX);
                }
                Cursor cur = resolver.query(uri, null, null, null, "_id desc");
                if (cur != null) {
                    int n = cur.getCount();
                    Log.d(LOGTAG, ("n = " + n));
                    if (n > 0 && cur.moveToFirst()) {
                        JSONObject json;
                        if ((json = SMSRetriever.this.getJsonFromCursor(cur)) != null) {
                            onSMSArrive(json);
                        } else {
                            Log.d(LOGTAG, "fetch record return null");
                        }
                    }
                    cur.close();
                }
            }
        };
        ctx.getContentResolver().registerContentObserver(Uri.parse(SMS_URI_INBOX), true, this.mObserver);
        Log.d(LOGTAG, "sms inbox observer registered");
    }


    private JSONObject getJsonFromSmsMessage(SmsMessage sms) {
    	JSONObject json = new JSONObject();
    	
        try {
        	json.put( ADDRESS, sms.getOriginatingAddress() );
        	json.put( BODY, sms.getMessageBody() ); // May need sms.getMessageBody.toString()
        	json.put( DATE_SENT, sms.getTimestampMillis() );
        	json.put( DATE, System.currentTimeMillis() );
        	json.put( READ, MESSAGE_IS_NOT_READ );
        	json.put( SEEN, MESSAGE_IS_NOT_SEEN );
        	json.put( STATUS, sms.getStatus() );
        	json.put( TYPE, MESSAGE_TYPE_INBOX );
        	json.put( SERVICE_CENTER, sms.getServiceCenterAddress());
        	
        } catch ( Exception e ) { 
            e.printStackTrace(); 
        }

    	return json;
    }
    
    private ContentValues getContentValuesFromJson(JSONObject json) {
    	ContentValues values = new ContentValues();
    	values.put( ADDRESS, json.optString(ADDRESS) );
    	values.put( BODY, json.optString(BODY));
    	values.put( DATE_SENT,  json.optLong(DATE_SENT));
    	values.put( READ, json.optInt(READ));
    	values.put( SEEN, json.optInt(SEEN));
    	values.put( TYPE, json.optInt(TYPE) );
    	values.put( SERVICE_CENTER, json.optString(SERVICE_CENTER));
    	return values;
    }

}