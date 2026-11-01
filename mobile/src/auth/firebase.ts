import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
});

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
// Development only: send sign-in to the Auth emulator on a teammate's laptop.
// Set EXPO_PUBLIC_EMULATOR_HOST in mobile/.env to that laptop's address.
const emulatorHost = process.env.EXPO_PUBLIC_EMULATOR_HOST;
if (emulatorHost) {
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
}
