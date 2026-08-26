import { useEffect, useState, useCallback } from 'react';
import {
  dayKey,
  shiftDayKey,
  todayJalaliLabel,
  todayWeekdayLabel,
  jalaliLabelForDayKey,
  jalaliDateOnlyLabel,
  jalaliTupleForDayKey,
  daysBetweenDayKeys,
} from './lib/date';
import SyncCard from './SyncCard';
import PaymentsCard from './PaymentsCard';
import ProjectLogCard from './ProjectLogCard';
import TimerCard from './TimerCard';
import SleepReportCard from './SleepReportCard';
import Collapsible from './Collapsible';
import JalaliDateInput from './JalaliDateInput';
import {
  listLogItems,
  addLogItem,
  editLogItem,
  toggleLogDone,
  deleteLogItem,
  moveLogItem,
  addNapEntry,
  addNapNone,
  listProjectCategories,
  listProjects,
  listDailyReviewEntries,
  addDailyReviewEntry,
  editDailyReviewEntry,
  deleteDailyReviewEntry,
  type LogItem,
  type LogItemType,
  type DailyReviewEntry,
  type ProjectCategory,
  type Project,
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
  const [logCategoryId, setLogCategoryId] = useState<string | null>(null);
  const [logProjectId, setLogProjectId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [sleepTimeInput, setSleepTimeInput] = useState('');
  const [wakeTimeInput, setWakeTimeInput] = useState('');
  const [napStartInput, setNapStartInput] = useState('');
  const [napDurationInput, setNapDurationInput] = useState('');
  const [prevNapStartInput, setPrevNapStartInput] = useState('');
  const [prevNapDurationInput, setPrevNapDurationInput] = useState('');

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingLogText, setEditingLogText] = useState('');
  const [editingLogType, setEditingLogType] = useState<LogItemType>('task');
  const [editingLogDayKey, setEditingLogDayKey] = useState(TODAY);
  const [editingLogCategoryId, setEditingLogCategoryId] = useState<string | null>(null);
  const [editingLogProjectId, setEditingLogProjectId] = useState<string | null>(null);

  const [projectCategories, setProjectCategories] = useState<ProjectCategory[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [addFormProjects, setAddFormProjects] = useState<Project[]>([]);
  const [editFormProjects, setEditFormProjects] = useState<Project[]>([]);

  const [sleepDataVersion, setSleepDataVersion] = useState(0);

  const [reviewDay, setReviewDay] = useState(TODAY);
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
      const [cats, projects] = await Promise.all([listProjectCategories(), listProjects()]);
      setProjectCategories(cats);
      setAllProjects(projects);
      setLoading(false);
    })();
  }, [reload]);

  useEffect(() => {
    if (!logCategoryId) {
      setAddFormProjects([]);
      return;
    }
    listProjects(logCategoryId).then(setAddFormProjects);
  }, [logCategoryId]);

  useEffect(() => {
    if (!editingLogCategoryId) {
      setEditFormProjects([]);
      return;
    }
    listProjects(editingLogCategoryId).then(setEditFormProjects);
  }, [editingLogCategoryId]);

  function categoryName(id?: string): string | null {
    if (!id) return null;
    return projectCategories.find((c) => c.id === id)?.name ?? null;
  }
  function projectName(id?: string): string | null {
    if (!id) return null;
    return allProjects.find((p) => p.id === id)?.name ?? null;
  }

  function onSelectLogCategory(catId: string) {
    setLogCategoryId((cur) => (cur === catId ? null : catId));
    setLogProjectId(null);
  }
  function onSelectEditCategory(catId: string) {
    setEditingLogCategoryId((cur) => (cur === catId ? null : catId));
    setEditingLogProjectId(null);
  }

  async function onAddLog() {
    if (!logInput.trim()) return;
    await addLogItem(viewedDay, logInput, logType, logPriority, logCategoryId ?? undefined, logProjectId ?? undefined);
    setLogInput('');
    setLogPriority(false);
    await reload();
  }
  async function onToggleLog(recId: string) {
    await toggleLogDone(recId);
    await reload();
  }
  async function onDeleteLog(recId: string) {
    const isNap = logItems.some((it) => it.recId === recId && it.itemType === 'nap');
    await deleteLogItem(recId);
    await reload();
    if (isNap) setSleepDataVersion((v) => v + 1);
  }
  async function onMigrateToToday(recId: string) {
    await moveLogItem(recId, TODAY);
    await reload();
  }
  function onStartEditLog(it: LogItem) {
    setEditingLogId(it.recId);
    setEditingLogText(it.text);
    setEditingLogType(it.itemType);
    setEditingLogDayKey(it.day);
    setEditingLogCategoryId(it.categoryId ?? null);
    setEditingLogProjectId(it.projectId ?? null);
  }
  async function onSaveEditLog() {
    if (!editingLogId) return;
    const original = logItems.find((it) => it.recId === editingLogId);
    await editLogItem(
      editingLogId,
      editingLogText,
      editingLogType,
      editingLogCategoryId ?? undefined,
      editingLogProjectId ?? undefined,
    );
    if (original && original.day !== editingLogDayKey) {
      await moveLogItem(editingLogId, editingLogDayKey);
    }
    setEditingLogId(null);
    await reload();
  }
  function onCancelEditLog() {
    setEditingLogId(null);
  }

  async function onNoNapPrevDay() {
    await addNapNone(prevDay);
    await reload();
    setSleepDataVersion((v) => v + 1);
  }
  async function onLogPrevDayNap() {
    const minutes = parseInt(prevNapDurationInput, 10);
    if (!prevNapStartInput || !minutes || minutes <= 0) return;
    await addNapEntry(prevDay, prevNapStartInput, minutes);
    setPrevNapStartInput('');
    setPrevNapDurationInput('');
    await reload();
    setSleepDataVersion((v) => v + 1);
  }

  async function onLogSleep() {
    if (!sleepTimeInput) return;
    await addLogItem(prevDay, sleepTimeInput, 'sleep', false);
    setSleepTimeInput('');
    await reload();
    setSleepDataVersion((v) => v + 1);
  }
  async function onLogWake() {
    if (!wakeTimeInput) return;
    await addLogItem(viewedDay, wakeTimeInput, 'wake', false);
    setWakeTimeInput('');
    await reload();
    setSleepDataVersion((v) => v + 1);
  }
  async function onAddNap() {
    const minutes = parseInt(napDurationInput, 10);
    if (!napStartInput || !minutes || minutes <= 0) return;
    await addNapEntry(viewedDay, napStartInput, minutes);
    setNapStartInput('');
    setNapDurationInput('');
    await reload();
    setSleepDataVersion((v) => v + 1);
  }

  async function onAddReview() {
    if (!reviewInput.trim()) return;
    await addDailyReviewEntry(reviewDay, reviewInput);
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
  const napResolvedPrevDay = prevDayLogItems.some((it) => it.itemType === 'nap' || it.itemType === 'nap_none');
  const napResolvedViewedDay = logItems.some((it) => it.itemType === 'nap' || it.itemType === 'nap_none');
  const gateStep: 'nap' | 'sleep' | 'wake' | 'unlocked' = !napResolvedPrevDay
    ? 'nap'
    : !sleepEntry
      ? 'sleep'
      : !wakeEntry
        ? 'wake'
        : 'unlocked';
  const dayUnlocked = gateStep === 'unlocked';
  const taskLogItems = logItems.filter(
    (it) => it.itemType !== 'sleep' && it.itemType !== 'wake' && it.itemType !== 'nap' && it.itemType !== 'nap_none',
  );
  const visibleLogItems = categoryFilter
    ? taskLogItems.filter((it) => it.categoryId === categoryFilter)
    : taskLogItems;

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
            {gateStep === 'nap' && (
              <>
                <div className="empty">
                  قبل از ثبت خواب دیشب، اول بگو دیروز ({jalaliDateOnlyLabel(prevDay)}) چرت زدی یا نه.
                </div>
                <div className="add-row">
                  <button onClick={onNoNapPrevDay}>چرت نزدم</button>
                </div>
                <div className="empty" style={{ marginTop: 4 }}>
                  یا اگه زدی، فقط ساعت شروع و مدتش رو بزن:
                </div>
                <div className="add-row">
                  <input type="time" value={prevNapStartInput} onChange={(e) => setPrevNapStartInput(e.target.value)} />
                  <input
                    type="number"
                    min="1"
                    placeholder="مدت (دقیقه)"
                    style={{ maxWidth: 100 }}
                    value={prevNapDurationInput}
                    onChange={(e) => setPrevNapDurationInput(e.target.value)}
                  />
                  <button onClick={onLogPrevDayNap}>ثبت چرت دیروز</button>
                </div>
              </>
            )}
            {gateStep === 'sleep' && (
              <>
                <div className="empty">
                  برای دیدن لیست {jalaliLabelForDayKey(viewedDay)}، اول باید ساعت خوابِ دیشب (شب {jalaliDateOnlyLabel(prevDay)}) رو ثبت کنی.
                </div>
                <div className="add-row">
                  <input type="time" value={sleepTimeInput} onChange={(e) => setSleepTimeInput(e.target.value)} />
                  <button onClick={onLogSleep}>ثبت ساعت خواب</button>
                </div>
              </>
            )}
            {gateStep === 'wake' && (
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

            {!napResolvedViewedDay && (
              <Collapsible title="خواب میان‌روزی" storageKey="nap">
                <div className="add-row">
                  <input type="time" value={napStartInput} onChange={(e) => setNapStartInput(e.target.value)} />
                  <input
                    type="number"
                    min="1"
                    placeholder="مدت (دقیقه)"
                    style={{ maxWidth: 100 }}
                    value={napDurationInput}
                    onChange={(e) => setNapDurationInput(e.target.value)}
                  />
                  <button onClick={onAddNap}>ثبت چرت</button>
                </div>
              </Collapsible>
            )}

            <div className="cat-select">
              <button
                className={'cat-btn' + (categoryFilter === null ? ' active' : '')}
                style={{ background: 'var(--paper)', color: 'var(--ink-soft)' }}
                onClick={() => setCategoryFilter(null)}
              >
                همه
              </button>
              {projectCategories.map((c) => (
                <button
                  key={c.id}
                  className={'cat-btn' + (categoryFilter === c.id ? ' active' : '')}
                  onClick={() => setCategoryFilter((f) => (f === c.id ? null : c.id))}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {visibleLogItems.length === 0 && <div className="empty">چیزی ثبت نشده.</div>}
            {visibleLogItems.map((it) => {
              const t = LOG_TYPES.find((x) => x.id === it.itemType) ?? LOG_TYPES[0];
              const canToggle = it.itemType === 'task';
              const catName = categoryName(it.categoryId);
              const projName = projectName(it.projectId);
              const isEditing = editingLogId === it.recId;

              if (isEditing) {
                return (
                  <div className="log-item" key={it.recId}>
                    <div style={{ flex: 1 }}>
                      <div className="add-row" style={{ marginTop: 0 }}>
                        <input
                          value={editingLogText}
                          onChange={(e) => setEditingLogText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && onSaveEditLog()}
                          autoFocus
                        />
                      </div>
                      <div className="type-select">
                        {LOG_TYPES.map((lt) => (
                          <button
                            key={lt.id}
                            className={'type-btn' + (editingLogType === lt.id ? ' active' : '')}
                            onClick={() => setEditingLogType(lt.id)}
                          >
                            {lt.mark} {lt.label}
                          </button>
                        ))}
                      </div>
                      <div className="add-row">
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>انتقال به تاریخ:</span>
                        <JalaliDateInput
                          value={jalaliTupleForDayKey(editingLogDayKey)}
                          onChange={(_jalali, newDayKey) => setEditingLogDayKey(newDayKey)}
                        />
                      </div>
                      <div className="cat-select">
                        <button
                          className={'cat-btn' + (editingLogCategoryId === null ? ' active' : '')}
                          style={{ background: 'var(--paper)', color: 'var(--ink-soft)' }}
                          onClick={() => {
                            setEditingLogCategoryId(null);
                            setEditingLogProjectId(null);
                          }}
                        >
                          بدون دسته‌بندی
                        </button>
                        {projectCategories.map((c) => (
                          <button
                            key={c.id}
                            className={'cat-btn' + (editingLogCategoryId === c.id ? ' active' : '')}
                            onClick={() => onSelectEditCategory(c.id)}
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                      {editingLogCategoryId && editFormProjects.length > 0 && (
                        <div className="cat-select" style={{ paddingInlineStart: 12 }}>
                          <button
                            className={'cat-btn' + (editingLogProjectId === null ? ' active' : '')}
                            style={{ background: 'var(--paper)', color: 'var(--ink-soft)' }}
                            onClick={() => setEditingLogProjectId(null)}
                          >
                            بدون پروژه
                          </button>
                          {editFormProjects.map((p) => (
                            <button
                              key={p.id}
                              className={'cat-btn' + (editingLogProjectId === p.id ? ' active' : '')}
                              onClick={() => setEditingLogProjectId((cur) => (cur === p.id ? null : p.id))}
                            >
                              {p.name}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="add-row">
                        <button onClick={onSaveEditLog}>ذخیره</button>
                        <button className="link-btn" onClick={onCancelEditLog}>
                          انصراف
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

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
                    {catName && (
                      <span className="pill" style={{ background: 'var(--paper)', color: 'var(--ink-soft)', marginInlineStart: 6 }}>
                        {catName}
                        {projName ? ` › ${projName}` : ''}
                      </span>
                    )}
                  </span>
                  <button className="habit-del" onClick={() => onStartEditLog(it)} title="ویرایش">
                    ✎
                  </button>
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
                className={'cat-btn' + (logCategoryId === null ? ' active' : '')}
                style={{ background: 'var(--paper)', color: 'var(--ink-soft)' }}
                onClick={() => {
                  setLogCategoryId(null);
                  setLogProjectId(null);
                }}
              >
                بدون دسته‌بندی
              </button>
              {projectCategories.map((c) => (
                <button
                  key={c.id}
                  className={'cat-btn' + (logCategoryId === c.id ? ' active' : '')}
                  onClick={() => onSelectLogCategory(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {logCategoryId && addFormProjects.length > 0 && (
              <div className="cat-select" style={{ paddingInlineStart: 12 }}>
                <button
                  className={'cat-btn' + (logProjectId === null ? ' active' : '')}
                  style={{ background: 'var(--paper)', color: 'var(--ink-soft)' }}
                  onClick={() => setLogProjectId(null)}
                >
                  بدون پروژه
                </button>
                {addFormProjects.map((p) => (
                  <button
                    key={p.id}
                    className={'cat-btn' + (logProjectId === p.id ? ' active' : '')}
                    onClick={() => setLogProjectId((cur) => (cur === p.id ? null : p.id))}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}

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
        <div className="day-nav">
          <button className="mini-btn" onClick={() => setReviewDay((d) => shiftDayKey(d, -1))} title="روز قبل">
            ◂
          </button>
          <span className="day-nav-label">
            {reviewDay === TODAY ? 'برای امروز — ' : 'برای '}
            {jalaliLabelForDayKey(reviewDay)}
          </span>
          <button className="mini-btn" onClick={() => setReviewDay((d) => shiftDayKey(d, 1))} title="روز بعد">
            ▸
          </button>
          {reviewDay !== TODAY && (
            <button className="link-btn" onClick={() => setReviewDay(TODAY)}>
              برگشت به امروز
            </button>
          )}
        </div>
        <textarea
          className="review"
          placeholder="چی گذشت؟ (۲-۳ خط کافیه)"
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

      <SleepReportCard refreshSignal={sleepDataVersion} />

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
