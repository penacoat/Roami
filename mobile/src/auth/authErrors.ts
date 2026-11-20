// Pure rules for sign-in problems: no Firebase imports, so they are easy to test.
// AuthService turns Firebase error codes into AuthError using the table below,
// and the screens decide how to show an AuthError (inline, banner, retry button).

/**
 * What the user can do about a problem:
 * - input:       fix a field (shown inline next to the field)
 * - credentials: re-enter details or reset the password
 * - connection:  check the network and try again (shows a Try again button)
 * - blocked:     wait, or contact the team
 * - app:         our problem; generic message, details go to the developer log
 */
export type AuthErrorCategory = 'input' | 'credentials' | 'connection' | 'blocked' | 'app';
export type AuthField = 'name' | 'email' | 'password';

export class AuthError extends Error {
  readonly code: string;
  readonly category: AuthErrorCategory;
  readonly field?: AuthField;
  /** Only connection problems are worth retrying with the same details. */
  readonly retryable: boolean;

  constructor(code: string, category: AuthErrorCategory, message: string, field?: AuthField) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.category = category;
    this.field = field;
    this.retryable = category === 'connection';
  }
}

export const MAX_NAME_LENGTH = 60; // matches validProfile in firestore.rules

export const SESSION_EXPIRED_MESSAGE = 'Your session expired. Please sign in again.';
export const CHECK_FAILED_MESSAGE =
  'We could not check your sign-in. Check your internet connection and try again.';
export const PROFILE_FAILED_MESSAGE =
  'Your account was created, but we could not save your profile. Check your connection and try again.';
const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

interface Rule {
  category: AuthErrorCategory;
  message: string;
  field?: AuthField;
}

const WRONG_CREDENTIALS: Rule = {
  category: 'credentials',
  // Wrong password and unknown email share one message on purpose, so the screen
  // never reveals which email addresses have accounts.
  message: 'Incorrect email or password. Try again, or reset your password.',
};
const CANNOT_REACH: Rule = {
  category: 'connection',
  message: 'Cannot reach Roami. Check your internet connection and try again.',
};
const UNAVAILABLE: Rule = {
  category: 'app',
  message: 'Sign-in is not available right now. Please try again later.',
};
const WEAK_PASSWORD: Rule = {
  category: 'input',
  message: 'Use a password with at least 6 characters.',
  field: 'password',
};
const SESSION_EXPIRED: Rule = { category: 'credentials', message: SESSION_EXPIRED_MESSAGE };

const RULES: Record<string, Rule> = {
  'auth/invalid-email': {
    category: 'input',
    message: 'That email address does not look right. Check for typos.',
    field: 'email',
  },
  'auth/missing-email': { category: 'input', message: 'Enter your email.', field: 'email' },
  'auth/missing-password': {
    category: 'input',
    message: 'Enter your password.',
    field: 'password',
  },
  'auth/email-already-in-use': {
    category: 'input',
    message: 'An account with that email already exists. Try signing in.',
    field: 'email',
  },
  'auth/weak-password': WEAK_PASSWORD,
  'auth/password-does-not-meet-requirements': WEAK_PASSWORD,

  'auth/invalid-credential': WRONG_CREDENTIALS,
  'auth/invalid-login-credentials': WRONG_CREDENTIALS,
  'auth/wrong-password': WRONG_CREDENTIALS,
  'auth/user-not-found': WRONG_CREDENTIALS,
  'auth/user-token-expired': SESSION_EXPIRED,
  'auth/invalid-user-token': SESSION_EXPIRED,
  'auth/user-token-revoked': SESSION_EXPIRED,
  'auth/invalid-refresh-token': SESSION_EXPIRED,

  'auth/network-request-failed': CANNOT_REACH,
  'auth/timeout': {
    category: 'connection',
    message: 'The request timed out. Check your internet connection and try again.',
  },
  'auth/internal-error': {
    category: 'connection',
    message: 'Something went wrong on our end. Try again in a moment.',
  },

  'auth/too-many-requests': {
    category: 'blocked',
    message: 'Too many attempts. Wait a few minutes and try again, or reset your password.',
  },
  'auth/user-disabled': {
    category: 'blocked',
    message: 'This account has been disabled. Contact the Roami team.',
  },

  'auth/operation-not-allowed': UNAVAILABLE,
  'auth/invalid-api-key': UNAVAILABLE,
  'auth/api-key-not-valid': UNAVAILABLE,
  'auth/app-not-authorized': UNAVAILABLE,
};

export function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : '';
}

/** Turns a Firebase error code into an AuthError. Unknown codes get the generic message. */
export function authErrorFromCode(code: string): AuthError {
  const rule = RULES[code] ?? { category: 'app' as const, message: GENERIC_MESSAGE };
  return new AuthError(code || 'unknown', rule.category, rule.message, rule.field);
}

export type FieldErrors = Partial<Record<AuthField, string>>;

/** Checks the form before contacting Firebase. Returns a message per field with a problem. */
export function validateAuthForm(
  mode: 'signIn' | 'signUp',
  values: { name: string; email: string; password: string },
): FieldErrors {
  const problems: FieldErrors = {};
  if (mode === 'signUp') {
    const name = values.name.trim();
    if (!name) problems.name = 'Enter your name.';
    else if (name.length > MAX_NAME_LENGTH) {
      problems.name = `Names can be at most ${MAX_NAME_LENGTH} characters.`;
    }
  }
  if (!values.email.trim()) problems.email = 'Enter your email.';
  if (!values.password) problems.password = 'Enter your password.';
  return problems;
}
