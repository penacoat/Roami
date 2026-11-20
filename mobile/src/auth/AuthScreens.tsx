import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { callApi } from '../api';
import { sendPasswordReset, signIn, signUp } from './AuthService';
import { buttonOutline } from '../components/buttonStyles';

export function AuthScreen() {
  const [mode, setMode] = useState<'signIn' | 'signUp' | 'reset'>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState('');

  const isSignUp = mode === 'signUp';
  const isReset = mode === 'reset';

  async function handleReset() {
    if (!email.trim()) {
      setError('Enter the email for your account.');
      return;
    }
    setError('');
    setNotice('');
    setSubmitting(true);
    try {
      await sendPasswordReset(email);
      setNotice(
        'If an account exists for that email, we sent a link to reset your password. Check your inbox and spam folder.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit() {
    if (!email.trim() || !password || (isSignUp && !name.trim())) {
      setError('Please fill in every field.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUp(email, password, name);
        // Create the public profile with the name typed here. App.tsx can't do
        // this for a new account because it learns about the user before the
        // name is saved.
        await callApi('ensureProfile', { displayName: name.trim() }).catch((profileError) => {
          // eslint-disable-next-line no-console
          console.warn('[profile] Could not create the profile after sign-up.', profileError);
        });
      } else {
        await signIn(email, password);
      }
      // No navigation needed: AuthProvider notices the new session.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Roami</Text>
      <Text style={styles.subtitle}>
        {isReset ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back'}
      </Text>

      {isSignUp && (
        <TextInput
          style={styles.input}
          placeholder="Name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      {!isReset && (
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            accessibilityState={{ checked: showPassword }}
            hitSlop={8}
            style={styles.eye}
            onPress={() => setShowPassword((value) => !value)}
          >
            <Text style={styles.eyeText}>{showPassword ? 'Hide' : 'Show'}</Text>
          </Pressable>
        </View>
      )}

      {mode === 'signIn' && (
        <Pressable
          accessibilityRole="button"
          style={styles.forgot}
          onPress={() => {
            setMode('reset');
            setShowPassword(false);
            setError('');
            setNotice('');
          }}
        >
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
      )}

      {error !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {notice !== '' && (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {notice}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        style={styles.button}
        onPress={isReset ? handleReset : handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {isReset ? 'Send reset link' : isSignUp ? 'Sign up' : 'Sign in'}
          </Text>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        style={styles.secondary}
        onPress={() => {
          setMode(isSignUp || isReset ? 'signIn' : 'signUp');
          setShowPassword(false);
          setError('');
          setNotice('');
        }}
      >
        <Text style={styles.link}>
          {isSignUp || isReset ? 'Back to sign in' : 'Create an account'}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 36, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 24, color: '#555' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 64 },
  eye: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 12,
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeText: { color: '#1a73e8', fontSize: 14, fontWeight: '600' },
  error: { color: '#c0392b', marginBottom: 12 },
  notice: { color: '#1e6b3a', marginBottom: 12, lineHeight: 20 },
  forgot: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end', marginBottom: 4 },
  button: {
    ...buttonOutline,
    borderColor: '#175DB8',
    backgroundColor: '#1a73e8',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: {
    ...buttonOutline,
    minHeight: 44,
    padding: 12,
    justifyContent: 'center',
  },
  link: { textAlign: 'center', color: '#1a73e8' },
});
