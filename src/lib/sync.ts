import { ref, onValue, set, get, type Unsubscribe } from 'firebase/database';
import { database, isFirebaseConfigured } from './firebase';
import type { ScheduleRow } from '../types';

const NODE = 'schedule';

interface SchedulePayload {
  updatedAt: number;
  rows: ScheduleRow[];
}

function normalizeRow(item: unknown): ScheduleRow | null {
  if (typeof item !== 'object' || item === null) return null;
  const raw = item as Record<string, unknown>;
  if (typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    date: typeof raw.date === 'string' ? raw.date : '',
    time: typeof raw.time === 'string' ? raw.time : '',
    section: typeof raw.section === 'string' ? raw.section : '',
    title: typeof raw.title === 'string' ? raw.title : '',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    linkUrl: typeof raw.linkUrl === 'string' ? raw.linkUrl : '',
    linkLabel: typeof raw.linkLabel === 'string' ? raw.linkLabel : '',
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

/** Fetch the current schedule once (used for the initial hydrate). */
export async function fetchScheduleOnce(): Promise<ScheduleRow[] | null> {
  if (!isFirebaseConfigured || !database) return null;
  try {
    const snap = await get(ref(database, NODE));
    if (!snap.exists()) return [];
    return extractRows(snap.val());
  } catch (err) {
    console.error('[sync] fetch error', err);
    return null;
  }
}

/** Push the full rows array to the shared node. */
export async function pushSchedule(rows: ScheduleRow[]): Promise<boolean> {
  if (!isFirebaseConfigured || !database) return false;
  try {
    const payload: SchedulePayload = { updatedAt: Date.now(), rows };
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
export function listenToSchedule(onData: (rows: ScheduleRow[]) => void): Unsubscribe {
  const db = database;
  if (!isFirebaseConfigured || !db) return () => {};
  return onValue(
    ref(db, NODE),
    (snap) => {
      if (!snap.exists()) {
        onData([]);
        return;
      }
      const rows = extractRows(snap.val());
      if (rows !== null) onData(rows);
    },
    (err) => {
      console.error('[sync] database error', err);
    },
  );
}

