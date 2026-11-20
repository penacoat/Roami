import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { callApi } from '../api';
import { PROFILE_FAILED_MESSAGE } from './authErrors';
import {
  clearProfileSetupFailed,
  reportProfileSetupFailed,
  useProfileSetupFailed,
} from './profileSetup';

/** Shown across the top when the new account's profile could not be saved. */
export function ProfileSetupBanner() {
  const failed = useProfileSetupFailed();
  const [retrying, setRetrying] = useState(false);
  if (!failed) return null;

  async function retry() {
    if (retrying) return;
    setRetrying(true);
    try {
      await callApi('ensureProfile', {});
      clearProfileSetupFailed();
    } catch {
      reportProfileSetupFailed();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.wrap}>
      <View style={styles.inner}>
        <Text accessibilityRole="alert" style={styles.text}>
          {PROFILE_FAILED_MESSAGE}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          disabled={retrying}
          onPress={() => void retry()}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{retrying ? 'Trying again…' : 'Try again'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#fdecea' },
  inner: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  text: { color: '#8a1f17', fontSize: 14, lineHeight: 20 },
  button: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  buttonText: {
    color: '#8a1f17',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
