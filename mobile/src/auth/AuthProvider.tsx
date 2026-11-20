import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { subscribeToAuthChanges, type AuthUser } from './AuthService';

// If Firebase has not answered by then, show the sign-in screen (with a Try again button).
const SIGN_IN_CHECK_TIMEOUT_MS = 8000;

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  /** The startup sign-in check got no answer in time. The user can retry it. */
  checkFailed: boolean;
  /** A signed-in user was signed out by Firebase (expired or revoked session). */
  sessionExpired: boolean;
  retryCheck: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  checkFailed: false,
  sessionExpired: false,
  retryCheck: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkFailed, setCheckFailed] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn('[auth] Sign-in check timed out.');
      setCheckFailed(true);
      setLoading(false);
    }, SIGN_IN_CHECK_TIMEOUT_MS);

    const unsubscribe = subscribeToAuthChanges((nextUser, info) => {
      clearTimeout(timer);
      setUser(nextUser);
      setCheckFailed(false);
      if (nextUser) setSessionExpired(false);
      else if (info?.sessionExpired) setSessionExpired(true);
      setLoading(false);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [attempt]);

  const retryCheck = useCallback(() => {
    setCheckFailed(false);
    setLoading(true);
    setAttempt((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({ user, loading, checkFailed, sessionExpired, retryCheck }),
    [user, loading, checkFailed, sessionExpired, retryCheck],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
