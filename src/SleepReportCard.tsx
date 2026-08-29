import { useEffect, useState, useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from 'react';
import { Moon, Sun, Clock, Smile } from 'lucide-react';
import Collapsible from './Collapsible';
import { dayKey, shiftDayKey, jalaliSlashDateForDayKey, isInCurrentJalaliMonth } from './lib/date';
import { listSleepReports, editSleepTime, editWakeTime, type SleepDayReport } from './repo';
import { MOOD_OPTIONS } from './moodOptions';

// شنبه is day 0 of the week and جمعه the last — the days between (یکشنبه..پنجشنبه)
// are commonly shortened to "۱ شنبه".."۵ شنبه" rather than spelled out.
const WEEKDAY_SHORT_FA = ['۱ شنبه', '۲ شنبه', '۳ شنبه', '۴ شنبه', '۵ شنبه', 'جمعه', 'شنبه']; // indexed by Date#getDay()

function weekdayShortForDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return WEEKDAY_SHORT_FA[new Date(y, m - 1, d).getDay()];
}

function formatDuration(min?: number): string {
  if (min === undefined || min < 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

// This week starts شنبه — how many days back from today that was.
function daysSinceSaturday(): number {
  return (new Date().getDay() + 1) % 7; // JS getDay(): Sat=6..Fri=5 → Sat=0..Fri=6
}

type FilterMode = 'week' | 'month' | '3d' | '7d';
const FILTERS: { id: FilterMode; label: string }[] = [
  { id: 'week', label: 'هفته جاری' },
  { id: 'month', label: 'ماه جاری' },
  { id: '3d', label: '۳ روز گذشته' },
  { id: '7d', label: 'هفته گذشته' },
];

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minutesToTime(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
// A plain arithmetic mean breaks down for clock times that wrap past
// midnight (e.g. 23:30 and 00:10 should average to ~23:50, not ~11:50) —
// averaging around the circle instead handles that correctly.
function circularMeanTime(times: string[]): string | undefined {
  if (times.length === 0) return undefined;
  let sinSum = 0;
  let cosSum = 0;
  for (const t of times) {
    const angle = (timeToMinutes(t) / 1440) * 2 * Math.PI;
    sinSum += Math.sin(angle);
    cosSum += Math.cos(angle);
  }
  const meanAngle = Math.atan2(sinSum / times.length, cosSum / times.length);
  const meanMin = ((meanAngle / (2 * Math.PI)) * 1440 + 1440) % 1440;
  return minutesToTime(meanMin);
}
function averageOf(nums: number[]): number | undefined {
  if (nums.length === 0) return undefined;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export default function SleepReportCard({ refreshSignal }: { refreshSignal: number }) {
  const [reports, setReports] = useState<SleepDayReport[]>([]);
  const [filter, setFilter] = useState<FilterMode>('week');
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editSleep, setEditSleep] = useState('');
  const [editWake, setEditWake] = useState('');

  const reload = useCallback(async () => {
    setReports(await listSleepReports());
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshSignal]);

  // A right-to-left swipe (a finger drag starting right, ending left — the
  // "forward" gesture in RTL) on a row opens edit mode for that night's
  // sleep/wake times, instead of a dedicated edit button on every row.
  //
  // Everything here is bound to the wrapper <div>, never to the <tr>, and
  // that placement is load-bearing rather than stylistic: per the CSS spec
  // `touch-action` does not apply to table rows at all, so declaring
  // `pan-y` on a <tr> is silently ignored and the browser stays free to
  // treat a sideways drag as a scroll of the overflow-x wrapper. On the
  // wrapper (a plain block box) it takes effect. Touch handlers are the
  // primary path since they fire on mobile regardless of how the browser
  // arbitrates the gesture; pointer handlers cover desktop mice and are
  // suppressed right after a touch so one finger drag isn't counted twice.
  // The row is resolved from the event target's data-day, and the decision
  // is made mid-drag so a gesture that ends outside the row still counts.
  const swipeStartRef = useRef<{ x: number; y: number; day: string } | null>(null);
  const lastTouchAtRef = useRef(0);

  function openEditFor(day: string) {
    const r = reports.find((x) => x.day === day);
    if (!r) return;
    setEditingDay(r.day);
    setEditSleep(r.sleepTime ?? '');
    setEditWake(r.wakeTime ?? '');
  }

  function beginSwipe(target: EventTarget | null, x: number, y: number) {
    const el = target as HTMLElement | null;
    // Don't hijack drags that start inside the edit inputs themselves.
    if (!el || el.closest('input')) return;
    const day = el.closest('tr')?.dataset.day;
    if (!day) return;
    swipeStartRef.current = { x, y, day };
  }

  function moveSwipe(x: number, y: number) {
    const start = swipeStartRef.current;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (dx < -35 && Math.abs(dx) > Math.abs(dy)) {
      swipeStartRef.current = null;
      openEditFor(start.day);
    }
  }

  function endSwipe() {
    swipeStartRef.current = null;
  }

  const swipeHandlers = {
    onTouchStart: (e: ReactTouchEvent<HTMLDivElement>) => {
      lastTouchAtRef.current = Date.now();
      const t = e.touches[0];
      beginSwipe(e.target, t.clientX, t.clientY);
    },
    onTouchMove: (e: ReactTouchEvent<HTMLDivElement>) => {
      lastTouchAtRef.current = Date.now();
      const t = e.touches[0];
      moveSwipe(t.clientX, t.clientY);
    },
    onTouchEnd: endSwipe,
    onTouchCancel: endSwipe,
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (Date.now() - lastTouchAtRef.current < 800) return;
      beginSwipe(e.target, e.clientX, e.clientY);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (Date.now() - lastTouchAtRef.current < 800) return;
      moveSwipe(e.clientX, e.clientY);
    },
    onPointerUp: endSwipe,
    onPointerCancel: endSwipe,
    onPointerLeave: endSwipe,
  };

  async function onSaveEdit() {
    if (!editingDay) return;
    if (editSleep) await editSleepTime(editingDay, editSleep);
    if (editWake) await editWakeTime(shiftDayKey(editingDay, 1), editWake);
    setEditingDay(null);
    await reload();
  }

  const today = dayKey(0);
  const cutoff =
    filter === 'week'
      ? shiftDayKey(today, -daysSinceSaturday())
      : filter === '3d'
        ? shiftDayKey(today, -2)
        : filter === '7d'
          ? shiftDayKey(today, -6)
          : null;
  // A row keyed to day D is the night you went to bed on D and woke on D+1,
  // so the night logged *this morning* is keyed to yesterday. Windowing on
  // the bed day would then drop it on the first day of a week or month — on
  // شنبه, "هفته جاری" starts today and last night's row sits on جمعه. Window
  // on the wake day instead: a night belongs to the period you woke up in,
  // which is also how it's actually experienced.
  const visible = reports.filter((r) => {
    if (r.day > today) return false;
    const wakeDay = shiftDayKey(r.day, 1);
    if (filter === 'month') return isInCurrentJalaliMonth(wakeDay);
    return cutoff !== null && wakeDay >= cutoff;
  });

  const avgSleep = circularMeanTime(visible.map((r) => r.sleepTime).filter((t): t is string => !!t));
  const avgWake = circularMeanTime(visible.map((r) => r.wakeTime).filter((t): t is string => !!t));
  const avgDuration = averageOf(visible.map((r) => r.totalSleepMin).filter((n): n is number => n !== undefined));

  return (
    <Collapsible title="گزارش خواب" storageKey="sleepreport">
      {visible.length > 0 && (
        <div className="sleep-avg-block">
          <span className="sleep-avg-title">میانگین</span>
          <div className="sleep-avg-cols">
            <div className="sleep-avg-col">
              <Moon size={14} />
              <span>{avgSleep ?? '—'}</span>
            </div>
            <div className="sleep-avg-col">
              <Sun size={14} />
              <span>{avgWake ?? '—'}</span>
            </div>
            <div className="sleep-avg-col">
              <Clock size={14} />
              <span>{formatDuration(avgDuration)}</span>
            </div>
          </div>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty">داده‌ی خوابی برای این بازه ثبت نشده.</div>
      ) : (
        <div className="sleep-table-wrap" {...swipeHandlers}>
          <table className="sleep-table">
            <thead>
              <tr>
                <th>روز</th>
                <th>تاریخ</th>
                <th title="ساعت خواب"><Moon size={14} /></th>
                <th title="ساعت بیداری"><Sun size={14} /></th>
                <th title="مدت خواب"><Clock size={14} /></th>
                <th title="مود صبح"><Smile size={14} /></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const moodOpt = MOOD_OPTIONS.find((m) => m.id === r.mood);
                const editing = editingDay === r.day;
                return (
                  <tr key={r.day} data-day={r.day} className={'sleep-row' + (editing ? ' editing' : '')}>
                    <td>{weekdayShortForDayKey(r.day)}</td>
                    <td>{jalaliSlashDateForDayKey(r.day)}</td>
                    <td>
                      {editing ? (
                        <input type="time" value={editSleep} onChange={(e) => setEditSleep(e.target.value)} className="sleep-time-input" />
                      ) : (
                        (r.sleepTime ?? '—')
                      )}
                    </td>
                    <td>
                      {editing ? (
                        <input type="time" value={editWake} onChange={(e) => setEditWake(e.target.value)} className="sleep-time-input" />
                      ) : (
                        (r.wakeTime ?? '—')
                      )}
                    </td>
                    <td>{r.napNone && r.totalSleepMin === undefined ? 'چرت نزدی' : formatDuration(r.totalSleepMin)}</td>
                    <td>
                      {moodOpt ? (
                        <span title={moodOpt.label} style={{ color: moodOpt.color }}>
                          <moodOpt.Icon size={14} />
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editingDay ? (
        <div className="add-row">
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>ویرایش {weekdayShortForDayKey(editingDay)}:</span>
          <button onClick={onSaveEdit}>ذخیره</button>
          <button className="link-btn" onClick={() => setEditingDay(null)}>
            انصراف
          </button>
        </div>
      ) : (
        visible.length > 0 && <div className="sleep-hint">برای ویرایش ساعت خواب/بیداری، روی ردیف از راست به چپ بکش.</div>
      )}

      <div className="type-select">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={'type-btn' + (filter === f.id ? ' active' : '')}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
    </Collapsible>
  );
}
