import type { ScheduleRow } from '../types';

const KEY = 'almagles-schedule-v1';

export function loadRows(): ScheduleRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveRows(rows: ScheduleRow[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* storage full or unavailable — ignore */
  }
}
