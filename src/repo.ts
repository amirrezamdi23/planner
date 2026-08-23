import db, { makeRecord, type Rec } from './db';
import { newId } from './lib/id';

// ---------- payload shapes ----------
export interface HabitPayload {
  name: string;
  icon: string;
}
export interface HabitCheckPayload {
  habitId: string;
  day: string;
}
export interface LogItemPayload {
  day: string;
  text: string;
  done: boolean;
}
export interface DailyReviewPayload {
  day: string;
  text: string;
}

export interface Habit {
  recId: string;
  id: string;
  name: string;
  icon: string;
}
export interface LogItem {
  recId: string;
  text: string;
  done: boolean;
}

async function liveByType(type: Rec['type']): Promise<Rec[]> {
  const all = await db.records.where('type').equals(type).toArray();
  return all.filter((r) => !r.deleted);
}

// ---------- habits ----------
export async function listHabits(): Promise<Habit[]> {
  const recs = await liveByType('habit');
  return recs
    .map((r) => {
      const p = r.payload as HabitPayload;
      return { recId: r.id, id: r.id, name: p.name, icon: p.icon };
    })
    .sort((a, b) => a.recId.localeCompare(b.recId));
}

export async function addHabit(name: string, icon = '✦'): Promise<void> {
  if (!name.trim()) return;
  await db.records.put(makeRecord('habit', { name: name.trim(), icon }));
}

export async function deleteHabit(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({ ...r, deleted: true, updatedAt: new Date().toISOString() });
}

export async function checkedHabitIds(day: string): Promise<Set<string>> {
  const recs = await liveByType('habit_check');
  const ids = recs
    .map((r) => r.payload as HabitCheckPayload)
    .filter((p) => p.day === day)
    .map((p) => p.habitId);
  return new Set(ids);
}

export async function toggleHabitCheck(habitId: string, day: string): Promise<void> {
  const recs = await liveByType('habit_check');
  const existing = recs.find((r) => {
    const p = r.payload as HabitCheckPayload;
    return p.habitId === habitId && p.day === day;
  });
  if (existing) {
    await db.records.put({ ...existing, deleted: true, updatedAt: new Date().toISOString() });
  } else {
    await db.records.put(makeRecord('habit_check', { habitId, day } as HabitCheckPayload));
  }
}

// ---------- quick log ----------
export async function listLogItems(day: string): Promise<LogItem[]> {
  const recs = await liveByType('log_item');
  return recs
    .filter((r) => (r.payload as LogItemPayload).day === day)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => {
      const p = r.payload as LogItemPayload;
      return { recId: r.id, text: p.text, done: p.done };
    });
}

export async function addLogItem(day: string, text: string): Promise<void> {
  if (!text.trim()) return;
  await db.records.put(
    makeRecord('log_item', { day, text: text.trim(), done: false } as LogItemPayload),
  );
}

export async function toggleLogDone(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as LogItemPayload;
  await db.records.put({
    ...r,
    payload: { ...p, done: !p.done },
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteLogItem(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({ ...r, deleted: true, updatedAt: new Date().toISOString() });
}

// ---------- daily review ----------
export async function getDailyReview(day: string): Promise<{ recId: string | null; text: string }> {
  const recs = await liveByType('daily_review');
  const r = recs.find((r) => (r.payload as DailyReviewPayload).day === day);
  if (!r) return { recId: null, text: '' };
  return { recId: r.id, text: (r.payload as DailyReviewPayload).text };
}

export async function setDailyReview(day: string, text: string): Promise<void> {
  const recs = await liveByType('daily_review');
  const existing = recs.find((r) => (r.payload as DailyReviewPayload).day === day);
  if (existing) {
    await db.records.put({
      ...existing,
      payload: { day, text } as DailyReviewPayload,
      updatedAt: new Date().toISOString(),
    });
  } else {
    await db.records.put(makeRecord('daily_review', { day, text } as DailyReviewPayload, newId()));
  }
}
