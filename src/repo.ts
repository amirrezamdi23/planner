import db, { makeRecord, type Rec } from './db';
import { newId } from './lib/id';
import { recurringPaymentCycle, jalaliCycleKey, shiftDayKey } from './lib/date';

// Categories/projects are edited from ProjectLogCard but read by other cards
// (quicklog's add/edit forms, HistoryCard) that each keep their own local
// copy loaded once on mount — without this, a category added in one card
// stays invisible in the others until a full page reload.
const CATEGORIES_CHANGED_EVENT = 'planner:categories-changed';

function notifyCategoriesChanged(): void {
  window.dispatchEvent(new Event(CATEGORIES_CHANGED_EVENT));
}

export function onCategoriesChanged(handler: () => void): () => void {
  window.addEventListener(CATEGORIES_CHANGED_EVENT, handler);
  return () => window.removeEventListener(CATEGORIES_CHANGED_EVENT, handler);
}

// ---------- payload shapes ----------
export interface HabitPayload {
  name: string;
  icon: string;
}
export interface HabitCheckPayload {
  habitId: string;
  day: string;
}
export type LogItemType = 'task' | 'event' | 'note' | 'idea' | 'sleep' | 'wake' | 'nap' | 'nap_none' | 'mood';
export interface LogItemPayload {
  day: string;
  text: string;
  done: boolean;
  failed?: boolean; // attempted but couldn't finish — 'task' items only
  itemType: LogItemType;
  priority: boolean;
  categoryId?: string;
  projectId?: string;
  durationMin?: number; // only used by 'nap'
  notes?: string;
  dueDate?: string; // day-key
  comment?: string;
  phaseId?: string; // only meaningful when the item's project defines phases
  parentId?: string; // set on a subtask — the recId of the task it belongs to
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
  failed?: boolean;
  itemType: LogItemType;
  priority: boolean;
  categoryId?: string;
  projectId?: string;
  durationMin?: number;
  notes?: string;
  dueDate?: string;
  comment?: string;
  phaseId?: string;
  parentId?: string;
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
function toLogItem(r: Rec): LogItem {
  const p = r.payload as LogItemPayload;
  return {
    recId: r.id,
    day: p.day,
    text: p.text,
    done: p.done,
    failed: p.failed,
    itemType: p.itemType,
    priority: p.priority,
    categoryId: p.categoryId,
    projectId: p.projectId,
    durationMin: p.durationMin,
    notes: p.notes,
    dueDate: p.dueDate,
    comment: p.comment,
    phaseId: p.phaseId,
    parentId: p.parentId,
  };
}

export async function listLogItems(day: string): Promise<LogItem[]> {
  const recs = await liveByType('log_item');
  return recs
    .filter((r) => (r.payload as LogItemPayload).day === day)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(toLogItem);
}

export interface AddLogItemInput {
  day: string;
  text: string;
  itemType: LogItemType;
  priority: boolean;
  categoryId?: string;
  projectId?: string;
  notes?: string;
  dueDate?: string;
  phaseId?: string;
}

export async function addLogItem(input: AddLogItemInput): Promise<void> {
  if (!input.text.trim()) return;
  await db.records.put(
    makeRecord('log_item', {
      day: input.day,
      text: input.text.trim(),
      done: false,
      itemType: input.itemType,
      priority: input.priority,
      categoryId: input.categoryId,
      projectId: input.projectId,
      notes: input.notes,
      dueDate: input.dueDate,
      phaseId: input.phaseId,
    } as LogItemPayload),
  );
}

// A subtask is just another 'task' log item that names its parent — it lives
// on the same day and inherits the parent's category/project/phase so it
// never drifts out of the grouping its parent belongs to.
export async function addSubtask(parentRecId: string, text: string): Promise<void> {
  if (!text.trim()) return;
  const parent = await db.records.get(parentRecId);
  if (!parent) return;
  const p = parent.payload as LogItemPayload;
  await db.records.put(
    makeRecord('log_item', {
      day: p.day,
      text: text.trim(),
      done: false,
      itemType: 'task',
      priority: false,
      categoryId: p.categoryId,
      projectId: p.projectId,
      phaseId: p.phaseId,
      parentId: parentRecId,
    } as LogItemPayload),
  );
}

export interface EditLogItemInput {
  recId: string;
  text: string;
  itemType: LogItemType;
  categoryId?: string;
  projectId?: string;
  notes?: string;
  dueDate?: string;
  phaseId?: string;
}

export async function editLogItem(input: EditLogItemInput): Promise<void> {
  if (!input.text.trim()) return;
  const r = await db.records.get(input.recId);
  if (!r) return;
  const p = r.payload as LogItemPayload;
  await db.records.put({
    ...r,
    payload: {
      ...p,
      text: input.text.trim(),
      itemType: input.itemType,
      categoryId: input.categoryId,
      projectId: input.projectId,
      notes: input.notes,
      dueDate: input.dueDate,
      phaseId: input.phaseId,
    },
    updatedAt: new Date().toISOString(),
  });
}

// Not-done items with a due date, from any day — used to surface reminders
// on today's list well before (and after) the deadline, regardless of which
// day the item actually lives on.
export async function listPendingWithDueDate(): Promise<LogItem[]> {
  const recs = await liveByType('log_item');
  return recs
    .filter((r) => {
      const p = r.payload as LogItemPayload;
      return !p.done && !p.failed && !!p.dueDate;
    })
    .map(toLogItem);
}

// All user-authored notes/tasks/events/ideas across every day — the
// bookkeeping types (sleep/wake/nap/nap_none) are excluded since they're not
// something the user would browse as "history".
//
// Note: entries journaled per-project in ProjectLogCard live in their own
// record type ('project_log', not 'log_item') because they're keyed by
// project rather than by day-list — folded in here too (tagged as 'note')
// so History/export doesn't silently miss them.
export async function listAllLogItems(): Promise<LogItem[]> {
  const recs = await liveByType('log_item');
  const NOTE_TYPES: LogItemType[] = ['task', 'event', 'note', 'idea'];
  const quickItems: LogItem[] = recs
    .filter((r) => NOTE_TYPES.includes((r.payload as LogItemPayload).itemType))
    .map(toLogItem);

  const projectRecs = await liveByType('project');
  const categoryByProjectId = new Map(
    projectRecs.map((r) => [r.id, (r.payload as ProjectPayload).categoryId]),
  );
  const projectLogRecs = await liveByType('project_log');
  const projectItems: LogItem[] = projectLogRecs.map((r) => {
    const p = r.payload as ProjectLogPayload;
    return {
      recId: r.id,
      day: p.day,
      text: p.text,
      done: false,
      itemType: 'note',
      priority: false,
      categoryId: categoryByProjectId.get(p.projectId),
      projectId: p.projectId,
    };
  });

  return [...quickItems, ...projectItems].sort((a, b) => b.recId.localeCompare(a.recId));
}

// Midday naps: same time-log idea as sleep/wake, but with a duration too.
// The start time is optional — the user only has to say how long they
// napped, and can add when it started if they want to.
export async function addNapEntry(day: string, durationMin: number, startTime?: string): Promise<void> {
  if (durationMin <= 0) return;
  await db.records.put(
    makeRecord('log_item', {
      day,
      text: startTime ?? '',
      done: false,
      itemType: 'nap',
      priority: false,
      durationMin,
    } as LogItemPayload),
  );
}

// Explicit "didn't nap that day" marker — resolves the nap gate the same way
// an actual nap entry does, without implying a nap happened.
export async function addNapNone(day: string): Promise<void> {
  await db.records.put(
    makeRecord('log_item', { day, text: '', done: false, itemType: 'nap_none', priority: false } as LogItemPayload),
  );
}

// Lets SleepReportCard's swipe-to-edit fix a mis-typed sleep/wake time after
// the fact, without going through the gate flow again.
export async function editSleepTime(day: string, time: string): Promise<void> {
  if (!time) return;
  const recs = await liveByType('log_item');
  const r = recs.find((r) => (r.payload as LogItemPayload).day === day && (r.payload as LogItemPayload).itemType === 'sleep');
  if (!r) return;
  const p = r.payload as LogItemPayload;
  await db.records.put({ ...r, payload: { ...p, text: time }, updatedAt: new Date().toISOString() });
}

export async function editWakeTime(day: string, time: string): Promise<void> {
  if (!time) return;
  const recs = await liveByType('log_item');
  const r = recs.find((r) => (r.payload as LogItemPayload).day === day && (r.payload as LogItemPayload).itemType === 'wake');
  if (!r) return;
  const p = r.payload as LogItemPayload;
  await db.records.put({ ...r, payload: { ...p, text: time }, updatedAt: new Date().toISOString() });
}

// Three-state cycle for a task's checkbox: not done -> done -> failed
// (attempted but couldn't finish) -> not done again.
export async function cycleLogStatus(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as LogItemPayload;
  const next = !p.done && !p.failed ? { done: true, failed: false } : p.done ? { done: false, failed: true } : { done: false, failed: false };
  await db.records.put({
    ...r,
    payload: { ...p, ...next },
    updatedAt: new Date().toISOString(),
  });
}

export async function setLogComment(recId: string, comment: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as LogItemPayload;
  await db.records.put({
    ...r,
    payload: { ...p, comment: comment || undefined },
    updatedAt: new Date().toISOString(),
  });
}

export async function togglePriority(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as LogItemPayload;
  await db.records.put({
    ...r,
    payload: { ...p, priority: !p.priority },
    updatedAt: new Date().toISOString(),
  });
}

// Deleting a task takes its subtasks with it — a subtask whose parent is gone
// has nothing to hang off and would just vanish from the list as an orphan.
export async function deleteLogItem(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const now = new Date().toISOString();
  await db.records.put({ ...r, deleted: true, updatedAt: now });
  const recs = await liveByType('log_item');
  for (const child of recs) {
    if ((child.payload as LogItemPayload).parentId === recId) {
      await db.records.put({ ...child, deleted: true, updatedAt: now });
    }
  }
}

// Bullet Journal migration: move an item (usually a still-undone task found
// while reviewing a past day) onto a different day's page.
export async function moveLogItem(recId: string, newDay: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as LogItemPayload;
  const now = new Date().toISOString();
  await db.records.put({ ...r, payload: { ...p, day: newDay }, updatedAt: now });
  // Subtasks always live on their parent's day — carry them along.
  const recs = await liveByType('log_item');
  for (const child of recs) {
    const cp = child.payload as LogItemPayload;
    if (cp.parentId === recId && cp.day !== newDay) {
      await db.records.put({ ...child, payload: { ...cp, day: newDay }, updatedAt: now });
    }
  }
}

// ---------- sleep report ----------
// Pulls every sleep/wake/nap entry ever logged and groups them per "night" —
// a sleep entry on day D pairs with the wake entry on day D+1, since that's
// how the quick-log gate itself records them.
export interface SleepDayReport {
  day: string; // the day the person's "day" was — the evening they went to bed, and where their naps landed
  sleepTime?: string;
  wakeTime?: string; // from the following morning
  nightDurationMin?: number;
  naps: { recId: string; start: string; durationMin: number }[];
  napTotalMin: number;
  napNone: boolean;
  totalSleepMin?: number; // night sleep + naps, the day's real total
  mood?: string; // morning-mood id, logged the same day as the wake entry
}

export async function listSleepReports(): Promise<SleepDayReport[]> {
  const recs = await liveByType('log_item');
  const sleeps = new Map<string, string>();
  const wakes = new Map<string, string>();
  const moods = new Map<string, string>();
  const naps = new Map<string, { recId: string; start: string; durationMin: number }[]>();
  const napNoneDays = new Set<string>();

  for (const r of recs) {
    const p = r.payload as LogItemPayload;
    if (p.itemType === 'sleep') sleeps.set(p.day, p.text);
    else if (p.itemType === 'wake') wakes.set(p.day, p.text);
    else if (p.itemType === 'mood') moods.set(p.day, p.text);
    else if (p.itemType === 'nap') {
      const arr = naps.get(p.day) ?? [];
      arr.push({ recId: r.id, start: p.text, durationMin: p.durationMin ?? 0 });
      naps.set(p.day, arr);
    } else if (p.itemType === 'nap_none') {
      napNoneDays.add(p.day);
    }
  }

  // A "day" in the report is the day the person went to bed (and where their
  // naps happened) — the wake entry is stored under the NEXT day, so it's
  // pulled in by shifting forward. This is what lets a nap taken Tuesday
  // afternoon combine with a sleep that crosses into Wednesday morning into
  // one "Tuesday" total, matching how the person actually experienced it.
  const days = new Set<string>([
    ...sleeps.keys(),
    ...naps.keys(),
    ...napNoneDays,
    ...[...wakes.keys()].map((wd) => shiftDayKey(wd, -1)),
  ]);

  const result: SleepDayReport[] = [];
  for (const day of days) {
    const sleepTime = sleeps.get(day);
    const nextDay = shiftDayKey(day, 1);
    const wakeTime = wakes.get(nextDay);
    let nightDurationMin: number | undefined;
    if (sleepTime && wakeTime) {
      // A bedtime entered as e.g. "00:10" is grouped under this "night" for
      // reporting purposes, but the clock instant it names has already
      // rolled into the next calendar day — treat any early-morning bedtime
      // (before noon) as landing on `nextDay` so the elapsed-time math is
      // correct instead of counting a bogus extra ~24 hours.
      const sleepHour = parseInt(sleepTime.split(':')[0], 10);
      const sleepDay = sleepHour < 12 ? nextDay : day;
      const sleepDt = new Date(`${sleepDay}T${sleepTime}:00`);
      const wakeDt = new Date(`${nextDay}T${wakeTime}:00`);
      nightDurationMin = Math.round((wakeDt.getTime() - sleepDt.getTime()) / 60000);
    }
    const napList = (naps.get(day) ?? []).sort((a, b) => a.start.localeCompare(b.start));
    const napTotalMin = napList.reduce((sum, n) => sum + n.durationMin, 0);
    const totalSleepMin =
      nightDurationMin !== undefined || napTotalMin > 0 ? (nightDurationMin ?? 0) + napTotalMin : undefined;
    result.push({
      day,
      sleepTime,
      wakeTime,
      nightDurationMin,
      naps: napList,
      napTotalMin,
      napNone: napNoneDays.has(day),
      totalSleepMin,
      mood: moods.get(nextDay),
    });
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
// What the payment actually is — separate from `kind` (how often it recurs).
export type PaymentType = 'check' | 'installment' | 'debt';
export interface PaymentPayload {
  name: string;
  kind: PaymentKind;
  payType?: PaymentType; // optional so payments created before this field existed still load
  dueDayJalali?: number; // for 'recurring': day of the Jalali month, 1-31
  dueDate?: string; // for 'once': a day-key
  paid: boolean;
  paidThroughCycle?: string; // for 'recurring': last "jy-jm" cycle marked paid
}
export interface Payment {
  recId: string;
  name: string;
  kind: PaymentKind;
  payType?: PaymentType;
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
  payType: PaymentType,
  kind: PaymentKind,
  dueDayJalali?: number,
  dueDate?: string,
): Promise<void> {
  if (!name.trim()) return;
  await db.records.put(
    makeRecord('payment', {
      name: name.trim(),
      kind,
      payType,
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

export async function editPayment(
  recId: string,
  name: string,
  payType: PaymentType,
  kind: PaymentKind,
  dueDayJalali?: number,
  dueDate?: string,
): Promise<void> {
  if (!name.trim()) return;
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as PaymentPayload;
  await db.records.put({
    ...r,
    payload: { ...p, name: name.trim(), payType, kind, dueDayJalali, dueDate },
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
  color?: string;
  bg?: string;
}
export interface ProjectCategory {
  recId: string;
  id: string;
  name: string;
  color?: string;
  bg?: string;
}

export async function listProjectCategories(): Promise<ProjectCategory[]> {
  const recs = await liveByType('project_category');
  return recs
    .map((r) => {
      const p = r.payload as ProjectCategoryPayload;
      return { recId: r.id, id: r.id, name: p.name, color: p.color, bg: p.bg };
    })
    .sort((a, b) => a.recId.localeCompare(b.recId));
}

export async function addProjectCategory(name: string, color?: string, bg?: string): Promise<void> {
  if (!name.trim()) return;
  await db.records.put(makeRecord('project_category', { name: name.trim(), color, bg } as ProjectCategoryPayload));
  notifyCategoriesChanged();
}

export async function editProjectCategory(recId: string, name: string, color?: string, bg?: string): Promise<void> {
  if (!name.trim()) return;
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({
    ...r,
    payload: { name: name.trim(), color, bg } as ProjectCategoryPayload,
    updatedAt: new Date().toISOString(),
  });
  notifyCategoriesChanged();
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
  notifyCategoriesChanged();
}

// ---------- project log ----------
// A per-project running history — pick a project, see what you did last and
// everything you've done on it since, across however many days it takes.
// Phases are opt-in per project: a long-running project (learning to trade,
// building an app) benefits from knowing "which stage am I at", while a
// one-off like a dentist visit would only be burdened by it. A project with
// an empty/absent `phases` behaves exactly as it did before this existed.
export interface ProjectPhase {
  id: string;
  name: string;
}
export interface ProjectPayload {
  name: string;
  categoryId: string;
  phases?: ProjectPhase[];
}
export interface Project {
  recId: string;
  id: string;
  name: string;
  categoryId: string;
  phases: ProjectPhase[];
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
      return { recId: r.id, id: r.id, name: p.name, categoryId: p.categoryId, phases: p.phases ?? [] };
    })
    .sort((a, b) => a.recId.localeCompare(b.recId));
}

// The three phases cover the shape of nearly any personal project without
// the ceremony of a five-stage product pipeline.
export const DEFAULT_PHASE_NAMES = ['آماده‌سازی', 'اجرا', 'جمع‌بندی'];

export async function setProjectPhases(recId: string, names: string[]): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as ProjectPayload;
  const existing = p.phases ?? [];
  // Reuse the id of a phase that keeps its name, so items already filed under
  // it stay filed under it across an edit.
  const phases: ProjectPhase[] = names
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name) => ({ id: existing.find((e) => e.name === name)?.id ?? newId(), name }));
  await db.records.put({ ...r, payload: { ...p, phases }, updatedAt: new Date().toISOString() });
  notifyCategoriesChanged();
}

export async function setLogPhase(recId: string, phaseId?: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as LogItemPayload;
  await db.records.put({ ...r, payload: { ...p, phaseId }, updatedAt: new Date().toISOString() });
}

export async function addProject(name: string, categoryId: string): Promise<void> {
  if (!name.trim() || !categoryId) return;
  await db.records.put(makeRecord('project', { name: name.trim(), categoryId } as ProjectPayload));
  notifyCategoriesChanged();
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
  notifyCategoriesChanged();
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
  notifyCategoriesChanged();
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
  notifyCategoriesChanged();
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
    await addProjectCategory(OTHER_NAME, '#5B5648', '#EAE6D9'); // neutral — matches --ink-soft / --paper
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
  // HistoryCard folds project-log entries into its list too — reuse the same
  // pub/sub so a newly journaled entry shows up there without a page reload.
  notifyCategoriesChanged();
}

export async function deleteProjectLogEntry(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({ ...r, deleted: true, updatedAt: new Date().toISOString() });
  notifyCategoriesChanged();
}

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

// ---------- music player songs ----------
// Metadata + URL only — the audio itself is never downloaded or cached to
// disk by this app; MusicPlayer (native) streams straight from `url`.
export interface SongPayload {
  title: string;
  artist: string;
  url: string;
}
export interface Song {
  recId: string;
  title: string;
  artist: string;
  url: string;
}

export async function listSongs(): Promise<Song[]> {
  const recs = await liveByType('song');
  return recs
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => ({ recId: r.id, ...(r.payload as SongPayload) }));
}

// Only the link is entered by hand — the title is derived from the URL's
// filename so the add form stays a single field.
function deriveTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop() ?? url;
    const decoded = decodeURIComponent(last);
    return decoded.replace(/\.[a-zA-Z0-9]+$/, '').replace(/[_+]/g, ' ').trim() || url;
  } catch {
    return url;
  }
}

export async function addSong(url: string): Promise<string> {
  const trimmed = url.trim();
  const rec = makeRecord('song', { title: deriveTitleFromUrl(trimmed), artist: '', url: trimmed } as SongPayload);
  await db.records.put(rec);
  return rec.id;
}

export async function editSong(recId: string, url: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const trimmed = url.trim();
  await db.records.put({
    ...r,
    payload: { title: deriveTitleFromUrl(trimmed), artist: '', url: trimmed } as SongPayload,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteSong(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({ ...r, deleted: true, updatedAt: new Date().toISOString() });
}
