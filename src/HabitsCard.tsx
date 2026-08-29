import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import Collapsible from './Collapsible';
import { dayKey, shiftDayKey, jalaliSlashDateForDayKey } from './lib/date';
import { listHabits, addHabit, deleteHabit, checkedHabitIds, toggleHabitCheck, type Habit } from './repo';

const TODAY = dayKey(0);
// A week of history per habit — enough to see a streak forming without the
// row turning into a wall of dots.
const HISTORY_DAYS = 7;
const WEEKDAY_SHORT_FA = ['۱ش', '۲ش', '۳ش', '۴ش', '۵ش', 'ج', 'ش']; // by Date#getDay()

function weekdayShort(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return WEEKDAY_SHORT_FA[new Date(y, m - 1, d).getDay()];
}

// Oldest first, ending on today.
const DAYS = Array.from({ length: HISTORY_DAYS }, (_, i) => shiftDayKey(TODAY, i - (HISTORY_DAYS - 1)));

const ICON_CHOICES = ['✦', '🏋️', '📈', '📖', '💧', '🧘', '🌙', '🦷', '🧹', '✍️'];

export default function HabitsCard() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checks, setChecks] = useState<Record<string, Set<string>>>({});
  const [nameInput, setNameInput] = useState('');
  const [icon, setIcon] = useState(ICON_CHOICES[0]);

  const reload = useCallback(async () => {
    const list = await listHabits();
    setHabits(list);
    const perDay: Record<string, Set<string>> = {};
    for (const day of DAYS) perDay[day] = await checkedHabitIds(day);
    setChecks(perDay);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function onToggle(habitId: string, day: string) {
    await toggleHabitCheck(habitId, day);
    await reload();
  }
  async function onAdd() {
    if (!nameInput.trim()) return;
    await addHabit(nameInput, icon);
    setNameInput('');
    await reload();
  }
  async function onDelete(recId: string) {
    if (!window.confirm('این عادت و سابقه‌اش حذف بشه؟')) return;
    await deleteHabit(recId);
    await reload();
  }

  // Consecutive days checked, counting back from today. Today not being
  // checked yet doesn't break a streak — it just hasn't been extended.
  function streakOf(habitId: string): number {
    let n = 0;
    for (let i = DAYS.length - 1; i >= 0; i--) {
      const day = DAYS[i];
      if (checks[day]?.has(habitId)) n++;
      else if (day !== TODAY) break;
    }
    return n;
  }

  const doneToday = habits.filter((h) => checks[TODAY]?.has(h.id)).length;

  return (
    <Collapsible title="عادت‌ها" storageKey="habits">
      {habits.length === 0 ? (
        <div className="empty">هنوز عادتی تعریف نکردی. با یکی دو تا شروع کن، نه ده تا.</div>
      ) : (
        <>
          <div className="habit-today-count">
            امروز {doneToday} از {habits.length}
          </div>
          <div className="habit-grid-wrap">
            <table className="habit-grid">
              <thead>
                <tr>
                  <th />
                  {DAYS.map((d) => (
                    <th key={d} title={jalaliSlashDateForDayKey(d)} className={d === TODAY ? 'is-today' : ''}>
                      {weekdayShort(d)}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {habits.map((h) => {
                  const streak = streakOf(h.id);
                  return (
                    <tr key={h.recId}>
                      <td className="habit-grid-name">
                        <span className="habit-grid-icon">{h.icon}</span>
                        {h.name}
                        {streak > 1 && <span className="habit-streak">{streak} روز</span>}
                      </td>
                      {DAYS.map((d) => {
                        const on = checks[d]?.has(h.id) ?? false;
                        return (
                          <td key={d}>
                            <button
                              className={'habit-dot' + (on ? ' on' : '') + (d === TODAY ? ' is-today' : '')}
                              onClick={() => onToggle(h.id, d)}
                              aria-label={`${h.name} — ${jalaliSlashDateForDayKey(d)}`}
                            >
                              {on && <Check size={12} />}
                            </button>
                          </td>
                        );
                      })}
                      <td>
                        <button className="habit-del" onClick={() => onDelete(h.recId)} title="حذف">
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="add-row">
        <input
          placeholder="عادت جدید (مثلاً باشگاه، بک‌تست طلا)…"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onAdd()}
        />
      </div>
      <div className="add-row">
        <div className="habit-icon-picker">
          {ICON_CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              className={'habit-icon-btn' + (icon === c ? ' active' : '')}
              onClick={() => setIcon(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <button onClick={onAdd}>افزودن</button>
      </div>
    </Collapsible>
  );
}
