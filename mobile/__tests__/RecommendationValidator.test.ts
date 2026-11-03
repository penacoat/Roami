import { describe, expect, it } from '@jest/globals';

import { validateRecommendationRequest } from '../src/logic/recommendationValidator';

const validRequest = {
  placeId: 'p1',
  description: 'A great place to visit.',
  tags: ['coffee'],
};

describe('validateRecommendationRequest', () => {
  it('accepts a valid request and normalizes its place and description', () => {
    expect(
      validateRecommendationRequest({
        ...validRequest,
        placeId: ' p1 ',
        description: '  A great place to visit. ',
        visitDate: '2024-02-29',
        sourceLinks: ['https://example.com/post'],
      }),
    ).toEqual({
      ok: true,
      value: {
        ...validRequest,
        description: 'A great place to visit.',
        visitDate: '2024-02-29',
        sourceLinks: ['https://example.com/post'],
      },
    });
  });

  it.each([undefined, null, [], 'invalid'])('rejects a malformed request: %p', (request) => {
    expect(validateRecommendationRequest(request)).toMatchObject({ ok: false });
  });

  it('rejects missing required values', () => {
    expect(validateRecommendationRequest({ description: 'Nice', tags: [] })).toMatchObject({
      ok: false,
    });
    expect(validateRecommendationRequest({ placeId: 'p1', tags: [] })).toMatchObject({
      ok: false,
    });
    expect(validateRecommendationRequest({ placeId: 'p1', description: 'Nice' })).toMatchObject({
      ok: false,
    });
  });

  it.each(['', ' \t\n '])('rejects an empty description (%p)', (description) => {
    expect(validateRecommendationRequest({ ...validRequest, description })).toMatchObject({
      ok: false,
    });
  });

  it('rejects wrong field types and invalid visit dates', () => {
    expect(validateRecommendationRequest({ ...validRequest, placeId: 12 })).toMatchObject({
      ok: false,
    });
    expect(validateRecommendationRequest({ ...validRequest, description: 12 })).toMatchObject({
      ok: false,
    });
    expect(validateRecommendationRequest({ ...validRequest, tags: ['ok', 2] })).toMatchObject({
      ok: false,
    });
    expect(
      validateRecommendationRequest({ ...validRequest, visitDate: '2026-02-30' }),
    ).toMatchObject({ ok: false });
    expect(
      validateRecommendationRequest({ ...validRequest, sourceLinks: 'https://example.com' }),
    ).toMatchObject({ ok: false });
    expect(
      validateRecommendationRequest({ ...validRequest, sourceLinks: ['javascript:alert(1)'] }),
    ).toMatchObject({ ok: false });
    expect(
      validateRecommendationRequest({ ...validRequest, sourceLinks: ['not a URL'] }),
    ).toMatchObject({ ok: false });
  });

  it('rejects unsupported fields such as a caller-supplied author ID', () => {
    expect(
      validateRecommendationRequest({ ...validRequest, authorId: 'someone-else' }),
    ).toMatchObject({ ok: false });
  });
});
