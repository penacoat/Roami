import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { AuthScreen } from './src/auth/AuthScreens';
import { signOut } from './src/auth/AuthService';
import { MapScreen } from './src/screens/MapScreen';
import { callApi } from './src/api';
import { registerServices } from './src/services';

registerServices();

function Root() {
  const { user, loading } = useAuth();

  // Make sure a signed-in account has a public profile (needed for author names
  // and getProfile). Safe to call every time: an existing profile is left alone.
  // Skipped while the name is missing, which happens just after sign-up; the
  // sign-up screen creates that profile itself.
  const uid = user?.uid;
  const hasName = Boolean(user?.displayName);
  useEffect(() => {
    if (!uid || !hasName) return;
    callApi('ensureProfile', {}).catch((error) => {
      // eslint-disable-next-line no-console
      console.warn('[profile] Could not make sure the profile exists.', error);
    });
  }, [uid, hasName]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <MapScreen key={user.uid} onSignOut={signOut} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
