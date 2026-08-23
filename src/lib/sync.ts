import { ref, onValue, set, get, type Unsubscribe } from 'firebase/database';
import { database, isFirebaseConfigured } from './firebase';
import type { ScheduleRow } from '../types';

const NODE = 'schedule';

interface SchedulePayload {
  updatedAt: number;
  rows: ScheduleRow[];
}

function isRows(value: unknown): value is ScheduleRow[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (r) => typeof r === 'object' && r !== null && typeof (r as ScheduleRow).id === 'string',
  );
}

/** Fetch the current schedule once (used for the initial hydrate). */
export async function fetchScheduleOnce(): Promise<ScheduleRow[] | null> {
  if (!isFirebaseConfigured || !database) return null;
  try {
    const snap = await get(ref(database, NODE));
    if (!snap.exists()) return null;
    const payload = snap.val() as SchedulePayload | null;
    if (!payload || !isRows(payload.rows)) return null;
    return payload.rows;
  } catch {
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
  } catch {
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
      const payload = snap.val() as SchedulePayload | null;
      if (payload && isRows(payload.rows)) onData(payload.rows);
    },
    (err) => {
      console.error('[sync] database error', err);
    },
  );
}
