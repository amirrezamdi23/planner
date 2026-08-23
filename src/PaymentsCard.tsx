import { useEffect, useState, useCallback } from 'react';
import { daysUntilJalaliDayOfMonth, daysUntilDate, jalaliOrdinalDay, jalaliDateOnlyLabel, todayJalali } from './lib/date';
import { listPayments, addPayment, togglePaymentPaid, deletePayment, type Payment, type PaymentKind } from './repo';
import JalaliDateInput from './JalaliDateInput';
import Collapsible from './Collapsible';

export default function PaymentsCard() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PaymentKind>('recurring');
  const [dueDay, setDueDay] = useState('1');
  const [dueJalali, setDueJalali] = useState<[number, number, number]>(todayJalali());
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));

  const reload = useCallback(async () => {
    setPayments(await listPayments());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function onAdd() {
    if (!name.trim()) return;
    if (kind === 'recurring') {
      await addPayment(name, 'recurring', Math.min(31, Math.max(1, parseInt(dueDay, 10) || 1)));
    } else {
      await addPayment(name, 'once', undefined, dueDate);
    }
    setName('');
    await reload();
  }

  const withDays = payments
    .map((p) => ({
      p,
      days: p.kind === 'recurring' ? daysUntilJalaliDayOfMonth(p.dueDayJalali ?? 1) : daysUntilDate(p.dueDate ?? dueDate),
    }))
    .sort((a, b) => a.days - b.days);

  return (
    <Collapsible title="پرداخت‌ها و اقساط" storageKey="payments">
      {withDays.length === 0 && <div className="empty">پرداختی ثبت نشده.</div>}
      {withDays.map(({ p, days }) => {
        const overdue = p.kind === 'once' && days < 0 && !p.paid;
        const soon = !overdue && days <= 3 && !(p.kind === 'once' && p.paid);
        let label: string;
        if (p.kind === 'recurring') {
          label = days === 0 ? 'امروز موعدشه' : `${days} روز مانده`;
        } else if (p.paid) {
          label = 'پرداخت شد';
        } else {
          label = days < 0 ? `${Math.abs(days)} روز گذشته` : days === 0 ? 'امروز موعدشه' : `${days} روز مانده`;
        }
        return (
          <div className={'pay-row' + (overdue ? ' overdue' : soon ? ' soon' : '')} key={p.recId}>
            <span className="pay-name">
              {p.name}
              {p.kind === 'recurring' && (
                <span className="pay-sub"> — هر ماه {jalaliOrdinalDay(p.dueDayJalali ?? 1)}</span>
              )}
              {p.kind === 'once' && p.dueDate && (
                <span className="pay-sub"> — {jalaliDateOnlyLabel(p.dueDate)}</span>
              )}
            </span>
            <span className="pay-days">{label}</span>
            {p.kind === 'once' && (
              <button
                className="habit-del"
                style={{ opacity: 1, color: p.paid ? 'var(--teal)' : 'var(--ink-soft)' }}
                onClick={async () => {
                  await togglePaymentPaid(p.recId);
                  await reload();
                }}
                title="پرداخت شد؟"
              >
                {p.paid ? '✓' : '○'}
              </button>
            )}
            <button
              className="habit-del"
              onClick={async () => {
                await deletePayment(p.recId);
                await reload();
              }}
              title="حذف"
            >
              ✕
            </button>
          </div>
        );
      })}

      <div className="type-select">
        <button className={'type-btn' + (kind === 'recurring' ? ' active' : '')} onClick={() => setKind('recurring')}>
          تکرارشونده‌ی ماهانه
        </button>
        <button className={'type-btn' + (kind === 'once' ? ' active' : '')} onClick={() => setKind('once')}>
          فقط یک‌بار
        </button>
      </div>

      <div className="add-row">
        <input placeholder="نام (مثلاً اجاره، قسط وام)" value={name} onChange={(e) => setName(e.target.value)} />
        {kind === 'recurring' ? (
          <input
            type="number"
            min="1"
            max="31"
            style={{ maxWidth: 90 }}
            placeholder="روز ماه"
            value={dueDay}
            onChange={(e) => setDueDay(e.target.value)}
          />
        ) : (
          <JalaliDateInput
            value={dueJalali}
            onChange={(jalali, dayKey) => {
              setDueJalali(jalali);
              setDueDate(dayKey);
            }}
          />
        )}
        <button onClick={onAdd}>افزودن</button>
      </div>
    </Collapsible>
  );
}
