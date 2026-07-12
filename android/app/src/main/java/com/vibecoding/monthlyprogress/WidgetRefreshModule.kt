package com.vibecoding.monthlyprogress

import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * 暴露给 JS 的原生模块：让 app 切前台时主动发广播刷新桌面组件。
 * JS 调用：NativeModules.WidgetRefreshModule.refreshWidget()
 */
class WidgetRefreshModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetRefreshModule"

    @ReactMethod
    fun refreshWidget() {
        val intent = Intent(reactApplicationContext, WorkdayWidgetProvider::class.java).apply {
            action = WorkdayWidgetProvider.ACTION_REFRESH
        }
        reactApplicationContext.sendBroadcast(intent)
    }
}
