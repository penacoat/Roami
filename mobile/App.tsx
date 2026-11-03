import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

import { AuthProvider, useAuth } from './src/auth/AuthProvider';
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

  return (
    <Stack key={user?.uid ?? 'signed-out'} screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={Boolean(user)}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
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
