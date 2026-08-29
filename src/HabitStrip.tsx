import { useCallback, useEffect, useState } from 'react';
import { dayKey } from './lib/date';
import { listHabits, checkedHabitIds, toggleHabitCheck, type Habit } from './repo';

const TODAY = dayKey(0);

// The full habits card lives behind the Browse tab, which is two taps away —
// too far for something that has to be ticked every day. This is just today's
// circles, on the home page, above everything else. Renders nothing at all
// when no habits are defined, so it never becomes clutter.
export default function HabitStrip() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    setHabits(await listHabits());
    setChecked(await checkedHabitIds(TODAY));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  async function onToggle(habitId: string) {
    await toggleHabitCheck(habitId, TODAY);
    await reload();
  }

  if (habits.length === 0) return null;

  return (
    <div className="habit-strip">
      {habits.map((h) => {
        const on = checked.has(h.id);
        return (
          <button
            key={h.recId}
            className={'habit-strip-item' + (on ? ' on' : '')}
            onClick={() => onToggle(h.id)}
            title={h.name}
          >
            <span className="habit-strip-dot">{h.icon}</span>
            <span className="habit-strip-name">{h.name}</span>
          </button>
        );
      })}
    </div>
  );
}
