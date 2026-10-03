import type { ScheduleRow } from '../types';
import { addDays, getWeekKey, isValidISODate, toISODate } from './dates';
import { emptyRow } from './csv';

/** A session with nothing typed into it yet. */
export function isBlankRow(row: ScheduleRow): boolean {
  return (
    !row.time.trim() &&
    !row.section.trim() &&
    !row.title.trim() &&
    !row.notes.trim() &&
    !row.linkUrl &&
    !Object.values(row.customValues || {}).some((v) => v.trim())
  );
}

/** Every week key in use: explicit weeks plus weeks that have sessions, sorted, undated last. */
export function collectWeekKeys(rows: ScheduleRow[], weeks: string[]): string[] {
  const keys = new Set(weeks.filter(isValidISODate));
  for (const r of rows) keys.add(getWeekKey(r.date));
  return Array.from(keys).sort((a, b) => {
    if (a === 'unassigned') return 1;
    if (b === 'unassigned') return -1;
    return a.localeCompare(b);
  });
}

/** Distinct non-empty values, most used first. */
export function rankedValues(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const t = v.trim();
    if (t) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v);
}

/** The closest earlier week that has filled-in sessions, to copy from. */
export function findCopySource(rows: ScheduleRow[], weekKey: string): string | null {
  let best: string | null = null;
  for (const r of rows) {
    if (isBlankRow(r)) continue;
    const k = getWeekKey(r.date);
    if (k !== 'unassigned' && k < weekKey && (!best || k > best)) best = k;
  }
  return best;
}

/** Copies a week's filled-in sessions onto the same weekdays of another week (notes are left empty). */
export function copyWeekRows(rows: ScheduleRow[], fromKey: string, toKey: string): ScheduleRow[] {
  const offsetDays = Math.round(
    (new Date(`${toKey}T12:00:00`).getTime() - new Date(`${fromKey}T12:00:00`).getTime()) / 86400000,
  );
  return rows
    .filter((r) => getWeekKey(r.date) === fromKey && !isBlankRow(r))
    .map((r) => ({
      ...emptyRow(toISODate(addDays(new Date(`${r.date}T12:00:00`), offsetDays))),
      time: r.time,
      section: r.section,
      title: r.title,
      linkUrl: r.linkUrl,
      linkLabel: r.linkLabel,
      customValues: { ...(r.customValues || {}) },
    }));
}
