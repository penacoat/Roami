import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { AuthScreen } from './src/auth/AuthScreens';
import { signOut } from './src/auth/AuthService';
import { PlacesCheck } from './src/dev/PlacesCheck';
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

  return (
    <View style={styles.center}>
      <Text style={styles.welcome}>Welcome, {user.displayName ?? user.email}!</Text>
      <Pressable style={styles.button} onPress={() => signOut()}>
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
      <PlacesCheck />
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Root />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  welcome: { fontSize: 22, marginBottom: 24 },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
