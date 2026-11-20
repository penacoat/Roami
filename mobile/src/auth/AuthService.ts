import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';

import { isFrontendPreview } from '../config/preview';
import { AuthError, authErrorFromCode, errorCode } from './authErrors';
import { getFirebaseAuth } from './firebase';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

const previewUser: AuthUser = {
  uid: 'fixture-user',
  email: 'preview@example.com',
  displayName: 'Test User',
};

function toAuthUser(user: User): AuthUser {
  return { uid: user.uid, email: user.email, displayName: user.displayName };
}

function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  const authError = authErrorFromCode(errorCode(error));
  if (authError.category === 'app') {
    // Not something the user can fix: keep the real code for developers.
    // eslint-disable-next-line no-console
    console.warn(`[auth] Unexpected sign-in error (${authError.code}).`, error);
  }
  return authError;
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthUser> {
  try {
    const credential = await createUserWithEmailAndPassword(
      getFirebaseAuth(),
      email.trim(),
      password,
    );
    await updateProfile(credential.user, { displayName: displayName.trim() });
    return toAuthUser(credential.user);
  } catch (error) {
    throw toAuthError(error);
  }
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  try {
    const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    return toAuthUser(credential.user);
  } catch (error) {
    throw toAuthError(error);
  }
}

/**
 * Emails a password reset link. An unknown address is treated as success so the
 * screen never reveals which emails have accounts.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  if (isFrontendPreview) return;
  try {
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/user-not-found') return;
    throw toAuthError(error);
  }
}

// Set while the user is signing out on purpose, so the auth listener can tell that
// apart from Firebase ending a session on its own (expired or revoked).
let userSignedOut = false;

export async function signOut(): Promise<void> {
  if (isFrontendPreview) return;
  userSignedOut = true;
  try {
    await firebaseSignOut(getFirebaseAuth());
  } catch (error) {
    userSignedOut = false;
    throw error;
  }
}

/** The signed-in user's ID, or null when nobody is signed in. Services use this for ownership. */
export function getCurrentUserId(): string | null {
  return getCurrentUser()?.uid ?? null;
}

/**
 * The signed-in user, or null. Read when called, so it includes a display name
 * set after sign-up (the user AuthProvider holds may not have it yet).
 */
export function getCurrentUser(): AuthUser | null {
  if (isFrontendPreview) return previewUser;
  const auth = getFirebaseAuth();
  return auth.currentUser ? toAuthUser(auth.currentUser) : null;
}

export interface AuthChangeInfo {
  /** True when a signed-in user was signed out without asking to be (expired or revoked session). */
  sessionExpired: boolean;
}

/** Calls the callback now and whenever the user signs in or out. Returns an unsubscribe function. */
export function subscribeToAuthChanges(
  callback: (user: AuthUser | null, info?: AuthChangeInfo) => void,
): () => void {
  if (isFrontendPreview) {
    callback(previewUser);
    return () => {};
  }
  let previousUid: string | null = null;
  return onAuthStateChanged(getFirebaseAuth(), (user) => {
    const sessionExpired = previousUid !== null && user === null && !userSignedOut;
    previousUid = user?.uid ?? null;
    userSignedOut = false;
    callback(user ? toAuthUser(user) : null, { sessionExpired });
  });
}
