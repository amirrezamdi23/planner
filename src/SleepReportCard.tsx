import { useEffect, useState, useCallback } from 'react';
import Collapsible from './Collapsible';
import { jalaliLabelForDayKey } from './lib/date';
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
      {reports.length === 0 && <div className="empty">هنوز داده‌ی خوابی ثبت نشده.</div>}
      {reports.map((r) => (
        <div className="log-item" key={r.day}>
          <span className="log-mark">–</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{jalaliLabelForDayKey(r.day)}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
              🌙 {r.sleepTime ?? '—'} — ☀️ {r.wakeTime ?? '—'} — مدت خواب شب: {formatDuration(r.nightDurationMin)}
            </div>
            {r.naps.length > 0 ? (
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                💤 چرت‌ها: {r.naps.map((n) => `${n.start} (${n.durationMin} دقیقه)`).join('، ')} — جمع:{' '}
                {formatDuration(r.napTotalMin)}
              </div>
            ) : (
              r.napNone && (
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>💤 چرت نزدی</div>
              )
            )}
          </div>
        </div>
      ))}
    </Collapsible>
  );
}
