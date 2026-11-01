import { connectFirestoreEmulator, getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';

import { app } from '../auth/firebase';

function createFirestore(): Firestore {
  let instance: Firestore;
  try {
    // React Native sometimes cannot hold a streaming connection open, so let
    // Firestore fall back to long polling when it detects a problem.
    instance = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  } catch {
    // Already initialized (happens after a hot reload).
    instance = getFirestore(app);
  }

  // Development only: use the Firestore emulator on a teammate's laptop.
  const emulatorHost = process.env.EXPO_PUBLIC_EMULATOR_HOST;
  if (emulatorHost) {
    try {
      connectFirestoreEmulator(instance, emulatorHost, 8080);
    } catch {
      // Already connected (happens after a hot reload).
    }
  }
  return instance;
}

export const db = createFirestore();
