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

const WEEKDAY_NAMES_FA = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
const JALALI_MONTHS = [
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

function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
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

// Days remaining until the Nth day of the current (or next) Jalali month —
// used for monthly recurring payments like rent or loan installments.
export function daysUntilJalaliDayOfMonth(dueDayJalali: number): number {
  const now = new Date();
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
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
  const clampedTarget = Math.min(dueDayJalali, jalaliMonthLen(targetY, targetM));
  const [gy, gm, gd] = jalaliToGregorian(targetY, targetM, clampedTarget);
  const target = new Date(gy, gm - 1, gd);
  const todayD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - todayD.getTime()) / 86400000);
}

export function daysUntilDate(dueDateISO: string): number {
  const target = new Date(dueDateISO + 'T00:00:00');
  const now = new Date();
  const todayD = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - todayD.getTime()) / 86400000);
}
