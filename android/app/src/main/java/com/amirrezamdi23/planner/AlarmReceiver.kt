package com.amirrezamdi23.planner

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Fires when a scheduled clock alarm's exact time arrives. Two things
 * happen: (1) the same alarm is immediately re-armed for its next weekly
 * occurrence — AlarmManager one-shots don't repeat themselves, so if this
 * receiver didn't re-schedule, the alarm would only ever ring once; (2) the
 * actual ring is triggered, both by starting AlarmRingActivity directly
 * (works reliably pre-Android 10, which is this project's real target
 * device) and by posting a full-screen-intent notification as the
 * standards-based fallback for newer Android versions that restrict
 * background activity starts.
 */
class AlarmReceiver : BroadcastReceiver() {
    private companion object {
        const val TAG = "AlarmReceiver"
        const val CHANNEL_ID = "planner_alarms"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getIntExtra("id", 0)
        val weekday = intent.getIntExtra("weekday", 1)
        val hour = intent.getIntExtra("hour", 7)
        val minute = intent.getIntExtra("minute", 0)
        val title = intent.getStringExtra("title") ?: "آلارم"
        val body = intent.getStringExtra("body") ?: ""
        val lockCancel = intent.getBooleanExtra("lockCancel", false)

        val nextTrigger = AlarmScheduling.nextTrigger(weekday, hour, minute, System.currentTimeMillis() + 60_000)
        try {
            AlarmScheduling.scheduleExact(context, id, nextTrigger, weekday, hour, minute, title, body, lockCancel)
        } catch (e: Exception) {
            Log.e(TAG, "could not re-arm next week's alarm", e)
        }

        val fullScreenIntent =
            Intent(context, AlarmRingActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                putExtra("id", id)
                putExtra("title", title)
                putExtra("body", body)
                putExtra("lockCancel", lockCancel)
            }

        try {
            context.startActivity(fullScreenIntent)
        } catch (e: Exception) {
            Log.e(TAG, "direct activity start failed, relying on the notification fallback", e)
        }

        postNotification(context, id, title, body, fullScreenIntent)
    }

    private fun postNotification(context: Context, id: Int, title: String, body: String, fullScreenIntent: Intent) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "آلارم", NotificationManager.IMPORTANCE_HIGH)
            // The ring itself (looping alarm-stream sound + vibration) is
            // handled inside AlarmRingActivity, not by the notification —
            // giving the channel its own sound too would double it up.
            channel.setSound(null, null)
            nm.createNotificationChannel(channel)
        }
        val contentPi =
            PendingIntent.getActivity(context, id, fullScreenIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification =
            NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setFullScreenIntent(contentPi, true)
                .setContentIntent(contentPi)
                .setAutoCancel(false)
                .setOngoing(true)
                .build()
        nm.notify(id, notification)
    }
}
