// Explicit local opt-in. Preview always uses sample data, even if API_MODE is live.
export const isFrontendPreview =
  process.env.EXPO_PUBLIC_FRONTEND_PREVIEW === 'true' ||
  (__DEV__ && process.env.EXPO_PUBLIC_DESIGN_REVIEW === 'true');
