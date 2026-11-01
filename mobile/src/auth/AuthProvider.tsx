import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { subscribeToAuthChanges, type AuthUser } from './AuthService';

// If Firebase has not answered by then, show the sign-in screen instead of a spinner.
const SIGN_IN_CHECK_TIMEOUT_MS = 8000;

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn(
        '[auth] Sign-in check timed out. Is the Auth emulator reachable at EXPO_PUBLIC_EMULATOR_HOST?',
      );
      setLoading(false);
    }, SIGN_IN_CHECK_TIMEOUT_MS);

    const unsubscribe = subscribeToAuthChanges((nextUser) => {
      clearTimeout(timer);
      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ user, loading }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
