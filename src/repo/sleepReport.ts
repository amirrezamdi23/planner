import { shiftDayKey } from '../lib/date';
import { liveByType } from './shared';
import type { LogItemPayload } from './logItems';

// ---------- sleep report ----------
// Pulls every sleep/wake/nap entry ever logged and groups them per "night" —
// a sleep entry on day D pairs with the wake entry on day D+1, since that's
// how the quick-log gate itself records them.
export interface SleepDayReport {
  day: string; // the day the person's "day" was — the evening they went to bed, and where their naps landed
  sleepTime?: string;
  wakeTime?: string; // from the following morning
  nightDurationMin?: number;
  naps: { recId: string; start: string; durationMin: number }[];
  napTotalMin: number;
  napNone: boolean;
  totalSleepMin?: number; // night sleep + naps, the day's real total
  mood?: string; // morning-mood id, logged the same day as the wake entry
}

export async function listSleepReports(): Promise<SleepDayReport[]> {
  const recs = await liveByType('log_item');
  const sleeps = new Map<string, string>();
  const wakes = new Map<string, string>();
  const moods = new Map<string, string>();
  const naps = new Map<string, { recId: string; start: string; durationMin: number }[]>();
  const napNoneDays = new Set<string>();

  for (const r of recs) {
    const p = r.payload as LogItemPayload;
    if (p.itemType === 'sleep') sleeps.set(p.day, p.text);
    else if (p.itemType === 'wake') wakes.set(p.day, p.text);
    else if (p.itemType === 'mood') moods.set(p.day, p.text);
    else if (p.itemType === 'nap') {
      const arr = naps.get(p.day) ?? [];
      arr.push({ recId: r.id, start: p.text, durationMin: p.durationMin ?? 0 });
      naps.set(p.day, arr);
    } else if (p.itemType === 'nap_none') {
      napNoneDays.add(p.day);
    }
  }

  // A "day" in the report is the day the person went to bed (and where their
  // naps happened) — the wake entry is stored under the NEXT day, so it's
  // pulled in by shifting forward. This is what lets a nap taken Tuesday
  // afternoon combine with a sleep that crosses into Wednesday morning into
  // one "Tuesday" total, matching how the person actually experienced it.
  const days = new Set<string>([
    ...sleeps.keys(),
    ...naps.keys(),
    ...napNoneDays,
    ...[...wakes.keys()].map((wd) => shiftDayKey(wd, -1)),
  ]);

  const result: SleepDayReport[] = [];
  for (const day of days) {
    const sleepTime = sleeps.get(day);
    const nextDay = shiftDayKey(day, 1);
    const wakeTime = wakes.get(nextDay);
    let nightDurationMin: number | undefined;
    if (sleepTime && wakeTime) {
      // A bedtime entered as e.g. "00:10" is grouped under this "night" for
      // reporting purposes, but the clock instant it names has already
      // rolled into the next calendar day — treat any early-morning bedtime
      // (before noon) as landing on `nextDay` so the elapsed-time math is
      // correct instead of counting a bogus extra ~24 hours.
      const sleepHour = parseInt(sleepTime.split(':')[0], 10);
      const sleepDay = sleepHour < 12 ? nextDay : day;
      const sleepDt = new Date(`${sleepDay}T${sleepTime}:00`);
      const wakeDt = new Date(`${nextDay}T${wakeTime}:00`);
      nightDurationMin = Math.round((wakeDt.getTime() - sleepDt.getTime()) / 60000);
    }
    const napList = (naps.get(day) ?? []).sort((a, b) => a.start.localeCompare(b.start));
    const napTotalMin = napList.reduce((sum, n) => sum + n.durationMin, 0);
    const totalSleepMin =
      nightDurationMin !== undefined || napTotalMin > 0 ? (nightDurationMin ?? 0) + napTotalMin : undefined;
    result.push({
      day,
      sleepTime,
      wakeTime,
      nightDurationMin,
      naps: napList,
      napTotalMin,
      napNone: napNoneDays.has(day),
      totalSleepMin,
      mood: moods.get(nextDay),
    });
  }
  return result.sort((a, b) => b.day.localeCompare(a.day));
}
