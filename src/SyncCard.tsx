import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { getSyncConfig, setSyncConfig, isSyncConfigured, runSync } from './lib/sync';
import Collapsible from './Collapsible';

const LAST_SYNC_LABEL_KEY = 'sync_last_label';

interface SyncStatus {
  ok: boolean;
  text: string;
}

function loadLastStatus(): SyncStatus | null {
  const raw = localStorage.getItem(LAST_SYNC_LABEL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SyncStatus;
  } catch {
    return null;
  }
}

export default function SyncCard({ onSynced }: { onSynced: () => void }) {
  const [configured, setConfigured] = useState(isSyncConfigured());
  const [editing, setEditing] = useState(!configured);
  const [serverUrl, setServerUrl] = useState(getSyncConfig().serverUrl);
  const [token, setToken] = useState(getSyncConfig().token);
  const [status, setStatus] = useState<SyncStatus | null>(loadLastStatus());
  const [syncing, setSyncing] = useState(false);

  async function doSync() {
    setSyncing(true);
    const result = await runSync();
    setSyncing(false);
    const next: SyncStatus = result.ok
      ? { ok: true, text: `همگام شد — ${result.pushed} فرستاده شد، ${result.pulled} دریافت شد` }
      : { ok: false, text: result.error };
    setStatus(next);
    if (result.ok) {
      localStorage.setItem(LAST_SYNC_LABEL_KEY, JSON.stringify(next));
      onSynced();
    }
  }

  function onSave() {
    setSyncConfig(serverUrl, token);
    setConfigured(isSyncConfigured());
    setEditing(false);
    doSync();
  }

  // Sync automatically on load and whenever the device comes back online —
  // manual sync stays available for "I want it right now".
  useEffect(() => {
    if (isSyncConfigured()) doSync();
    const onOnline = () => isSyncConfigured() && doSync();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Collapsible title="همگام‌سازی بین دستگاه‌ها" storageKey="sync">
      {editing ? (
        <>
          <div className="add-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
            <input
              placeholder="آدرس سرور (مثلاً https://xxx.liara.run)"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
            />
            <input
              placeholder="توکن همگام‌سازی"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              type="password"
            />
            <button onClick={onSave} disabled={!serverUrl.trim() || !token.trim()}>
              ذخیره و همگام‌سازی
            </button>
          </div>
        </>
      ) : (
        <div className="add-row">
          <button onClick={doSync} disabled={syncing}>
            {syncing ? 'در حال همگام‌سازی…' : 'همگام‌سازی الان'}
          </button>
          <button className="link-btn" onClick={() => setEditing(true)}>
            تنظیمات
          </button>
          {status && (
            <span className="saved-hint icon-row">
              {status.ok ? <Check size={13} /> : <X size={13} />} {status.text}
            </span>
          )}
        </div>
      )}
    </Collapsible>
  );
}
