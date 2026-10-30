import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
    updateProfile,
    type User,
  } from 'firebase/auth';
  
  import { requireAuth } from './firebase';
  
  export interface AuthUser {
    uid: string;
    email: string | null;
    displayName: string | null;
  }
  
  function toAuthUser(user: User): AuthUser {
    return { uid: user.uid, email: user.email, displayName: user.displayName };
  }
  
  function friendlyMessage(error: unknown): string {
    const code = (error as { code?: string }).code ?? '';
    switch (code) {
      case 'auth/invalid-email':
        return 'That email address does not look right.';
      case 'auth/email-already-in-use':
        return 'An account with that email already exists. Try signing in.';
      case 'auth/weak-password':
        return 'Choose a password with at least 6 characters.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Incorrect email or password.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Wait a moment and try again.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is not turned on in Firebase yet.';
      case 'auth/invalid-api-key':
      case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
        return 'The Firebase API key is invalid. Check EXPO_PUBLIC_FIREBASE_API_KEY in mobile/.env, then restart Expo.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
  
  export async function signUp(
    email: string,
    password: string,
    displayName: string,
  ): Promise<AuthUser> {
    try {
      const credential = await createUserWithEmailAndPassword(requireAuth(), email.trim(), password);
      await updateProfile(credential.user, { displayName: displayName.trim() });
      return toAuthUser(credential.user);
    } catch (error) {
      throw new Error(friendlyMessage(error));
    }
  }
  
  export async function signIn(email: string, password: string): Promise<AuthUser> {
    try {
      const credential = await signInWithEmailAndPassword(requireAuth(), email.trim(), password);
      return toAuthUser(credential.user);
    } catch (error) {
      throw new Error(friendlyMessage(error));
    }
  }
  
  export async function signOut(): Promise<void> {
    await firebaseSignOut(requireAuth());
  }
  
  /** Calls the callback now and whenever the user signs in or out. Returns an unsubscribe function. */
  export function subscribeToAuthChanges(callback: (user: AuthUser | null) => void): () => void {
    return onAuthStateChanged(requireAuth(), (user) => callback(user ? toAuthUser(user) : null));
  }
