package com.amirrezamdi23.planner

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

/**
 * Shared exact-alarm math/scheduling, used both when a clock alarm is first
 * created (AlarmRingPlugin) and when AlarmReceiver re-arms the same alarm
 * for its next weekly occurrence right after it fires. AlarmManager itself
 * has no "repeat weekly" primitive that stays exact (setRepeating() is
 * inexact and drifts) — the standard, reliable pattern is to schedule one
 * shot at a time and re-schedule +7 days from inside the receiver.
 */
object AlarmScheduling {
    /** weekday follows java.util.Calendar.DAY_OF_WEEK (1=Sunday..7=Saturday),
     *  same convention already used elsewhere in this app's JS layer. */
    fun nextTrigger(weekday: Int, hour: Int, minute: Int, after: Long = System.currentTimeMillis()): Long {
        val cal = Calendar.getInstance()
        cal.timeInMillis = after
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        cal.set(Calendar.HOUR_OF_DAY, hour)
        cal.set(Calendar.MINUTE, minute)
        cal.set(Calendar.DAY_OF_WEEK, weekday)
        if (cal.timeInMillis <= after) {
            cal.add(Calendar.DAY_OF_YEAR, 7)
        }
        return cal.timeInMillis
    }

    private fun pendingIntentFor(context: Context, id: Int, weekday: Int, hour: Int, minute: Int, title: String, body: String, lockCancel: Boolean): PendingIntent {
        val intent =
            Intent(context, AlarmReceiver::class.java).apply {
                putExtra("id", id)
                putExtra("weekday", weekday)
                putExtra("hour", hour)
                putExtra("minute", minute)
                putExtra("title", title)
                putExtra("body", body)
                putExtra("lockCancel", lockCancel)
            }
        return PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    fun scheduleExact(context: Context, id: Int, triggerAt: Long, weekday: Int, hour: Int, minute: Int, title: String, body: String, lockCancel: Boolean) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = pendingIntentFor(context, id, weekday, hour, minute, title, body, lockCancel)
        // A real alarm clock, not just a background timer — setAlarmClock is
        // the one AlarmManager API that's exempt from Doze/App Standby by
        // design and shows the little alarm-clock glyph in the status bar,
        // exactly like the phone's own clock app.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            val showIntent = Intent(context, MainActivity::class.java)
            val showPi = PendingIntent.getActivity(context, id, showIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            am.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, showPi), pi)
        } else {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
        }
    }

    fun cancel(context: Context, id: Int) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        // Extras don't need to match to cancel — PendingIntent equality for
        // FLAG_UPDATE_CURRENT is based on the intent's action/component/request
        // code, not its extras.
        val intent = Intent(context, AlarmReceiver::class.java)
        val pi = PendingIntent.getBroadcast(context, id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        am.cancel(pi)
        pi.cancel()
    }
}
