import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';

let app: FirebaseApp | null = null;
let database: Database | null = null;

try {
  // VITE_DISABLE_SYNC=1 runs the app in local-only mode (e.g. for testing without touching the shared schedule).
  if (import.meta.env.VITE_DISABLE_SYNC !== '1') {
    app = initializeApp(firebaseConfig);
    database = getDatabase(app);
  }
} catch (err) {
  console.error('[firebase] init failed', err);
  database = null;
}

export const isFirebaseConfigured = database !== null;

export { database };
