import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, type Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const required = {
  EXPO_PUBLIC_FIREBASE_API_KEY: config.apiKey,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: config.authDomain,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: config.projectId,
  EXPO_PUBLIC_FIREBASE_APP_ID: config.appId,
};
const missing = Object.entries(required).filter(([, value]) => !value?.trim()).map(([name]) => name);

let initializedAuth: Auth | null = null;
let setupError: string | null = missing.length ? `Missing Firebase settings: ${missing.join(', ')}` : null;

if (!setupError) {
  try {
    const app = initializeApp(config);
    initializedAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    setupError = 'Firebase could not start. Check that mobile/.env contains the Firebase web app configuration for Roami.';
  }
}

export const auth = initializedAuth;
export const firebaseSetupError = setupError;

export function requireAuth(): Auth {
  if (!auth) throw new Error(firebaseSetupError ?? 'Firebase is not configured.');
  return auth;
}
