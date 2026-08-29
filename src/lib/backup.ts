// Manual, file-based alternative to lib/sync.ts — for moving all data to a
// new phone/laptop in one shot rather than syncing through a server.
// Audio blobs (db.localFiles) are deliberately excluded: they're large,
// device-local by design (see db.ts), and out of scope for now.

import db, { type Rec } from '../db';

const BACKUP_VERSION = 1;

interface BackupFile {
  version: number;
  exportedAt: string;
  records: Rec[];
}

export async function exportAllData(): Promise<string> {
  const records = await db.records.toArray();
  const file: BackupFile = { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), records };
  return JSON.stringify(file, null, 2);
}

export type ImportResult = { ok: true; imported: number; skipped: number } | { ok: false; error: string };

// Same last-write-wins rule as lib/sync.ts, so importing an older backup
// on top of newer local data can't silently roll anything back.
export async function importAllData(json: string): Promise<ImportResult> {
  let file: BackupFile;
  try {
    file = JSON.parse(json);
  } catch {
    return { ok: false, error: 'فایل معتبر نیست (JSON خراب)' };
  }
  if (!file || typeof file !== 'object' || !Array.isArray(file.records)) {
    return { ok: false, error: 'فایل معتبر نیست (فرمت ناشناس)' };
  }

  let imported = 0;
  let skipped = 0;
  for (const rec of file.records) {
    if (!rec || typeof rec.id !== 'string' || typeof rec.updatedAt !== 'string') {
      skipped++;
      continue;
    }
    const existing = await db.records.get(rec.id);
    if (!existing || existing.updatedAt < rec.updatedAt) {
      await db.records.put(rec);
      imported++;
    } else {
      skipped++;
    }
  }
  return { ok: true, imported, skipped };
}
