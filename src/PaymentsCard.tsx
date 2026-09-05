import { useEffect, useState, useCallback } from 'react';
import { Square, SquareCheckBig, X, ChevronDown, Pencil, Landmark, CalendarClock, TrendingDown, Repeat, CircleDot, type LucideIcon } from 'lucide-react';
import {
  daysUntilRecurring,
  daysUntilDate,
  jalaliOrdinalDay,
  jalaliDateOnlyLabel,
  jalaliTupleForDayKey,
  todayJalali,
  isInCurrentJalaliMonth,
  JALALI_MONTHS,
} from './lib/date';
import {
  listPayments,
  addPayment,
  editPayment,
  markOncePaymentPaid,
  advanceRecurringPayment,
  deletePayment,
  listPaymentArchive,
  deletePaymentArchiveEntry,
  type Payment,
  type PaymentKind,
  type PaymentType,
  type PaymentArchiveEntry,
} from './repo';
import JalaliDateInput from './JalaliDateInput';
import Collapsible from './Collapsible';

const PAY_TYPES: { id: PaymentType; label: string; Icon: LucideIcon }[] = [
  { id: 'check', label: 'چک', Icon: Landmark },
  { id: 'installment', label: 'قسط', Icon: CalendarClock },
  { id: 'debt', label: 'بدهی', Icon: TrendingDown },
];
const PAY_KINDS: { id: PaymentKind; label: string; Icon: LucideIcon }[] = [
  { id: 'recurring', label: 'تکرارشونده‌ی ماهانه', Icon: Repeat },
  { id: 'once', label: 'فقط یک‌بار', Icon: CircleDot },
];

// Exclusive-select pills that start icon-only and widen to reveal their
// label when picked — the label span always renders so its max-width can
// transition instead of the text popping in/out.
function IconPillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string; Icon: LucideIcon }[];
  value: T | null;
  onChange: (id: T) => void;
}) {
  return (
    <div className="iconpill-row">
      {options.map((opt) => (
        <button
          key={opt.id}
          className={'iconpill' + (value === opt.id ? ' expanded' : '')}
          onClick={() => onChange(opt.id)}
          title={opt.label}
        >
          <opt.Icon size={15} />
          <span className="iconpill-label">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function PaymentsCard() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [name, setName] = useState('');
  // Defaults to the first type rather than null — an unset, invisible
  // required field (no CSS distinguished an enabled button from a disabled
  // one; see the button:disabled rule added for this) meant "افزودن"
  // silently did nothing until a type was picked, which read as broken.
  const [payType, setPayType] = useState<PaymentType | null>(PAY_TYPES[0].id);
  const [kind, setKind] = useState<PaymentKind>('recurring');
  const [dueDay, setDueDay] = useState('1');
  const [dueJalali, setDueJalali] = useState<[number, number, number]>(todayJalali());
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showOthers, setShowOthers] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);
  const [archive, setArchive] = useState<PaymentArchiveEntry[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPayType, setEditPayType] = useState<PaymentType | null>(null);
  const [editKind, setEditKind] = useState<PaymentKind>('recurring');
  const [editDueDay, setEditDueDay] = useState('1');
  const [editDueJalali, setEditDueJalali] = useState<[number, number, number]>(todayJalali());
  const [editDueDate, setEditDueDate] = useState(() => new Date().toISOString().slice(0, 10));

  const reload = useCallback(async () => {
    setPayments(await listPayments());
  }, []);
  const reloadArchive = useCallback(async () => {
    setArchive(await listPaymentArchive());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => {
    reloadArchive();
  }, [reloadArchive]);

  async function onAdd() {
    if (!name.trim() || !payType) return;
    if (kind === 'recurring') {
      await addPayment(name, payType, 'recurring', Math.min(31, Math.max(1, parseInt(dueDay, 10) || 1)));
    } else {
      await addPayment(name, payType, 'once', undefined, dueDate);
    }
    setName('');
    setPayType(null);
    await reload();
  }

  function openEditForm(p: Payment) {
    setEditingId(p.recId);
    setEditName(p.name);
    setEditPayType(p.payType ?? null);
    setEditKind(p.kind);
    setEditDueDay(String(p.dueDayJalali ?? 1));
    if (p.dueDate) {
      setEditDueJalali(jalaliTupleForDayKey(p.dueDate));
      setEditDueDate(p.dueDate);
    } else {
      setEditDueJalali(todayJalali());
      setEditDueDate(new Date().toISOString().slice(0, 10));
    }
  }
  async function onSaveEdit() {
    if (!editingId || !editName.trim() || !editPayType) return;
    if (editKind === 'recurring') {
      await editPayment(editingId, editName, editPayType, 'recurring', Math.min(31, Math.max(1, parseInt(editDueDay, 10) || 1)));
    } else {
      await editPayment(editingId, editName, editPayType, 'once', undefined, editDueDate);
    }
    setEditingId(null);
    await reload();
  }

  const withDays = payments.map((p) => ({
    p,
    days:
      p.kind === 'recurring'
        ? daysUntilRecurring(p.dueDayJalali ?? 1, p.paidThroughCycle)
        : daysUntilDate(p.dueDate ?? dueDate),
  }));

  // Overdue once-payments are pulled out and always pinned at the top,
  // regardless of month, until the user checks them off — they shouldn't be
  // able to silently scroll out of view behind "نمایش بقیه".
  const overdue = withDays
    .filter(({ p, days }) => p.kind === 'once' && !p.paid && days < 0)
    .sort((a, b) => a.days - b.days);
  const overdueIds = new Set(overdue.map(({ p }) => p.recId));

  // Recurring payments recur every month, so they're always "current" — only
  // one-time payments get tucked away when their due date is in another month.
  const thisMonth = withDays
    .filter(
      ({ p }) => !overdueIds.has(p.recId) && (p.kind === 'recurring' || (p.dueDate && isInCurrentJalaliMonth(p.dueDate))),
    )
    .sort((a, b) => a.days - b.days);
  const others = withDays
    .filter(({ p }) => !overdueIds.has(p.recId) && p.kind === 'once' && p.dueDate && !isInCurrentJalaliMonth(p.dueDate))
    .sort((a, b) => a.days - b.days);

  function monthKeyOf(dueDate: string): string {
    const [jy, jm] = jalaliTupleForDayKey(dueDate);
    return `${jy}-${jm}`;
  }
  function monthLabelOf(monthKey: string): string {
    const [jy, jm] = monthKey.split('-').map(Number);
    return `${JALALI_MONTHS[jm - 1]} ${jy}`;
  }
  // Distinct upcoming months among "others", nearest first — so the user can
  // pick a specific future month instead of scrolling one long flat list.
  const otherMonths = Array.from(new Set(others.map(({ p }) => monthKeyOf(p.dueDate!)))).sort((a, b) => {
    const [ay, am] = a.split('-').map(Number);
    const [by, bm] = b.split('-').map(Number);
    return ay - by || am - bm;
  });
  const visibleOthers = monthFilter ? others.filter(({ p }) => monthKeyOf(p.dueDate!) === monthFilter) : others;

  function renderRow({ p, days }: { p: Payment; days: number }) {
    if (editingId === p.recId) {
      return (
        <div className="pay-row" key={p.recId} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="add-row" style={{ marginTop: 0 }}>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} />
            {editKind === 'recurring' ? (
              <input
                type="number"
                min="1"
                max="31"
                style={{ maxWidth: 90 }}
                placeholder="روز ماه"
                value={editDueDay}
                onChange={(e) => setEditDueDay(e.target.value)}
              />
            ) : (
              <JalaliDateInput
                value={editDueJalali}
                onChange={(jalali, dk) => {
                  setEditDueJalali(jalali);
                  setEditDueDate(dk);
                }}
              />
            )}
          </div>
          <IconPillGroup options={PAY_TYPES} value={editPayType} onChange={setEditPayType} />
          <IconPillGroup options={PAY_KINDS} value={editKind} onChange={setEditKind} />
          <div className="add-row">
            <button onClick={onSaveEdit} disabled={!editName.trim() || !editPayType}>
              ذخیره
            </button>
            <button className="link-btn" onClick={() => setEditingId(null)}>
              انصراف
            </button>
          </div>
        </div>
      );
    }
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
    const checked = p.kind === 'once' ? p.paid : false;
    const payTypeInfo = PAY_TYPES.find((t) => t.id === p.payType);
    return (
      <div className={'pay-row' + (overdue ? ' overdue' : soon ? ' soon' : '')} key={p.recId}>
        <button
          className={'pay-check' + (checked ? ' checked' : '')}
          onClick={async () => {
            if (p.kind === 'once') await markOncePaymentPaid(p.recId);
            else await advanceRecurringPayment(p.recId);
            await reload();
            await reloadArchive();
          }}
          title={p.kind === 'recurring' ? 'این دوره پرداخت شد — برو دوره‌ی بعد' : 'پرداخت شد؟'}
        >
          {checked ? <SquareCheckBig size={13} /> : <Square size={13} />}
        </button>
        <span className="pay-name">
          {payTypeInfo && (
            <span className="icon-row" title={payTypeInfo.label} style={{ marginInlineEnd: 4 }}>
              <payTypeInfo.Icon size={12} />
            </span>
          )}
          {p.name}
          {p.kind === 'recurring' && (
            <span className="pay-sub"> — هر ماه {jalaliOrdinalDay(p.dueDayJalali ?? 1)}</span>
          )}
          {p.kind === 'once' && p.dueDate && <span className="pay-sub"> — {jalaliDateOnlyLabel(p.dueDate)}</span>}
        </span>
        <span className="pay-days">{label}</span>
        <button className="habit-del" onClick={() => openEditForm(p)} title="ویرایش">
          <Pencil size={13} />
        </button>
        <button
          className="habit-del"
          onClick={async () => {
            await deletePayment(p.recId);
            await reload();
          }}
          title="حذف"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <Collapsible title="پرداخت‌ها" storageKey="payments">
      {overdue.length === 0 && thisMonth.length === 0 && others.length === 0 && (
        <div className="empty">پرداختی ثبت نشده.</div>
      )}
      {overdue.map(renderRow)}
      {thisMonth.map(renderRow)}

      {others.length > 0 && (
        <>
          <button className="link-btn chevron-inline" onClick={() => setShowOthers((v) => !v)}>
            <span className={'chevron-btn small' + (showOthers ? '' : ' collapsed')}>
              <ChevronDown size={14} />
            </span>
            {showOthers ? 'پنهان کردن بقیه' : `نمایش بقیه (${others.length} مورد)`}
          </button>
          {showOthers && otherMonths.length > 1 && (
            <div className="type-select">
              <button className={'type-btn' + (monthFilter === null ? ' active' : '')} onClick={() => setMonthFilter(null)}>
                همه‌ی ماه‌ها
              </button>
              {otherMonths.map((mk) => (
                <button
                  key={mk}
                  className={'type-btn' + (monthFilter === mk ? ' active' : '')}
                  onClick={() => setMonthFilter((cur) => (cur === mk ? null : mk))}
                >
                  {monthLabelOf(mk)}
                </button>
              ))}
            </div>
          )}
          {showOthers && visibleOthers.map(renderRow)}
        </>
      )}

      {archive.length > 0 && (
        <>
          <button className="link-btn chevron-inline" onClick={() => setShowArchive((v) => !v)}>
            <span className={'chevron-btn small' + (showArchive ? '' : ' collapsed')}>
              <ChevronDown size={14} />
            </span>
            {showArchive ? 'پنهان کردن آرشیو' : `آرشیو (${archive.length} مورد)`}
          </button>
          {showArchive &&
            archive.map((a) => {
              const payTypeInfo = PAY_TYPES.find((t) => t.id === a.payType);
              const cycleText = a.kind === 'recurring' ? monthLabelOf(a.cycleLabel) : a.cycleLabel ? jalaliDateOnlyLabel(a.cycleLabel) : '';
              return (
                <div className="pay-row" key={a.recId}>
                  <span className="icon-row" style={{ color: 'var(--teal)' }}>
                    <SquareCheckBig size={13} />
                  </span>
                  <span className="pay-name">
                    {payTypeInfo && (
                      <span className="icon-row" title={payTypeInfo.label} style={{ marginInlineEnd: 4 }}>
                        <payTypeInfo.Icon size={12} />
                      </span>
                    )}
                    {a.name}
                    {cycleText && <span className="pay-sub"> — {cycleText}</span>}
                  </span>
                  <button
                    className="habit-del"
                    onClick={async () => {
                      await deletePaymentArchiveEntry(a.recId);
                      await reloadArchive();
                    }}
                    title="حذف از آرشیو"
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            })}
        </>
      )}

      <IconPillGroup options={PAY_TYPES} value={payType} onChange={setPayType} />
      <IconPillGroup options={PAY_KINDS} value={kind} onChange={setKind} />

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
        <button onClick={onAdd} disabled={!name.trim() || !payType}>
          افزودن
        </button>
      </div>
    </Collapsible>
  );
}
