import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Pencil, X, Minus } from 'lucide-react';
import { dayKey, shiftDayKey, jalaliLabelForDayKey, daysBetweenDayKeys } from './lib/date';
import Collapsible from './Collapsible';
import {
  listDailyReviewEntries,
  addDailyReviewEntry,
  editDailyReviewEntry,
  deleteDailyReviewEntry,
  type DailyReviewEntry,
} from './repo';

const TODAY = dayKey(0);
// Past reviews stay editable for a week — long enough to fix a typo or finish
// a thought, short enough that old entries settle into a record.
const REVIEW_EDIT_WINDOW_DAYS = 7;

export default function DailyReviewCard() {
  const [reviewDay, setReviewDay] = useState(TODAY);
  const [reviewInput, setReviewInput] = useState('');
  const [entries, setEntries] = useState<DailyReviewEntry[]>([]);
  const [listOpen, setListOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const reload = useCallback(async () => {
    setEntries(await listDailyReviewEntries());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function onAdd() {
    if (!reviewInput.trim()) return;
    await addDailyReviewEntry(reviewDay, reviewInput);
    setReviewInput('');
    await reload();
  }
  async function onDelete(recId: string) {
    await deleteDailyReviewEntry(recId);
    await reload();
  }
  function onStartEdit(e: DailyReviewEntry) {
    setEditingId(e.recId);
    setEditText(e.text);
  }
  async function onSaveEdit() {
    if (!editingId) return;
    await editDailyReviewEntry(editingId, editText);
    setEditingId(null);
    setEditText('');
    await reload();
  }

  return (
    <Collapsible title="مرور روزانه" storageKey="dailyreview">
      <div className="day-nav">
        <button className="mini-btn" onClick={() => setReviewDay((d) => shiftDayKey(d, -1))} title="روز قبل">
          <ChevronRight size={16} />
        </button>
        <span className="day-nav-label">
          {reviewDay === TODAY ? 'برای امروز — ' : 'برای '}
          {jalaliLabelForDayKey(reviewDay)}
        </span>
        <button className="mini-btn" onClick={() => setReviewDay((d) => shiftDayKey(d, 1))} title="روز بعد">
          <ChevronLeft size={16} />
        </button>
        {reviewDay !== TODAY && (
          <button className="link-btn" onClick={() => setReviewDay(TODAY)}>
            برگشت به امروز
          </button>
        )}
      </div>
      <textarea
        className="review"
        placeholder="چی گذشت؟ (۲-۳ خط کافیه)"
        value={reviewInput}
        onChange={(e) => setReviewInput(e.target.value)}
      />
      <div className="add-row">
        <button onClick={onAdd}>ثبت</button>
      </div>

      <button className="link-btn chevron-inline" style={{ marginTop: 10 }} onClick={() => setListOpen((v) => !v)}>
        <span className={'chevron-btn small' + (listOpen ? '' : ' collapsed')}>
          <ChevronDown size={14} />
        </span>
        {listOpen ? 'پنهان کردن لیست مرورها' : `نمایش لیست مرورها (${entries.length})`}
      </button>

      {listOpen &&
        (entries.length === 0 ? (
          <div className="empty">هنوز مروری ثبت نشده.</div>
        ) : (
          <div className="proj-history">
            {entries.map((e) => {
              const editable = Math.abs(daysBetweenDayKeys(e.day, TODAY)) <= REVIEW_EDIT_WINDOW_DAYS;
              const isEditing = editingId === e.recId;
              return (
                <div className="log-item" key={e.recId}>
                  <span className="log-mark">
                    <Minus size={15} />
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="review-meta">
                      <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{jalaliLabelForDayKey(e.day)}</span>
                    </div>
                    {isEditing ? (
                      <>
                        <textarea
                          className="review"
                          style={{ minHeight: 60 }}
                          value={editText}
                          onChange={(ev) => setEditText(ev.target.value)}
                        />
                        <div className="add-row">
                          <button onClick={onSaveEdit}>ذخیره</button>
                          <button className="link-btn" onClick={() => setEditingId(null)}>
                            انصراف
                          </button>
                        </div>
                      </>
                    ) : (
                      <span className="log-text">{e.text}</span>
                    )}
                  </div>
                  {!isEditing && editable && (
                    <button className="habit-del" onClick={() => onStartEdit(e)} title="ویرایش">
                      <Pencil size={13} />
                    </button>
                  )}
                  <button className="habit-del" onClick={() => onDelete(e.recId)} title="حذف">
                    <X size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
    </Collapsible>
  );
}
