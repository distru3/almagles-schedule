import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';

let app: FirebaseApp | null = null;
let database: Database | null = null;

try {
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
} catch (err) {
  console.error('[firebase] init failed', err);
  database = null;
}

export const isFirebaseConfigured = database !== null;

export { database };
