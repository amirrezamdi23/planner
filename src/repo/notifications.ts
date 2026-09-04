import { db, makeRecord, liveByType, onceInFlight } from './shared';

// ---------- user-defined reminder notifications ----------
export type NotificationKind = 'confirm_open_clock' | 'ok';

export interface NotificationPayload {
  time: string; // "HH:MM", repeats daily
  text: string;
  kind: NotificationKind;
  enabled: boolean;
}
export interface AppNotification {
  recId: string;
  time: string;
  text: string;
  kind: NotificationKind;
  enabled: boolean;
}

export async function listNotifications(): Promise<AppNotification[]> {
  const recs = await liveByType('notification');
  return recs
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => ({ recId: r.id, ...(r.payload as NotificationPayload) }));
}

// Every notification the user creates through the card is a plain
// acknowledge-only reminder — see lib/notifications.ts for why
// 'confirm_open_clock' is reserved for the built-in alarm-reminder.
export async function addNotification(time: string, text: string): Promise<string> {
  const rec = makeRecord('notification', { time, text: text.trim(), kind: 'ok', enabled: true } as NotificationPayload);
  await db.records.put(rec);
  return rec.id;
}

export async function editNotification(recId: string, time: string, text: string): Promise<void> {
  if (!text.trim()) return;
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as NotificationPayload;
  await db.records.put({ ...r, payload: { ...p, time, text: text.trim() }, updatedAt: new Date().toISOString() });
}

export async function setNotificationEnabled(recId: string, enabled: boolean): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as NotificationPayload;
  await db.records.put({ ...r, payload: { ...p, enabled }, updatedAt: new Date().toISOString() });
}

export async function deleteNotification(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({ ...r, deleted: true, updatedAt: new Date().toISOString() });
}

// One-time seed: the "want an alarm for tomorrow?" reminder ships as the
// first row in the card rather than a hidden, separately-coded feature — the
// user can edit its time/text or delete it like any other notification.
// Wrapped in onceInFlight for the same reason ensureBulletJournalProject
// needed it: this starts with an await, so two near-simultaneous calls
// (React StrictMode's dev-mode double-invoke of a mount effect) would both
// read "no confirm_open_clock notification yet" and both create one.
export const DEFAULT_ALARM_REMINDER_TEXT = 'آیا می‌خوای برای فردا آلارم فعال کنی؟';

export const ensureDefaultAlarmReminder = onceInFlight(async (): Promise<void> => {
  const existing = await listNotifications();
  if (existing.some((n) => n.kind === 'confirm_open_clock')) return;
  await db.records.put(
    makeRecord('notification', {
      time: '21:00',
      text: DEFAULT_ALARM_REMINDER_TEXT,
      kind: 'confirm_open_clock',
      enabled: true,
    } as NotificationPayload),
  );
});
