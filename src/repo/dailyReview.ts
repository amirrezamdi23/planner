import { db, makeRecord, liveByType } from './shared';

// ---------- daily review ----------
// Append-only: every submit adds a new dated entry to a running list, rather
// than overwriting a single per-day note.
export interface DailyReviewPayload {
  day: string;
  text: string;
}
export interface DailyReviewEntry {
  recId: string;
  day: string;
  text: string;
}

export async function listDailyReviewEntries(): Promise<DailyReviewEntry[]> {
  const recs = await liveByType('daily_review');
  return recs
    .sort((a, b) => b.id.localeCompare(a.id)) // newest first
    .map((r) => {
      const p = r.payload as DailyReviewPayload;
      return { recId: r.id, day: p.day, text: p.text };
    });
}

export async function addDailyReviewEntry(day: string, text: string): Promise<void> {
  if (!text.trim()) return;
  await db.records.put(makeRecord('daily_review', { day, text: text.trim() } as DailyReviewPayload));
}

export async function editDailyReviewEntry(recId: string, text: string): Promise<void> {
  if (!text.trim()) return;
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as DailyReviewPayload;
  await db.records.put({
    ...r,
    payload: { ...p, text: text.trim() },
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteDailyReviewEntry(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({ ...r, deleted: true, updatedAt: new Date().toISOString() });
}
