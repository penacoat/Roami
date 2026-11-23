import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { Sacramento_400Regular } from '@expo-google-fonts/sacramento';
import { CityProvider } from './src/cities/CityProvider';
import { RoamiLoading } from './src/design/RoamingRibbon';
import { isFrontendPreview } from './src/config/preview';

import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { ProfileSetupBanner } from './src/auth/ProfileSetupBanner';
import { clearProfileSetupFailed, reportProfileSetupFailed } from './src/auth/profileSetup';
import { callApi, getApiMode } from './src/api';

function Root({ fontsReady }: { fontsReady: boolean }) {
  const { user, loading } = useAuth();
  const [servicesReady, setServicesReady] = useState(getApiMode() === 'fixtures');
  const [servicesError, setServicesError] = useState(false);

  useEffect(() => {
    if (getApiMode() !== 'live') return;
    let active = true;
    import('./src/services')
      .then(({ registerServices }) => {
        registerServices();
        if (active) setServicesReady(true);
      })
      .catch(() => {
        if (active) setServicesError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Make sure a signed-in account has a public profile (needed for author names
  // and getProfile). Safe to call every time: an existing profile is left alone.
  // Skipped while the name is missing, which happens just after sign-up; the
  // sign-up screen creates that profile itself.
  const uid = user?.uid;
  const hasName = Boolean(user?.displayName);
  useEffect(() => {
    if (!uid || !hasName || !servicesReady) return;
    callApi('ensureProfile', {}).catch((error) => {
      // eslint-disable-next-line no-console
      console.warn('[profile] Could not make sure the profile exists.', error);
      reportProfileSetupFailed();
    });
  }, [uid, hasName, servicesReady]);

  // A new session starts clean: forget a profile problem from the previous account.
  useEffect(() => {
    if (!uid) clearProfileSetupFailed();
  }, [uid]);

  if (servicesError) {
    return (
      <View style={styles.center}>
        <Text>Could not connect to app services. Restart the app to try again.</Text>
      </View>
    );
  }

  if (loading || !servicesReady || !fontsReady) return <RoamiLoading />;

  return (
    <View style={styles.flex}>
      <ProfileSetupBanner />
      <Stack key={user?.uid ?? 'signed-out'} screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={__DEV__ && isFrontendPreview}>
          <Stack.Screen name="design-review" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(user)}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="new-trip" />
          <Stack.Screen name="itinerary/[tripId]" />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </View>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Sacramento_400Regular });
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CityProvider>
          <Root fontsReady={fontsLoaded || Boolean(fontError)} />
        </CityProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
});
