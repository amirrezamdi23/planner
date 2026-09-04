import { useEffect, useState, useCallback } from 'react';
import { X, Pencil } from 'lucide-react';
import Collapsible from './Collapsible';
import Switch from './Switch';
import { hashToSlot } from './lib/alarm';
import { scheduleDailyNotification, cancelNotification } from './lib/notifications';
import {
  listNotifications,
  addNotification,
  editNotification,
  setNotificationEnabled,
  deleteNotification,
  ensureDefaultAlarmReminder,
  type AppNotification,
} from './repo';

// A distinct numeric range from the Timer's OS notification ids (1001+) and
// the clock alarm's (5000..~75000, see lib/alarm.ts) so this feature's
// notifications never collide with either.
function notificationNativeId(recId: string): number {
  return 80000 + hashToSlot(recId);
}

async function scheduleOne(n: AppNotification): Promise<void> {
  const [h, m] = n.time.split(':').map(Number);
  await scheduleDailyNotification({
    id: notificationNativeId(n.recId),
    hour: h,
    minute: m,
    title: 'دفترچه‌ی روزانه',
    body: n.text,
    kind: n.kind,
  });
}

export default function NotificationsCard() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [time, setTime] = useState('21:00');
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTime, setEditingTime] = useState('');
  const [editingText, setEditingText] = useState('');

  const reload = useCallback(async () => {
    setItems(await listNotifications());
  }, []);

  // Seed the built-in reminder once, then re-arm every enabled notification
  // against the OS — the same "make the native schedule match app state"
  // reconciliation AlarmCard does for clock alarms, needed for a fresh
  // install, a restored backup, or a native schedule that went stale while
  // the app was closed. Sequenced (not two separate effects) so the seed
  // row is guaranteed to exist before this scheduling pass looks for it.
  useEffect(() => {
    (async () => {
      await ensureDefaultAlarmReminder();
      const current = await listNotifications();
      for (const n of current) {
        if (n.enabled) await scheduleOne(n);
      }
      setItems(current);
    })();
  }, []);

  async function onAdd() {
    if (!text.trim()) return;
    const recId = await addNotification(time, text);
    await scheduleOne({ recId, time, text: text.trim(), kind: 'ok', enabled: true });
    setText('');
    await reload();
  }
  function onStartEdit(n: AppNotification) {
    setEditingId(n.recId);
    setEditingTime(n.time);
    setEditingText(n.text);
  }
  async function onSaveEdit() {
    if (!editingId || !editingText.trim()) return;
    await editNotification(editingId, editingTime, editingText);
    const updated = items.find((n) => n.recId === editingId);
    if (updated) await scheduleOne({ ...updated, time: editingTime, text: editingText.trim() });
    setEditingId(null);
    await reload();
  }
  async function onToggleEnabled(n: AppNotification) {
    const next = !n.enabled;
    await setNotificationEnabled(n.recId, next);
    if (next) await scheduleOne({ ...n, enabled: next });
    else await cancelNotification(notificationNativeId(n.recId));
    await reload();
  }
  async function onDelete(n: AppNotification) {
    await cancelNotification(notificationNativeId(n.recId));
    await deleteNotification(n.recId);
    await reload();
  }

  return (
    <Collapsible title="اعلان‌ها" storageKey="notifications">
      {items.length === 0 && <div className="empty">هنوز اعلانی ثبت نشده.</div>}
      {items.map((n) => {
        const isEditing = editingId === n.recId;
        return (
          <div className="log-item" key={n.recId}>
            {isEditing ? (
              <div style={{ flex: 1 }}>
                <div className="add-row" style={{ marginTop: 0 }}>
                  <input type="time" value={editingTime} onChange={(e) => setEditingTime(e.target.value)} />
                  <input
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onSaveEdit()}
                    autoFocus
                  />
                </div>
                <div className="add-row">
                  <button onClick={onSaveEdit}>ذخیره</button>
                  <button className="link-btn" onClick={() => setEditingId(null)}>
                    انصراف
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1 }}>
                <span className="log-text">
                  {n.time} — {n.text}
                  {n.kind === 'confirm_open_clock' && (
                    <span
                      className="pill"
                      style={{ background: 'var(--paper)', color: 'var(--ink-soft)', marginInlineStart: 6 }}
                    >
                      پیش‌فرض
                    </span>
                  )}
                </span>
              </div>
            )}
            {!isEditing && (
              <div className="icon-row" style={{ gap: 8 }}>
                <button className="habit-del" onClick={() => onStartEdit(n)} title="ویرایش">
                  <Pencil size={16} />
                </button>
                <Switch checked={n.enabled} onChange={() => onToggleEnabled(n)} title={n.enabled ? 'فعال' : 'غیرفعال'} />
                <button className="habit-del" onClick={() => onDelete(n)} title="حذف">
                  <X size={18} />
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div className="add-row">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <input
          placeholder="متن اعلان…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
        />
      </div>
      <div className="add-row">
        <button onClick={onAdd} disabled={!text.trim()}>
          افزودن اعلان
        </button>
      </div>
    </Collapsible>
  );
}
