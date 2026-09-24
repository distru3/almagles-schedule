export const WEEKDAY_NAMES = {
  sat: 'السبت',
  sun: 'الأحد',
  mon: 'الاثنين',
  tue: 'الثلاثاء',
  wed: 'الأربعاء',
  thu: 'الخميس',
  fri: 'الجمعة',
} as const;

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isValidISODate(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(new Date(`${iso}T12:00:00`).getTime());
}

const hijriFormatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const gregorianShortFormatter = new Intl.DateTimeFormat('ar', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

/** e.g. "٨ صفر ١٤٤٨ هـ" */
export function formatHijri(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return hijriFormatter.format(date);
}

/** e.g. "٨ أغسطس ٢٠٢٦" */
export function formatGregorianShort(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return gregorianShortFormatter.format(date);
}

/** Weekday in Arabic for a given ISO date: "السبت" etc. */
export function formatWeekday(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const key = (['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const)[(d.getDay() + 1) % 7];
  return WEEKDAY_NAMES[key];
}

/** Given a date or ISO string, get the Monday of that week. Week starts on Monday. */
export function getMondayOfWeek(d: Date | string): Date {
  const date = typeof d === 'string' ? new Date(`${d}T12:00:00`) : new Date(d);
  const day = date.getDay(); // 0 is Sun, 1 is Mon, ... 6 is Sat
  const diffToMonday = (day + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMonday);
  monday.setHours(12, 0, 0, 0);
  return monday;
}

/** Returns the ISO date (YYYY-MM-DD) of the Monday for the week containing `isoDate`. */
export function getWeekKey(isoDate: string): string {
  if (!isValidISODate(isoDate)) return 'unassigned';
  return toISODate(getMondayOfWeek(isoDate));
}

/** Add `days` to a date */
export function addDays(date: Date, days: number): Date {
  const res = new Date(date);
  res.setDate(res.getDate() + days);
  return res;
}

/** Returns 7 consecutive ISO date strings starting from the given Monday. */
export function generateWeekDates(monday: Date | string): string[] {
  const mon = typeof monday === 'string' ? getMondayOfWeek(monday) : getMondayOfWeek(monday);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(toISODate(addDays(mon, i)));
  }
  return dates;
}

/**
 * Formats a clean Arabic range for the week starting on Monday:
 * e.g. "الاثنين 21 سبتمبر — الأحد 27 سبتمبر 2026 م"
 */
export function formatWeekRange(monday: Date | string): string {
  const mon = typeof monday === 'string' ? getMondayOfWeek(monday) : getMondayOfWeek(monday);
  const sun = addDays(mon, 6);
  const monIso = toISODate(mon);
  const sunIso = toISODate(sun);
  return `الأسبوع: الاثنين ${formatGregorianShort(monIso)} — الأحد ${formatGregorianShort(sunIso)} م (${formatHijri(monIso)} إلى ${formatHijri(sunIso)})`;
}

