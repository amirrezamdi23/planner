import { useEffect, useState, useCallback } from 'react';
import {
  dayKey,
  shiftDayKey,
  todayJalaliLabel,
  todayWeekdayLabel,
  jalaliLabelForDayKey,
  jalaliDateOnlyLabel,
  daysBetweenDayKeys,
} from './lib/date';
import { CATEGORIES, categoryInfo } from './categories';
import SyncCard from './SyncCard';
import PaymentsCard from './PaymentsCard';
import ProjectLogCard from './ProjectLogCard';
import TimerCard from './TimerCard';
import Collapsible from './Collapsible';
import {
  listLogItems,
  addLogItem,
  toggleLogDone,
  deleteLogItem,
  moveLogItem,
  listDailyReviewEntries,
  addDailyReviewEntry,
  editDailyReviewEntry,
  deleteDailyReviewEntry,
  type LogItem,
  type LogItemType,
  type DailyReviewEntry,
} from './repo';

const TODAY = dayKey(0);
const REVIEW_EDIT_WINDOW_DAYS = 7;

// Symbol + spelled-out label together, always — so the user never has to
// memorize what "•" vs "○" vs "–" means on their own. Tasks use a tickable
// checkbox square rather than a bullet, so "this can be checked off" reads
// at a glance.
const LOG_TYPES: Array<{ id: LogItemType; mark: string; doneMark?: string; label: string }> = [
  { id: 'task', mark: '☐', doneMark: '☑', label: 'کار' },
  { id: 'event', mark: '○', label: 'رویداد' },
  { id: 'note', mark: '–', label: 'یادداشت' },
  { id: 'idea', mark: '💡', label: 'ایده' },
];

export default function App() {
  const [viewedDay, setViewedDay] = useState(TODAY);
  const [logItems, setLogItems] = useState<LogItem[]>([]);
  const [prevDayLogItems, setPrevDayLogItems] = useState<LogItem[]>([]);
  const [logInput, setLogInput] = useState('');
  const [logType, setLogType] = useState<LogItemType>('task');
  const [logPriority, setLogPriority] = useState(false);
  const [logTag, setLogTag] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sleepTimeInput, setSleepTimeInput] = useState('');
  const [wakeTimeInput, setWakeTimeInput] = useState('');

  const [reviewInput, setReviewInput] = useState('');
  const [reviewEntries, setReviewEntries] = useState<DailyReviewEntry[]>([]);
  const [reviewListOpen, setReviewListOpen] = useState(true);
  const [reviewEditingId, setReviewEditingId] = useState<string | null>(null);
  const [reviewEditText, setReviewEditText] = useState('');
  const [loading, setLoading] = useState(true);

  const prevDay = shiftDayKey(viewedDay, -1);

  const reload = useCallback(async () => {
    const [l, pl, r] = await Promise.all([
      listLogItems(viewedDay),
      listLogItems(prevDay),
      listDailyReviewEntries(),
    ]);
    setLogItems(l);
    setPrevDayLogItems(pl);
    setReviewEntries(r);
  }, [viewedDay, prevDay]);

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  async function onAddLog() {
    if (!logInput.trim()) return;
    await addLogItem(viewedDay, logInput, logType, logPriority, logTag ?? undefined);
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
  async function onLogSleep() {
    if (!sleepTimeInput) return;
    await addLogItem(prevDay, sleepTimeInput, 'sleep', false);
    setSleepTimeInput('');
    await reload();
  }
  async function onLogWake() {
    if (!wakeTimeInput) return;
    await addLogItem(viewedDay, wakeTimeInput, 'wake', false);
    setWakeTimeInput('');
    await reload();
  }

  async function onAddReview() {
    if (!reviewInput.trim()) return;
    await addDailyReviewEntry(TODAY, reviewInput);
    setReviewInput('');
    await reload();
  }
  async function onDeleteReview(recId: string) {
    await deleteDailyReviewEntry(recId);
    await reload();
  }
  function onStartEditReview(e: DailyReviewEntry) {
    setReviewEditingId(e.recId);
    setReviewEditText(e.text);
  }
  async function onSaveEditReview() {
    if (!reviewEditingId) return;
    await editDailyReviewEntry(reviewEditingId, reviewEditText);
    setReviewEditingId(null);
    setReviewEditText('');
    await reload();
  }

  if (loading) {
    return (
      <div className="wrap">
        <div className="empty">در حال بارگذاری…</div>
      </div>
    );
  }

  const sleepEntry = prevDayLogItems.find((it) => it.itemType === 'sleep');
  const wakeEntry = logItems.find((it) => it.itemType === 'wake');
  const dayUnlocked = !!sleepEntry && !!wakeEntry;
  const taskLogItems = logItems.filter((it) => it.itemType !== 'sleep' && it.itemType !== 'wake');
  const visibleLogItems = tagFilter ? taskLogItems.filter((it) => it.tag === tagFilter) : taskLogItems;

  return (
    <div className="wrap">
      <header>
        <div className="title">دفترچه‌ی روزانه</div>
        <div className="subdate">
          {todayWeekdayLabel()} — {todayJalaliLabel()}
        </div>
      </header>

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

        {!dayUnlocked ? (
          <div className="sleep-gate">
            {!sleepEntry ? (
              <>
                <div className="empty">
                  برای دیدن لیست {jalaliLabelForDayKey(viewedDay)}، اول باید ساعت خوابِ دیشب (شب {jalaliDateOnlyLabel(prevDay)}) رو ثبت کنی.
                </div>
                <div className="add-row">
                  <input type="time" value={sleepTimeInput} onChange={(e) => setSleepTimeInput(e.target.value)} />
                  <button onClick={onLogSleep}>ثبت ساعت خواب</button>
                </div>
              </>
            ) : (
              <>
                <div className="empty">
                  حالا ساعت بیداری {jalaliLabelForDayKey(viewedDay)} رو ثبت کن تا لیست این روز رو ببینی.
                </div>
                <div className="add-row">
                  <input type="time" value={wakeTimeInput} onChange={(e) => setWakeTimeInput(e.target.value)} />
                  <button onClick={onLogWake}>ثبت ساعت بیداری</button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="sleep-summary">
              🌙 {sleepEntry!.text} — ☀️ {wakeEntry!.text}
            </div>

            <div className="cat-select">
              <button
                className={'cat-btn' + (tagFilter === null ? ' active' : '')}
                style={{ background: 'var(--paper)', color: 'var(--ink-soft)' }}
                onClick={() => setTagFilter(null)}
              >
                همه
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className={'cat-btn' + (tagFilter === c.id ? ' active' : '')}
                  style={{ background: c.bg, color: c.color }}
                  onClick={() => setTagFilter((f) => (f === c.id ? null : c.id))}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {visibleLogItems.length === 0 && <div className="empty">چیزی ثبت نشده.</div>}
            {visibleLogItems.map((it) => {
              const t = LOG_TYPES.find((x) => x.id === it.itemType) ?? LOG_TYPES[0];
              const canToggle = it.itemType === 'task';
              const tag = it.tag ? categoryInfo(it.tag) : null;
              return (
                <div className="log-item" key={it.recId}>
                  {canToggle ? (
                    <button
                      className={'log-check' + (it.done ? ' done' : '')}
                      onClick={() => onToggleLog(it.recId)}
                      title="برای تیک‌زدن کلیک کن"
                    >
                      {it.done ? '✓' : ''}
                    </button>
                  ) : (
                    <span className="log-mark">{t.mark}</span>
                  )}
                  <span className={'log-text' + (it.done ? ' done' : '')}>
                    {it.priority && <span className="prio-badge" title="اولویت بالا">*</span>}
                    {it.text}
                    {tag && (
                      <span className="pill" style={{ background: tag.bg, color: tag.color, marginInlineStart: 6 }}>
                        {tag.name}
                      </span>
                    )}
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

            <div className="cat-select">
              <button
                className={'cat-btn' + (logTag === null ? ' active' : '')}
                style={{ background: 'var(--paper)', color: 'var(--ink-soft)' }}
                onClick={() => setLogTag(null)}
              >
                بدون تگ
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className={'cat-btn' + (logTag === c.id ? ' active' : '')}
                  style={{ background: c.bg, color: c.color }}
                  onClick={() => setLogTag((cur) => (cur === c.id ? null : c.id))}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <div className="add-row">
              <input
                placeholder={
                  logType === 'task'
                    ? 'چه کاری داری؟'
                    : logType === 'event'
                      ? 'چه رویدادی؟'
                      : logType === 'idea'
                        ? 'چه ایده‌ای؟'
                        : 'چی می‌خوای یادداشت کنی؟'
                }
                value={logInput}
                onChange={(e) => setLogInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onAddLog()}
              />
              <button onClick={onAddLog}>ثبت</button>
            </div>
          </>
        )}
      </Collapsible>

      <Collapsible title="مرور روزانه" storageKey="dailyreview">
        <textarea
          className="review"
          placeholder="امروز چی گذشت؟ (۲-۳ خط کافیه)"
          value={reviewInput}
          onChange={(e) => setReviewInput(e.target.value)}
        />
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
                const editable = Math.abs(daysBetweenDayKeys(e.day, TODAY)) <= REVIEW_EDIT_WINDOW_DAYS;
                const isEditing = reviewEditingId === e.recId;
                return (
                  <div className="log-item" key={e.recId}>
                    <span className="log-mark">–</span>
                    <div style={{ flex: 1 }}>
                      <div className="review-meta">
                        <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                          {jalaliLabelForDayKey(e.day)}
                        </span>
                      </div>
                      {isEditing ? (
                        <>
                          <textarea
                            className="review"
                            style={{ minHeight: 60 }}
                            value={reviewEditText}
                            onChange={(ev) => setReviewEditText(ev.target.value)}
                          />
                          <div className="add-row">
                            <button onClick={onSaveEditReview}>ذخیره</button>
                            <button className="link-btn" onClick={() => setReviewEditingId(null)}>
                              انصراف
                            </button>
                          </div>
                        </>
                      ) : (
                        <span className="log-text">{e.text}</span>
                      )}
                    </div>
                    {!isEditing && editable && (
                      <button className="habit-del" onClick={() => onStartEditReview(e)} title="ویرایش">
                        ✎
                      </button>
                    )}
                    <button className="habit-del" onClick={() => onDeleteReview(e.recId)} title="حذف">
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
      </Collapsible>

      <TimerCard />

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
