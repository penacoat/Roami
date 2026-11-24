import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from '../auth/AuthService';
import { PageSignature } from '../design/PageSignature';
import { palette, type } from '../design/tokens';

/** Account action while the team's full profile feature is being built. */
export function ProfileScreen({ onSignOut = signOut }: { onSignOut?: () => Promise<void> } = {}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  async function leave() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await onSignOut();
    } catch {
      setError('Could not sign out. Try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <PageSignature title="Profile" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          accessibilityState={{ disabled: pending, busy: pending }}
          disabled={pending}
          onPress={() => void leave()}
          style={styles.button}
        >
          <Text style={styles.action}>{pending ? 'Signing out…' : 'Sign out'}</Text>
        </Pressable>
        {error !== '' && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  button: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  action: { ...type.action, color: palette.primary },
  error: { ...type.caption, color: palette.red },
});
