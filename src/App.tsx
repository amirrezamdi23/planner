import { useRef, useState, type ReactNode } from 'react';
import {
  Moon, ArrowRight, History, NotebookPen, Timer, AlarmClock, Music, Wallet,
  FolderKanban, RefreshCw, Database, Repeat, type LucideIcon,
} from 'lucide-react';
import { todayJalaliLabel, todayWeekdayLabel } from './lib/date';
import SyncCard from './SyncCard';
import BackupCard from './BackupCard';
import BottomNav, { type NavTab } from './BottomNav';
import DailyReviewCard from './DailyReviewCard';
import HabitsCard from './HabitsCard';
import HabitStrip from './HabitStrip';
import UpcomingCard from './UpcomingCard';
import PaymentsCard from './PaymentsCard';
import ProjectLogCard from './ProjectLogCard';
import TimerCard from './TimerCard';
import AlarmCard from './AlarmCard';
import MusicCard from './MusicCard';
import SleepReportCard from './SleepReportCard';
import HistoryCard from './HistoryCard';
import { BareCardContext } from './Collapsible';
import QuickLogCard, { type QuickLogHandle } from './QuickLogCard';

export default function App() {
  const [tab, setTab] = useState<NavTab>('today');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const quickLogRef = useRef<QuickLogHandle>(null);

  // Everything except the quick log lives behind the "مرور" tab, one row per
  // card, each opening as its own page. Sync/backup can't reach the quick
  // log's own state through a prop (the two are never mounted at the same
  // time — see QuickLogCard's ref handle), so they nudge it to refetch
  // through the imperative handle instead.
  const BROWSE_CARDS: { id: string; title: string; Icon: LucideIcon; node: ReactNode }[] = [
    { id: 'habits', title: 'عادت‌ها', Icon: Repeat, node: <HabitsCard /> },
    { id: 'history', title: 'پیشینه', Icon: History, node: <HistoryCard /> },
    { id: 'dailyreview', title: 'مرور روزانه', Icon: NotebookPen, node: <DailyReviewCard /> },
    { id: 'sleep', title: 'گزارش خواب', Icon: Moon, node: <SleepReportCard /> },
    { id: 'timer', title: 'تایمر چندمرحله‌ای', Icon: Timer, node: <TimerCard /> },
    { id: 'alarm', title: 'آلارم', Icon: AlarmClock, node: <AlarmCard /> },
    { id: 'music', title: 'پخش موسیقی', Icon: Music, node: <MusicCard /> },
    { id: 'payments', title: 'پرداخت‌ها', Icon: Wallet, node: <PaymentsCard /> },
    { id: 'projects', title: 'دسته‌بندی', Icon: FolderKanban, node: <ProjectLogCard /> },
    {
      id: 'sync',
      title: 'همگام‌سازی بین دستگاه‌ها',
      Icon: RefreshCw,
      node: <SyncCard onSynced={() => quickLogRef.current?.reload()} />,
    },
    {
      id: 'backup',
      title: 'خروجی و ورودی کامل داده‌ها',
      Icon: Database,
      node: <BackupCard onImported={() => quickLogRef.current?.reload()} />,
    },
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

  if (tab === 'upcoming') {
    return (
      <>
        <div className="wrap page">
          <div className="page-head">
            <h1 className="page-title">پیش رو</h1>
          </div>
          <UpcomingCard />
        </div>
        <BottomNav active={tab} onSelect={onSelectTab} />
      </>
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

        <HabitStrip />

        <div id="section-today" />
        <QuickLogCard ref={quickLogRef} />

        <div className="footnote">
          اطلاعات همین دستگاه ذخیره می‌شه؛ اگه همگام‌سازی رو تنظیم کنی، بین دستگاه‌هات هم به‌روز می‌مونه.
          تاریخ‌ها شمسی نمایش داده می‌شن.
        </div>
      </div>
      <BottomNav active={tab} onSelect={onSelectTab} />
    </>
  );
}
