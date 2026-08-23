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
