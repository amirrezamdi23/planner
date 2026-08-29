package com.amirrezamdi23.planner

import android.app.Activity
import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.graphics.Color
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * The actual "ring": shown full-screen over the lock screen with sound and
 * vibration, the way the phone's own alarm clock behaves — a local
 * notification alone can't do any of this (no reliable looping sound, no
 * lock-screen takeover), which is the whole reason this feature exists
 * outside AlarmCard's UI. Launched either directly by AlarmReceiver or via a
 * full-screen-intent notification tap.
 */
class AlarmRingActivity : Activity() {
    private companion object {
        const val TAG = "AlarmRingActivity"
        const val HOLD_TO_DISMISS_MS = 2000L
    }

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var alarmId: Int = 0
    private var lockCancel: Boolean = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        alarmId = intent.getIntExtra("id", 0)
        val title = intent.getStringExtra("title") ?: "آلارم"
        val body = intent.getStringExtra("body") ?: ""
        lockCancel = intent.getBooleanExtra("lockCancel", false)

        showOverLockScreen()
        buildUi(title, body)
        startRinging()
    }

    private fun showOverLockScreen() {
        // Both the modern (API 27+) API *and* the legacy window flags are set
        // together, not either/or — some OEM keyguards (this was found on a
        // Samsung/One UI device) only honor the old FLAG_SHOW_WHEN_LOCKED-style
        // flags even on OS versions where the new per-Activity API exists.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
        )
        val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            km.requestDismissKeyguard(this, null)
        }
        try {
            @Suppress("DEPRECATION")
            km.newKeyguardLock(TAG).disableKeyguard()
        } catch (e: Exception) {
            Log.e(TAG, "disableKeyguard failed", e)
        }
    }

    private fun buildUi(title: String, body: String) {
        val root =
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setBackgroundColor(Color.parseColor("#242320"))
                setPadding(64, 64, 64, 64)
            }
        val titleView =
            TextView(this).apply {
                text = title
                textSize = 26f
                setTextColor(Color.WHITE)
                gravity = Gravity.CENTER
            }
        val bodyView =
            TextView(this).apply {
                text = body
                textSize = 15f
                setTextColor(Color.parseColor("#cfc7ac"))
                gravity = Gravity.CENTER
                setPadding(0, 16, 0, 56)
            }
        val dismissBtn =
            Button(this).apply {
                text = if (lockCancel) "برای رد کردن نگه‌دار" else "رد کردن"
                setPadding(72, 36, 72, 36)
            }
        if (lockCancel) {
            val handler = Handler(Looper.getMainLooper())
            var holdRunnable: Runnable? = null
            dismissBtn.setOnTouchListener { _, event ->
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        holdRunnable = Runnable { dismiss() }
                        handler.postDelayed(holdRunnable!!, HOLD_TO_DISMISS_MS)
                        true
                    }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        holdRunnable?.let { handler.removeCallbacks(it) }
                        true
                    }
                    else -> false
                }
            }
        } else {
            dismissBtn.setOnClickListener { dismiss() }
        }
        root.addView(titleView)
        root.addView(bodyView)
        root.addView(dismissBtn)
        setContentView(root)
    }

    private fun startRinging() {
        try {
            val uri =
                RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)
                    ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            mediaPlayer =
                MediaPlayer().apply {
                    setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build(),
                    )
                    setDataSource(this@AlarmRingActivity, uri)
                    isLooping = true
                    prepare()
                    start()
                }
        } catch (e: Exception) {
            Log.e(TAG, "could not play alarm sound", e)
        }

        vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        val pattern = longArrayOf(0, 500, 500)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
        } else {
            @Suppress("DEPRECATION")
            vibrator?.vibrate(pattern, 0)
        }
    }

    private fun dismiss() {
        finish()
    }

    override fun onBackPressed() {
        // A "no easy cancel" alarm must be stopped deliberately via the
        // hold-to-dismiss control, not by the back gesture/button.
        if (!lockCancel) {
            dismiss()
        }
    }

    override fun onDestroy() {
        mediaPlayer?.let {
            try {
                it.stop()
                it.release()
            } catch (e: Exception) {
                Log.e(TAG, "stopping alarm sound failed", e)
            }
        }
        vibrator?.cancel()
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(alarmId)
        super.onDestroy()
    }
}
