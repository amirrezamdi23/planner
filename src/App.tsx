import { useEffect, useState, useCallback } from 'react';
import { dayKey, todayJalaliLabel, todayWeekdayLabel } from './lib/date';
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
  getDailyReview,
  setDailyReview,
  type Habit,
  type LogItem,
} from './repo';

const TODAY = dayKey(0);

const DEFAULT_HABITS: Array<[string, string]> = [
  ['🌙', 'ساعت خواب ثابت'],
  ['💪', 'ورزش / باشگاه'],
  ['📓', 'ژورنال (۲ خط)'],
];

export default function App() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [habitInput, setHabitInput] = useState('');

  const [logItems, setLogItems] = useState<LogItem[]>([]);
  const [logInput, setLogInput] = useState('');

  const [review, setReview] = useState('');
  const [reviewSaved, setReviewSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [h, c, l, r] = await Promise.all([
      listHabits(),
      checkedHabitIds(TODAY),
      listLogItems(TODAY),
      getDailyReview(TODAY),
    ]);
    setHabits(h);
    setChecked(c);
    setLogItems(l);
    setReview(r.text);
  }, []);

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
    await addLogItem(TODAY, logInput);
    setLogInput('');
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

  async function onSaveReview() {
    await setDailyReview(TODAY, review);
    setReviewSaved(true);
    setTimeout(() => setReviewSaved(false), 2000);
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

      <div className="card">
        <h2>عادت‌های امروز</h2>
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
      </div>

      <div className="card">
        <h2>یادداشت سریع امروز</h2>
        {logItems.length === 0 && <div className="empty">چیزی ثبت نشده.</div>}
        {logItems.map((it) => (
          <div className="log-item" key={it.recId}>
            <span className="log-mark" onClick={() => onToggleLog(it.recId)}>
              {it.done ? '✕' : '•'}
            </span>
            <span className={'log-text' + (it.done ? ' done' : '')}>{it.text}</span>
            <button className="habit-del" onClick={() => onDeleteLog(it.recId)} title="حذف">
              ✕
            </button>
          </div>
        ))}
        <div className="add-row">
          <input
            placeholder="چی داری اضافه می‌کنی؟"
            value={logInput}
            onChange={(e) => setLogInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onAddLog()}
          />
          <button onClick={onAddLog}>ثبت</button>
        </div>
      </div>

      <div className="card">
        <h2>مرور روزانه</h2>
        <textarea
          className="review"
          placeholder="امروز چی گذشت؟ (۲-۳ خط کافیه)"
          value={review}
          onChange={(e) => {
            setReview(e.target.value);
            setReviewSaved(false);
          }}
        />
        <div className="add-row">
          <button onClick={onSaveReview}>ثبت</button>
          {reviewSaved && <span className="saved-hint">✓ ذخیره شد</span>}
        </div>
      </div>

      <div className="footnote">
        اطلاعات فقط روی همین دستگاه ذخیره می‌شه. تاریخ‌ها شمسی نمایش داده می‌شن.
      </div>
    </div>
  );
}
