import { useSyncExternalStore } from 'react';

// Tracks whether saving the user's public profile failed after sign-up. The sign-up
// screen is already gone by then (signing up signs the user in), so the app shows a
// banner (ProfileSetupBanner) instead.
let failed = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function reportProfileSetupFailed(): void {
  if (failed) return;
  failed = true;
  emit();
}

export function clearProfileSetupFailed(): void {
  if (!failed) return;
  failed = false;
  emit();
}

export function useProfileSetupFailed(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => failed,
    () => failed,
  );
}
