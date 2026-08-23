import { useEffect, useState } from 'react';
import { getSyncConfig, setSyncConfig, isSyncConfigured, runSync } from './lib/sync';

const LAST_SYNC_LABEL_KEY = 'sync_last_label';

export default function SyncCard({ onSynced }: { onSynced: () => void }) {
  const [configured, setConfigured] = useState(isSyncConfigured());
  const [editing, setEditing] = useState(!configured);
  const [serverUrl, setServerUrl] = useState(getSyncConfig().serverUrl);
  const [token, setToken] = useState(getSyncConfig().token);
  const [status, setStatus] = useState<string>(localStorage.getItem(LAST_SYNC_LABEL_KEY) ?? '');
  const [syncing, setSyncing] = useState(false);

  async function doSync() {
    setSyncing(true);
    setStatus('در حال همگام‌سازی…');
    const result = await runSync();
    setSyncing(false);
    if (result.ok) {
      const label = `✓ همگام شد — ${result.pushed} فرستاده شد، ${result.pulled} دریافت شد`;
      setStatus(label);
      localStorage.setItem(LAST_SYNC_LABEL_KEY, label);
      onSynced();
    } else {
      setStatus('✕ ' + result.error);
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
    <div className="card">
      <h2>همگام‌سازی بین دستگاه‌ها</h2>
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
          {status && <span className="saved-hint">{status}</span>}
        </div>
      )}
    </div>
  );
}
