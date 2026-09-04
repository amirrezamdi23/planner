import { newId } from '../lib/id';
import { db, makeRecord, liveByType, onceInFlight } from './shared';

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
// A journal entry (see JournalCard) is just a project-log entry tagged with
// which kind of note it is — set only by that card; a plain project log
// entry from ProjectLogCard has no tag.
export type JournalTag = 'morning' | 'evening' | 'day';
export interface ProjectLogPayload {
  projectId: string;
  day: string;
  text: string;
  tag?: JournalTag;
}
export interface ProjectLogEntry {
  recId: string;
  day: string;
  text: string;
  tag?: JournalTag;
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

export const ensureOtherCategoryAndMigrateLegacyProjects = onceInFlight(async (): Promise<void> => {
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
});

// JournalCard never shows a category/project picker — every entry it writes
// is filed here automatically, so later an export still finds it exactly
// where a normal project log lives. Idempotent and safe to call on every
// mount, same as the "سایر" migration above.
const PERSONAL_CATEGORY_NAME = 'شخصی';
const BULLET_JOURNAL_PROJECT_NAME = 'بولت ژورنال';

export const ensureBulletJournalProject = onceInFlight(async (): Promise<string> => {
  let categories = await listProjectCategories();
  let personal = categories.find((c) => c.name === PERSONAL_CATEGORY_NAME);
  if (!personal) {
    await addProjectCategory(PERSONAL_CATEGORY_NAME, '#6B4C9A', '#E4DCEF'); // matches the "purple" swatch
    categories = await listProjectCategories();
    personal = categories.find((c) => c.name === PERSONAL_CATEGORY_NAME);
  }
  if (!personal) throw new Error('failed to ensure the شخصی category');

  const projects = await listProjects(personal.id);
  let journal = projects.find((p) => p.name === BULLET_JOURNAL_PROJECT_NAME);
  if (!journal) {
    await addProject(BULLET_JOURNAL_PROJECT_NAME, personal.id);
    const after = await listProjects(personal.id);
    journal = after.find((p) => p.name === BULLET_JOURNAL_PROJECT_NAME);
  }
  if (!journal) throw new Error('failed to ensure the بولت ژورنال project');
  return journal.id;
});

export async function listProjectLog(projectId: string): Promise<ProjectLogEntry[]> {
  const recs = await liveByType('project_log');
  return recs
    .filter((r) => (r.payload as ProjectLogPayload).projectId === projectId)
    .sort((a, b) => b.id.localeCompare(a.id)) // newest first
    .map((r) => {
      const p = r.payload as ProjectLogPayload;
      return { recId: r.id, day: p.day, text: p.text, tag: p.tag, createdAt: r.updatedAt };
    });
}

export async function addProjectLogEntry(
  projectId: string,
  day: string,
  text: string,
  tag?: JournalTag,
): Promise<void> {
  if (!text.trim()) return;
  await db.records.put(makeRecord('project_log', { projectId, day, text: text.trim(), tag } as ProjectLogPayload));
  // HistoryCard folds project-log entries into its list too — reuse the same
  // pub/sub so a newly journaled entry shows up there without a page reload.
  notifyCategoriesChanged();
}

export async function editProjectLogEntry(recId: string, text: string): Promise<void> {
  if (!text.trim()) return;
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as ProjectLogPayload;
  await db.records.put({
    ...r,
    payload: { ...p, text: text.trim() },
    updatedAt: new Date().toISOString(),
  });
  notifyCategoriesChanged();
}

export async function deleteProjectLogEntry(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({ ...r, deleted: true, updatedAt: new Date().toISOString() });
  notifyCategoriesChanged();
}
