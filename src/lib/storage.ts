import type { ScheduleRow, CustomColumn } from '../types';

const KEY = 'almagles-schedule-v1';
const COLS_KEY = 'almagles-columns-v1';

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

export function loadColumns(): CustomColumn[] {
  try {
    const raw = localStorage.getItem(COLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveColumns(cols: CustomColumn[]): void {
  try {
    localStorage.setItem(COLS_KEY, JSON.stringify(cols));
  } catch {
    /* storage full or unavailable — ignore */
  }
}

