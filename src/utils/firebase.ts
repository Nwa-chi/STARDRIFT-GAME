import { initializeApp, getApps, getApp } from '@firebase/app';
import { getAuth } from '@firebase/auth';
import { getDatabase } from '@firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAmNimFyLy_WuF0q699lhOL3VckIO2MoiE',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'stardrift-game.firebaseapp.com',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://stardrift-game-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'stardrift-game',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'stardrift-game.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '949577328108',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:949577328108:web:b9f6ec0afa66952f1c4cc9',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const database = getDatabase(app);

export { app, auth, database };
