// Native-only seam for AlarmCard's weekly clock alarms.
//
// This is deliberately a *different* mechanism from lib/alarm.ts's
// @capacitor/local-notifications-based scheduling: a local notification can
// only ever post a silent-ish banner, but the user explicitly asked for a
// clock alarm to behave like the phone's own alarm — ring with sound, keep
// ringing, and show over the lock screen. Notifications can't do that; only
// a dedicated full-screen Activity plus AlarmManager-driven exact scheduling
// can, so this talks to a custom native plugin
// (android/app/.../AlarmRingPlugin.kt + AlarmReceiver.kt + AlarmRingActivity.kt)
// instead. No web/PWA implementation exists on purpose — see the note in
// CLAUDE project memory: this class of "must ring like a real alarm" feature
// is native-Android-only by nature, not a gap to fill in later.

import { Capacitor, registerPlugin } from '@capacitor/core';

export interface WeeklyRingAlarm {
  /** Stable id so the same (alarm, weekday, stage) can be replaced/cancelled. */
  id: number;
  /** Capacitor/java.util.Calendar convention: 1=Sunday..7=Saturday. */
  weekday: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
  /** true = dismissing the ring requires a deliberate hold, not a quick tap. */
  lockCancel: boolean;
}

interface AlarmRingNativePlugin {
  scheduleWeekly(alarm: WeeklyRingAlarm): Promise<void>;
  cancel(options: { id: number }): Promise<void>;
}

const AlarmRing = registerPlugin<AlarmRingNativePlugin>('AlarmRing');

export function ringAlarmsAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export async function scheduleRingAlarm(alarm: WeeklyRingAlarm): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await AlarmRing.scheduleWeekly(alarm);
}

export async function cancelRingAlarm(id: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await AlarmRing.cancel({ id });
}
