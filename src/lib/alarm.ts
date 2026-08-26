// Alarm scheduling, kept behind one thin seam.
//
// Why this exists: the in-page ring (AudioContext beep / <audio> loop in
// TimerCard) only fires while the app is actually running and foregrounded.
// Once this app is wrapped with Capacitor for Android/iOS, a backgrounded or
// screen-locked WebView gets throttled (Android Doze) or suspended outright
// (iOS WKWebView), so JS cannot be relied on to fire at the right moment.
//
// The fix on native is to hand the alarm to the OS *when the timer starts*, so
// the OS rings even if the app is asleep. That needs @capacitor/local-notifications,
// which only exists inside the native shell — hence this seam: TimerCard calls
// these functions unconditionally, and on the web they're inert no-ops while the
// existing in-page ring carries the experience.
//
// To wire up native later, implement `nativeBackend` below against
// @capacitor/local-notifications; nothing in TimerCard needs to change.
//
// Note for that future work: a user-supplied ringtone (stored as a Blob in
// IndexedDB) cannot be used as a native notification sound — Android requires a
// bundled resource in res/raw. The custom sound stays for the in-app ring; the
// OS-level alarm falls back to the default notification sound.

export interface ScheduledAlarm {
  /** Stable id so the same alarm can be cancelled/replaced later. */
  id: number;
  /** Wall-clock time the alarm should fire. */
  at: Date;
  title: string;
  body: string;
}

interface AlarmBackend {
  readonly available: boolean;
  schedule(alarm: ScheduledAlarm): Promise<void>;
  cancel(id: number): Promise<void>;
}

// Web/PWA: no OS-level scheduling. TimerCard's in-page ring already covers the
// only case the browser can serve (app open and foregrounded), so these are
// deliberately silent no-ops rather than a half-working Notification API path.
const webBackend: AlarmBackend = {
  available: false,
  async schedule() {},
  async cancel() {},
};

// Swap in the Capacitor implementation here once the native project exists.
const nativeBackend: AlarmBackend | null = null;

const backend: AlarmBackend = nativeBackend ?? webBackend;

/** True when alarms survive the app being backgrounded — false on plain web. */
export function alarmsRunInBackground(): boolean {
  return backend.available;
}

export function scheduleAlarm(alarm: ScheduledAlarm): Promise<void> {
  return backend.schedule(alarm);
}

export function cancelAlarm(id: number): Promise<void> {
  return backend.cancel(id);
}

/** Distinct ids per timer stage, so re-scheduling one stage can't clobber another. */
export const TIMER_ALARM_IDS = [1001, 1002, 1003] as const;
