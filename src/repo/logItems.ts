import { db, makeRecord, liveByType } from './shared';
import type { ProjectPayload, ProjectLogPayload } from './projects';

// ---------- quick log ----------
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

function toLogItem(r: { id: string; payload: unknown }): LogItem {
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

export async function setLogPhase(recId: string, phaseId?: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as LogItemPayload;
  await db.records.put({ ...r, payload: { ...p, phaseId }, updatedAt: new Date().toISOString() });
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

// Everything still open, keyed by the day it's actually *for*: a due date
// wins over the day the item was written on, since that's the day the user
// needs to see it. Used by the Upcoming view.
export interface UpcomingItem extends LogItem {
  onDay: string;
}

export async function listUpcomingItems(): Promise<UpcomingItem[]> {
  const recs = await liveByType('log_item');
  const PLANNABLE: LogItemType[] = ['task', 'event'];
  return recs
    .map(toLogItem)
    .filter((it) => PLANNABLE.includes(it.itemType) && !it.done && !it.failed && !it.parentId)
    .map((it) => ({ ...it, onDay: it.dueDate ?? it.day }))
    .sort((a, b) => a.onDay.localeCompare(b.onDay) || a.recId.localeCompare(b.recId));
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
  const categoryByProjectId = new Map(projectRecs.map((r) => [r.id, (r.payload as ProjectPayload).categoryId]));
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
