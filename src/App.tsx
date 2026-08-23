import { useEffect, useState, useCallback } from 'react';
import { dayKey, shiftDayKey, todayJalaliLabel, todayWeekdayLabel, jalaliLabelForDayKey } from './lib/date';
import { CATEGORIES, categoryInfo } from './categories';
import SyncCard from './SyncCard';
import PaymentsCard from './PaymentsCard';
import ProjectLogCard from './ProjectLogCard';
import Collapsible from './Collapsible';
import {
  listHabits,
  addHabit,
  deleteHabit,
  checkedHabitIds,
  toggleHabitCheck,
  listLogItems,
  addLogItem,
  toggleLogDone,
  deleteLogItem,
  moveLogItem,
  listDailyReviewEntries,
  addDailyReviewEntry,
  deleteDailyReviewEntry,
  type Habit,
  type LogItem,
  type LogItemType,
  type DailyReviewEntry,
} from './repo';

const TODAY = dayKey(0);

const DEFAULT_HABITS: Array<[string, string]> = [
  ['🌙', 'ساعت خواب ثابت'],
  ['💪', 'ورزش / باشگاه'],
  ['📓', 'ژورنال (۲ خط)'],
];

// Symbol + spelled-out label together, always — so the user never has to
// memorize what "•" vs "○" vs "–" means on their own. Tasks use a tickable
// checkbox square rather than a bullet, so "this can be checked off" reads
// at a glance.
const LOG_TYPES: Array<{ id: LogItemType; mark: string; doneMark?: string; label: string }> = [
  { id: 'task', mark: '☐', doneMark: '☑', label: 'کار' },
  { id: 'event', mark: '○', label: 'رویداد' },
  { id: 'note', mark: '–', label: 'یادداشت' },
];

export default function App() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [habitInput, setHabitInput] = useState('');

  const [viewedDay, setViewedDay] = useState(TODAY);
  const [logItems, setLogItems] = useState<LogItem[]>([]);
  const [logInput, setLogInput] = useState('');
  const [logType, setLogType] = useState<LogItemType>('task');
  const [logPriority, setLogPriority] = useState(false);

  const [reviewInput, setReviewInput] = useState('');
  const [reviewCategory, setReviewCategory] = useState('personal');
  const [reviewEntries, setReviewEntries] = useState<DailyReviewEntry[]>([]);
  const [reviewListOpen, setReviewListOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [h, c, l, r] = await Promise.all([
      listHabits(),
      checkedHabitIds(TODAY),
      listLogItems(viewedDay),
      listDailyReviewEntries(),
    ]);
    setHabits(h);
    setChecked(c);
    setLogItems(l);
    setReviewEntries(r);
  }, [viewedDay]);

  useEffect(() => {
    (async () => {
      // Guard with a localStorage flag (not just "habits.length === 0") so
      // React StrictMode's double-invoke in dev can't race and seed twice.
      if (!localStorage.getItem('seeded_default_habits')) {
        localStorage.setItem('seeded_default_habits', '1');
        for (const [icon, name] of DEFAULT_HABITS) {
          await addHabit(name, icon);
        }
      }
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  async function onToggleHabit(id: string) {
    await toggleHabitCheck(id, TODAY);
    await reload();
  }
  async function onAddHabit() {
    if (!habitInput.trim()) return;
    await addHabit(habitInput);
    setHabitInput('');
    await reload();
  }
  async function onDeleteHabit(recId: string) {
    await deleteHabit(recId);
    await reload();
  }

  async function onAddLog() {
    if (!logInput.trim()) return;
    await addLogItem(viewedDay, logInput, logType, logPriority);
    setLogInput('');
    setLogPriority(false);
    await reload();
  }
  async function onToggleLog(recId: string) {
    await toggleLogDone(recId);
    await reload();
  }
  async function onDeleteLog(recId: string) {
    await deleteLogItem(recId);
    await reload();
  }
  async function onMigrateToToday(recId: string) {
    await moveLogItem(recId, TODAY);
    await reload();
  }

  async function onAddReview() {
    if (!reviewInput.trim()) return;
    await addDailyReviewEntry(TODAY, reviewInput, reviewCategory);
    setReviewInput('');
    await reload();
  }
  async function onDeleteReview(recId: string) {
    await deleteDailyReviewEntry(recId);
    await reload();
  }

  if (loading) {
    return (
      <div className="wrap">
        <div className="empty">در حال بارگذاری…</div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <header>
        <div className="title">دفترچه‌ی روزانه</div>
        <div className="subdate">
          {todayWeekdayLabel()} — {todayJalaliLabel()}
        </div>
      </header>

      <Collapsible title="عادت‌های امروز" storageKey="habits">
        {habits.length === 0 && <div className="empty">هنوز عادتی اضافه نکردی.</div>}
        {habits.map((h) => {
          const done = checked.has(h.id);
          return (
            <div className="habit-row" key={h.recId}>
              <button
                className={'habit-check' + (done ? ' done' : '')}
                onClick={() => onToggleHabit(h.id)}
              >
                {done ? '✓' : ''}
              </button>
              <span className="habit-icon">{h.icon}</span>
              <span className="habit-name">{h.name}</span>
              <button className="habit-del" onClick={() => onDeleteHabit(h.recId)} title="حذف">
                ✕
              </button>
            </div>
          );
        })}
        <div className="add-row">
          <input
            placeholder="عادت جدید…"
            value={habitInput}
            onChange={(e) => setHabitInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddHabit()}
          />
          <button onClick={onAddHabit}>افزودن</button>
        </div>
      </Collapsible>

      <Collapsible title="یادداشت سریع" storageKey="quicklog">
        <div className="day-nav">
          <button className="mini-btn" onClick={() => setViewedDay((d) => shiftDayKey(d, -1))} title="روز قبل">
            ◂
          </button>
          <span className="day-nav-label">
            {viewedDay === TODAY ? 'امروز — ' : ''}
            {jalaliLabelForDayKey(viewedDay)}
          </span>
          <button className="mini-btn" onClick={() => setViewedDay((d) => shiftDayKey(d, 1))} title="روز بعد">
            ▸
          </button>
          {viewedDay !== TODAY && (
            <button className="link-btn" onClick={() => setViewedDay(TODAY)}>
              برگشت به امروز
            </button>
          )}
        </div>

        {logItems.length === 0 && <div className="empty">چیزی ثبت نشده.</div>}
        {logItems.map((it) => {
          const t = LOG_TYPES.find((x) => x.id === it.itemType) ?? LOG_TYPES[0];
          const canToggle = it.itemType === 'task';
          return (
            <div className="log-item" key={it.recId}>
              <span
                className={'log-mark' + (canToggle ? ' clickable' : '')}
                onClick={() => canToggle && onToggleLog(it.recId)}
                title={canToggle ? 'برای تیک‌زدن کلیک کن' : undefined}
              >
                {it.done ? (t.doneMark ?? '✕') : t.mark}
              </span>
              <span className={'log-text' + (it.done ? ' done' : '')}>
                {it.priority && <span className="prio-badge" title="اولویت بالا">*</span>}
                {it.text}
              </span>
              {viewedDay !== TODAY && !it.done && (
                <button className="habit-del" onClick={() => onMigrateToToday(it.recId)} title="انتقال به امروز">
                  ⇥
                </button>
              )}
              <button className="habit-del" onClick={() => onDeleteLog(it.recId)} title="حذف">
                ✕
              </button>
            </div>
          );
        })}

        <div className="type-select">
          {LOG_TYPES.map((t) => (
            <button
              key={t.id}
              className={'type-btn' + (logType === t.id ? ' active' : '')}
              onClick={() => setLogType(t.id)}
            >
              {t.mark} {t.label}
            </button>
          ))}
          <button
            className={'type-btn prio' + (logPriority ? ' active' : '')}
            onClick={() => setLogPriority((v) => !v)}
            title="اگه انتخابش کنی، این مورد با علامت * به‌عنوان اولویت بالا مشخص می‌شه"
          >
            * اولویت بالا
          </button>
        </div>

        <div className="add-row">
          <input
            placeholder={
              logType === 'task'
                ? 'چه کاری داری؟'
                : logType === 'event'
                  ? 'چه رویدادی؟'
                  : 'چی می‌خوای یادداشت کنی؟'
            }
            value={logInput}
            onChange={(e) => setLogInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddLog()}
          />
          <button onClick={onAddLog}>ثبت</button>
        </div>
      </Collapsible>

      <Collapsible title="مرور روزانه" storageKey="dailyreview">
        <textarea
          className="review"
          placeholder="امروز چی گذشت؟ (۲-۳ خط کافیه)"
          value={reviewInput}
          onChange={(e) => setReviewInput(e.target.value)}
        />
        <div className="cat-select">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              className={'cat-btn' + (reviewCategory === c.id ? ' active' : '')}
              style={{ background: c.bg, color: c.color }}
              onClick={() => setReviewCategory(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="add-row">
          <button onClick={onAddReview}>ثبت</button>
        </div>

        <button
          className="link-btn chevron-inline"
          style={{ marginTop: 10 }}
          onClick={() => setReviewListOpen((v) => !v)}
        >
          <span className={'chevron-btn small' + (reviewListOpen ? '' : ' collapsed')}>▾</span>
          {reviewListOpen ? 'پنهان کردن لیست مرورها' : `نمایش لیست مرورها (${reviewEntries.length})`}
        </button>

        {reviewListOpen &&
          (reviewEntries.length === 0 ? (
            <div className="empty">هنوز مروری ثبت نشده.</div>
          ) : (
            <div className="proj-history">
              {reviewEntries.map((e) => {
                const cat = categoryInfo(e.category);
                return (
                  <div className="log-item" key={e.recId}>
                    <span className="log-mark">–</span>
                    <div style={{ flex: 1 }}>
                      <div className="review-meta">
                        <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                          {jalaliLabelForDayKey(e.day)}
                        </span>
                        <span className="pill" style={{ background: cat.bg, color: cat.color }}>
                          {cat.name}
                        </span>
                      </div>
                      <span className="log-text">{e.text}</span>
                    </div>
                    <button className="habit-del" onClick={() => onDeleteReview(e.recId)} title="حذف">
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
      </Collapsible>

      <PaymentsCard />

      <ProjectLogCard />

      <SyncCard onSynced={reload} />

      <div className="footnote">
        اطلاعات همین دستگاه ذخیره می‌شه؛ اگه همگام‌سازی رو تنظیم کنی، بین دستگاه‌هات هم به‌روز می‌مونه.
        تاریخ‌ها شمسی نمایش داده می‌شن.
      </div>
    </div>
  );
}
