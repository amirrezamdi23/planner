import { JALALI_MONTHS, jalaliMonthLen, jalaliToGregorian, todayJalali } from './lib/date';

// A Jalali (day, month, year) picker whose value is still stored/emitted as a
// Gregorian day-key ("YYYY-MM-DD") — the rest of the app never has to know
// this input speaks Jalali internally.
export default function JalaliDateInput({
  value,
  onChange,
}: {
  value: [number, number, number]; // [jy, jm, jd]
  onChange: (jalali: [number, number, number], dayKey: string) => void;
}) {
  const [jy, jm, jd] = value;
  const monthLen = jalaliMonthLen(jy, jm);

  function set(next: [number, number, number]) {
    const [ny, nm, nd] = next;
    const clampedDay = Math.min(nd, jalaliMonthLen(ny, nm));
    const [gy, gm, gd] = jalaliToGregorian(ny, nm, clampedDay);
    const dayKey = `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
    onChange([ny, nm, clampedDay], dayKey);
  }

  return (
    <div className="jdate">
      <select value={jd} onChange={(e) => set([jy, jm, Number(e.target.value)])}>
        {Array.from({ length: monthLen }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select value={jm} onChange={(e) => set([jy, Number(e.target.value), jd])}>
        {JALALI_MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select value={jy} onChange={(e) => set([Number(e.target.value), jm, jd])}>
        {Array.from({ length: 6 }, (_, i) => todayJalali()[0] - 1 + i).map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
