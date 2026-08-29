package com.amirrezamdi23.planner

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * JS-facing bridge for AlarmCard's clock alarms — deliberately separate from
 * @capacitor/local-notifications (used elsewhere in this app for the Timer),
 * since a plain notification can't ring with sound/vibration or take over
 * the lock screen the way this feature needs to. See AlarmScheduling.kt /
 * AlarmReceiver.kt / AlarmRingActivity.kt for the actual native mechanics.
 */
@CapacitorPlugin(name = "AlarmRing")
class AlarmRingPlugin : Plugin() {
    @PluginMethod
    fun scheduleWeekly(call: PluginCall) {
        val id = call.getInt("id")
        val weekday = call.getInt("weekday")
        val hour = call.getInt("hour")
        val minute = call.getInt("minute")
        if (id == null || weekday == null || hour == null || minute == null) {
            call.reject("id/weekday/hour/minute required")
            return
        }
        val title = call.getString("title") ?: "آلارم"
        val body = call.getString("body") ?: ""
        val lockCancel = call.getBoolean("lockCancel", false) ?: false
        val triggerAt = AlarmScheduling.nextTrigger(weekday, hour, minute)
        AlarmScheduling.scheduleExact(context, id, triggerAt, weekday, hour, minute, title, body, lockCancel)
        call.resolve()
    }

    @PluginMethod
    fun cancel(call: PluginCall) {
        val id = call.getInt("id")
        if (id == null) {
            call.reject("id required")
            return
        }
        AlarmScheduling.cancel(context, id)
        call.resolve()
    }
}
