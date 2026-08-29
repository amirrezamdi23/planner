import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { dayKey, jalaliLabelForDayKey } from './lib/date';
import { exportTextFile } from './lib/exportFile';
import { LOG_TYPES } from './logTypes';
import Collapsible from './Collapsible';
import {
  listAllLogItems,
  listProjectCategories,
  listProjects,
  onCategoriesChanged,
  type LogItem,
  type LogItemType,
  type ProjectCategory,
  type Project,
} from './repo';

// Plain-text stand-in for the UI icons — a .txt export can't carry SVGs.
function exportMarkFor(it: LogItem): string {
  if (it.itemType === 'task') return it.done ? '[x]' : '[ ]';
  return '-';
}

export default function HistoryCard() {
  const [items, setItems] = useState<LogItem[]>([]);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [categoryProjects, setCategoryProjects] = useState<Project[]>([]);

  const [typeFilter, setTypeFilter] = useState<LogItemType | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [expandedNotesIds, setExpandedNotesIds] = useState<Set<string>>(new Set());

  function toggleNotesExpanded(recId: string) {
    setExpandedNotesIds((prev) => {
      const next = new Set(prev);
      if (next.has(recId)) next.delete(recId);
      else next.add(recId);
      return next;
    });
  }

  const reload = useCallback(async () => {
    const [allItems, cats, projects] = await Promise.all([listAllLogItems(), listProjectCategories(), listProjects()]);
    setItems(allItems);
    setCategories(cats);
    setAllProjects(projects);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Categories/projects are managed from ProjectLogCard — pick up changes
  // made there without requiring a page reload.
  useEffect(() => onCategoriesChanged(reload), [reload]);

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

  // Nothing is shown (and export stays disabled) until the user actually
  // narrows things down — an unfiltered "همه" dump isn't what history
  // browsing is for, and the list would otherwise just repeat the full
  // journal below the filter buttons.
  const hasActiveFilter = typeFilter !== null || categoryFilter !== null || projectFilter !== null;
  const filtered = hasActiveFilter
    ? items.filter(
        (it) =>
          (!typeFilter || it.itemType === typeFilter) &&
          (!categoryFilter || it.categoryId === categoryFilter) &&
          (!projectFilter || it.projectId === projectFilter),
      )
    : [];

  const typeLabel = typeFilter ? LOG_TYPES.find((t) => t.id === typeFilter)?.label : null;
  const activeCategory = categoryFilter ? categories.find((c) => c.id === categoryFilter) : null;
  const categoryLabel = activeCategory?.name ?? null;
  const projectLabel = projectFilter ? allProjects.find((p) => p.id === projectFilter)?.name : null;

  function buildExportText(): string {
    const lines: string[] = ['دفترچه‌ی روزانه — خروجی پیشینه'];
    const filterParts = [
      typeLabel && `نوع: ${typeLabel}`,
      categoryLabel && `دسته‌بندی: ${categoryLabel}`,
      projectLabel && `پروژه: ${projectLabel}`,
    ].filter(Boolean);
    lines.push(filterParts.length ? `فیلتر: ${filterParts.join('، ')}` : 'فیلتر: همه');
    lines.push(`تعداد مورد: ${filtered.length}`, '');
    for (const it of filtered) {
      const cat = categories.find((c) => c.id === it.categoryId);
      const proj = allProjects.find((p) => p.id === it.projectId);
      const mark = exportMarkFor(it);
      const tagParts = [cat?.name, proj?.name].filter(Boolean);
      lines.push(
        `[${jalaliLabelForDayKey(it.day)}] ${mark} ${it.text}` + (tagParts.length ? ` — ${tagParts.join(' › ')}` : ''),
      );
      if (it.notes) lines.push(`    توضیحات: ${it.notes}`);
    }
    return lines.join('\n');
  }

  async function onExport() {
    const nameParts = [typeLabel, categoryLabel, projectLabel].filter(Boolean);
    const suffix = nameParts.length ? `-${nameParts.join('-')}` : '';
    await exportTextFile(`پیشینه${suffix}-${dayKey(0)}.txt`, buildExportText());
  }

  return (
    <Collapsible title="پیشینه" storageKey="history">
      <div className="type-select">
        <button className="type-btn" onClick={() => setTypeFilter(null)}>
          همه
        </button>
        {LOG_TYPES.map((t) => (
          <button
            key={t.id}
            className={'type-btn' + (typeFilter === t.id ? ' active' : '')}
            onClick={() => setTypeFilter((f) => (f === t.id ? null : t.id))}
          >
            <t.Icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      <div className="cat-select">
        <button
          className="cat-btn"
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
              style={{ background: activeCategory?.bg ?? 'var(--paper)', color: activeCategory?.color ?? 'var(--ink-soft)' }}
              onClick={() => setProjectFilter((cur) => (cur === p.id ? null : p.id))}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="add-row">
        <button className="link-btn icon-row" onClick={onExport} disabled={!hasActiveFilter} title="خروجی گرفتن از موارد فیلترشده">
          <Download size={14} />
        </button>
        {hasActiveFilter && <span className="pay-sub">{filtered.length} مورد</span>}
      </div>

      {!hasActiveFilter && <div className="empty">یک فیلتر (نوع یا دسته‌بندی) انتخاب کن تا موارد نشون داده بشن.</div>}
      {hasActiveFilter && filtered.length === 0 && <div className="empty">چیزی پیدا نشد.</div>}
      {filtered.map((it) => {
        const t = LOG_TYPES.find((x) => x.id === it.itemType) ?? LOG_TYPES[0];
        const cat = categories.find((c) => c.id === it.categoryId);
        const proj = allProjects.find((p) => p.id === it.projectId);
        const tagLabel = projectFilter ? null : categoryFilter ? (proj?.name ?? null) : (cat?.name ?? null);
        const MarkIcon = it.done && t.DoneIcon ? t.DoneIcon : t.Icon;
        return (
          <div className={'log-item history-row' + (it.priority ? ' priority' : '')} key={it.recId}>
            <span className="log-mark">
              <MarkIcon size={15} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{jalaliLabelForDayKey(it.day)}</div>
              <span className={'log-text' + (it.done ? ' done' : '')}>
                {it.text}
                {tagLabel && (
                  <span
                    className="pill"
                    style={{ background: cat?.bg ?? 'var(--paper)', color: cat?.color ?? 'var(--ink-soft)', marginInlineStart: 6 }}
                  >
                    {tagLabel}
                  </span>
                )}
              </span>
              {it.notes && expandedNotesIds.has(it.recId) && <div className="pay-sub">{it.notes}</div>}
            </div>
            {it.notes && (
              <button
                className={'chevron-btn small' + (expandedNotesIds.has(it.recId) ? '' : ' collapsed')}
                onClick={() => toggleNotesExpanded(it.recId)}
                title="نمایش/پنهان‌کردن توضیحات"
              >
                <ChevronDown size={14} />
              </button>
            )}
          </div>
        );
      })}
    </Collapsible>
  );
}
