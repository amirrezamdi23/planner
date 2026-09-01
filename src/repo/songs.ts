import { db, makeRecord, liveByType } from './shared';

// ---------- music player songs ----------
// Metadata + URL only — the audio itself is never downloaded or cached to
// disk by this app; MusicPlayer (native) streams straight from `url`.
export interface SongPayload {
  title: string;
  artist: string;
  url: string;
}
export interface Song {
  recId: string;
  title: string;
  artist: string;
  url: string;
}

export async function listSongs(): Promise<Song[]> {
  const recs = await liveByType('song');
  return recs
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => ({ recId: r.id, ...(r.payload as SongPayload) }));
}

// Only the link is entered by hand — the title is derived from the URL's
// filename so the add form stays a single field.
function deriveTitleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop() ?? url;
    const decoded = decodeURIComponent(last);
    return decoded.replace(/\.[a-zA-Z0-9]+$/, '').replace(/[_+]/g, ' ').trim() || url;
  } catch {
    return url;
  }
}

export async function addSong(url: string): Promise<string> {
  const trimmed = url.trim();
  const rec = makeRecord('song', { title: deriveTitleFromUrl(trimmed), artist: '', url: trimmed } as SongPayload);
  await db.records.put(rec);
  return rec.id;
}

export async function editSong(recId: string, url: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const trimmed = url.trim();
  await db.records.put({
    ...r,
    payload: { title: deriveTitleFromUrl(trimmed), artist: '', url: trimmed } as SongPayload,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteSong(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({ ...r, deleted: true, updatedAt: new Date().toISOString() });
}
