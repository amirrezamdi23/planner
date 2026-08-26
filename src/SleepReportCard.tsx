import { useEffect, useState, useCallback } from 'react';
import Collapsible from './Collapsible';
import { jalaliDateOnlyLabel, weekdayLabelForDayKey } from './lib/date';
import { listSleepReports, type SleepDayReport } from './repo';

function formatDuration(min?: number): string {
  if (min === undefined || min < 0) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} دقیقه`;
  if (m === 0) return `${h} ساعت`;
  return `${h} ساعت و ${m} دقیقه`;
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
                <th>ساعت خواب</th>
                <th>ساعت بیداری</th>
                <th>مدت خواب</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.day}>
                  <td>{weekdayLabelForDayKey(r.day)}</td>
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
