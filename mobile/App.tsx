import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/auth/AuthProvider';
import { AuthScreen } from './src/auth/AuthScreens';
import { signOut } from './src/auth/AuthService';
import { TripCreationScreen } from './src/screens/TripCreationScreen';
import { firebaseSetupError } from './src/auth/firebase';

function Root() {
  const { user, loading } = useAuth();

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

  return <TripCreationScreen key={user.uid} ownerId={user.uid} onSignOut={signOut} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      {firebaseSetupError ? (
        <SafeAreaView style={styles.setup}>
          <ScrollView contentContainerStyle={styles.setupContent}>
            <Text style={styles.setupTitle}>Connect Roami to Firebase</Text>
            <Text style={styles.setupText}>Copy mobile/.env.example to mobile/.env and fill in the team’s Firebase web app configuration from the living doc.</Text>
            <Text style={styles.setupText}>Then stop Expo and run this from mobile/:</Text>
            <Text selectable style={styles.command}>npx expo start --clear</Text>
            <Text style={styles.setupText}>Reload the app after restarting Expo.</Text>
            <Text style={styles.setupError}>{firebaseSetupError}</Text>
          </ScrollView>
        </SafeAreaView>
      ) : (
        <AuthProvider>
          <Root />
        </AuthProvider>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  setup: { flex: 1, backgroundColor: '#F7F6F0' },
  setupContent: { flexGrow: 1, justifyContent: 'center', padding: 28, gap: 18, maxWidth: 600, alignSelf: 'center', width: '100%' },
  setupTitle: { color: '#203C32', fontSize: 28, fontWeight: '700' },
  setupText: { color: '#526359', fontSize: 16, lineHeight: 25 },
  command: { color: '#203C32', backgroundColor: '#E6EFE7', padding: 16, borderRadius: 12, fontSize: 15 },
  setupError: { color: '#A13D32', fontSize: 13, lineHeight: 21 },
});
