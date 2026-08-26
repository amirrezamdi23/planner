import { useEffect, useState, useCallback } from 'react';
import { dayKey, jalaliLabelForDayKey } from './lib/date';
import { CATEGORY_PALETTE, DEFAULT_SWATCH, type ColorSwatch } from './palette';
import Collapsible from './Collapsible';
import {
  listProjectCategories,
  addProjectCategory,
  editProjectCategory,
  deleteProjectCategory,
  listProjects,
  addProject,
  editProject,
  deleteProject,
  moveProjectToCategory,
  ensureOtherCategoryAndMigrateLegacyProjects,
  listProjectLog,
  addProjectLogEntry,
  deleteProjectLogEntry,
  type ProjectCategory,
  type Project,
  type ProjectLogEntry,
} from './repo';

const TODAY = dayKey(0);
const SELECTED_CATEGORY_KEY = 'selected_project_category_id';
const SELECTED_PROJECT_KEY = 'selected_project_id';

function SwatchPicker({ value, onChange }: { value: ColorSwatch; onChange: (s: ColorSwatch) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      {CATEGORY_PALETTE.map((s) => (
        <button
          key={s.color}
          type="button"
          onClick={() => onChange(s)}
          title={s.color}
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: s.color,
            border: value.color === s.color ? '2px solid var(--ink)' : '2px solid transparent',
            cursor: 'pointer',
            padding: 0,
          }}
        />
      ))}
    </div>
  );
}

function ColorDot({ color }: { color?: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: color ?? 'var(--paper-line)',
        flex: '0 0 auto',
      }}
    />
  );
}

export default function ProjectLogCard() {
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [categoryColor, setCategoryColor] = useState<ColorSwatch>(DEFAULT_SWATCH);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryText, setEditingCategoryText] = useState('');
  const [editingCategoryColor, setEditingCategoryColor] = useState<ColorSwatch>(DEFAULT_SWATCH);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    localStorage.getItem(SELECTED_CATEGORY_KEY),
  );

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectInput, setProjectInput] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectText, setEditingProjectText] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    localStorage.getItem(SELECTED_PROJECT_KEY),
  );

  const [entries, setEntries] = useState<ProjectLogEntry[]>([]);
  const [entryInput, setEntryInput] = useState('');

  const reloadCategories = useCallback(async () => {
    const list = await listProjectCategories();
    setCategories(list);
    if (selectedCategoryId && !list.some((c) => c.id === selectedCategoryId)) {
      setSelectedCategoryId(null);
      localStorage.removeItem(SELECTED_CATEGORY_KEY);
    }
  }, [selectedCategoryId]);

  const reloadProjects = useCallback(
    async (categoryId: string | null) => {
      const list = categoryId ? await listProjects(categoryId) : [];
      setProjects(list);
      if (selectedProjectId && !list.some((p) => p.id === selectedProjectId)) {
        setSelectedProjectId(null);
        localStorage.removeItem(SELECTED_PROJECT_KEY);
      }
    },
    [selectedProjectId],
  );

  const reloadEntries = useCallback(async (projectId: string | null) => {
    setEntries(projectId ? await listProjectLog(projectId) : []);
  }, []);

  useEffect(() => {
    (async () => {
      // Guard with a localStorage flag (not just re-checking DB state) so
      // React StrictMode's double-invoke in dev can't race and create the
      // "سایر" category/project twice.
      if (!localStorage.getItem('migrated_other_category_v1')) {
        localStorage.setItem('migrated_other_category_v1', '1');
        await ensureOtherCategoryAndMigrateLegacyProjects();
      }
      await reloadCategories();
    })();
    // Runs once on mount — migration is idempotent, no need to re-run per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    reloadProjects(selectedCategoryId);
  }, [selectedCategoryId, reloadProjects]);

  useEffect(() => {
    reloadEntries(selectedProjectId);
  }, [selectedProjectId, reloadEntries]);

  function selectCategory(id: string) {
    setSelectedCategoryId(id);
    localStorage.setItem(SELECTED_CATEGORY_KEY, id);
  }
  function backToCategories() {
    setSelectedCategoryId(null);
    localStorage.removeItem(SELECTED_CATEGORY_KEY);
    setSelectedProjectId(null);
    localStorage.removeItem(SELECTED_PROJECT_KEY);
  }
  function selectProject(id: string) {
    setSelectedProjectId(id);
    localStorage.setItem(SELECTED_PROJECT_KEY, id);
  }
  function backToProjects() {
    setSelectedProjectId(null);
    localStorage.removeItem(SELECTED_PROJECT_KEY);
  }

  async function onAddCategory() {
    if (!categoryInput.trim()) return;
    await addProjectCategory(categoryInput, categoryColor.color, categoryColor.bg);
    setCategoryInput('');
    setCategoryColor(DEFAULT_SWATCH);
    await reloadCategories();
  }
  function onStartEditCategory(c: ProjectCategory) {
    setEditingCategoryId(c.recId);
    setEditingCategoryText(c.name);
    setEditingCategoryColor(
      CATEGORY_PALETTE.find((s) => s.color === c.color) ?? (c.color && c.bg ? { color: c.color, bg: c.bg } : DEFAULT_SWATCH),
    );
  }
  async function onSaveEditCategory() {
    if (!editingCategoryId) return;
    await editProjectCategory(editingCategoryId, editingCategoryText, editingCategoryColor.color, editingCategoryColor.bg);
    setEditingCategoryId(null);
    setEditingCategoryText('');
    await reloadCategories();
  }
  async function onDeleteCategory(recId: string) {
    if (!window.confirm('این دسته‌بندی و همه‌ی پروژه‌ها و لاگ‌های زیرمجموعه‌اش حذف می‌شن. مطمئنی؟')) return;
    await deleteProjectCategory(recId);
    await reloadCategories();
  }

  async function onAddProject() {
    if (!selectedCategoryId || !projectInput.trim()) return;
    await addProject(projectInput, selectedCategoryId);
    setProjectInput('');
    await reloadProjects(selectedCategoryId);
  }
  function onStartEditProject(p: Project) {
    setEditingProjectId(p.recId);
    setEditingProjectText(p.name);
  }
  async function onSaveEditProject() {
    if (!editingProjectId) return;
    await editProject(editingProjectId, editingProjectText);
    setEditingProjectId(null);
    setEditingProjectText('');
    await reloadProjects(selectedCategoryId);
  }
  async function onDeleteProject(recId: string) {
    if (!window.confirm('این پروژه و لاگ‌های ثبت‌شده براش حذف می‌شن. مطمئنی؟')) return;
    await deleteProject(recId);
    await reloadProjects(selectedCategoryId);
  }

  async function onAddEntry() {
    if (!selectedProjectId || !entryInput.trim()) return;
    await addProjectLogEntry(selectedProjectId, TODAY, entryInput);
    setEntryInput('');
    await reloadEntries(selectedProjectId);
  }
  async function onDeleteEntry(recId: string) {
    await deleteProjectLogEntry(recId);
    await reloadEntries(selectedProjectId);
  }

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? null;
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;
  const [last, ...rest] = entries;

  // ---------- step 1: category picker ----------
  if (!selectedCategory) {
    return (
      <Collapsible title="دسته‌بندی" storageKey="projectlog">
        {categories.length === 0 && <div className="empty">هنوز دسته‌بندی‌ای اضافه نکردی.</div>}
        {categories.map((c) => (
          <div className="habit-row" key={c.recId}>
            {editingCategoryId === c.recId ? (
              <div style={{ flex: 1 }}>
                <div className="add-row" style={{ marginTop: 0 }}>
                  <input
                    value={editingCategoryText}
                    onChange={(e) => setEditingCategoryText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSaveEditCategory()}
                    autoFocus
                  />
                </div>
                <div className="add-row">
                  <SwatchPicker value={editingCategoryColor} onChange={setEditingCategoryColor} />
                </div>
                <div className="add-row">
                  <button onClick={onSaveEditCategory}>ذخیره</button>
                  <button className="link-btn" onClick={() => setEditingCategoryId(null)}>
                    انصراف
                  </button>
                </div>
              </div>
            ) : (
              <>
                <ColorDot color={c.color} />
                <span className="habit-name" style={{ cursor: 'pointer' }} onClick={() => selectCategory(c.id)}>
                  {c.name}
                </span>
                <button className="habit-del" onClick={() => onStartEditCategory(c)} title="ویرایش">
                  ✎
                </button>
                <button className="habit-del" onClick={() => onDeleteCategory(c.recId)} title="حذف">
                  ✕
                </button>
              </>
            )}
          </div>
        ))}
        <div className="add-row">
          <input
            placeholder="دسته‌بندی جدید (مثلاً کاری، شخصی)…"
            value={categoryInput}
            onChange={(e) => setCategoryInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddCategory()}
          />
        </div>
        <div className="add-row">
          <SwatchPicker value={categoryColor} onChange={setCategoryColor} />
          <button onClick={onAddCategory}>افزودن دسته‌بندی</button>
        </div>
      </Collapsible>
    );
  }

  // ---------- step 2: project picker within category ----------
  if (!selectedProject) {
    return (
      <Collapsible title="دسته‌بندی" tag={selectedCategory.name} storageKey="projectlog">
        <button className="link-btn" onClick={backToCategories}>
          ◂ بازگشت به دسته‌بندی‌ها
        </button>

        <div style={{ marginTop: 10 }}>
          {projects.length === 0 && <div className="empty">هنوز پروژه‌ای توی این دسته‌بندی اضافه نکردی.</div>}
          {projects.map((p) => (
            <div className="habit-row" key={p.recId}>
              {editingProjectId === p.recId ? (
                <div className="add-row" style={{ flex: 1, marginTop: 0 }}>
                  <input
                    value={editingProjectText}
                    onChange={(e) => setEditingProjectText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSaveEditProject()}
                    autoFocus
                  />
                  <button onClick={onSaveEditProject}>ذخیره</button>
                  <button className="link-btn" onClick={() => setEditingProjectId(null)}>
                    انصراف
                  </button>
                </div>
              ) : (
                <>
                  <ColorDot color={selectedCategory.color} />
                  <span className="habit-name" style={{ cursor: 'pointer' }} onClick={() => selectProject(p.id)}>
                    {p.name}
                  </span>
                  <select
                    className="mini-select"
                    value={p.categoryId}
                    title="انتقال به دسته‌بندی دیگر"
                    onChange={async (e) => {
                      await moveProjectToCategory(p.recId, e.target.value);
                      await reloadProjects(selectedCategoryId);
                    }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button className="habit-del" onClick={() => onStartEditProject(p)} title="ویرایش">
                    ✎
                  </button>
                  <button className="habit-del" onClick={() => onDeleteProject(p.recId)} title="حذف">
                    ✕
                  </button>
                </>
              )}
            </div>
          ))}
          <div className="add-row">
            <input
              placeholder="پروژه‌ی جدید (مثلاً پروژه X)…"
              value={projectInput}
              onChange={(e) => setProjectInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAddProject()}
            />
            <button onClick={onAddProject}>افزودن پروژه</button>
          </div>
        </div>
      </Collapsible>
    );
  }

  // ---------- step 3: project log ----------
  return (
    <Collapsible title="دسته‌بندی" tag={`${selectedCategory.name} / ${selectedProject.name}`} storageKey="projectlog">
      <button className="link-btn" onClick={backToProjects}>
        ◂ بازگشت به لیست پروژه‌ها
      </button>

      <div className="proj-divider" />
      {last ? (
        <div className="last-entry">
          <div className="last-entry-label">آخرین کار — {jalaliLabelForDayKey(last.day)}</div>
          <div className="last-entry-row">
            <div className="last-entry-text">{last.text}</div>
            <button className="habit-del" onClick={() => onDeleteEntry(last.recId)} title="حذف">
              ✕
            </button>
          </div>
        </div>
      ) : (
        <div className="empty">هنوز یادداشتی برای این پروژه ثبت نشده.</div>
      )}

      {rest.length > 0 && (
        <div className="proj-history">
          {rest.map((e) => (
            <div className="log-item" key={e.recId}>
              <span className="log-mark">–</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{jalaliLabelForDayKey(e.day)}</div>
                <span className="log-text">{e.text}</span>
              </div>
              <button className="habit-del" onClick={() => onDeleteEntry(e.recId)} title="حذف">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="add-row">
        <input
          placeholder="امروز روی این پروژه چی‌کار کردی؟"
          value={entryInput}
          onChange={(e) => setEntryInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAddEntry()}
        />
        <button onClick={onAddEntry}>ثبت</button>
      </div>
    </Collapsible>
  );
}
