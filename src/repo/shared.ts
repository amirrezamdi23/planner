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
