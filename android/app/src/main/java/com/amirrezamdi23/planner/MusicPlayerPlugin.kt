package com.amirrezamdi23.planner

import android.content.ComponentName
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * JS-facing bridge for background audio streaming. Deliberately thin: the
 * song list, "which song is next", and all UI live in the web layer — this
 * plugin just tells MusicService (a MediaSessionService) what URL to play
 * and reports position/duration/playing-state back as events, so the same
 * ExoPlayer instance keeps running (and the OS notification / lock-screen
 * controls keep working) whether the WebView is foregrounded or not.
 *
 * THREADING — the thing that makes this file look more roundabout than it
 * needs to be: Capacitor dispatches @PluginMethod calls on its own
 * "CapacitorPlugins" HandlerThread, while a Media3 MediaController may only
 * ever be touched from its application looper (the main thread). Calling it
 * straight from a plugin method throws IllegalStateException("MediaController
 * method is called from a wrong thread"), which is a fatal, process-killing
 * crash rather than a rejected promise. So every single controller
 * interaction below goes through onMain {}, and the PluginCall is
 * resolved/rejected from inside that block.
 */
@CapacitorPlugin(name = "MusicPlayer")
class MusicPlayerPlugin : Plugin() {
    companion object {
        var instance: MusicPlayerPlugin? = null
        const val TAG = "MusicPlayerPlugin"
    }

    private var controller: MediaController? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var progressRunnable: Runnable? = null

    /** Runs [block] on the main thread — immediately if already there. */
    private fun onMain(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) block() else mainHandler.post(block)
    }

    override fun load() {
        instance = this
        onMain {
            try {
                val sessionToken = SessionToken(context, ComponentName(context, MusicService::class.java))
                val controllerFuture =
                    MediaController.Builder(context, sessionToken)
                        // Pin the controller's application thread explicitly
                        // instead of inheriting whatever thread built it.
                        .setApplicationLooper(Looper.getMainLooper())
                        .buildAsync()
                controllerFuture.addListener(
                    {
                        try {
                            controller = controllerFuture.get()
                            startProgressLoop()
                        } catch (e: Exception) {
                            Log.e(TAG, "could not connect to MusicService", e)
                            onPlayerError("اتصال به پخش‌کننده برقرار نشد")
                        }
                    },
                    ContextCompat.getMainExecutor(context),
                )
            } catch (e: Exception) {
                Log.e(TAG, "could not build MediaController", e)
            }
        }
    }

    private fun startProgressLoop() {
        val runnable =
            object : Runnable {
                override fun run() {
                    emitStatus()
                    mainHandler.postDelayed(this, 500)
                }
            }
        progressRunnable = runnable
        mainHandler.post(runnable)
    }

    private fun durationOrZero(c: MediaController): Long = if (c.duration == C.TIME_UNSET) 0 else c.duration

    /** Main thread only — every caller reaches this through onMain {}. */
    private fun emitStatus() {
        val c = controller ?: return
        try {
            val data = JSObject()
            data.put("isPlaying", c.isPlaying)
            data.put("positionMs", c.currentPosition)
            data.put("durationMs", durationOrZero(c))
            notifyListeners("playbackStateChanged", data)
        } catch (e: Exception) {
            Log.e(TAG, "emitStatus failed", e)
        }
    }

    // The service's Player.Listener fires these from inside ExoPlayer's own
    // callback dispatch. Reading the MediaController right there would be a
    // re-entrant call back into the session that is mid-notification, so the
    // read is deferred to the next main-thread tick instead.
    fun onIsPlayingChanged(isPlaying: Boolean) {
        mainHandler.post { emitStatus() }
    }

    fun onPlaybackStateChanged(state: Int) {
        mainHandler.post {
            if (state == Player.STATE_ENDED) notifyListeners("trackEnded", JSObject())
            emitStatus()
        }
    }

    fun onPlayerError(message: String) {
        mainHandler.post {
            val data = JSObject()
            data.put("message", message)
            notifyListeners("playbackError", data)
        }
    }

    /** Playback survived, but there is no notification / lock-screen control. */
    fun onNotificationFailed(message: String) {
        mainHandler.post {
            val data = JSObject()
            data.put("message", message)
            notifyListeners("notificationFailed", data)
        }
    }

    fun emitNext() {
        mainHandler.post { notifyListeners("mediaButtonNext", JSObject()) }
    }

    fun emitPrevious() {
        mainHandler.post { notifyListeners("mediaButtonPrevious", JSObject()) }
    }

    @PluginMethod
    fun loadAndPlay(call: PluginCall) {
        val url = call.getString("url")
        if (url.isNullOrBlank()) {
            call.reject("URL خالیه")
            return
        }
        // Reading call params is thread-safe; only the controller is not.
        val title = call.getString("title") ?: ""
        val artist = call.getString("artist") ?: ""
        withController(call) { c ->
            val metadata = MediaMetadata.Builder().setTitle(title).setArtist(artist).build()
            val item = MediaItem.Builder().setUri(url).setMediaMetadata(metadata).build()
            c.setMediaItem(item)
            c.prepare()
            c.play()
        }
    }

    @PluginMethod
    fun play(call: PluginCall) = withController(call) { it.play() }

    @PluginMethod
    fun pause(call: PluginCall) = withController(call) { it.pause() }

    @PluginMethod
    fun seekTo(call: PluginCall) {
        val positionMs = (call.getInt("positionMs", 0) ?: 0).toLong()
        withController(call) { it.seekTo(positionMs) }
    }

    @PluginMethod
    fun stop(call: PluginCall) = withController(call) { it.stop() }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        onMain {
            val data = JSObject()
            try {
                val c = controller
                data.put("isPlaying", c?.isPlaying ?: false)
                data.put("positionMs", c?.currentPosition ?: 0)
                data.put("durationMs", c?.let { durationOrZero(it) } ?: 0)
            } catch (e: Exception) {
                Log.e(TAG, "getStatus failed", e)
                data.put("isPlaying", false)
                data.put("positionMs", 0)
                data.put("durationMs", 0)
            }
            call.resolve(data)
        }
    }

    /**
     * Hops to the main thread, hands [block] the connected controller, and
     * settles the PluginCall there. A failure becomes a rejected promise the
     * UI can show — never an exception escaping into the bridge, which is
     * what took the whole process down before.
     */
    private fun withController(call: PluginCall, block: (MediaController) -> Unit) {
        onMain {
            val c = controller
            if (c == null) {
                call.reject("پخش‌کننده هنوز آماده نیست")
                return@onMain
            }
            try {
                block(c)
                call.resolve()
            } catch (e: Exception) {
                Log.e(TAG, "player command failed", e)
                call.reject(e.message ?: "دستور پخش انجام نشد")
            }
        }
    }

    override fun handleOnDestroy() {
        progressRunnable?.let { mainHandler.removeCallbacks(it) }
        onMain {
            try {
                controller?.release()
            } catch (e: Exception) {
                Log.e(TAG, "controller release failed", e)
            }
            controller = null
        }
        instance = null
        super.handleOnDestroy()
    }
}
