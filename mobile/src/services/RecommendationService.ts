import type {
  CreateRecommendationRequest,
  CreateRecommendationResponse,
  Recommendation,
} from '@roami/shared';

import { ApiError } from '../api';
import { getCurrentUserId } from '../auth/AuthService';
import { validateRecommendationRequest } from '../logic/recommendationValidator';
import { getPlacesByIds } from '../repositories/PlaceRepository';
import {
  createRecommendation as writeRecommendation,
  newRecommendationId,
} from '../repositories/RecommendationRepository';
import { toRecommendationViews } from './recommendationViews';

function mapFirestoreError(error: unknown): unknown {
  if (error instanceof ApiError) return error;
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code).toLowerCase()
      : '';
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  const knownCodes = [
    'unauthenticated',
    'permission-denied',
    'invalid-argument',
    'not-found',
    'unavailable',
  ] as const;
  const known = knownCodes.find((candidate) => code.includes(candidate));
  return known ? new ApiError(known, message) : error;
}

export async function createRecommendation(
  request: CreateRecommendationRequest,
): Promise<CreateRecommendationResponse> {
  const authorId = getCurrentUserId();
  if (!authorId) throw new ApiError('unauthenticated', 'Sign in to continue.');

  const checked = validateRecommendationRequest(request);
  if (!checked.ok) throw new ApiError('invalid-argument', checked.error);

  try {
    const places = await getPlacesByIds([checked.value.placeId]);
    const place = places.get(checked.value.placeId);
    if (!place) throw new ApiError('not-found', 'That place is not in the catalog.');

    const recommendation: Recommendation = {
      id: newRecommendationId(),
      authorId,
      placeId: checked.value.placeId,
      description: checked.value.description,
      tags: checked.value.tags,
      visitDate: checked.value.visitDate ?? null,
      sourceLinks: checked.value.sourceLinks ?? [],
      moderationStatus: 'active',
      createdAt: new Date().toISOString(),
    };
    await writeRecommendation(recommendation);

    const [view] = await toRecommendationViews([recommendation], places);
    if (!view) throw new ApiError('internal', 'The recommendation could not be loaded.');
    return { recommendation: view };
  } catch (error) {
    throw mapFirestoreError(error);
  }
}
