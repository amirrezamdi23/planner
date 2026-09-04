// Internal plumbing shared by every domain module in this directory. Not
// part of the public repo API — feature code imports from '../repo' (the
// barrel), never from here directly.
import db, { type Rec } from '../db';

export { default as db, makeRecord } from '../db';
export type { Rec } from '../db';

export async function liveByType(type: Rec['type']): Promise<Rec[]> {
  const all = await db.records.where('type').equals(type).toArray();
  return all.filter((r) => !r.deleted);
}

// Wraps a find-or-create routine so a second call while the first is still
// in flight gets the same in-progress promise instead of racing it — both
// would otherwise read "doesn't exist yet" before either write lands, and
// create a duplicate. This bit React's StrictMode dev double-invoke of a
// mount effect calling ensureBulletJournalProject(); wrap any future
// find-or-create the same way rather than leaning on a call-site guard.
export function onceInFlight<T>(run: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => {
    if (!promise) promise = run();
    return promise;
  };
}
