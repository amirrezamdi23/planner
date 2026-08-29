import { useEffect, useRef, useState, useCallback, type ChangeEvent } from 'react';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Music, Play, Pause, SkipBack, SkipForward, Rewind, FastForward, Square, Repeat, Repeat1, Pencil, X, Plus } from 'lucide-react';
import Collapsible from './Collapsible';
import MusicPlayer, { type PlaybackStatus } from './lib/musicPlayer';
import { listSongs, addSong, editSong, deleteSong, type Song } from './repo';

function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function MusicCard() {
  const isNative = Capacitor.isNativePlatform();
  const [songs, setSongs] = useState<Song[]>([]);
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>({ isPlaying: false, positionMs: 0, durationMs: 0 });
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formUrl, setFormUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  type RepeatMode = 'off' | 'all' | 'one';
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');

  const songsRef = useRef<Song[]>([]);
  const currentSongIdRef = useRef<string | null>(null);
  const repeatModeRef = useRef<RepeatMode>('off');
  useEffect(() => {
    songsRef.current = songs;
  }, [songs]);
  useEffect(() => {
    currentSongIdRef.current = currentSongId;
  }, [currentSongId]);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  const reload = useCallback(async () => {
    setSongs(await listSongs());
  }, []);

  useEffect(() => {
    if (isNative) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload]);

  // On Android 13+, a media foreground service must be able to post its
  // notification — if POST_NOTIFICATIONS hasn't been granted yet, starting
  // playback (which promotes MusicService to a foreground service) can
  // crash the whole app instead of just failing quietly, since that failure
  // happens deep in the OS/Media3 layer, outside this plugin call's own
  // try/catch. Confirming the permission is settled *before* ever calling
  // loadAndPlay — not just once on mount — is what actually prevents it.
  async function ensureNotificationPermission() {
    try {
      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    } catch {
      // ignore — worst case playback proceeds without a confirmed grant
    }
  }

  const playSong = useCallback(async (song: Song) => {
    setError(null);
    setCurrentSongId(song.recId);
    try {
      await ensureNotificationPermission();
      await MusicPlayer.loadAndPlay({ url: song.url, title: song.title, artist: song.artist });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در پخش');
    }
  }, []);

  // Refs so trackEnded/mediaButtonNext|Previous (registered once) always see
  // the latest song list/current song instead of a stale closure.
  const onNext = useCallback(() => {
    const list = songsRef.current;
    if (list.length === 0) return;
    const idx = list.findIndex((s) => s.recId === currentSongIdRef.current);
    playSong(list[(idx + 1 + list.length) % list.length]);
  }, [playSong]);

  const onPrev = useCallback(() => {
    const list = songsRef.current;
    if (list.length === 0) return;
    const idx = list.findIndex((s) => s.recId === currentSongIdRef.current);
    playSong(list[(idx - 1 + list.length) % list.length]);
  }, [playSong]);

  // 'one' replays the same track; 'off' stops instead of wrapping past the
  // last song; 'all' (the default onNext behavior) always wraps around.
  const onTrackEnded = useCallback(() => {
    const list = songsRef.current;
    if (list.length === 0) return;
    if (repeatModeRef.current === 'one') {
      const current = list.find((s) => s.recId === currentSongIdRef.current);
      if (current) playSong(current);
      return;
    }
    const idx = list.findIndex((s) => s.recId === currentSongIdRef.current);
    if (repeatModeRef.current === 'off' && idx === list.length - 1) {
      MusicPlayer.stop();
      return;
    }
    onNext();
  }, [onNext, playSong]);

  function onRepeatToggle() {
    setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  }

  function seekBy(deltaMs: number) {
    const positionMs = Math.min(Math.max(status.positionMs + deltaMs, 0), status.durationMs || Number.MAX_SAFE_INTEGER);
    setStatus((s) => ({ ...s, positionMs }));
    MusicPlayer.seekTo({ positionMs });
  }

  async function onStop() {
    await MusicPlayer.stop();
    setCurrentSongId(null);
    setStatus({ isPlaying: false, positionMs: 0, durationMs: 0 });
  }

  useEffect(() => {
    if (!isNative) return;
    // The background-playback foreground service needs a visible
    // notification on Android 13+ — request it up front instead of at
    // first play, same as the alarm/timer notifications already do.
    LocalNotifications.requestPermissions().catch(() => {});
    let subs: PluginListenerHandle[] = [];
    (async () => {
      subs = [
        await MusicPlayer.addListener('playbackStateChanged', (s) => setStatus(s)),
        await MusicPlayer.addListener('trackEnded', () => onTrackEnded()),
        await MusicPlayer.addListener('playbackError', (e) => setError(e.message)),
        await MusicPlayer.addListener('notificationFailed', () =>
          setError('نوتیفیکیشن پخش نمایش داده نشد — پخش ادامه داره ولی کنترل‌های صفحه‌قفل کار نمی‌کنه. اجازه‌ی نوتیفیکیشن اپ رو از تنظیمات گوشی روشن کن.'),
        ),
        await MusicPlayer.addListener('mediaButtonNext', () => onNext()),
        await MusicPlayer.addListener('mediaButtonPrevious', () => onPrev()),
      ];
    })();
    return () => {
      subs.forEach((s) => s.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative]);

  async function onTogglePlay() {
    if (!currentSongId) {
      if (songs.length > 0) await playSong(songs[0]);
      return;
    }
    if (status.isPlaying) await MusicPlayer.pause();
    else await MusicPlayer.play();
  }

  function onSeek(e: ChangeEvent<HTMLInputElement>) {
    const positionMs = Number(e.target.value);
    setStatus((s) => ({ ...s, positionMs }));
    MusicPlayer.seekTo({ positionMs });
  }

  function openAddForm() {
    setEditingId(null);
    setFormUrl('');
    setFormError(null);
    setShowForm(true);
  }
  function openEditForm(s: Song) {
    setEditingId(s.recId);
    setFormUrl(s.url);
    setFormError(null);
    setShowForm(true);
  }

  async function onSubmitForm() {
    const url = formUrl.trim();
    if (!url) {
      setFormError('لینک لازمه.');
      return;
    }
    if (!isValidUrl(url)) {
      setFormError('لینک معتبر نیست — باید با http:// یا https:// شروع بشه.');
      return;
    }
    setFormError(null);
    if (editingId) await editSong(editingId, url);
    else await addSong(url);
    setShowForm(false);
    await reload();
  }

  async function onDelete(s: Song) {
    if (!window.confirm(`«${s.title}» حذف بشه؟`)) return;
    if (currentSongId === s.recId) {
      await MusicPlayer.stop();
      setCurrentSongId(null);
    }
    await deleteSong(s.recId);
    await reload();
  }

  // Streaming needs a real native player with background playback + a
  // lock-screen media session — a browser can't do that, so this card is
  // native-only by design (see lib/musicPlayer.ts).
  if (!isNative) return null;

  const currentSong = songs.find((s) => s.recId === currentSongId) ?? null;

  return (
    <Collapsible title="پخش‌کننده‌ی موسیقی" storageKey="music">
      {error && (
        <div className="empty" style={{ color: 'var(--rust)' }}>
          {error}
        </div>
      )}

      {songs.length === 0 && !showForm && <div className="empty">هنوز آهنگی اضافه نشده.</div>}

      {songs.map((s) => (
        <div className="log-item" key={s.recId}>
          <button className="log-mark clickable" onClick={() => playSong(s)} title="پخش">
            {currentSongId === s.recId && status.isPlaying ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <div style={{ flex: 1 }}>
            <span className="log-text">
              {s.title}
              {s.artist && <span className="pay-sub"> — {s.artist}</span>}
            </span>
          </div>
          <div className="log-actions">
            <button className="habit-del" onClick={() => openEditForm(s)} title="ویرایش">
              <Pencil size={13} />
            </button>
            <button className="habit-del" onClick={() => onDelete(s)} title="حذف">
              <X size={13} />
            </button>
          </div>
        </div>
      ))}

      {currentSong && (
        <div className="music-now-playing">
          <div className="icon-row" style={{ fontWeight: 700 }}>
            <Music size={14} /> {currentSong.title}
            {currentSong.artist ? ` — ${currentSong.artist}` : ''}
          </div>
          {/* English-player convention: elapsed time / controls read
              left-to-right regardless of the page's own RTL direction. */}
          <div className="music-controls-ltr">
            <input
              type="range"
              min="0"
              max={status.durationMs || 0}
              value={Math.min(status.positionMs, status.durationMs || 0)}
              onChange={onSeek}
              className="music-seek"
            />
            <div className="icon-row" style={{ fontSize: 11, color: 'var(--ink-soft)', justifyContent: 'space-between' }}>
              <span>{formatTime(status.positionMs)}</span>
              <span>{formatTime(status.durationMs)}</span>
            </div>
            <div className="add-row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="mini-btn" onClick={onPrev} title="آهنگ قبلی">
                <SkipBack size={16} />
              </button>
              <button className="mini-btn" onClick={() => seekBy(-5000)} title="۵ ثانیه عقب">
                <Rewind size={16} />
              </button>
              <button className="mini-btn" onClick={onTogglePlay} title={status.isPlaying ? 'مکث' : 'پخش'}>
                {status.isPlaying ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button className="mini-btn" onClick={() => seekBy(5000)} title="۵ ثانیه جلو">
                <FastForward size={16} />
              </button>
              <button className="mini-btn" onClick={onNext} title="آهنگ بعدی">
                <SkipForward size={16} />
              </button>
              <button
                className={'mini-btn' + (repeatMode !== 'off' ? ' active' : '')}
                onClick={onRepeatToggle}
                title={repeatMode === 'off' ? 'بدون تکرار' : repeatMode === 'all' ? 'تکرار همه' : 'تکرار یکی'}
              >
                {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
              </button>
              <button className="mini-btn" onClick={onStop} title="توقف">
                <Square size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showForm ? (
        <div className="add-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <input placeholder="لینک پخش (MP3)" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} />
          {formError && (
            <div className="empty" style={{ color: 'var(--rust)' }}>
              {formError}
            </div>
          )}
          <div className="add-row">
            <button onClick={onSubmitForm}>{editingId ? 'ذخیره' : 'افزودن آهنگ'}</button>
            <button className="link-btn" onClick={() => setShowForm(false)}>
              انصراف
            </button>
          </div>
        </div>
      ) : (
        <div className="add-row">
          <button onClick={openAddForm}>
            <Plus size={14} /> افزودن آهنگ
          </button>
        </div>
      )}
    </Collapsible>
  );
}
