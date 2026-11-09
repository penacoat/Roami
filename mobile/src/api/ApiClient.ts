import type { ApiErrorCode, ApiFunctionName, ApiRequest, ApiResponse } from '@roami/shared';
import { isFrontendPreview } from '../config/preview';

import { fixtureHandlers } from './fixtureHandlers';
import { ApiError, type ApiHandlers } from './types';

/**
 * 'fixtures': every call returns fake data (the default, no setup needed).
 * 'live': calls go to real handlers registered with registerLiveHandlers.
 *         Functions with no real handler yet still fall back to fixtures.
 * Set EXPO_PUBLIC_API_MODE=live in mobile/.env, then restart with --clear.
 */
export type ApiMode = 'fixtures' | 'live';

const mode: ApiMode =
  !isFrontendPreview && process.env.EXPO_PUBLIC_API_MODE === 'live' ? 'live' : 'fixtures';
const live: Partial<ApiHandlers> = {};
const warned = new Set<string>();

export function getApiMode(): ApiMode {
  return mode;
}

/** Real services call this to take over from the fixtures, one function at a time. */
export function registerLiveHandlers(handlers: Partial<ApiHandlers>): void {
  Object.assign(live, handlers);
}

const KNOWN_CODES: ApiErrorCode[] = [
  'unauthenticated',
  'permission-denied',
  'invalid-argument',
  'not-found',
  'aborted',
  'unavailable',
];

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const raw =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code).toLowerCase()
      : '';
  const code = KNOWN_CODES.find((known) => raw.includes(known)) ?? 'internal';
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return new ApiError(code, message);
}

/**
 * The only way screens reach data. The name and request are checked against
 * the contract in shared/, and the response type follows from the name.
 *
 *   const { results } = await callApi('searchRecommendations', {
 *     text: 'jazz', interests: [], city: 'Seattle',
 *   });
 */
export async function callApi<K extends ApiFunctionName>(
  name: K,
  request: ApiRequest<K>,
): Promise<ApiResponse<K>> {
  type Handler = (req: ApiRequest<K>) => Promise<ApiResponse<K>>;
  const liveHandler = mode === 'live' ? (live[name] as unknown as Handler | undefined) : undefined;
  if (mode === 'live' && !liveHandler && !warned.has(name)) {
    warned.add(name);
    // eslint-disable-next-line no-console
    console.warn(`[api] No live handler for "${name}" yet, using fixtures.`);
  }
  const handler = liveHandler ?? (fixtureHandlers[name] as unknown as Handler);
  try {
    return await handler(request);
  } catch (error) {
    throw toApiError(error);
  }
}
