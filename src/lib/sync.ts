import { ref, onValue, set, get, type Unsubscribe } from 'firebase/database';
import { database, isFirebaseConfigured } from './firebase';
import type { ScheduleRow, CustomColumn } from '../types';

const NODE = 'schedule';

export interface ScheduleSyncData {
  rows: ScheduleRow[];
  columns: CustomColumn[];
}

interface SchedulePayload {
  updatedAt: number;
  rows?: ScheduleRow[];
  columns?: CustomColumn[];
}

function normalizeRow(item: unknown): ScheduleRow | null {
  if (typeof item !== 'object' || item === null) return null;
  const raw = item as Record<string, unknown>;
  if (typeof raw.id !== 'string') return null;
  const customValues: Record<string, string> = {};
  if (typeof raw.customValues === 'object' && raw.customValues !== null) {
    for (const [k, v] of Object.entries(raw.customValues)) {
      if (typeof v === 'string') customValues[k] = v;
    }
  }
  return {
    id: raw.id,
    date: typeof raw.date === 'string' ? raw.date : '',
    time: typeof raw.time === 'string' ? raw.time : '',
    section: typeof raw.section === 'string' ? raw.section : '',
    title: typeof raw.title === 'string' ? raw.title : '',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    linkUrl: typeof raw.linkUrl === 'string' ? raw.linkUrl : '',
    linkLabel: typeof raw.linkLabel === 'string' ? raw.linkLabel : '',
    customValues,
  };
}

/**
 * Safely extracts rows from Firebase RTDB payload.
 * Firebase drops empty arrays (rows: []) entirely, so a missing or undefined
 * `rows` field on an existing payload is treated as an empty array `[]`.
 */
export function extractRows(payload: unknown): ScheduleRow[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const rawRows = (payload as { rows?: unknown }).rows;
  if (!rawRows) return [];
  const list = Array.isArray(rawRows) ? rawRows : Object.values(rawRows);
  const rows: ScheduleRow[] = [];
  for (const item of list) {
    const row = normalizeRow(item);
    if (row) rows.push(row);
  }
  return rows;
}

export function extractColumns(payload: unknown): CustomColumn[] {
  if (!payload || typeof payload !== 'object') return [];
  const rawCols = (payload as { columns?: unknown }).columns;
  if (!rawCols) return [];
  const list = Array.isArray(rawCols) ? rawCols : Object.values(rawCols);
  const cols: CustomColumn[] = [];
  for (const c of list) {
    if (typeof c === 'object' && c !== null) {
      const obj = c as Record<string, unknown>;
      if (typeof obj.id === 'string' && typeof obj.label === 'string') {
        cols.push({ id: obj.id, label: obj.label });
      }
    }
  }
  return cols;
}

export function extractSchedule(payload: unknown): ScheduleSyncData | null {
  if (!payload || typeof payload !== 'object') return null;
  const rows = extractRows(payload);
  if (rows === null) return null;
  const columns = extractColumns(payload);
  return { rows, columns };
}

/** Fetch the current schedule once (used for the initial hydrate). */
export async function fetchScheduleOnce(): Promise<ScheduleSyncData | null> {
  if (!isFirebaseConfigured || !database) return null;
  try {
    const snap = await get(ref(database, NODE));
    if (!snap.exists()) return { rows: [], columns: [] };
    return extractSchedule(snap.val());
  } catch (err) {
    console.error('[sync] fetch error', err);
    return null;
  }
}

/** Push the full rows array and custom columns to the shared node. */
export async function pushSchedule(rows: ScheduleRow[], columns: CustomColumn[] = []): Promise<boolean> {
  if (!isFirebaseConfigured || !database) return false;
  try {
    const payload: SchedulePayload = { updatedAt: Date.now(), rows, columns };
    await set(ref(database, NODE), payload);
    return true;
  } catch (err) {
    console.error('[sync] push error', err);
    return false;
  }
}

/**
 * Subscribe to live changes from any client. Returns an unsubscribe function.
 * `onOwnWrite` is ignored (the caller guards against echo loops).
 */
export function listenToSchedule(onData: (data: ScheduleSyncData) => void): Unsubscribe {
  const db = database;
  if (!isFirebaseConfigured || !db) return () => {};
  return onValue(
    ref(db, NODE),
    (snap) => {
      if (!snap.exists()) {
        onData({ rows: [], columns: [] });
        return;
      }
      const data = extractSchedule(snap.val());
      if (data !== null) onData(data);
    },
    (err) => {
      console.error('[sync] database error', err);
    },
  );
}


