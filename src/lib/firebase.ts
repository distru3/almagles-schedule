import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

function readConfig(): FirebaseConfig | null {
  const env = import.meta.env;
  const apiKey = env.VITE_FIREBASE_API_KEY as string | undefined;
  const databaseURL = env.VITE_FIREBASE_DATABASE_URL as string | undefined;
  const appId = env.VITE_FIREBASE_APP_ID as string | undefined;
  const projectId = env.VITE_FIREBASE_PROJECT_ID as string | undefined;
  if (!apiKey || !databaseURL || !appId || !projectId) return null;
  return {
    apiKey,
    databaseURL,
    appId,
    projectId,
    authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) ?? `${projectId}.firebaseapp.com`,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  };
}

const config = readConfig();

export const isFirebaseConfigured = config !== null;

let app: FirebaseApp | null = null;
let database: Database | null = null;

if (config) {
  app = initializeApp(config);
  database = getDatabase(app);
}

export { database };
