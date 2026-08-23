import db, { type Rec } from '../db';

const SERVER_URL_KEY = 'sync_server_url';
const SYNC_TOKEN_KEY = 'sync_token';
const CURSOR_KEY = 'sync_cursor';
const PUSHED_UNTIL_KEY = 'sync_pushed_until';

export function getSyncConfig() {
  return {
    serverUrl: localStorage.getItem(SERVER_URL_KEY) ?? '',
    token: localStorage.getItem(SYNC_TOKEN_KEY) ?? '',
  };
}

export function setSyncConfig(serverUrl: string, token: string) {
  localStorage.setItem(SERVER_URL_KEY, serverUrl.trim().replace(/\/$/, ''));
  localStorage.setItem(SYNC_TOKEN_KEY, token.trim());
}

export function isSyncConfigured(): boolean {
  const { serverUrl, token } = getSyncConfig();
  return !!serverUrl && !!token;
}

export type SyncResult = { ok: true; pushed: number; pulled: number } | { ok: false; error: string };

export async function runSync(): Promise<SyncResult> {
  const { serverUrl, token } = getSyncConfig();
  if (!serverUrl || !token) return { ok: false, error: 'سرور یا توکن تنظیم نشده' };

  // Only the records changed since our own last push get sent — everything
  // else already made it to the server in a previous sync.
  const pushedUntil = localStorage.getItem(PUSHED_UNTIL_KEY) ?? '1970-01-01T00:00:00.000Z';
  const cursor = localStorage.getItem(CURSOR_KEY) ?? '1970-01-01T00:00:00.000Z';

  const toPush = await db.records.where('updatedAt').above(pushedUntil).toArray();
  const pushStartedAt = new Date().toISOString();

  let res: Response;
  try {
    res = await fetch(`${serverUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ since: cursor, changes: toPush }),
    });
  } catch {
    return { ok: false, error: 'اتصال به سرور برقرار نشد (آفلاینی؟)' };
  }

  if (!res.ok) {
    return { ok: false, error: res.status === 401 ? 'توکن اشتباهه' : `خطای سرور (${res.status})` };
  }

  const { changes, cursor: newCursor } = (await res.json()) as { changes: Rec[]; cursor: string };

  // Last-write-wins locally too, symmetric with the server's merge rule.
  let applied = 0;
  for (const rec of changes) {
    const existing = await db.records.get(rec.id);
    if (!existing || existing.updatedAt < rec.updatedAt) {
      await db.records.put(rec);
      applied++;
    }
  }

  localStorage.setItem(PUSHED_UNTIL_KEY, pushStartedAt);
  localStorage.setItem(CURSOR_KEY, newCursor);

  return { ok: true, pushed: toPush.length, pulled: applied };
}
