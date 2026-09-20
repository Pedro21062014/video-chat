import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import defaultAppletConfig from '../firebase-applet-config.json';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || defaultAppletConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || defaultAppletConfig.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || defaultAppletConfig.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || defaultAppletConfig.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || defaultAppletConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || defaultAppletConfig.appId,
};

const app = !getApps().length ? initializeApp(config) : getApp();

const firestoreDbId =
  process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID ||
  defaultAppletConfig.firestoreDatabaseId;

export const db = firestoreDbId ? getFirestore(app, firestoreDbId) : getFirestore(app);
export default app;

