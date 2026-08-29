import { useEffect, useState, useCallback } from 'react';
import { X, Lock } from 'lucide-react';
import Collapsible from './Collapsible';
import Switch from './Switch';
import { scheduleRingAlarm, cancelRingAlarm } from './lib/clockAlarm';
import { clockAlarmId, hashToSlot, cancelAlarm as cancelLegacyNotification } from './lib/alarm';
import { listAlarms, addAlarm, setAlarmEnabled, deleteAlarm, type Alarm } from './repo';

// Persian week order (شنبه first) — each entry's `js` is JS Date#getDay(),
// which is what gets stored and what the native scheduler's weekday (1=Sun..7=Sat,
// matching java.util.Calendar) is derived from.
const WEEKDAY_OPTIONS: { js: number; short: string }[] = [
  { js: 6, short: 'ش' },
  { js: 0, short: 'ی' },
  { js: 1, short: 'د' },
  { js: 2, short: 'س' },
  { js: 3, short: 'چ' },
  { js: 4, short: 'پ' },
  { js: 5, short: 'ج' },
];
const MAX_STAGES = 9;

// The box showing which days an alarm repeats on: a single day reads as a
// circular badge (matching the round weekday-picker buttons above), while
// multiple days keep the wider pill shape — there's simply more to show.
function WeekdaysBadge({ weekdays }: { weekdays: number[] }) {
  const selected = WEEKDAY_OPTIONS.filter((w) => weekdays.includes(w.js));
  if (selected.length === 1) {
    return <span className="alarm-day-circle">{selected[0].short}</span>;
  }
  return (
    <span className="pill alarm-day-pill" style={{ background: 'var(--paper)', color: 'var(--ink-soft)', marginInlineStart: 6 }}>
      {selected.map((w) => w.short).join(' ')}
    </span>
  );
}

async function scheduleAllStages(alarm: Alarm): Promise<void> {
  const slot = hashToSlot(alarm.recId);
  const [h, m] = alarm.time.split(':').map(Number);
  const startMin = h * 60 + m;
  for (const wd of alarm.weekdays) {
    for (let stage = 0; stage < alarm.stageCount; stage++) {
      const totalMin = startMin + stage * alarm.intervalMin;
      const dayOverflow = Math.floor(totalMin / 1440);
      const minuteOfDay = ((totalMin % 1440) + 1440) % 1440;
      const actualWd = (wd + dayOverflow) % 7;
      await scheduleRingAlarm({
        id: clockAlarmId(slot, wd, stage),
        weekday: actualWd + 1, // 1=Sunday..7=Saturday, matches JS getDay()+1
        hour: Math.floor(minuteOfDay / 60),
        minute: minuteOfDay % 60,
        title: alarm.name || 'آلارم',
        body: alarm.stageCount > 1 ? `مرحله ${stage + 1} از ${alarm.stageCount}` : 'وقتشه!',
        lockCancel: alarm.lockCancel,
      });
    }
  }
}

async function cancelAllStages(alarm: Alarm): Promise<void> {
  const slot = hashToSlot(alarm.recId);
  for (const wd of alarm.weekdays) {
    for (let stage = 0; stage < alarm.stageCount; stage++) {
      await cancelRingAlarm(clockAlarmId(slot, wd, stage));
    }
  }
}

export default function AlarmCard() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [name, setName] = useState('');
  const [time, setTime] = useState('07:00');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [stageCountInput, setStageCountInput] = useState('1');
  const [intervalInput, setIntervalInput] = useState('5');
  // Default matches "امکان لغو داشته باشه" — a deliberate opt-in is needed
  // to make an alarm hard to dismiss, not the other way around.
  const [cancelEnabled, setCancelEnabled] = useState(true);

  const reload = useCallback(async () => {
    setAlarms(await listAlarms());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Alarms created before this ring-activity feature existed are still
  // scheduled as plain @capacitor/local-notifications — those only ever
  // post a silent-ish banner, never actually ring. Cancel that stale
  // schedule and re-arm every enabled alarm through the new AlarmManager
  // path once, so existing alarms get the real ring without the user
  // having to re-create them. Both calls target the exact same numeric ids
  // (clockAlarmId is unchanged), so this is a clean swap, not a duplicate.
  useEffect(() => {
    (async () => {
      const current = await listAlarms();
      for (const a of current) {
        const slot = hashToSlot(a.recId);
        for (const wd of a.weekdays) {
          for (let stage = 0; stage < a.stageCount; stage++) {
            await cancelLegacyNotification(clockAlarmId(slot, wd, stage));
          }
        }
        if (a.enabled) await scheduleAllStages(a);
      }
    })();
  }, []);

  function toggleWeekday(js: number) {
    setWeekdays((prev) => (prev.includes(js) ? prev.filter((d) => d !== js) : [...prev, js]));
  }

  // If the user never touches the weekday picker, don't block adding the
  // alarm — infer the single day it should ring on from the chosen time:
  // today if that time hasn't passed yet, otherwise tomorrow.
  function inferWeekdayFromTime(t: string): number {
    const [h, m] = t.split(':').map(Number);
    const now = new Date();
    const stillUpcomingToday = h > now.getHours() || (h === now.getHours() && m > now.getMinutes());
    return stillUpcomingToday ? now.getDay() : (now.getDay() + 1) % 7;
  }

  async function onAdd() {
    const effectiveWeekdays = weekdays.length > 0 ? weekdays : [inferWeekdayFromTime(time)];
    const stageCount = Math.min(MAX_STAGES, Math.max(1, parseInt(stageCountInput, 10) || 1));
    const intervalMin = Math.max(1, parseInt(intervalInput, 10) || 1);
    const lockCancel = !cancelEnabled;
    const recId = await addAlarm({ name: name.trim(), weekdays: effectiveWeekdays, time, stageCount, intervalMin, lockCancel });
    await scheduleAllStages({ recId, name: name.trim(), weekdays: effectiveWeekdays, time, stageCount, intervalMin, lockCancel, enabled: true });
    setName('');
    setWeekdays([]);
    setStageCountInput('1');
    setIntervalInput('5');
    setCancelEnabled(true);
    await reload();
  }

  async function onToggleEnabled(a: Alarm) {
    const next = !a.enabled;
    await setAlarmEnabled(a.recId, next);
    if (next) await scheduleAllStages({ ...a, enabled: next });
    else await cancelAllStages(a);
    await reload();
  }

  async function onDelete(a: Alarm) {
    await cancelAllStages(a);
    await deleteAlarm(a.recId);
    await reload();
  }

  return (
    <Collapsible title="آلارم" storageKey="clockalarm">
      {alarms.length === 0 && <div className="empty">هنوز آلارمی ثبت نشده.</div>}
      {alarms.map((a) => (
        <div className="log-item" key={a.recId}>
          <div style={{ flex: 1 }}>
            <span className="log-text">
              {a.time} — {a.name || 'آلارم'}
              <WeekdaysBadge weekdays={a.weekdays} />
            </span>
            <div className="pay-sub">{a.stageCount > 1 ? `${a.stageCount} مرحله، هر ${a.intervalMin} دقیقه` : 'تک‌مرحله‌ای'}</div>
          </div>
          <div className="icon-row" style={{ gap: 8 }}>
            {a.lockCancel && <Lock size={18} style={{ color: 'var(--ink-soft)' }} />}
            <Switch checked={a.enabled} onChange={() => onToggleEnabled(a)} title={a.enabled ? 'فعال' : 'غیرفعال'} />
            <button className="habit-del" onClick={() => onDelete(a)} title="حذف">
              <X size={18} />
            </button>
          </div>
        </div>
      ))}

      <div className="add-row">
        <input placeholder="نام آلارم (اختیاری)" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>

      <div className="weekday-row">
        {WEEKDAY_OPTIONS.map((w) => (
          <button
            key={w.js}
            className={'weekday-btn' + (weekdays.includes(w.js) ? ' active' : '') + (w.js === 5 ? ' friday' : '')}
            onClick={() => toggleWeekday(w.js)}
          >
            {w.short}
          </button>
        ))}
      </div>

      <div className="add-row">
        <span style={{ minWidth: 80, fontSize: 13, color: 'var(--ink-soft)' }}>تعداد مرحله</span>
        <input
          type="number"
          min="1"
          max={MAX_STAGES}
          style={{ maxWidth: 80 }}
          value={stageCountInput}
          onChange={(e) => setStageCountInput(e.target.value)}
        />
      </div>
      <div className="add-row">
        <span style={{ minWidth: 80, fontSize: 13, color: 'var(--ink-soft)' }}>فاصله مراحل</span>
        <input
          type="number"
          min="1"
          style={{ maxWidth: 80 }}
          value={intervalInput}
          onChange={(e) => setIntervalInput(e.target.value)}
        />
        <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>دقیقه</span>
      </div>
      <div className="add-row" style={{ alignItems: 'center' }}>
        <span style={{ minWidth: 80, fontSize: 13, color: 'var(--ink-soft)' }}>قابلیت لغو</span>
        <Switch checked={cancelEnabled} onChange={setCancelEnabled} />
        {!cancelEnabled && <Lock size={18} style={{ color: 'var(--ink-soft)' }} />}
      </div>

      <div className="add-row">
        <button onClick={onAdd}>افزودن آلارم</button>
      </div>
    </Collapsible>
  );
}
