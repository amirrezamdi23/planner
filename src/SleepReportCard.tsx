import { useEffect, useState, useCallback } from 'react';
import Collapsible from './Collapsible';
import { jalaliDateOnlyLabel } from './lib/date';
import { listSleepReports, type SleepDayReport } from './repo';

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

export default function SleepReportCard({ refreshSignal }: { refreshSignal: number }) {
  const [reports, setReports] = useState<SleepDayReport[]>([]);

  const reload = useCallback(async () => {
    setReports(await listSleepReports());
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshSignal]);

  return (
    <Collapsible title="گزارش خواب" storageKey="sleepreport">
      {reports.length === 0 ? (
        <div className="empty">هنوز داده‌ی خوابی ثبت نشده.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="sleep-table">
            <thead>
              <tr>
                <th>روز</th>
                <th>تاریخ</th>
                <th title="ساعت خواب">🌙</th>
                <th title="ساعت بیداری">☀️</th>
                <th title="مدت خواب">🕐</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.day}>
                  <td>{weekdayShortForDayKey(r.day)}</td>
                  <td>{jalaliDateOnlyLabel(r.day)}</td>
                  <td>{r.sleepTime ?? '—'}</td>
                  <td>{r.wakeTime ?? '—'}</td>
                  <td>{r.napNone && r.totalSleepMin === undefined ? 'چرت نزدی' : formatDuration(r.totalSleepMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Collapsible>
  );
}
