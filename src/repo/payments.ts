import { recurringPaymentCycle, jalaliCycleKey } from '../lib/date';
import { db, makeRecord, liveByType } from './shared';

// ---------- payments ----------
export type PaymentKind = 'recurring' | 'once';
// What the payment actually is — separate from `kind` (how often it recurs).
export type PaymentType = 'check' | 'installment' | 'debt';
export interface PaymentPayload {
  name: string;
  kind: PaymentKind;
  payType?: PaymentType; // optional so payments created before this field existed still load
  dueDayJalali?: number; // for 'recurring': day of the Jalali month, 1-31
  dueDate?: string; // for 'once': a day-key
  paid: boolean;
  paidThroughCycle?: string; // for 'recurring': last "jy-jm" cycle marked paid
}
export interface Payment {
  recId: string;
  name: string;
  kind: PaymentKind;
  payType?: PaymentType;
  dueDayJalali?: number;
  dueDate?: string;
  paid: boolean;
  paidThroughCycle?: string;
}

export async function listPayments(): Promise<Payment[]> {
  const recs = await liveByType('payment');
  return recs
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => {
      const p = r.payload as PaymentPayload;
      return { recId: r.id, ...p };
    });
}

export async function addPayment(
  name: string,
  payType: PaymentType,
  kind: PaymentKind,
  dueDayJalali?: number,
  dueDate?: string,
): Promise<void> {
  if (!name.trim()) return;
  await db.records.put(
    makeRecord('payment', {
      name: name.trim(),
      kind,
      payType,
      dueDayJalali,
      dueDate,
      paid: false,
    } as PaymentPayload),
  );
}

// ---------- payment archive ----------
// A record of a payment actually being paid — kept separate from `payment`
// because a recurring payment only stores its *current* cycle
// (paidThroughCycle), not a history of every past one, and a paid one-time
// payment doesn't stay in the live list at all (see markOncePaymentPaid).
export interface PaymentArchivePayload {
  name: string;
  payType?: PaymentType;
  kind: PaymentKind;
  cycleLabel: string; // recurring: the "jy-jm" cycle that was paid; once: its due day-key
  paidAt: string; // ISO timestamp, for sorting newest-first
}
export interface PaymentArchiveEntry {
  recId: string;
  name: string;
  payType?: PaymentType;
  kind: PaymentKind;
  cycleLabel: string;
  paidAt: string;
}

export async function listPaymentArchive(): Promise<PaymentArchiveEntry[]> {
  const recs = await liveByType('payment_archive');
  return recs
    .map((r) => ({ recId: r.id, ...(r.payload as PaymentArchivePayload) }))
    .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

export async function deletePaymentArchiveEntry(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({ ...r, deleted: true, updatedAt: new Date().toISOString() });
}

// A one-time payment marked paid is done — archive it and drop it from the
// live list entirely, rather than leaving a "پرداخت شد" row sitting among
// the still-due ones.
export async function markOncePaymentPaid(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as PaymentPayload;
  await db.records.put(
    makeRecord('payment_archive', {
      name: p.name,
      payType: p.payType,
      kind: 'once',
      cycleLabel: p.dueDate ?? '',
      paidAt: new Date().toISOString(),
    } as PaymentArchivePayload),
  );
  await db.records.put({ ...r, deleted: true, updatedAt: new Date().toISOString() });
}

// Mark the currently-shown cycle of a recurring payment as paid — archived
// under that cycle, and the row itself advances to show the next due date
// instead of disappearing forever.
export async function advanceRecurringPayment(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as PaymentPayload;
  const cycle = recurringPaymentCycle(p.dueDayJalali ?? 1, p.paidThroughCycle);
  const cycleKey = jalaliCycleKey(cycle);
  await db.records.put(
    makeRecord('payment_archive', {
      name: p.name,
      payType: p.payType,
      kind: 'recurring',
      cycleLabel: cycleKey,
      paidAt: new Date().toISOString(),
    } as PaymentArchivePayload),
  );
  await db.records.put({
    ...r,
    payload: { ...p, paidThroughCycle: cycleKey },
    updatedAt: new Date().toISOString(),
  });
}

export async function editPayment(
  recId: string,
  name: string,
  payType: PaymentType,
  kind: PaymentKind,
  dueDayJalali?: number,
  dueDate?: string,
): Promise<void> {
  if (!name.trim()) return;
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as PaymentPayload;
  await db.records.put({
    ...r,
    payload: { ...p, name: name.trim(), payType, kind, dueDayJalali, dueDate },
    updatedAt: new Date().toISOString(),
  });
}

export async function deletePayment(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  await db.records.put({ ...r, deleted: true, updatedAt: new Date().toISOString() });
}
