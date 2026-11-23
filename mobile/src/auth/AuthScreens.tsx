import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

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
import { Wordmark } from '../design/Wordmark';
import { RoamiLoading } from '../design/RoamingRibbon';
import { palette, type } from '../design/tokens';
import { useReducedMotion } from '../design/useReducedMotion';

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

export function AuthScreen({ previewMode }: { previewMode?: Mode } = {}) {
  const { checkFailed, sessionExpired, retryCheck } = useAuth();
  const [mode, setMode] = useState<Mode>(previewMode ?? 'signIn');
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
  const reduced = useReducedMotion();
  const [dissolve] = useState(() => new Animated.Value(0));
  const loadingScreen = submitting && !isReset;
  useEffect(() => {
    const transition = Animated.timing(dissolve, {
      toValue: loadingScreen ? 1 : 0,
      duration: reduced ? 0 : 240,
      useNativeDriver: Platform.OS !== 'web',
    });
    transition.start();
    return () => transition.stop();
  }, [dissolve, loadingScreen, reduced]);

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
    if (previewMode) {
      setNotice('Design preview — no account request was sent.');
      return;
    }
    if (busy.current) return;
    busy.current = true;
    lastAction.current = action;
    setFieldErrors({});
    setFormError(null);
    setNotice('');
    setSubmitting(true);
    Keyboard.dismiss();
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Animated.View
        style={[
          styles.flex,
          {
            opacity: dissolve.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            transform: [
              { translateY: dissolve.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
            ],
          },
        ]}
        accessibilityElementsHidden={loadingScreen}
        importantForAccessibility={loadingScreen ? 'no-hide-descendants' : 'auto'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.form}>
            <Wordmark />
            {isReset && <Text style={styles.subtitle}>Reset your password</Text>}

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
                  editable={!submitting}
                  maxLength={MAX_NAME_LENGTH}
                  value={name}
                  onChangeText={(value) => {
                    setName(value);
                    clearField('name');
                  }}
                  autoCapitalize="words"
                />
                <FieldError message={fieldErrors.name} />
              </>
            )}
            <Text style={styles.label}>Email</Text>
            <TextInput
              accessibilityLabel="Email"
              style={[styles.input, fieldErrors.email ? styles.inputError : null]}
              editable={!submitting}
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                clearField('email');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
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
                    editable={!submitting}
                    value={password}
                    onChangeText={(value) => {
                      setPassword(value);
                      clearField('password');
                    }}
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
                <FieldError message={fieldErrors.password} />
              </>
            )}

            {mode === 'signIn' && (
              <Pressable
                accessibilityRole="button"
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
            >
              {submitting ? (
                <ActivityIndicator color={palette.navy} />
              ) : (
                <Text style={styles.buttonText}>
                  {isReset ? 'Send reset link' : isSignUp ? 'Create account' : 'Sign in'}
                </Text>
              )}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              style={styles.secondary}
              disabled={submitting}
              onPress={() => switchMode(isSignUp || isReset ? 'signIn' : 'signUp')}
            >
              <Text style={styles.link}>{isSignUp || isReset ? 'Sign in' : 'Create account'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
      {loadingScreen && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: dissolve }]}>
          <RoamiLoading label={isSignUp ? 'Creating your account' : 'Signing in'} />
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: palette.navy },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  form: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  subtitle: { ...type.body, textAlign: 'center', marginBottom: 24, color: palette.card },
  label: { ...type.action, color: palette.card, marginBottom: 8, fontWeight: '400' },
  input: {
    borderWidth: 1,
    borderColor: '#8691A0',
    borderRadius: 3,
    padding: 12,
    marginBottom: 20,
    minHeight: 48,
    color: palette.card,
    fontSize: 16,
  },
  inputError: { borderColor: '#E6A897', marginBottom: 4 },
  fieldError: { ...type.caption, color: '#E6A897', marginBottom: 16 },
  passwordRow: { justifyContent: 'center' },
  passwordInput: { paddingRight: 64 },
  eye: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 20,
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeText: { ...type.action, color: palette.card, fontWeight: '400' },
  banner: {
    backgroundColor: '#2D2730',
    borderColor: '#B87868',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 4,
  },
  bannerInfo: { backgroundColor: '#1B3046', borderColor: '#8691A0' },
  bannerText: { ...type.body, color: palette.card },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: {
    color: palette.card,
    fontSize: 15,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  notice: { ...type.body, color: palette.card, marginBottom: 16 },
  forgot: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginTop: -12,
    marginBottom: 12,
  },
  button: {
    ...buttonOutline,
    borderColor: palette.card,
    backgroundColor: palette.card,
    borderRadius: 3,
    minHeight: 48,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: { ...type.action, color: palette.navy, fontSize: 16 },
  secondary: {
    minHeight: 44,
    padding: 12,
    justifyContent: 'center',
  },
  link: {
    ...type.action,
    textAlign: 'center',
    color: palette.card,
    fontWeight: '400',
    textDecorationLine: 'underline',
  },
});
