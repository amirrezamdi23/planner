import Dexie, { type EntityTable } from 'dexie';
import { newId, getDeviceId } from './lib/id';

// One table, many "types" of records. This is the shape that stays stable even
// as features are added later — new types never require a schema migration here.
export type RecordType =
  | 'habit'
  | 'habit_check'
  | 'log_item'
  | 'daily_review'
  | 'payment'
  | 'project_category'
  | 'project'
  | 'project_log'
  | 'alarm'
  | 'song';

export interface Rec {
  id: string;
  type: RecordType;
  payload: unknown;
  updatedAt: string; // ISO timestamp, used for ordering / future sync
  deleted: boolean; // tombstone — never physically delete
  deviceId: string;
}

// Device-local files (like a custom timer ringtone) live in their own table,
// separate from `records` — they're not part of the sync payload (too big,
// and a ringtone picked on one phone has no reason to travel to another).
export interface LocalFile {
  id: string;
  blob: Blob;
  name: string;
  type: string;
}

const db = new Dexie('planner') as Dexie & {
  records: EntityTable<Rec, 'id'>;
  localFiles: EntityTable<LocalFile, 'id'>;
};

db.version(1).stores({
  // indexed on type so we can query "all habits", "all log items for a day", etc.
  records: 'id, type, deleted, updatedAt',
});

db.version(2).stores({
  records: 'id, type, deleted, updatedAt',
  localFiles: 'id',
});

export function makeRecord(type: RecordType, payload: unknown, id = newId()): Rec {
  return {
    id,
    type,
    payload,
    updatedAt: new Date().toISOString(),
    deleted: false,
    deviceId: getDeviceId(),
  };
}

const TIMER_SOUND_ID = 'timer_sound';

export async function getTimerSound(): Promise<LocalFile | undefined> {
  return db.localFiles.get(TIMER_SOUND_ID);
}

export async function setTimerSound(file: File): Promise<void> {
  await db.localFiles.put({ id: TIMER_SOUND_ID, blob: file, name: file.name, type: file.type });
}

export async function clearTimerSound(): Promise<void> {
  await db.localFiles.delete(TIMER_SOUND_ID);
}

export default db;
