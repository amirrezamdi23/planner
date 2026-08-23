import { useEffect, useState, useCallback } from 'react';
import { dayKey, jalaliLabelForDayKey } from './lib/date';
import Collapsible from './Collapsible';
import {
  listProjects,
  addProject,
  deleteProject,
  listProjectLog,
  addProjectLogEntry,
  deleteProjectLogEntry,
  type Project,
  type ProjectLogEntry,
} from './repo';

const TODAY = dayKey(0);
const SELECTED_KEY = 'selected_project_id';

export default function ProjectLogCard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectInput, setProjectInput] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(localStorage.getItem(SELECTED_KEY));
  const [entries, setEntries] = useState<ProjectLogEntry[]>([]);
  const [entryInput, setEntryInput] = useState('');

  const reloadProjects = useCallback(async () => {
    const list = await listProjects();
    setProjects(list);
    if (selectedId && !list.some((p) => p.id === selectedId)) {
      setSelectedId(null);
      localStorage.removeItem(SELECTED_KEY);
    }
  }, [selectedId]);

  const reloadEntries = useCallback(async (projectId: string | null) => {
    setEntries(projectId ? await listProjectLog(projectId) : []);
  }, []);

  useEffect(() => {
    reloadProjects();
  }, [reloadProjects]);

  useEffect(() => {
    reloadEntries(selectedId);
  }, [selectedId, reloadEntries]);

  function selectProject(id: string) {
    setSelectedId(id);
    localStorage.setItem(SELECTED_KEY, id);
  }

  async function onAddProject() {
    if (!projectInput.trim()) return;
    await addProject(projectInput);
    setProjectInput('');
    await reloadProjects();
  }

  async function onDeleteProject(recId: string) {
    await deleteProject(recId);
    if (selectedId === recId) {
      setSelectedId(null);
      localStorage.removeItem(SELECTED_KEY);
    }
    await reloadProjects();
  }

  async function onAddEntry() {
    if (!selectedId || !entryInput.trim()) return;
    await addProjectLogEntry(selectedId, TODAY, entryInput);
    setEntryInput('');
    await reloadEntries(selectedId);
  }

  async function onDeleteEntry(recId: string) {
    await deleteProjectLogEntry(recId);
    await reloadEntries(selectedId);
  }

  const [last, ...rest] = entries;

  return (
    <Collapsible title="لاگ پروژه‌ها" storageKey="projectlog">
      {projects.length === 0 && <div className="empty">هنوز پروژه‌ای اضافه نکردی.</div>}
      <div className="type-select">
        {projects.map((p) => (
          <button
            key={p.recId}
            className={'type-btn' + (selectedId === p.id ? ' active' : '')}
            onClick={() => selectProject(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="add-row">
        <input
          placeholder="پروژه‌ی جدید (مثلاً پروژه X)…"
          value={projectInput}
          onChange={(e) => setProjectInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAddProject()}
        />
        <button onClick={onAddProject}>افزودن پروژه</button>
        {selectedId && (
          <button
            className="habit-del"
            onClick={() => onDeleteProject(selectedId)}
            title="حذف پروژه‌ی انتخاب‌شده"
          >
            حذف پروژه
          </button>
        )}
      </div>

      {selectedId && (
        <>
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
        </>
      )}
    </Collapsible>
  );
}
