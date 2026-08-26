import { useEffect, useState, useCallback } from 'react';
import { jalaliLabelForDayKey } from './lib/date';
import Collapsible from './Collapsible';
import {
  listAllLogItems,
  listProjectCategories,
  listProjects,
  type LogItem,
  type LogItemType,
  type ProjectCategory,
  type Project,
} from './repo';

const LOG_TYPES: Array<{ id: LogItemType; mark: string; doneMark?: string; label: string }> = [
  { id: 'task', mark: '☐', doneMark: '☑', label: 'کار' },
  { id: 'event', mark: '○', label: 'رویداد' },
  { id: 'note', mark: '–', label: 'یادداشت' },
  { id: 'idea', mark: '💡', label: 'ایده' },
];

export default function HistoryCard() {
  const [items, setItems] = useState<LogItem[]>([]);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [categoryProjects, setCategoryProjects] = useState<Project[]>([]);

  const [typeFilter, setTypeFilter] = useState<LogItemType | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [allItems, cats, projects] = await Promise.all([listAllLogItems(), listProjectCategories(), listProjects()]);
    setItems(allItems);
    setCategories(cats);
    setAllProjects(projects);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!categoryFilter) {
      setCategoryProjects([]);
      return;
    }
    listProjects(categoryFilter).then(setCategoryProjects);
  }, [categoryFilter]);

  function onSelectCategory(catId: string) {
    setCategoryFilter((cur) => (cur === catId ? null : catId));
    setProjectFilter(null);
  }

  const filtered = items.filter(
    (it) =>
      (!typeFilter || it.itemType === typeFilter) &&
      (!categoryFilter || it.categoryId === categoryFilter) &&
      (!projectFilter || it.projectId === projectFilter),
  );

  return (
    <Collapsible title="پیشینه" storageKey="history">
      <div className="type-select">
        <button className={'type-btn' + (typeFilter === null ? ' active' : '')} onClick={() => setTypeFilter(null)}>
          همه
        </button>
        {LOG_TYPES.map((t) => (
          <button
            key={t.id}
            className={'type-btn' + (typeFilter === t.id ? ' active' : '')}
            onClick={() => setTypeFilter((f) => (f === t.id ? null : t.id))}
          >
            {t.mark} {t.label}
          </button>
        ))}
      </div>

      <div className="cat-select">
        <button
          className={'cat-btn' + (categoryFilter === null ? ' active' : '')}
          style={{ background: 'var(--paper)', color: 'var(--ink-soft)' }}
          onClick={() => {
            setCategoryFilter(null);
            setProjectFilter(null);
          }}
        >
          همه
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            className={'cat-btn' + (categoryFilter === c.id ? ' active' : '')}
            style={{ background: c.bg ?? 'var(--paper)', color: c.color ?? 'var(--ink-soft)' }}
            onClick={() => onSelectCategory(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {categoryFilter && categoryProjects.length > 0 && (
        <div className="cat-select" style={{ paddingInlineStart: 12 }}>
          <button
            className={'cat-btn' + (projectFilter === null ? ' active' : '')}
            style={{ background: 'var(--paper)', color: 'var(--ink-soft)' }}
            onClick={() => setProjectFilter(null)}
          >
            همه
          </button>
          {categoryProjects.map((p) => (
            <button
              key={p.id}
              className={'cat-btn' + (projectFilter === p.id ? ' active' : '')}
              onClick={() => setProjectFilter((cur) => (cur === p.id ? null : p.id))}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && <div className="empty">چیزی پیدا نشد.</div>}
      {filtered.map((it) => {
        const t = LOG_TYPES.find((x) => x.id === it.itemType) ?? LOG_TYPES[0];
        const cat = categories.find((c) => c.id === it.categoryId);
        const proj = allProjects.find((p) => p.id === it.projectId);
        return (
          <div className="log-item" key={it.recId}>
            <span className="log-mark">{it.done && t.doneMark ? t.doneMark : t.mark}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{jalaliLabelForDayKey(it.day)}</div>
              <span className={'log-text' + (it.done ? ' done' : '')}>
                {it.priority && <span className="prio-badge" title="اولویت بالا">*</span>}
                {it.text}
                {cat && (
                  <span
                    className="pill"
                    style={{ background: cat.bg ?? 'var(--paper)', color: cat.color ?? 'var(--ink-soft)', marginInlineStart: 6 }}
                  >
                    {cat.name}
                    {proj ? ` › ${proj.name}` : ''}
                  </span>
                )}
              </span>
              {it.notes && <div className="pay-sub">{it.notes}</div>}
            </div>
          </div>
        );
      })}
    </Collapsible>
  );
}
