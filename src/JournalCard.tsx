import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight, Pencil, X, Sunrise, Sunset, NotebookText } from 'lucide-react';
import { dayKey, shiftDayKey, jalaliLabelForDayKey } from './lib/date';
import Collapsible from './Collapsible';
import {
  ensureBulletJournalProject,
  listProjectLog,
  addProjectLogEntry,
  editProjectLogEntry,
  deleteProjectLogEntry,
  type ProjectLogEntry,
  type JournalTag,
} from './repo';

const TODAY = dayKey(0);

const TAGS: { id: JournalTag; label: string; Icon: typeof Sunrise }[] = [
  { id: 'morning', label: 'بازتاب صبح', Icon: Sunrise },
  { id: 'evening', label: 'بازتاب شب', Icon: Sunset },
  { id: 'day', label: 'روز', Icon: NotebookText },
];

// Enter continues a "- " bullet onto the next line (an empty bullet exits the
// list instead, so a line is always one Enter away from plain text); Tab /
// Shift+Tab indent or outdent the current line by two spaces. Both operate
// on the controlled string directly and restore the caret afterward, since
// mutating a React-controlled textarea's DOM value directly would just be
// overwritten by the next render.
function useBulletTextarea(value: string, onChange: (next: string) => void) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function setCaret(pos: number) {
    requestAnimationFrame(() => {
      ref.current?.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const { selectionStart, selectionEnd } = el;
    if (selectionStart !== selectionEnd) return; // only handle a plain caret, not a selection

    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const lineEnd = value.indexOf('\n', selectionStart);
    const line = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd);

    if (e.key === 'Enter') {
      const m = line.match(/^(\s*)-\s(.*)$/);
      if (!m) return;
      e.preventDefault();
      const [, indent, rest] = m;
      if (rest.trim() === '') {
        // An empty bullet: drop the marker and just break the line, so the
        // list doesn't force itself onto every last line.
        const markerStart = lineStart + indent.length;
        onChange(value.slice(0, markerStart) + '\n' + value.slice(selectionEnd));
        setCaret(markerStart + 1);
      } else {
        const insertion = '\n' + indent + '- ';
        onChange(value.slice(0, selectionStart) + insertion + value.slice(selectionEnd));
        setCaret(selectionStart + insertion.length);
      }
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const removed = line.match(/^ {1,2}/)?.[0].length ?? 0;
        if (removed === 0) return;
        onChange(value.slice(0, lineStart) + value.slice(lineStart + removed));
        setCaret(Math.max(lineStart, selectionStart - removed));
      } else {
        onChange(value.slice(0, lineStart) + '  ' + value.slice(lineStart));
        setCaret(selectionStart + 2);
      }
    }
  }

  return { ref, onKeyDown };
}

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

export default function JournalCard() {
  const [viewedDay, setViewedDay] = useState(TODAY);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ProjectLogEntry[]>([]);
  const [tag, setTag] = useState<JournalTag | null>(null);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const bullet = useBulletTextarea(text, setText);
  const editBullet = useBulletTextarea(editingText, setEditingText);

  useEffect(() => {
    ensureBulletJournalProject().then(setProjectId);
  }, []);

  const reload = useCallback(async () => {
    if (!projectId) return;
    const all = await listProjectLog(projectId);
    setEntries(all.filter((e) => e.day === viewedDay));
  }, [projectId, viewedDay]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => autoResize(bullet.ref.current), [text]);
  useEffect(() => autoResize(editBullet.ref.current), [editingText]);

  async function onAdd() {
    if (!projectId || !tag || !text.trim()) return;
    await addProjectLogEntry(projectId, viewedDay, text, tag);
    setText(''); // tag stays selected — writing several entries under it in a row is the common case
    await reload();
  }
  function onStartEdit(e: ProjectLogEntry) {
    setEditingId(e.recId);
    setEditingText(e.text);
  }
  async function onSaveEdit(e: ProjectLogEntry) {
    if (!editingText.trim()) return;
    await editProjectLogEntry(e.recId, editingText);
    setEditingId(null);
    await reload();
  }
  async function onDelete(recId: string) {
    await deleteProjectLogEntry(recId);
    await reload();
  }

  return (
    <Collapsible title="ژورنال" storageKey="journal">
      <div className="day-nav">
        <button className="mini-btn" onClick={() => setViewedDay((d) => shiftDayKey(d, -1))} title="روز قبل">
          <ChevronRight size={16} />
        </button>
        <span className="day-nav-label">
          {viewedDay === TODAY ? 'امروز — ' : ''}
          {jalaliLabelForDayKey(viewedDay)}
        </span>
        <button className="mini-btn" onClick={() => setViewedDay((d) => shiftDayKey(d, 1))} title="روز بعد">
          <ChevronLeft size={16} />
        </button>
        {viewedDay !== TODAY && (
          <button className="link-btn" onClick={() => setViewedDay(TODAY)}>
            برگشت به امروز
          </button>
        )}
      </div>

      {entries.length === 0 && <div className="empty">چیزی برای این روز ثبت نشده.</div>}
      {entries.map((e) => {
        const t = TAGS.find((x) => x.id === e.tag);
        const isEditing = editingId === e.recId;
        return (
          <div className="log-item" key={e.recId}>
            <span className="log-mark">{t && <t.Icon size={15} />}</span>
            <div style={{ flex: 1 }}>
              {t && <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 2 }}>{t.label}</div>}
              {isEditing ? (
                <>
                  <textarea
                    ref={editBullet.ref}
                    className="review journal-textarea"
                    value={editingText}
                    onChange={(ev) => setEditingText(ev.target.value)}
                    onKeyDown={editBullet.onKeyDown}
                    autoFocus
                  />
                  <div className="add-row">
                    <button onClick={() => onSaveEdit(e)}>ذخیره</button>
                    <button className="link-btn" onClick={() => setEditingId(null)}>
                      انصراف
                    </button>
                  </div>
                </>
              ) : (
                <span className="log-text" style={{ whiteSpace: 'pre-wrap' }}>
                  {e.text}
                </span>
              )}
            </div>
            {!isEditing && (
              <>
                <button className="habit-del" onClick={() => onStartEdit(e)} title="ویرایش">
                  <Pencil size={13} />
                </button>
                <button className="habit-del" onClick={() => onDelete(e.recId)} title="حذف">
                  <X size={13} />
                </button>
              </>
            )}
          </div>
        );
      })}

      <div className="type-select">
        {TAGS.map((t) => (
          <button
            key={t.id}
            className={'type-btn' + (tag === t.id ? ' active' : '')}
            onClick={() => setTag((cur) => (cur === t.id ? null : t.id))}
          >
            <t.Icon size={13} /> {t.label}
          </button>
        ))}
      </div>
      {tag && (
        <div className="add-row">
          <textarea
            ref={bullet.ref}
            className="review journal-textarea"
            placeholder="شروع کن به نوشتن… («- » یه بولت می‌سازه)"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={bullet.onKeyDown}
          />
        </div>
      )}
      {tag && (
        <div className="add-row">
          <button onClick={onAdd} disabled={!text.trim()}>
            ثبت
          </button>
        </div>
      )}
    </Collapsible>
  );
}
