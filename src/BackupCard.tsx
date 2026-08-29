import { useRef, useState, type ChangeEvent } from 'react';
import { Check, X } from 'lucide-react';
import Collapsible from './Collapsible';
import { exportAllData, importAllData } from './lib/backup';
import { exportTextFile } from './lib/exportFile';

interface Status {
  ok: boolean;
  text: string;
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function BackupCard({ onImported }: { onImported: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onExport() {
    setBusy(true);
    const json = await exportAllData();
    await exportTextFile(`planner-backup-${todayStamp()}.json`, json);
    setBusy(false);
  }

  async function onPickFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    const json = await file.text();
    const result = await importAllData(json);
    setBusy(false);
    setStatus(
      result.ok
        ? { ok: true, text: `${result.imported} مورد اضافه/به‌روزرسانی شد، ${result.skipped} رد شد` }
        : { ok: false, text: result.error }
    );
    if (result.ok) onImported();
  }

  return (
    <Collapsible title="خروجی و ورودی کامل داده‌ها" storageKey="backup">
      <div className="empty">
        همه‌ی داده‌های اپ (ژورنال، آلارم‌ها، پرداخت‌ها، عادت‌ها و...) رو در یه فایل ذخیره کن و روی گوشی یا لپ‌تاپ دیگه وارد کن. فایل‌های صوتی (زنگ تایمر، آهنگ‌ها) شامل نمی‌شن.
      </div>
      <div className="add-row">
        <button onClick={onExport} disabled={busy}>
          خروجی گرفتن
        </button>
        <label className="mini-btn" style={{ cursor: 'pointer' }}>
          وارد کردن فایل
          <input ref={fileInputRef} type="file" accept="application/json" onChange={onPickFile} style={{ display: 'none' }} />
        </label>
        {status && (
          <span className="saved-hint icon-row">
            {status.ok ? <Check size={13} /> : <X size={13} />} {status.text}
          </span>
        )}
      </div>
    </Collapsible>
  );
}
