package com.amirrezamdi23.planner

import android.app.PendingIntent
import android.util.Log
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionResult

/**
 * Background playback lives here, not in the WebView — a foreground
 * MediaSessionService keeps ExoPlayer alive when the app is backgrounded or
 * the screen locks, and Media3 auto-derives the lock-screen/notification
 * transport controls from this session. The JS side owns the actual
 * playlist (song list from Dexie), so this service only ever holds one
 * MediaItem at a time; Next/Previous from the notification are intercepted
 * and forwarded to JS (via MusicPlayerPlugin) instead of being handled here,
 * since the player has nothing else queued to skip to.
 */
class MusicService : MediaSessionService() {
    private companion object {
        const val TAG = "MusicService"
    }

    private lateinit var player: ExoPlayer
    private lateinit var mediaSession: MediaSession

    override fun onCreate() {
        super.onCreate()
        player = ExoPlayer.Builder(this).build()

        // Media3's DefaultMediaNotificationProvider only draws a Next/Previous
        // button when the underlying player reports the corresponding seek
        // command as available — and a real ExoPlayer with a single MediaItem
        // and no next/previous item queued never does, so the buttons were
        // silently missing from the notification entirely (not just
        // unresponsive). Since the JS layer, not the player, owns "is there a
        // next song", the fix is to always claim these commands are
        // available on a thin ForwardingPlayer wrapper; the actual skip
        // logic still runs through onPlayerCommandRequest below, which
        // intercepts the command before it ever reaches the real player.
        val sessionPlayer =
            object : ForwardingPlayer(player) {
                override fun isCommandAvailable(command: Int): Boolean =
                    when (command) {
                        Player.COMMAND_SEEK_TO_NEXT,
                        Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
                        Player.COMMAND_SEEK_TO_PREVIOUS,
                        Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
                        -> true
                        else -> super.isCommandAvailable(command)
                    }

                override fun getAvailableCommands(): Player.Commands =
                    super.getAvailableCommands()
                        .buildUpon()
                        .add(Player.COMMAND_SEEK_TO_NEXT)
                        .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
                        .add(Player.COMMAND_SEEK_TO_PREVIOUS)
                        .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
                        .build()
            }

        val sessionActivityIntent = packageManager.getLaunchIntentForPackage(packageName)
        val sessionActivityPendingIntent = sessionActivityIntent?.let {
            PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        }

        val callback = object : MediaSession.Callback {
            override fun onPlayerCommandRequest(
                session: MediaSession,
                controller: MediaSession.ControllerInfo,
                playerCommand: Int,
            ): Int {
                if (playerCommand == Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM || playerCommand == Player.COMMAND_SEEK_TO_NEXT) {
                    MusicPlayerPlugin.instance?.emitNext()
                    return SessionResult.RESULT_ERROR_NOT_SUPPORTED
                }
                if (playerCommand == Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM || playerCommand == Player.COMMAND_SEEK_TO_PREVIOUS) {
                    MusicPlayerPlugin.instance?.emitPrevious()
                    return SessionResult.RESULT_ERROR_NOT_SUPPORTED
                }
                return SessionResult.RESULT_SUCCESS
            }
        }

        val builder = MediaSession.Builder(this, sessionPlayer).setCallback(callback)
        if (sessionActivityPendingIntent != null) {
            builder.setSessionActivity(sessionActivityPendingIntent)
        }
        mediaSession = builder.build()

        player.addListener(
            object : Player.Listener {
                override fun onPlaybackStateChanged(state: Int) {
                    MusicPlayerPlugin.instance?.onPlaybackStateChanged(state)
                }

                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    MusicPlayerPlugin.instance?.onIsPlayingChanged(isPlaying)
                }

                override fun onPlayerError(error: PlaybackException) {
                    MusicPlayerPlugin.instance?.onPlayerError(error.message ?: "خطای پخش")
                }
            },
        )
    }

    /**
     * This is where Media3 promotes the service to the foreground and posts
     * the media notification. That promotion is the single most fragile
     * moment in the whole feature: on Android 13+ it needs POST_NOTIFICATIONS
     * to have been granted, and Android 14/15/16 keep tightening when a
     * foreground service of type mediaPlayback may be started at all. When it
     * is refused, the platform throws (ForegroundServiceStartNotAllowedException,
     * SecurityException, or a RemoteServiceException delivered later) and,
     * because the throw originates inside the framework's own service
     * dispatch rather than inside a plugin call, it takes the whole process
     * down — which is exactly the "player appears for a moment, then the app
     * dies" symptom.
     *
     * Swallowing it here degrades gracefully instead: audio keeps playing
     * through the already-running ExoPlayer, only the notification and
     * lock-screen controls go missing, and the JS layer is told so it can
     * show a normal error instead of the user losing the app.
     */
    override fun onUpdateNotification(session: MediaSession, startInForegroundRequired: Boolean) {
        try {
            super.onUpdateNotification(session, startInForegroundRequired)
        } catch (e: Exception) {
            Log.e(TAG, "could not post media notification / start foreground", e)
            MusicPlayerPlugin.instance?.onNotificationFailed(e.message ?: e.javaClass.simpleName)
        }
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession = mediaSession

    override fun onDestroy() {
        mediaSession.run {
            player.release()
            release()
        }
        super.onDestroy()
    }
}
