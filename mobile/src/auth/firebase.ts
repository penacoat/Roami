import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  initializeAuth,
  getReactNativePersistence,
  type Auth,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize on demand so frontend previews do not start Firebase at all.
export function getFirebaseApp() {
  return getApps().length ? getApp() : initializeApp(config);
}

let auth: Auth | undefined;
export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = initializeAuth(getFirebaseApp(), {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    const emulatorHost = process.env.EXPO_PUBLIC_EMULATOR_HOST;
    if (emulatorHost) {
      connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    }
  }
  return auth;
}
