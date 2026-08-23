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
  | 'project'
  | 'project_log';

export interface Rec {
  id: string;
  type: RecordType;
  payload: unknown;
  updatedAt: string; // ISO timestamp, used for ordering / future sync
  deleted: boolean; // tombstone — never physically delete
  deviceId: string;
}

const db = new Dexie('planner') as Dexie & {
  records: EntityTable<Rec, 'id'>;
};

db.version(1).stores({
  // indexed on type so we can query "all habits", "all log items for a day", etc.
  records: 'id, type, deleted, updatedAt',
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

export default db;
