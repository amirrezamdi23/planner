import { Fragment, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, Moon, Sun, FileText, CalendarDays, Pencil, Redo2, X, Check,
  Minus, MessageSquare, ListPlus, ArrowRight, History, NotebookPen, Timer, AlarmClock, Music, Wallet,
  FolderKanban, RefreshCw, Database, type LucideIcon,
} from 'lucide-react';
import { LOG_TYPES } from './logTypes';
import { MOOD_OPTIONS } from './moodOptions';
import {
  dayKey,
  shiftDayKey,
  todayJalaliLabel,
  todayWeekdayLabel,
  jalaliLabelForDayKey,
  jalaliDateOnlyLabel,
  jalaliTupleForDayKey,
  daysBetweenDayKeys,
  todayJalali,
} from './lib/date';
import Switch from './Switch';
import SyncCard from './SyncCard';
import BackupCard from './BackupCard';
import BottomNav, { type NavTab } from './BottomNav';
import DailyReviewCard from './DailyReviewCard';
import PaymentsCard from './PaymentsCard';
import ProjectLogCard from './ProjectLogCard';
import TimerCard from './TimerCard';
import AlarmCard from './AlarmCard';
import MusicCard from './MusicCard';
import SleepReportCard from './SleepReportCard';
import HistoryCard from './HistoryCard';
import Collapsible, { BareCardContext } from './Collapsible';
import JalaliDateInput from './JalaliDateInput';
import {
  listLogItems,
  addLogItem,
  editLogItem,
  cycleLogStatus,
  togglePriority,
  deleteLogItem,
  moveLogItem,
  addNapEntry,
  addNapNone,
  listPendingWithDueDate,
  setLogComment,
  addSubtask,
  listProjectCategories,
  listProjects,
  onCategoriesChanged,
  type LogItem,
  type LogItemType,
  type ProjectCategory,
  type Project,
} from './repo';

const TODAY = dayKey(0);

export default function App() {
  const [tab, setTab] = useState<NavTab>('today');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [viewedDay, setViewedDay] = useState(TODAY);
  const [logItems, setLogItems] = useState<LogItem[]>([]);
  const [prevDayLogItems, setPrevDayLogItems] = useState<LogItem[]>([]);
  const [logInput, setLogInput] = useState('');
  const [logType, setLogType] = useState<LogItemType | null>(null);
  const [logPriorityPending, setLogPriorityPending] = useState(false);
  const [holdingPriorityBtn, setHoldingPriorityBtn] = useState(false);
  const [logCategoryId, setLogCategoryId] = useState<string | null>(null);
  const [logProjectId, setLogProjectId] = useState<string | null>(null);
  const [logPhaseId, setLogPhaseId] = useState<string | null>(null);
  const [logHasNotes, setLogHasNotes] = useState(false);
  const [logNotesInput, setLogNotesInput] = useState('');
  const [logHasDueDate, setLogHasDueDate] = useState(false);
  const [logDueDateJalali, setLogDueDateJalali] = useState<[number, number, number]>(todayJalali());
  const [logDueDateKey, setLogDueDateKey] = useState(TODAY);
  const [sleepTimeInput, setSleepTimeInput] = useState('');
  const [wakeTimeInput, setWakeTimeInput] = useState('');
  const [napStartInput, setNapStartInput] = useState('');
  const [napDurationInput, setNapDurationInput] = useState('');
  const [prevNapStartInput, setPrevNapStartInput] = useState('');
  const [prevNapDurationInput, setPrevNapDurationInput] = useState('');
  const [napFormOpen, setNapFormOpen] = useState(false);
  const [napHasStart, setNapHasStart] = useState(false);
  const [prevNapFormOpen, setPrevNapFormOpen] = useState(false);
  const [prevNapHasStart, setPrevNapHasStart] = useState(false);

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingLogText, setEditingLogText] = useState('');
  const [editingLogType, setEditingLogType] = useState<LogItemType>('task');
  const [editingLogDayKey, setEditingLogDayKey] = useState(TODAY);
  const [editingLogCategoryId, setEditingLogCategoryId] = useState<string | null>(null);
  const [editingLogProjectId, setEditingLogProjectId] = useState<string | null>(null);
  const [editingLogPhaseId, setEditingLogPhaseId] = useState<string | null>(null);
  const [editingLogHasNotes, setEditingLogHasNotes] = useState(false);
  const [editingLogNotesInput, setEditingLogNotesInput] = useState('');
  const [editingLogHasDueDate, setEditingLogHasDueDate] = useState(false);
  const [editingLogDueDateJalali, setEditingLogDueDateJalali] = useState<[number, number, number]>(todayJalali());
  const [editingLogDueDateKey, setEditingLogDueDateKey] = useState(TODAY);

  const [projectCategories, setProjectCategories] = useState<ProjectCategory[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [addFormProjects, setAddFormProjects] = useState<Project[]>([]);
  const [editFormProjects, setEditFormProjects] = useState<Project[]>([]);
  const [pendingWithDueDate, setPendingWithDueDate] = useState<LogItem[]>([]);
  const [expandedNotesIds, setExpandedNotesIds] = useState<Set<string>>(new Set());
  const [commentOpenId, setCommentOpenId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentEditing, setCommentEditing] = useState(false);
  const [subtaskOpenId, setSubtaskOpenId] = useState<string | null>(null);
  const [subtaskDraft, setSubtaskDraft] = useState('');

  const [sleepDataVersion, setSleepDataVersion] = useState(0);

  const [loading, setLoading] = useState(true);

  const prevDay = shiftDayKey(viewedDay, -1);

  const reload = useCallback(async () => {
    const [l, pl, pending] = await Promise.all([
      listLogItems(viewedDay),
      listLogItems(prevDay),
      listPendingWithDueDate(),
    ]);
    setLogItems(l);
    setPrevDayLogItems(pl);
    setPendingWithDueDate(pending);
  }, [viewedDay, prevDay]);

  const reloadCategories = useCallback(async () => {
    const [cats, projects] = await Promise.all([listProjectCategories(), listProjects()]);
    setProjectCategories(cats);
    setAllProjects(projects);
  }, []);

  useEffect(() => {
    (async () => {
      await reload();
      await reloadCategories();
      setLoading(false);
    })();
  }, [reload, reloadCategories]);

  // Categories/projects are managed from ProjectLogCard — pick up changes
  // made there without requiring a page reload.
  useEffect(() => onCategoriesChanged(reloadCategories), [reloadCategories]);

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

  function categoryOf(id?: string): ProjectCategory | null {
    if (!id) return null;
    return projectCategories.find((c) => c.id === id) ?? null;
  }
  function projectName(id?: string): string | null {
    if (!id) return null;
    return allProjects.find((p) => p.id === id)?.name ?? null;
  }
  function phasesOf(projectId?: string | null) {
    if (!projectId) return [];
    return allProjects.find((p) => p.id === projectId)?.phases ?? [];
  }
  function phaseName(projectId?: string, phaseId?: string): string | null {
    if (!phaseId) return null;
    return phasesOf(projectId).find((ph) => ph.id === phaseId)?.name ?? null;
  }

  function onSelectLogCategory(catId: string) {
    setLogCategoryId((cur) => (cur === catId ? null : catId));
    setLogProjectId(null);
    setLogPhaseId(null);
  }
  function toggleNotesExpanded(recId: string) {
    setExpandedNotesIds((prev) => {
      const next = new Set(prev);
      if (next.has(recId)) next.delete(recId);
      else next.add(recId);
      return next;
    });
  }
  function onSelectEditCategory(catId: string) {
    setEditingLogCategoryId((cur) => (cur === catId ? null : catId));
    setEditingLogProjectId(null);
    setEditingLogPhaseId(null);
  }

  async function onAddLog() {
    if (!logInput.trim() || !logType) return;
    await addLogItem({
      day: viewedDay,
      text: logInput,
      itemType: logType,
      priority: logPriorityPending,
      categoryId: logCategoryId ?? undefined,
      projectId: logProjectId ?? undefined,
      phaseId: logPhaseId ?? undefined,
      notes: logHasNotes ? logNotesInput.trim() || undefined : undefined,
      dueDate: logHasDueDate ? logDueDateKey : undefined,
    });
    setLogInput('');
    setLogPriorityPending(false);
    setLogHasNotes(false);
    setLogNotesInput('');
    setLogHasDueDate(false);
    setLogDueDateJalali(todayJalali());
    setLogDueDateKey(TODAY);
    await reload();
  }

  // Setting priority before a task even exists: hold the "کار" type tag for
  // ~600ms and it gradually turns red (see .type-btn.holding-priority CSS);
  // releasing past that threshold commits logPriorityPending, which is what
  // onAddLog actually saves. A quick tap still just switches the type.
  const addPriorityTimerRef = useRef<number | null>(null);
  const addPriorityFiredRef = useRef(false);
  function onTypeBtnPointerDown(typeId: LogItemType) {
    if (typeId !== 'task') return;
    addPriorityFiredRef.current = false;
    setHoldingPriorityBtn(true);
    addPriorityTimerRef.current = window.setTimeout(() => {
      addPriorityFiredRef.current = true;
      setHoldingPriorityBtn(false);
      setLogPriorityPending((v) => !v);
    }, 600);
  }
  function onTypeBtnPointerUp() {
    setHoldingPriorityBtn(false);
    if (addPriorityTimerRef.current !== null) {
      clearTimeout(addPriorityTimerRef.current);
      addPriorityTimerRef.current = null;
    }
  }
  function onTypeBtnClick(typeId: LogItemType) {
    if (addPriorityFiredRef.current) {
      addPriorityFiredRef.current = false;
      return;
    }
    setLogType(typeId);
  }
  async function onToggleLog(recId: string) {
    await cycleLogStatus(recId);
    await reload();
  }

  // Priority has no separate control — hold a row's mark for ~600ms instead.
  // longPressFiredRef suppresses the click that follows the pointerup so a
  // long-press doesn't also toggle the task done.
  const longPressTimerRef = useRef<number | null>(null);
  const longPressFiredRef = useRef(false);
  function onMarkPointerDown(recId: string) {
    longPressFiredRef.current = false;
    longPressTimerRef.current = window.setTimeout(async () => {
      longPressFiredRef.current = true;
      await togglePriority(recId);
      await reload();
    }, 600);
  }
  function onMarkPointerUp() {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }
  function onMarkClick(e: { preventDefault: () => void }, then: () => void) {
    if (longPressFiredRef.current) {
      e.preventDefault();
      return;
    }
    then();
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
  function onToggleCommentBox(it: LogItem) {
    setCommentOpenId((cur) => {
      if (cur === it.recId) return null;
      setCommentDraft(it.comment ?? '');
      setCommentEditing(!it.comment);
      return it.recId;
    });
  }
  function onStartEditComment(it: LogItem) {
    setCommentDraft(it.comment ?? '');
    setCommentEditing(true);
  }
  async function onSaveComment(recId: string) {
    await setLogComment(recId, commentDraft.trim());
    setCommentEditing(false);
    await reload();
  }
  function onToggleSubtaskBox(recId: string) {
    setSubtaskDraft('');
    setSubtaskOpenId((cur) => (cur === recId ? null : recId));
  }
  async function onAddSubtask(parentRecId: string) {
    if (!subtaskDraft.trim()) return;
    await addSubtask(parentRecId, subtaskDraft);
    setSubtaskDraft(''); // stay open — adding several in a row is the common case
    await reload();
  }
  function onStartEditLog(it: LogItem) {
    setEditingLogId(it.recId);
    setEditingLogText(it.text);
    setEditingLogType(it.itemType);
    setEditingLogDayKey(it.day);
    setEditingLogCategoryId(it.categoryId ?? null);
    setEditingLogProjectId(it.projectId ?? null);
    setEditingLogPhaseId(it.phaseId ?? null);
    setEditingLogHasNotes(!!it.notes);
    setEditingLogNotesInput(it.notes ?? '');
    setEditingLogHasDueDate(!!it.dueDate);
    setEditingLogDueDateJalali(it.dueDate ? jalaliTupleForDayKey(it.dueDate) : todayJalali());
    setEditingLogDueDateKey(it.dueDate ?? TODAY);
  }
  async function onSaveEditLog() {
    if (!editingLogId) return;
    const allKnown = [...logItems, ...prevDayLogItems, ...pendingWithDueDate];
    const original = allKnown.find((it) => it.recId === editingLogId);
    await editLogItem({
      recId: editingLogId,
      text: editingLogText,
      itemType: editingLogType,
      categoryId: editingLogCategoryId ?? undefined,
      projectId: editingLogProjectId ?? undefined,
      phaseId: editingLogPhaseId ?? undefined,
      notes: editingLogHasNotes ? editingLogNotesInput.trim() || undefined : undefined,
      dueDate: editingLogHasDueDate ? editingLogDueDateKey : undefined,
    });
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
    if (!minutes || minutes <= 0) return;
    await addNapEntry(prevDay, minutes, prevNapHasStart ? prevNapStartInput || undefined : undefined);
    setPrevNapStartInput('');
    setPrevNapDurationInput('');
    setPrevNapHasStart(false);
    setPrevNapFormOpen(false);
    await reload();
    setSleepDataVersion((v) => v + 1);
  }

  async function onLogSleep() {
    if (!sleepTimeInput) return;
    await addLogItem({ day: prevDay, text: sleepTimeInput, itemType: 'sleep', priority: false });
    setSleepTimeInput('');
    await reload();
    setSleepDataVersion((v) => v + 1);
  }
  async function onLogWake() {
    if (!wakeTimeInput) return;
    await addLogItem({ day: viewedDay, text: wakeTimeInput, itemType: 'wake', priority: false });
    setWakeTimeInput('');
    await reload();
    setSleepDataVersion((v) => v + 1);
  }
  async function onAddNap() {
    const minutes = parseInt(napDurationInput, 10);
    if (!minutes || minutes <= 0) return;
    await addNapEntry(viewedDay, minutes, napHasStart ? napStartInput || undefined : undefined);
    setNapStartInput('');
    setNapDurationInput('');
    setNapHasStart(false);
    setNapFormOpen(false);
    await reload();
    setSleepDataVersion((v) => v + 1);
  }
  async function onNoNapViewedDay() {
    await addNapNone(viewedDay);
    await reload();
    setSleepDataVersion((v) => v + 1);
  }

  // Morning mood — one entry per day, same "log it once at the start of the
  // day" spot as sleep/wake, but re-tappable if the user changes their mind.
  async function onSetMood(moodId: string) {
    const existing = logItems.find((it) => it.itemType === 'mood');
    if (existing) await deleteLogItem(existing.recId);
    await addLogItem({ day: viewedDay, text: moodId, itemType: 'mood', priority: false });
    await reload();
    setSleepDataVersion((v) => v + 1);
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
  const moodEntry = logItems.find((it) => it.itemType === 'mood');
  const napResolvedPrevDay = prevDayLogItems.some((it) => it.itemType === 'nap' || it.itemType === 'nap_none');
  const napResolvedViewedDay = logItems.some((it) => it.itemType === 'nap' || it.itemType === 'nap_none');
  const isTodayView = viewedDay === TODAY;
  // The morning-mood check gates the list the same way sleep/wake do, but
  // only kicks in from 8am onward on today's page — no point demanding a
  // "how do you feel this morning" answer before the morning has started,
  // or retroactively on a past day being reviewed.
  const moodDue = isTodayView && new Date().getHours() >= 8 && !moodEntry;
  // The whole nap/sleep/wake/mood gate only starts demanding anything from
  // 6am onward on today's page — right after midnight the "new day" has
  // technically started but the person is still awake from the previous
  // one, so nagging them to log last night's sleep the instant the date
  // rolls over is backwards. A past day being reviewed is always gated.
  const gateActive = !isTodayView || new Date().getHours() >= 6;
  const gateStep: 'nap' | 'sleep' | 'wake' | 'mood' | 'unlocked' = !gateActive
    ? 'unlocked'
    : !napResolvedPrevDay
      ? 'nap'
      : !sleepEntry
        ? 'sleep'
        : !wakeEntry
          ? 'wake'
          : moodDue
            ? 'mood'
            : 'unlocked';
  const dayUnlocked = gateStep === 'unlocked';
  const taskLogItems = logItems.filter(
    (it) =>
      it.itemType !== 'sleep' &&
      it.itemType !== 'wake' &&
      it.itemType !== 'nap' &&
      it.itemType !== 'nap_none' &&
      it.itemType !== 'mood',
  );
  // A due-dated item starts surfacing as a reminder 10 days out (yellow),
  // turns urgent inside the last 3 days (red), and once its due date has
  // fully passed it keeps reappearing — pinned, still red — on every day
  // after, until it's checked off.
  function dueStatusFor(it: LogItem): 'yellow' | 'red' | null {
    if (!it.dueDate || it.done || it.failed) return null;
    const daysUntil = daysBetweenDayKeys(viewedDay, it.dueDate);
    if (daysUntil <= 3) return 'red';
    if (daysUntil <= 10) return 'yellow';
    return null;
  }
  const reminderItems = pendingWithDueDate.filter(
    (it) => it.day !== viewedDay && !it.parentId && dueStatusFor(it) !== null,
  );
  // Subtasks never stand on their own in the list — they're pulled out here and
  // re-inserted directly under whichever task they belong to.
  const subtasksByParent = new Map<string, LogItem[]>();
  for (const it of taskLogItems) {
    if (!it.parentId) continue;
    const siblings = subtasksByParent.get(it.parentId) ?? [];
    siblings.push(it);
    subtasksByParent.set(it.parentId, siblings);
  }
  // Priority is set by long-pressing a row (see onMarkPointerDown below), not
  // at creation time — sort those to the top instead of a separate control.
  const sortedTaskLogItems = taskLogItems
    .filter((it) => !it.parentId)
    .sort((a, b) => (a.priority === b.priority ? 0 : a.priority ? -1 : 1));
  const renderedItems = [...reminderItems, ...sortedTaskLogItems].flatMap((it) => [
    it,
    ...(subtasksByParent.get(it.recId) ?? []),
  ]);

  // Everything except the quick log lives behind the "مرور" tab, one row per
  // card, each opening as its own page.
  const BROWSE_CARDS: { id: string; title: string; Icon: LucideIcon; node: ReactNode }[] = [
    { id: 'history', title: 'پیشینه', Icon: History, node: <HistoryCard /> },
    { id: 'dailyreview', title: 'مرور روزانه', Icon: NotebookPen, node: <DailyReviewCard /> },
    { id: 'sleep', title: 'گزارش خواب', Icon: Moon, node: <SleepReportCard refreshSignal={sleepDataVersion} /> },
    { id: 'timer', title: 'تایمر چندمرحله‌ای', Icon: Timer, node: <TimerCard /> },
    { id: 'alarm', title: 'آلارم', Icon: AlarmClock, node: <AlarmCard /> },
    { id: 'music', title: 'پخش موسیقی', Icon: Music, node: <MusicCard /> },
    { id: 'payments', title: 'پرداخت‌ها', Icon: Wallet, node: <PaymentsCard /> },
    { id: 'projects', title: 'دسته‌بندی', Icon: FolderKanban, node: <ProjectLogCard /> },
    { id: 'sync', title: 'همگام‌سازی بین دستگاه‌ها', Icon: RefreshCw, node: <SyncCard onSynced={reload} /> },
    { id: 'backup', title: 'خروجی و ورودی کامل داده‌ها', Icon: Database, node: <BackupCard onImported={reload} /> },
  ];

  function onSelectTab(next: NavTab) {
    setTab(next);
    setOpenCardId(null);
    window.scrollTo(0, 0);
  }
  function openCardPage(id: string) {
    setOpenCardId(id);
    window.scrollTo(0, 0);
  }

  const openCard = openCardId ? BROWSE_CARDS.find((c) => c.id === openCardId) ?? null : null;

  // A card's own page: header + the card itself, and no bottom nav — the back
  // arrow is the only way out, so the page reads as a place you went into.
  if (openCard) {
    return (
      <div className="wrap page no-nav">
        <div className="page-head">
          <button className="page-back" onClick={() => setOpenCardId(null)} aria-label="بازگشت">
            <ArrowRight size={22} />
          </button>
          <h1 className="page-title">{openCard.title}</h1>
        </div>
        <BareCardContext.Provider value={true}>{openCard.node}</BareCardContext.Provider>
      </div>
    );
  }

  if (tab !== 'today') {
    return (
      <>
        <div className="wrap page">
          <div className="page-head">
            <h1 className="page-title">مرور</h1>
          </div>
          <div className="browse-list">
            {BROWSE_CARDS.map((c) => (
              <button key={c.id} className="browse-row" onClick={() => openCardPage(c.id)}>
                <span className="browse-row-icon">
                  <c.Icon size={22} />
                </span>
                <span className="browse-row-label">{c.title}</span>
              </button>
            ))}
          </div>
        </div>
        <BottomNav active={tab} onSelect={onSelectTab} />
      </>
    );
  }

  return (
    <>
    <div className="wrap">
      <header>
        <div className="title">دفترچه‌ی روزانه</div>
        <div className="subdate">
          {todayWeekdayLabel()} — {todayJalaliLabel()}
        </div>
      </header>

      <div id="section-today" />
      <Collapsible title="یادداشت سریع" storageKey="quicklog">
        <div className="day-nav">
          <button className="mini-btn" onClick={() => setViewedDay((d) => shiftDayKey(d, -1))} title="روز قبل">
            <ChevronRight size={16} />
          </button>
          <span className="day-nav-label">
            {viewedDay === TODAY ? 'امروز — ' : ''}
            {jalaliLabelForDayKey(viewedDay)}
          </span>
          <button className="mini-btn" onClick={() => setViewedDay((d) => shiftDayKey(d, 1))} title="روز بعد">
            <ChevronLeft size={16} />
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
                {!prevNapFormOpen ? (
                  <div className="add-row">
                    <button onClick={() => setPrevNapFormOpen(true)}>ثبت</button>
                    <button className="link-btn" onClick={onNoNapPrevDay}>
                      چرت نزدم
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="add-row">
                      <input
                        type="number"
                        min="1"
                        placeholder="مدت (دقیقه)"
                        style={{ maxWidth: 100 }}
                        value={prevNapDurationInput}
                        onChange={(e) => setPrevNapDurationInput(e.target.value)}
                      />
                      <button onClick={onLogPrevDayNap} disabled={!prevNapDurationInput}>
                        ثبت چرت دیروز
                      </button>
                    </div>
                    <div className="add-row" style={{ alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>زمان شروع</span>
                      <Switch checked={prevNapHasStart} onChange={setPrevNapHasStart} />
                      {prevNapHasStart && (
                        <input type="time" value={prevNapStartInput} onChange={(e) => setPrevNapStartInput(e.target.value)} />
                      )}
                    </div>
                  </>
                )}
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
            {gateStep === 'mood' && (
              <>
                <div className="empty">قبل از دیدن لیست امروز، مودت رو برای صبح ثبت کن.</div>
                <div className="mood-row">
                  {MOOD_OPTIONS.map((m) => (
                    <button
                      key={m.id}
                      className="mood-btn"
                      style={{ background: m.bg, color: m.color, borderColor: m.color }}
                      onClick={() => onSetMood(m.id)}
                      title={m.label}
                    >
                      <m.Icon size={17} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {sleepEntry && wakeEntry && (
              <div className="sleep-summary icon-row">
                <Moon size={14} /> {sleepEntry.text} — <Sun size={14} /> {wakeEntry.text}
              </div>
            )}

            {!napResolvedViewedDay && (
              <Collapsible title="خواب میان‌روزی" storageKey="nap">
                {!napFormOpen ? (
                  <div className="add-row">
                    <button onClick={() => setNapFormOpen(true)}>ثبت</button>
                    <button className="link-btn" onClick={onNoNapViewedDay}>
                      چرت نزدم
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="add-row">
                      <input
                        type="number"
                        min="1"
                        placeholder="مدت (دقیقه)"
                        style={{ maxWidth: 100 }}
                        value={napDurationInput}
                        onChange={(e) => setNapDurationInput(e.target.value)}
                      />
                      <button onClick={onAddNap} disabled={!napDurationInput}>
                        ثبت چرت
                      </button>
                    </div>
                    <div className="add-row" style={{ alignItems: 'center' }}>
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>زمان شروع</span>
                      <Switch checked={napHasStart} onChange={setNapHasStart} />
                      {napHasStart && (
                        <input type="time" value={napStartInput} onChange={(e) => setNapStartInput(e.target.value)} />
                      )}
                    </div>
                  </>
                )}
              </Collapsible>
            )}

            {reminderItems.length === 0 && taskLogItems.length === 0 && (
              <div className="empty">چیزی ثبت نشده.</div>
            )}
            {renderedItems.map((it) => {
              const t = LOG_TYPES.find((x) => x.id === it.itemType) ?? LOG_TYPES[0];
              const canToggle = it.itemType === 'task';
              const isSub = !!it.parentId;
              const catObj = categoryOf(it.categoryId);
              const catName = catObj?.name ?? null;
              const projName = projectName(it.projectId);
              const phName = phaseName(it.projectId, it.phaseId);
              const subs = subtasksByParent.get(it.recId) ?? [];
              const isEditing = editingLogId === it.recId;
              const dueStatus = dueStatusFor(it);
              const dueDaysLeft = it.dueDate ? daysBetweenDayKeys(viewedDay, it.dueDate) : null;
              const rowClass =
                'log-item' +
                (isSub ? ' sub-item' : '') +
                (it.priority ? ' priority' : '') +
                (dueStatus === 'red' ? ' due-urgent' : dueStatus === 'yellow' ? ' due-soon' : '');

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
                            <lt.Icon size={13} /> {lt.label}
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
                      {editingLogType && (
                        <>
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
                                style={{ background: c.bg ?? 'var(--paper)', color: c.color ?? 'var(--ink-soft)' }}
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
                                  style={{
                                    background: categoryOf(editingLogCategoryId ?? undefined)?.bg ?? 'var(--paper)',
                                    color: categoryOf(editingLogCategoryId ?? undefined)?.color ?? 'var(--ink-soft)',
                                  }}
                                  onClick={() => {
                                    setEditingLogProjectId((cur) => (cur === p.id ? null : p.id));
                                    setEditingLogPhaseId(null);
                                  }}
                                >
                                  {p.name}
                                </button>
                              ))}
                            </div>
                          )}
                          {phasesOf(editingLogProjectId).length > 0 && (
                            <div className="cat-select" style={{ paddingInlineStart: 24 }}>
                              <button
                                className={'cat-btn' + (editingLogPhaseId === null ? ' active' : '')}
                                style={{ background: 'var(--paper)', color: 'var(--ink-soft)' }}
                                onClick={() => setEditingLogPhaseId(null)}
                              >
                                بدون فاز
                              </button>
                              {phasesOf(editingLogProjectId).map((ph) => (
                                <button
                                  key={ph.id}
                                  className={'cat-btn' + (editingLogPhaseId === ph.id ? ' active' : '')}
                                  style={{
                                    background: categoryOf(editingLogCategoryId ?? undefined)?.bg ?? 'var(--paper)',
                                    color: categoryOf(editingLogCategoryId ?? undefined)?.color ?? 'var(--ink-soft)',
                                  }}
                                  onClick={() => setEditingLogPhaseId((cur) => (cur === ph.id ? null : ph.id))}
                                >
                                  {ph.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      <div className="type-select">
                        <button
                          className={'type-btn' + (editingLogHasNotes ? ' active' : '')}
                          onClick={() => setEditingLogHasNotes((v) => !v)}
                        >
                          <FileText size={13} /> توضیحات
                        </button>
                        <button
                          className={'type-btn' + (editingLogHasDueDate ? ' active' : '')}
                          onClick={() => setEditingLogHasDueDate((v) => !v)}
                        >
                          <CalendarDays size={13} /> سررسید
                        </button>
                      </div>
                      {editingLogHasNotes && (
                        <div className="add-row">
                          <textarea
                            className="review"
                            style={{ minHeight: 50 }}
                            placeholder="توضیحات تکمیلی…"
                            value={editingLogNotesInput}
                            onChange={(e) => setEditingLogNotesInput(e.target.value)}
                          />
                        </div>
                      )}
                      {editingLogHasDueDate && (
                        <div className="add-row">
                          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>سررسید:</span>
                          <JalaliDateInput
                            value={editingLogDueDateJalali}
                            onChange={(jalali, dk) => {
                              setEditingLogDueDateJalali(jalali);
                              setEditingLogDueDateKey(dk);
                            }}
                          />
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
                <Fragment key={it.recId}>
                <div className={rowClass}>
                  {canToggle ? (
                    <button
                      className={'log-check' + (it.done ? ' done' : '') + (it.failed ? ' failed' : '')}
                      onPointerDown={() => onMarkPointerDown(it.recId)}
                      onPointerUp={onMarkPointerUp}
                      onPointerLeave={onMarkPointerUp}
                      onClick={(e) => onMarkClick(e, () => onToggleLog(it.recId))}
                      title="یک بار برای تیک، دوباره برای علامت نشدنی؛ برای اولویت بالا نگه‌دار"
                    >
                      {it.done && <Check size={13} />}
                      {it.failed && <Minus size={13} />}
                    </button>
                  ) : (
                    <span
                      className="log-mark clickable"
                      onPointerDown={() => onMarkPointerDown(it.recId)}
                      onPointerUp={onMarkPointerUp}
                      onPointerLeave={onMarkPointerUp}
                      title="برای اولویت بالا نگه‌دار"
                    >
                      <t.Icon size={15} />
                    </span>
                  )}
                  <div style={{ flex: 1 }}>
                    <span className={'log-text' + (it.done ? ' done' : '') + (it.failed ? ' failed' : '')}>
                      {it.text}
                      {!isSub && catName && (
                        <span
                          className="pill"
                          style={{ background: catObj?.bg ?? 'var(--paper)', color: catObj?.color ?? 'var(--ink-soft)', marginInlineStart: 6 }}
                        >
                          {catName}
                          {projName ? ` › ${projName}` : ''}
                          {phName ? ` › ${phName}` : ''}
                        </span>
                      )}
                      {subs.length > 0 && (
                        <span className="pill" style={{ background: 'var(--paper)', color: 'var(--ink-soft)', marginInlineStart: 6 }}>
                          {subs.filter((s) => s.done).length}/{subs.length}
                        </span>
                      )}
                      {it.dueDate && (
                        <span className="pill icon-row" style={{ background: 'var(--paper)', color: 'var(--ink-soft)', marginInlineStart: 6 }}>
                          <CalendarDays size={11} /> {jalaliDateOnlyLabel(it.dueDate)}
                          {dueDaysLeft !== null &&
                            (dueDaysLeft < 0 ? ` — ${Math.abs(dueDaysLeft)} روز گذشته` : ` — ${dueDaysLeft} روز مانده`)}
                        </span>
                      )}
                    </span>
                    {it.notes && expandedNotesIds.has(it.recId) && <div className="pay-sub">{it.notes}</div>}
                  </div>
                  <div className="log-actions">
                    {it.notes && (
                      <button
                        className={'chevron-btn small' + (expandedNotesIds.has(it.recId) ? '' : ' collapsed')}
                        onClick={() => toggleNotesExpanded(it.recId)}
                        title="نمایش/پنهان‌کردن توضیحات"
                      >
                        <ChevronDown size={14} />
                      </button>
                    )}
                    {canToggle && !isSub && (
                      <button
                        className={'habit-del' + (subs.length > 0 ? ' active' : '')}
                        onClick={() => onToggleSubtaskBox(it.recId)}
                        title="زیرکار"
                      >
                        <ListPlus size={13} />
                      </button>
                    )}
                    {canToggle && (
                      <button
                        className={'habit-del' + (it.comment ? ' active' : '')}
                        onClick={() => onToggleCommentBox(it)}
                        title="کامنت"
                      >
                        <MessageSquare size={13} />
                      </button>
                    )}
                    <button className="habit-del" onClick={() => onStartEditLog(it)} title="ویرایش">
                      <Pencil size={13} />
                    </button>
                    {!isSub && it.day !== TODAY && !it.done && !it.failed && (
                      <button className="habit-del" onClick={() => onMigrateToToday(it.recId)} title="موکول به امروز">
                        <Redo2 size={13} />
                      </button>
                    )}
                    <button className="habit-del" onClick={() => onDeleteLog(it.recId)} title="حذف">
                      <X size={13} />
                    </button>
                  </div>
                </div>
                {canToggle && commentOpenId === it.recId && (
                  <div className="log-item comment-row">
                    {commentEditing ? (
                      <>
                        <input
                          value={commentDraft}
                          onChange={(e) => setCommentDraft(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && onSaveComment(it.recId)}
                          placeholder="یک کامنت کوتاه…"
                          autoFocus
                        />
                        <button onClick={() => onSaveComment(it.recId)}>ثبت</button>
                      </>
                    ) : (
                      <>
                        <span className="comment-text">{it.comment}</span>
                        <button className="habit-del" onClick={() => onStartEditComment(it)} title="ویرایش">
                          <Pencil size={13} />
                        </button>
                      </>
                    )}
                  </div>
                )}
                {canToggle && !isSub && subtaskOpenId === it.recId && (
                  <div className="log-item comment-row">
                    <input
                      value={subtaskDraft}
                      onChange={(e) => setSubtaskDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && onAddSubtask(it.recId)}
                      placeholder="یک زیرکار…"
                      autoFocus
                    />
                    <button onClick={() => onAddSubtask(it.recId)}>افزودن</button>
                  </div>
                )}
                </Fragment>
              );
            })}

            <div className="type-select">
              {LOG_TYPES.map((t) => (
                <button
                  key={t.id}
                  className={
                    'type-btn' +
                    (logType === t.id ? ' active' : '') +
                    (t.id === 'task' && holdingPriorityBtn ? ' holding-priority' : '') +
                    (t.id === 'task' && logPriorityPending ? ' priority-pending' : '')
                  }
                  onPointerDown={() => onTypeBtnPointerDown(t.id)}
                  onPointerUp={onTypeBtnPointerUp}
                  onPointerLeave={onTypeBtnPointerUp}
                  onClick={() => onTypeBtnClick(t.id)}
                  title={t.id === 'task' ? 'برای اولویت بالا نگه‌دار' : undefined}
                >
                  <t.Icon size={13} /> {t.label}
                </button>
              ))}
            </div>

            {logType && (
              <>
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
                      style={{ background: c.bg ?? 'var(--paper)', color: c.color ?? 'var(--ink-soft)' }}
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
                        style={{ background: categoryOf(logCategoryId)?.bg ?? 'var(--paper)', color: categoryOf(logCategoryId)?.color ?? 'var(--ink-soft)' }}
                        onClick={() => {
                          setLogProjectId((cur) => (cur === p.id ? null : p.id));
                          setLogPhaseId(null);
                        }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}

                {phasesOf(logProjectId).length > 0 && (
                  <div className="cat-select" style={{ paddingInlineStart: 24 }}>
                    <button
                      className={'cat-btn' + (logPhaseId === null ? ' active' : '')}
                      style={{ background: 'var(--paper)', color: 'var(--ink-soft)' }}
                      onClick={() => setLogPhaseId(null)}
                    >
                      بدون فاز
                    </button>
                    {phasesOf(logProjectId).map((ph) => (
                      <button
                        key={ph.id}
                        className={'cat-btn' + (logPhaseId === ph.id ? ' active' : '')}
                        style={{
                          background: categoryOf(logCategoryId ?? undefined)?.bg ?? 'var(--paper)',
                          color: categoryOf(logCategoryId ?? undefined)?.color ?? 'var(--ink-soft)',
                        }}
                        onClick={() => setLogPhaseId((cur) => (cur === ph.id ? null : ph.id))}
                      >
                        {ph.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="type-select">
              <button
                className={'type-btn' + (logHasNotes ? ' active' : '')}
                onClick={() => setLogHasNotes((v) => !v)}
                title="یه کادر توضیحات جداگانه باز می‌شه تا عنوان کوتاه بمونه"
              >
                <FileText size={13} /> توضیحات
              </button>
              <button
                className={'type-btn' + (logHasDueDate ? ' active' : '')}
                onClick={() => setLogHasDueDate((v) => !v)}
              >
                <CalendarDays size={13} /> سررسید
              </button>
            </div>
            {logHasNotes && (
              <div className="add-row">
                <textarea
                  className="review"
                  style={{ minHeight: 50 }}
                  placeholder="توضیحات تکمیلی…"
                  value={logNotesInput}
                  onChange={(e) => setLogNotesInput(e.target.value)}
                />
              </div>
            )}
            {logHasDueDate && (
              <div className="add-row">
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>سررسید:</span>
                <JalaliDateInput
                  value={logDueDateJalali}
                  onChange={(jalali, dk) => {
                    setLogDueDateJalali(jalali);
                    setLogDueDateKey(dk);
                  }}
                />
              </div>
            )}

            <div className="add-row">
              <input
                placeholder={
                  logType === null
                    ? 'اول نوع رو از بالا انتخاب کن'
                    : logType === 'task'
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
              <button onClick={onAddLog} disabled={!logInput.trim() || !logType}>
                ثبت
              </button>
            </div>
          </>
        )}
      </Collapsible>

      <div className="footnote">
        اطلاعات همین دستگاه ذخیره می‌شه؛ اگه همگام‌سازی رو تنظیم کنی، بین دستگاه‌هات هم به‌روز می‌مونه.
        تاریخ‌ها شمسی نمایش داده می‌شن.
      </div>
    </div>
    <BottomNav active={tab} onSelect={onSelectTab} />
    </>
  );
}
