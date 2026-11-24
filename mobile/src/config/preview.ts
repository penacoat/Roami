declare const __DEV__: boolean;

// Explicit local opt-in. Preview always uses sample data, even if API_MODE is live.
export const isFrontendPreview =
  process.env.EXPO_PUBLIC_FRONTEND_PREVIEW === 'true' ||
  (typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_DESIGN_REVIEW === 'true');
