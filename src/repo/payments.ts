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

export async function togglePaymentPaid(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as PaymentPayload;
  await db.records.put({
    ...r,
    payload: { ...p, paid: !p.paid },
    updatedAt: new Date().toISOString(),
  });
}

// Mark the currently-shown cycle of a recurring payment as paid — the row
// then advances to show the next due date instead of disappearing forever.
export async function advanceRecurringPayment(recId: string): Promise<void> {
  const r = await db.records.get(recId);
  if (!r) return;
  const p = r.payload as PaymentPayload;
  const cycle = recurringPaymentCycle(p.dueDayJalali ?? 1, p.paidThroughCycle);
  await db.records.put({
    ...r,
    payload: { ...p, paidThroughCycle: jalaliCycleKey(cycle) },
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
