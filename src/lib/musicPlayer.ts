// Thin typed wrapper around the custom native MusicPlayer Capacitor plugin
// (android/app/.../MusicPlayerPlugin.kt + MusicService.kt). There is no web
// implementation on purpose — per the Music Player spec, streaming has to go
// straight to a real native player (never a WebView/<audio> element) with a
// background service and lock-screen controls, none of which a browser can
// do, so MusicCard only renders when Capacitor.isNativePlatform().

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface PlaybackStatus {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
}

export interface MusicPlayerPlugin {
  loadAndPlay(options: { url: string; title: string; artist: string }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(options: { positionMs: number }): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<PlaybackStatus>;
  addListener(eventName: 'playbackStateChanged', listenerFunc: (status: PlaybackStatus) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'trackEnded', listenerFunc: () => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'playbackError', listenerFunc: (data: { message: string }) => void): Promise<PluginListenerHandle>;
  // Playback itself is fine, but the OS refused the media notification, so
  // there are no lock-screen controls and backgrounding may stop playback.
  addListener(eventName: 'notificationFailed', listenerFunc: (data: { message: string }) => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'mediaButtonNext', listenerFunc: () => void): Promise<PluginListenerHandle>;
  addListener(eventName: 'mediaButtonPrevious', listenerFunc: () => void): Promise<PluginListenerHandle>;
}

const MusicPlayer = registerPlugin<MusicPlayerPlugin>('MusicPlayer');

export default MusicPlayer;
