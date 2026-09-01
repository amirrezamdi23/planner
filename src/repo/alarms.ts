import { db, makeRecord, liveByType } from './shared';

// ---------- clock alarms ----------
// Samsung-style: pick weekdays to repeat on, a first-stage time, how many
// stages, and the gap between them — each stage becomes its own weekly-
// repeating OS notification (see lib/alarm.ts's clockAlarmId), so a missed
// first stage still gets a second/third nudge without the app needing to be
// open in between.
export interface AlarmPayload {
  name: string;
  weekdays: number[]; // JS Date#getDay() values, 0=Sunday..6=Saturday
  time: string; // "HH:MM", the first stage
  stageCount: number;
  intervalMin: number;
  lockCancel: boolean;
  enabled: boolean;
}
export interface Alarm {
  recId: string;
  name: string;
  weekdays: number[];
  time: string;
  stageCount: number;
  intervalMin: number;
  lockCancel: boolean;
  enabled: boolean;
}

export async function listAlarms(): Promise<Alarm[]> {
  const recs = await liveByType('alarm');
  return recs
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => ({ recId: r.id, ...(r.payload as AlarmPayload) }));
}

export async function addAlarm(input: Omit<AlarmPayload, 'enabled'>): Promise<string> {
  const rec = makeRecord('alarm', { ...input, enabled: true } as AlarmPayload);
  await db.records.put(rec);
  return rec.id;
}

export async function setAlarmEnabled(recId: string, enabled: boolean): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as AlarmPayload;
  await db.records.put({ ...r, payload: { ...p, enabled }, updatedAt: new Date().toISOString() });
}

export async function deleteAlarm(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({ ...r, deleted: true, updatedAt: new Date().toISOString() });
}
