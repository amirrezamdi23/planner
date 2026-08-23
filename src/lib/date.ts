// All storage keys use the LOCAL calendar date (never toISOString(), which is UTC
// and silently shifts the "day" during Iran's early morning hours, ~00:00-03:30).

export function dayKey(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function shiftDayKey(key: string, deltaDays: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  const ny = date.getFullYear();
  const nm = String(date.getMonth() + 1).padStart(2, '0');
  const nd = String(date.getDate()).padStart(2, '0');
  return `${ny}-${nm}-${nd}`;
}

const WEEKDAY_NAMES_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number, jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

export function todayJalaliLabel(): string {
  const now = new Date();
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return `${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`;
}

export function todayWeekdayLabel(): string {
  return WEEKDAY_NAMES_FA[new Date().getDay()];
}

export function jalaliLabelForDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const [jy, jm, jd] = gregorianToJalali(y, m, d);
  const weekday = WEEKDAY_NAMES_FA[date.getDay()];
  return `${weekday} ${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`;
}

export function jalaliMonthLen(_jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Approximation good enough for due-date math (leap-year exactness of
  // Esfand 29 vs 30 doesn't matter when clamping a "day of month" like 31).
  return 29;
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  let gy = jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;
  let days = 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor((days - 1) / 36524);
    days = (days - 1) % 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const isLeapG = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const monthLens = [0, 31, isLeapG ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 1;
  for (; gm < 13; gm++) {
    if (gd <= monthLens[gm]) break;
    gd -= monthLens[gm];
  }
  return [gy, gm, gd];
}

export type JalaliCycle = { y: number; m: number };

export function jalaliCycleKey(c: JalaliCycle): string {
  return `${c.y}-${String(c.m).padStart(2, '0')}`;
}

function nextJalaliCycle(c: JalaliCycle): JalaliCycle {
  return c.m === 12 ? { y: c.y + 1, m: 1 } : { y: c.y, m: c.m + 1 };
}

// The Jalali year-month whose `dueDayJalali` is the next occurrence from
// today's actual date — ignores any "already paid" bookkeeping.
function naturalDueCycle(dueDayJalali: number): JalaliCycle {
  const [jy, jm, jd] = todayJalali();
  let targetM = jm;
  let targetY = jy;
  const clampedDay = Math.min(dueDayJalali, jalaliMonthLen(jy, jm));
  if (jd > clampedDay) {
    targetM = jm + 1;
    if (targetM > 12) {
      targetM = 1;
      targetY = jy + 1;
    }
  }
  return { y: targetY, m: targetM };
}

// The cycle to actually display: the natural next occurrence, skipped
// forward past any cycle already marked paid (see `paidThroughCycle`).
export function recurringPaymentCycle(dueDayJalali: number, paidThroughCycle?: string): JalaliCycle {
  let cycle = naturalDueCycle(dueDayJalali);
  let guard = 0;
  while (paidThroughCycle && jalaliCycleKey(cycle) <= paidThroughCycle && guard < 24) {
    cycle = nextJalaliCycle(cycle);
    guard++;
  }
  return cycle;
}

function daysUntilCycle(cycle: JalaliCycle, dueDayJalali: number): number {
  const clampedTarget = Math.min(dueDayJalali, jalaliMonthLen(cycle.y, cycle.m));
  const [gy, gm, gd] = jalaliToGregorian(cycle.y, cycle.m, clampedTarget);
  const target = new Date(gy, gm - 1, gd);
  const now = new Date();
  const todayD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - todayD.getTime()) / 86400000);
}

// Days remaining until a monthly recurring payment's next due date — the
// current cycle by default, or the first not-yet-paid cycle if some were
// already marked paid ahead of the calendar catching up.
export function daysUntilRecurring(dueDayJalali: number, paidThroughCycle?: string): number {
  return daysUntilCycle(recurringPaymentCycle(dueDayJalali, paidThroughCycle), dueDayJalali);
}

export function isInCurrentJalaliMonth(key: string): boolean {
  const [y, m, d] = key.split('-').map(Number);
  const [jy, jm] = gregorianToJalali(y, m, d);
  const [cy, cm] = todayJalali();
  return jy === cy && jm === cm;
}

export function todayJalali(): [number, number, number] {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function jalaliDateOnlyLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const [jy, jm, jd] = gregorianToJalali(y, m, d);
  return `${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`;
}

export function jalaliOrdinalDay(day: number): string {
  return day === 1 ? 'اول' : `${day} اُم`;
}

export function daysBetweenDayKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const da = new Date(ay, am - 1, ad);
  const db2 = new Date(by, bm - 1, bd);
  return Math.round((db2.getTime() - da.getTime()) / 86400000);
}

export function daysUntilDate(dueDateISO: string): number {
  const target = new Date(dueDateISO + 'T00:00:00');
  const now = new Date();
  const todayD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - todayD.getTime()) / 86400000);
}
