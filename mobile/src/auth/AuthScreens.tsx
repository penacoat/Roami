import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { callApi } from '../api';
import { useAuth } from './AuthProvider';
import {
  AuthError,
  CHECK_FAILED_MESSAGE,
  MAX_NAME_LENGTH,
  SESSION_EXPIRED_MESSAGE,
  validateAuthForm,
  type AuthField,
  type FieldErrors,
} from './authErrors';
import { reportProfileSetupFailed } from './profileSetup';
import { sendPasswordReset, signIn, signUp } from './AuthService';
import { buttonOutline } from '../components/buttonStyles';
import { colors } from '../screens/map/theme';

type Mode = 'signIn' | 'signUp' | 'reset';

/** A message above the buttons, with an optional Try again button for connection problems. */
function Banner({
  message,
  tone = 'error',
  onRetry,
  retrying = false,
}: {
  message: string;
  tone?: 'error' | 'info';
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <View style={[styles.banner, tone === 'info' && styles.bannerInfo]}>
      <Text accessibilityRole="alert" style={styles.bannerText}>
        {message}
      </Text>
      {onRetry && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          accessibilityState={{ disabled: retrying, busy: retrying }}
          disabled={retrying}
          onPress={onRetry}
          style={styles.retry}
        >
          <Text style={styles.retryText}>{retrying ? 'Trying again…' : 'Try again'}</Text>
        </Pressable>
      )}
    </View>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" style={styles.fieldError}>
      {message}
    </Text>
  );
}

function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return new AuthError('unknown', 'app', message);
}

export function AuthScreen() {
  const { checkFailed, sessionExpired, retryCheck } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<AuthError | null>(null);
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);
  const lastAction = useRef<(() => Promise<void>) | null>(null);

  const isSignUp = mode === 'signUp';
  const isReset = mode === 'reset';

  function clearField(field: AuthField) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const { [field]: _removed, ...rest } = current;
      return rest;
    });
  }

  function switchMode(next: Mode) {
    setMode(next);
    setShowPassword(false);
    setFieldErrors({});
    setFormError(null);
    setNotice('');
  }

  /** Runs one attempt. The same action is kept so Try again can repeat it. */
  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    lastAction.current = action;
    setFieldErrors({});
    setFormError(null);
    setNotice('');
    setSubmitting(true);
    try {
      await action();
    } catch (e) {
      const problem = toAuthError(e);
      if (problem.field) setFieldErrors({ [problem.field]: problem.message });
      else setFormError(problem);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  function handleSubmit() {
    const problems = validateAuthForm(isSignUp ? 'signUp' : 'signIn', { name, email, password });
    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      setFormError(null);
      return;
    }
    void run(async () => {
      if (isSignUp) {
        await signUp(email, password, name);
        // Create the public profile with the name typed here. App.tsx can't do
        // this for a new account because it learns about the user before the
        // name is saved. This screen is usually gone by the time it finishes, so a
        // failure is reported to the app-level banner instead.
        await callApi('ensureProfile', { displayName: name.trim() }).catch((profileError) => {
          // eslint-disable-next-line no-console
          console.warn('[profile] Could not create the profile after sign-up.', profileError);
          reportProfileSetupFailed();
        });
      } else {
        await signIn(email, password);
      }
      // No navigation needed: AuthProvider notices the new session.
    });
  }

  function handleReset() {
    if (!email.trim()) {
      setFieldErrors({ email: 'Enter the email for your account.' });
      return;
    }
    void run(async () => {
      await sendPasswordReset(email);
      setNotice(
        'If an account exists for that email, we sent a link to reset your password. Check your inbox and spam folder.',
      );
    });
  }

  function retry() {
    if (lastAction.current) void run(lastAction.current);
  }

  return (
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.form}>
            <Text accessibilityRole="header" style={styles.title}>
              Roami
            </Text>
            <Text accessibilityRole="header" style={styles.subtitle}>
              {isReset ? 'Reset your password' : isSignUp ? 'Create your account' : 'Welcome back'}
            </Text>

            {checkFailed && <Banner message={CHECK_FAILED_MESSAGE} onRetry={retryCheck} />}
            {sessionExpired && mode === 'signIn' && !checkFailed && (
              <Banner message={SESSION_EXPIRED_MESSAGE} tone="info" />
            )}

            {isSignUp && (
              <>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  accessibilityLabel="Name"
                  style={[styles.input, fieldErrors.name ? styles.inputError : null]}
                  placeholder="Name"
                  maxLength={MAX_NAME_LENGTH}
                  value={name}
                  onChangeText={(value) => {
                    setName(value);
                    clearField('name');
                  }}
                  autoCapitalize="words"
                  autoComplete="name"
                  editable={!submitting}
                />
                <FieldError message={fieldErrors.name} />
              </>
            )}
            <Text style={styles.label}>Email</Text>
            <TextInput
              accessibilityLabel="Email"
              style={[styles.input, fieldErrors.email ? styles.inputError : null]}
              placeholder="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                clearField('email');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              editable={!submitting}
            />
            <FieldError message={fieldErrors.email} />
            {!isReset && (
              <>
                <Text style={styles.label}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    accessibilityLabel="Password"
                    style={[
                      styles.input,
                      styles.passwordInput,
                      fieldErrors.password ? styles.inputError : null,
                    ]}
                    placeholder="Password"
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      clearField('password');
                    }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    editable={!submitting}
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
                <FieldError message={fieldErrors.password} />
              </>
            )}

            {mode === 'signIn' && (
              <Pressable
                accessibilityRole="button"
                disabled={submitting}
                style={styles.forgot}
                onPress={() => switchMode('reset')}
              >
                <Text style={styles.link}>Forgot password?</Text>
              </Pressable>
            )}

            {formError && (
              <Banner
                message={formError.message}
                onRetry={formError.retryable ? retry : undefined}
                retrying={submitting}
              />
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
              accessibilityState={{ disabled: submitting, busy: submitting }}
              accessibilityLabel={isReset ? 'Send reset link' : isSignUp ? 'Sign up' : 'Sign in'}
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
              disabled={submitting}
              onPress={() => switchMode(isSignUp || isReset ? 'signIn' : 'signUp')}
            >
              <Text style={styles.link}>
                {isSignUp || isReset ? 'Back to sign in' : 'Create an account'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.paper },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingVertical: 32 },
  form: { width: '100%', maxWidth: 460, alignSelf: 'center' },
  title: {
    fontSize: 52,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: colors.primary,
    textAlign: 'center',
    marginVertical: 12,
  },
  subtitle: { fontSize: 20, textAlign: 'center', marginBottom: 28, color: colors.ink },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    color: colors.ink,
    borderRadius: 12,
    minHeight: 52,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  inputError: { borderColor: '#b3261e', marginBottom: 4 },
  fieldError: { color: '#b3261e', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  passwordRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  passwordInput: { flex: 1, minWidth: 0 },
  eye: {
    minWidth: 56,
    minHeight: 48,
    paddingHorizontal: 8,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  banner: {
    backgroundColor: '#fdecea',
    borderColor: '#f1b5b0',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 4,
  },
  bannerInfo: { backgroundColor: '#eaf2fd', borderColor: '#b5cdf1' },
  bannerText: { color: '#5c1510', fontSize: 14, lineHeight: 20 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: {
    color: '#175DB8',
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  notice: { color: '#1e6b3a', marginBottom: 12, lineHeight: 20 },
  forgot: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end', marginBottom: 4 },
  button: {
    ...buttonOutline,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 52,
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
  link: { textAlign: 'center', color: colors.primary, fontSize: 15, fontWeight: '600' },
});
