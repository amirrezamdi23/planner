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
// Note: a user-supplied ringtone (stored as a Blob in IndexedDB) cannot be used
// as a native notification sound — Android requires a bundled resource in
// res/raw. The custom sound stays for the in-app ring; the OS-level alarm falls
// back to the default notification sound.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface ScheduledAlarm {
  /** Stable id so the same alarm can be cancelled/replaced later. */
  id: number;
  /** Wall-clock time the alarm should fire. */
  at: Date;
  title: string;
  body: string;
}

// A clock alarm (AlarmCard) that repeats weekly on one weekday — unlike
// ScheduledAlarm's one-shot `at`, the OS re-fires this every week on its own,
// so it doesn't need re-scheduling as long as the app stays installed.
export interface ScheduledWeeklyAlarm {
  id: number;
  /** Capacitor's convention: 1=Sunday..7=Saturday. */
  weekday: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
  /** true = the notification can't just be swiped away, only dismissed by
   *  opening the app — used for alarms the user marked "no easy cancel". */
  ongoing?: boolean;
}

interface AlarmBackend {
  readonly available: boolean;
  schedule(alarm: ScheduledAlarm): Promise<void>;
  scheduleWeekly(alarm: ScheduledWeeklyAlarm): Promise<void>;
  cancel(id: number): Promise<void>;
}

// Web/PWA: no OS-level scheduling. TimerCard's in-page ring already covers the
// only case the browser can serve (app open and foregrounded), so these are
// deliberately silent no-ops rather than a half-working Notification API path.
const webBackend: AlarmBackend = {
  available: false,
  async schedule() {},
  async scheduleWeekly() {},
  async cancel() {},
};

// Native (Android/iOS): hand the alarm to the OS so it fires even while the
// WebView is asleep. Permission is requested lazily on first schedule rather
// than at app startup, so nothing prompts until the user actually starts a
// timer.
const capacitorBackend: AlarmBackend = {
  available: true,
  async schedule(alarm) {
    await LocalNotifications.requestPermissions();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: alarm.id,
          title: alarm.title,
          body: alarm.body,
          schedule: { at: alarm.at, allowWhileIdle: true },
        },
      ],
    });
  },
  async scheduleWeekly(alarm) {
    await LocalNotifications.requestPermissions();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: alarm.id,
          title: alarm.title,
          body: alarm.body,
          schedule: {
            on: { weekday: alarm.weekday, hour: alarm.hour, minute: alarm.minute },
            allowWhileIdle: true,
          },
          ongoing: alarm.ongoing,
        },
      ],
    });
  },
  async cancel(id) {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  },
};

// Only use the Capacitor backend when actually running inside the native
// shell — @capacitor/local-notifications has no working web implementation,
// so the plain PWA build must keep using the inert no-op backend.
const nativeBackend: AlarmBackend | null = Capacitor.isNativePlatform() ? capacitorBackend : null;

const backend: AlarmBackend = nativeBackend ?? webBackend;

/** True when alarms survive the app being backgrounded — false on plain web. */
export function alarmsRunInBackground(): boolean {
  return backend.available;
}

export function scheduleAlarm(alarm: ScheduledAlarm): Promise<void> {
  return backend.schedule(alarm);
}

export function scheduleWeeklyAlarm(alarm: ScheduledWeeklyAlarm): Promise<void> {
  return backend.scheduleWeekly(alarm);
}

export function cancelAlarm(id: number): Promise<void> {
  return backend.cancel(id);
}

/** Distinct id per timer stage (arbitrary stage count), so re-scheduling one
 *  stage can't clobber another. */
export function timerAlarmId(stageIndex: number): number {
  return 1001 + stageIndex;
}

// Local notification ids must be plain integers, but our alarm records use
// string (ULID-ish) ids — this derives a stable small integer "slot" per
// alarm so each clock alarm's (weekday, stage) notifications get a distinct
// id without colliding with another alarm's.
export function hashToSlot(recId: string): number {
  let h = 0;
  for (let i = 0; i < recId.length; i++) h = (h * 31 + recId.charCodeAt(i)) >>> 0;
  return h % 1000;
}

/** Distinct id per (alarm slot, weekday, stage) of a recurring clock alarm —
 *  kept in a separate numeric range from the timer ids above so the two
 *  features' native notifications never collide. Up to 10 stages per weekday. */
export function clockAlarmId(slot: number, weekday: number, stageIndex: number): number {
  return 5000 + slot * 70 + weekday * 10 + stageIndex;
}
