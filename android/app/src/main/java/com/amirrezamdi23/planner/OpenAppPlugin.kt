package com.amirrezamdi23.planner

import android.content.Intent
import android.provider.AlarmClock
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Launches another of the device's own apps — used when the user taps "بله"
 * on the nightly "want an alarm for tomorrow?" notification (see
 * lib/notifications.ts). Uses the system ACTION_SHOW_ALARMS intent contract
 * rather than a hardcoded package name (com.android.deskclock,
 * com.sec.android.app.clockpackage, ...) so it opens whichever clock app the
 * OEM actually ships, the same way the stock Clock app's own shortcut does.
 */
@CapacitorPlugin(name = "OpenApp")
class OpenAppPlugin : Plugin() {
    @PluginMethod
    fun openClock(call: PluginCall) {
        val intent = Intent(AlarmClock.ACTION_SHOW_ALARMS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("no clock app available on this device", e)
        }
    }
}
