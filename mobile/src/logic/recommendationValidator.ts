import type { CreateRecommendationRequest } from '@roami/shared';

import { isValidDate, type Result } from './trips';

const REQUEST_FIELDS = new Set(['placeId', 'description', 'tags', 'visitDate', 'sourceLinks']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isExternalLink(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0;
  } catch (error) {
    if (error instanceof TypeError) return false;
    throw error;
  }
}

function fail(error: string): Result<CreateRecommendationRequest> {
  return { ok: false, error };
}

/** Validates and normalizes a create-recommendation request without side effects. */
export function validateRecommendationRequest(
  request: unknown,
): Result<CreateRecommendationRequest> {
  if (!isRecord(request)) return fail('Enter a valid recommendation.');
  if (Object.keys(request).some((key) => !REQUEST_FIELDS.has(key))) {
    return fail('The recommendation contains an unsupported field.');
  }

  const placeId = typeof request.placeId === 'string' ? request.placeId.trim() : '';
  if (placeId.length === 0) return fail('Choose a place.');

  const description = typeof request.description === 'string' ? request.description.trim() : '';
  if (description.length === 0) return fail('Add a description.');

  if (!Array.isArray(request.tags) || request.tags.some((tag) => typeof tag !== 'string')) {
    return fail('Tags must be a list of text.');
  }

  if (
    request.visitDate !== undefined &&
    (typeof request.visitDate !== 'string' || !isValidDate(request.visitDate))
  ) {
    return fail('Enter the visit date as a valid YYYY-MM-DD date.');
  }

  if (
    request.sourceLinks !== undefined &&
    (!Array.isArray(request.sourceLinks) ||
      request.sourceLinks.some((link) => typeof link !== 'string' || !isExternalLink(link)))
  ) {
    return fail('Source links must be valid external HTTP or HTTPS URLs.');
  }

  return {
    ok: true,
    value: {
      placeId,
      description,
      tags: [...request.tags],
      ...(request.visitDate !== undefined ? { visitDate: request.visitDate } : {}),
      ...(request.sourceLinks !== undefined ? { sourceLinks: [...request.sourceLinks] } : {}),
    },
  };
}
