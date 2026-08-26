import db, { makeRecord, type Rec } from './db';
import { recurringPaymentCycle, jalaliCycleKey, shiftDayKey } from './lib/date';

// ---------- payload shapes ----------
export interface HabitPayload {
  name: string;
  icon: string;
}
export interface HabitCheckPayload {
  habitId: string;
  day: string;
}
export type LogItemType = 'task' | 'event' | 'note' | 'idea' | 'sleep' | 'wake' | 'nap';
export interface LogItemPayload {
  day: string;
  text: string;
  done: boolean;
  itemType: LogItemType;
  priority: boolean;
  categoryId?: string;
  projectId?: string;
  durationMin?: number; // only used by 'nap'
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
  day: string;
  text: string;
  done: boolean;
  itemType: LogItemType;
  priority: boolean;
  categoryId?: string;
  projectId?: string;
  durationMin?: number;
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
      return {
        recId: r.id,
        day: p.day,
        text: p.text,
        done: p.done,
        itemType: p.itemType,
        priority: p.priority,
        categoryId: p.categoryId,
        projectId: p.projectId,
        durationMin: p.durationMin,
      };
    });
}

export async function addLogItem(
  day: string,
  text: string,
  itemType: LogItemType,
  priority: boolean,
  categoryId?: string,
  projectId?: string,
): Promise<void> {
  if (!text.trim()) return;
  await db.records.put(
    makeRecord('log_item', {
      day,
      text: text.trim(),
      done: false,
      itemType,
      priority,
      categoryId,
      projectId,
    } as LogItemPayload),
  );
}

export async function editLogItem(recId: string, text: string): Promise<void> {
  if (!text.trim()) return;
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as LogItemPayload;
  await db.records.put({
    ...r,
    payload: { ...p, text: text.trim() },
    updatedAt: new Date().toISOString(),
  });
}

// Midday naps: same time-log idea as sleep/wake, but with a duration too.
export async function addNapEntry(day: string, startTime: string, durationMin: number): Promise<void> {
  if (!startTime || durationMin <= 0) return;
  await db.records.put(
    makeRecord('log_item', {
      day,
      text: startTime,
      done: false,
      itemType: 'nap',
      priority: false,
      durationMin,
    } as LogItemPayload),
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

// Bullet Journal migration: move an item (usually a still-undone task found
// while reviewing a past day) onto a different day's page.
export async function moveLogItem(recId: string, newDay: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as LogItemPayload;
  await db.records.put({
    ...r,
    payload: { ...p, day: newDay },
    updatedAt: new Date().toISOString(),
  });
}

// ---------- sleep report ----------
// Pulls every sleep/wake/nap entry ever logged and groups them per "night" —
// a sleep entry on day D pairs with the wake entry on day D+1, since that's
// how the quick-log gate itself records them.
export interface SleepDayReport {
  day: string; // the wake day — the report row's anchor date
  sleepTime?: string;
  wakeTime?: string;
  nightDurationMin?: number;
  naps: { recId: string; start: string; durationMin: number }[];
  napTotalMin: number;
}

export async function listSleepReports(): Promise<SleepDayReport[]> {
  const recs = await liveByType('log_item');
  const sleeps = new Map<string, string>();
  const wakes = new Map<string, string>();
  const naps = new Map<string, { recId: string; start: string; durationMin: number }[]>();

  for (const r of recs) {
    const p = r.payload as LogItemPayload;
    if (p.itemType === 'sleep') sleeps.set(p.day, p.text);
    else if (p.itemType === 'wake') wakes.set(p.day, p.text);
    else if (p.itemType === 'nap') {
      const arr = naps.get(p.day) ?? [];
      arr.push({ recId: r.id, start: p.text, durationMin: p.durationMin ?? 0 });
      naps.set(p.day, arr);
    }
  }

  const days = new Set<string>([...wakes.keys(), ...naps.keys()]);
  const result: SleepDayReport[] = [];
  for (const day of days) {
    const wakeTime = wakes.get(day);
    const prevDay = shiftDayKey(day, -1);
    const sleepTime = sleeps.get(prevDay);
    let nightDurationMin: number | undefined;
    if (sleepTime && wakeTime) {
      const sleepDt = new Date(`${prevDay}T${sleepTime}:00`);
      const wakeDt = new Date(`${day}T${wakeTime}:00`);
      nightDurationMin = Math.round((wakeDt.getTime() - sleepDt.getTime()) / 60000);
    }
    const napList = (naps.get(day) ?? []).sort((a, b) => a.start.localeCompare(b.start));
    const napTotalMin = napList.reduce((sum, n) => sum + n.durationMin, 0);
    result.push({ day, sleepTime, wakeTime, nightDurationMin, naps: napList, napTotalMin });
  }
  return result.sort((a, b) => b.day.localeCompare(a.day));
}

// ---------- daily review ----------
// Append-only: every submit adds a new dated entry to a running list, rather
// than overwriting a single per-day note.
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

// ---------- payments ----------
export type PaymentKind = 'recurring' | 'once';
export interface PaymentPayload {
  name: string;
  kind: PaymentKind;
  dueDayJalali?: number; // for 'recurring': day of the Jalali month, 1-31
  dueDate?: string; // for 'once': a day-key
  paid: boolean;
  paidThroughCycle?: string; // for 'recurring': last "jy-jm" cycle marked paid
}
export interface Payment {
  recId: string;
  name: string;
  kind: PaymentKind;
  dueDayJalali?: number;
  dueDate?: string;
  paid: boolean;
  paidThroughCycle?: string;
}

export async function listPayments(): Promise<Payment[]> {
  const recs = await liveByType('payment');
  return recs
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => {
      const p = r.payload as PaymentPayload;
      return { recId: r.id, ...p };
    });
}

export async function addPayment(
  name: string,
  kind: PaymentKind,
  dueDayJalali?: number,
  dueDate?: string,
): Promise<void> {
  if (!name.trim()) return;
  await db.records.put(
    makeRecord('payment', {
      name: name.trim(),
      kind,
      dueDayJalali,
      dueDate,
      paid: false,
    } as PaymentPayload),
  );
}

export async function togglePaymentPaid(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as PaymentPayload;
  await db.records.put({
    ...r,
    payload: { ...p, paid: !p.paid },
    updatedAt: new Date().toISOString(),
  });
}

// Mark the currently-shown cycle of a recurring payment as paid — the row
// then advances to show the next due date instead of disappearing forever.
export async function advanceRecurringPayment(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as PaymentPayload;
  const cycle = recurringPaymentCycle(p.dueDayJalali ?? 1, p.paidThroughCycle);
  await db.records.put({
    ...r,
    payload: { ...p, paidThroughCycle: jalaliCycleKey(cycle) },
    updatedAt: new Date().toISOString(),
  });
}

export async function deletePayment(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({ ...r, deleted: true, updatedAt: new Date().toISOString() });
}

// ---------- project categories ----------
// Two-step structure: pick a category, then manage its projects as a
// subgroup — mirrors how the user actually thinks about their work areas.
export interface ProjectCategoryPayload {
  name: string;
}
export interface ProjectCategory {
  recId: string;
  id: string;
  name: string;
}

export async function listProjectCategories(): Promise<ProjectCategory[]> {
  const recs = await liveByType('project_category');
  return recs
    .map((r) => ({ recId: r.id, id: r.id, name: (r.payload as ProjectCategoryPayload).name }))
    .sort((a, b) => a.recId.localeCompare(b.recId));
}

export async function addProjectCategory(name: string): Promise<void> {
  if (!name.trim()) return;
  await db.records.put(makeRecord('project_category', { name: name.trim() } as ProjectCategoryPayload));
}

export async function editProjectCategory(recId: string, name: string): Promise<void> {
  if (!name.trim()) return;
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({
    ...r,
    payload: { name: name.trim() } as ProjectCategoryPayload,
    updatedAt: new Date().toISOString(),
  });
}

// Deleting a category cascades to its projects and their log entries, so
// nothing orphaned lingers under a category that no longer exists.
export async function deleteProjectCategory(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const now = new Date().toISOString();
  await db.records.put({ ...r, deleted: true, updatedAt: now });
  const projects = await liveByType('project');
  const logs = await liveByType('project_log');
  for (const p of projects) {
    if ((p.payload as ProjectPayload).categoryId !== recId) continue;
    await db.records.put({ ...p, deleted: true, updatedAt: now });
    for (const l of logs) {
      if ((l.payload as ProjectLogPayload).projectId === p.id) {
        await db.records.put({ ...l, deleted: true, updatedAt: now });
      }
    }
  }
}

// ---------- project log ----------
// A per-project running history — pick a project, see what you did last and
// everything you've done on it since, across however many days it takes.
export interface ProjectPayload {
  name: string;
  categoryId: string;
}
export interface Project {
  recId: string;
  id: string;
  name: string;
  categoryId: string;
}
export interface ProjectLogPayload {
  projectId: string;
  day: string;
  text: string;
}
export interface ProjectLogEntry {
  recId: string;
  day: string;
  text: string;
  createdAt: string;
}

export async function listProjects(categoryId?: string): Promise<Project[]> {
  const recs = await liveByType('project');
  return recs
    .filter((r) => !categoryId || (r.payload as ProjectPayload).categoryId === categoryId)
    .map((r) => {
      const p = r.payload as ProjectPayload;
      return { recId: r.id, id: r.id, name: p.name, categoryId: p.categoryId };
    })
    .sort((a, b) => a.recId.localeCompare(b.recId));
}

export async function addProject(name: string, categoryId: string): Promise<void> {
  if (!name.trim() || !categoryId) return;
  await db.records.put(makeRecord('project', { name: name.trim(), categoryId } as ProjectPayload));
}

export async function moveProjectToCategory(recId: string, categoryId: string): Promise<void> {
  if (!categoryId) return;
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as ProjectPayload;
  await db.records.put({
    ...r,
    payload: { ...p, categoryId },
    updatedAt: new Date().toISOString(),
  });
}

export async function editProject(recId: string, name: string): Promise<void> {
  if (!name.trim()) return;
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as ProjectPayload;
  await db.records.put({
    ...r,
    payload: { ...p, name: name.trim() },
    updatedAt: new Date().toISOString(),
  });
}

// Deleting a project cascades to its log entries.
export async function deleteProject(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const now = new Date().toISOString();
  await db.records.put({ ...r, deleted: true, updatedAt: now });
  const logs = await liveByType('project_log');
  for (const l of logs) {
    if ((l.payload as ProjectLogPayload).projectId === recId) {
      await db.records.put({ ...l, deleted: true, updatedAt: now });
    }
  }
}

// One-time, idempotent migration: older projects were created before
// categories existed, so they have no categoryId. Bucket them (and always
// keep available) under a "سایر" (Other) category with its own "سایر"
// catch-all project — the user can move any of them elsewhere afterward.
const OTHER_NAME = 'سایر';

export async function ensureOtherCategoryAndMigrateLegacyProjects(): Promise<void> {
  let categories = await listProjectCategories();
  let other = categories.find((c) => c.name === OTHER_NAME);
  if (!other) {
    await addProjectCategory(OTHER_NAME);
    categories = await listProjectCategories();
    other = categories.find((c) => c.name === OTHER_NAME);
  }
  if (!other) return;

  const now = new Date().toISOString();
  const recs = await liveByType('project');
  for (const r of recs) {
    const p = r.payload as ProjectPayload;
    if (!p.categoryId) {
      await db.records.put({ ...r, payload: { ...p, categoryId: other.id }, updatedAt: now });
    }
  }

  const projectsInOther = await listProjects(other.id);
  if (!projectsInOther.some((p) => p.name === OTHER_NAME)) {
    await addProject(OTHER_NAME, other.id);
  }
}

export async function listProjectLog(projectId: string): Promise<ProjectLogEntry[]> {
  const recs = await liveByType('project_log');
  return recs
    .filter((r) => (r.payload as ProjectLogPayload).projectId === projectId)
    .sort((a, b) => b.id.localeCompare(a.id)) // newest first
    .map((r) => ({
      recId: r.id,
      day: (r.payload as ProjectLogPayload).day,
      text: (r.payload as ProjectLogPayload).text,
      createdAt: r.updatedAt,
    }));
}

export async function addProjectLogEntry(projectId: string, day: string, text: string): Promise<void> {
  if (!text.trim()) return;
  await db.records.put(
    makeRecord('project_log', { projectId, day, text: text.trim() } as ProjectLogPayload),
  );
}

export async function deleteProjectLogEntry(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({ ...r, deleted: true, updatedAt: new Date().toISOString() });
}
