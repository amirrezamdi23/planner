import { useCallback, useEffect, useState } from 'react';
import { Check, Minus, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { LOG_TYPES } from './logTypes';
import {
  dayKey,
  shiftDayKey,
  jalaliTupleForDayKey,
  jalaliDateOnlyLabel,
  daysBetweenDayKeys,
} from './lib/date';
import {
  listUpcomingItems,
  cycleLogStatus,
  listProjectCategories,
  listProjects,
  type UpcomingItem,
  type ProjectCategory,
  type Project,
} from './repo';

const TODAY = dayKey(0);
// How far forward the day-by-day listing runs. Two weeks is as far as a
// personal plan stays believable.
const HORIZON_DAYS = 14;
const WEEKDAY_SHORT_FA = ['۱ش', '۲ش', '۳ش', '۴ش', '۵ش', 'ج', 'ش']; // by Date#getDay()

function weekdayShort(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return WEEKDAY_SHORT_FA[new Date(y, m - 1, d).getDay()];
}
// The Persian week starts شنبه: how many days back from `key` that was.
function startOfWeek(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return shiftDayKey(key, -((new Date(y, m - 1, d).getDay() + 1) % 7));
}
function dayNumber(key: string): number {
  return jalaliTupleForDayKey(key)[2];
}
function dayHeading(key: string): string {
  const delta = daysBetweenDayKeys(TODAY, key);
  const rel = delta === 0 ? 'امروز' : delta === 1 ? 'فردا' : delta === -1 ? 'دیروز' : null;
  return (rel ? `${rel} — ` : '') + jalaliDateOnlyLabel(key);
}

export default function UpcomingCard() {
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [categories, setCategories] = useState<ProjectCategory[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(TODAY));
  const [selected, setSelected] = useState(TODAY);

  const reload = useCallback(async () => {
    const [list, cats, projs] = await Promise.all([listUpcomingItems(), listProjectCategories(), listProjects()]);
    setItems(list);
    setCategories(cats);
    setProjects(projs);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function onToggle(recId: string) {
    await cycleLogStatus(recId);
    await reload();
  }

  const byDay = new Map<string, UpcomingItem[]>();
  for (const it of items) {
    const arr = byDay.get(it.onDay) ?? [];
    arr.push(it);
    byDay.set(it.onDay, arr);
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => shiftDayKey(weekStart, i));
  const overdue = items.filter((it) => it.onDay < TODAY);
  // Only days that actually carry something get a section — an empty run of
  // dates is noise, not information.
  const listedDays = Array.from({ length: HORIZON_DAYS }, (_, i) => shiftDayKey(selected, i)).filter((d) =>
    byDay.has(d),
  );

  function renderRow(it: UpcomingItem) {
    const t = LOG_TYPES.find((x) => x.id === it.itemType) ?? LOG_TYPES[0];
    const cat = categories.find((c) => c.id === it.categoryId);
    const proj = projects.find((p) => p.id === it.projectId);
    return (
      <div className={'log-item' + (it.priority ? ' priority' : '')} key={it.recId}>
        {it.itemType === 'task' ? (
          <button
            className={'log-check' + (it.done ? ' done' : '') + (it.failed ? ' failed' : '')}
            onClick={() => onToggle(it.recId)}
            title="انجام شد"
          >
            {it.done && <Check size={13} />}
            {it.failed && <Minus size={13} />}
          </button>
        ) : (
          <span className="log-mark">
            <t.Icon size={15} />
          </span>
        )}
        <div style={{ flex: 1 }}>
          <span className="log-text">
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
            {it.dueDate && (
              <span className="pill icon-row" style={{ background: 'var(--paper)', color: 'var(--ink-soft)', marginInlineStart: 6 }}>
                <CalendarDays size={11} /> سررسید
              </span>
            )}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Week navigator — RTL, so the right chevron steps backward. */}
      <div className="week-nav">
        <button className="mini-btn" onClick={() => setWeekStart((w) => shiftDayKey(w, -7))} title="هفته‌ی قبل">
          <ChevronRight size={16} />
        </button>
        <span className="week-nav-label">{jalaliDateOnlyLabel(weekStart)}</span>
        <button className="mini-btn" onClick={() => setWeekStart((w) => shiftDayKey(w, 7))} title="هفته‌ی بعد">
          <ChevronLeft size={16} />
        </button>
      </div>
      <div className="week-strip">
        {weekDays.map((d) => (
          <button
            key={d}
            className={
              'week-day' + (d === selected ? ' selected' : '') + (d === TODAY ? ' is-today' : '')
            }
            onClick={() => setSelected(d)}
          >
            <span className="week-day-name">{weekdayShort(d)}</span>
            <span className="week-day-num">{dayNumber(d)}</span>
            <span className={'week-day-dot' + (byDay.has(d) ? ' on' : '')} />
          </button>
        ))}
      </div>

      {selected <= TODAY && overdue.length > 0 && (
        <div className="upcoming-day">
          <div className="upcoming-day-head overdue">عقب‌افتاده ({overdue.length})</div>
          {overdue.map(renderRow)}
        </div>
      )}

      {listedDays.length === 0 && overdue.length === 0 && (
        <div className="empty">برای این بازه چیزی برنامه‌ریزی نشده.</div>
      )}

      {listedDays.map((d) => (
        <div className="upcoming-day" key={d}>
          <div className={'upcoming-day-head' + (d === TODAY ? ' is-today' : '')}>{dayHeading(d)}</div>
          {(byDay.get(d) ?? []).map(renderRow)}
        </div>
      ))}
    </>
  );
}
