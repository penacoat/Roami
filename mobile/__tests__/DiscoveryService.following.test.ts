import { beforeEach, expect, it, jest } from '@jest/globals';
import { getCurrentUserId } from '../src/auth/AuthService';
import { listFolloweeIds } from '../src/repositories/FollowRepository';
import {
  listActiveForAuthors,
  listActiveForPlaces,
} from '../src/repositories/RecommendationRepository';
import { listCityPlaces } from '../src/services/PlaceService';
import { toRecommendationViews } from '../src/services/recommendationViews';
import { getFeed } from '../src/services/DiscoveryService';

jest.mock('../src/auth/AuthService', () => ({ getCurrentUserId: jest.fn() }));
jest.mock('../src/repositories/FollowRepository', () => ({ listFolloweeIds: jest.fn() }));
jest.mock('../src/repositories/RecommendationRepository', () => ({
  listActiveForAuthors: jest.fn(),
  listActiveForPlaces: jest.fn(),
}));
jest.mock('../src/services/PlaceService', () => ({ listCityPlaces: jest.fn() }));
jest.mock('../src/services/recommendationViews', () => ({
  toRecommendationViews: jest.fn(),
}));

const mockCurrentUserId = jest.mocked(getCurrentUserId);
const mockPlaces = jest.mocked(listCityPlaces);
const mockFollowees = jest.mocked(listFolloweeIds);
const mockAuthors = jest.mocked(listActiveForAuthors);
const mockCityRecs = jest.mocked(listActiveForPlaces);
const mockViews = jest.mocked(toRecommendationViews);

beforeEach(() => {
  jest.resetAllMocks();
  mockCurrentUserId.mockReturnValue('user-a');
  mockPlaces.mockResolvedValue([
    {
      id: 'place-seattle',
      name: 'Seattle Place',
      latitude: 47,
      longitude: -122,
      category: 'cafe',
      openingHours: null,
      missingFields: [],
    },
  ]);
  mockFollowees.mockResolvedValue(['user-b']);
  mockAuthors.mockResolvedValue([]);
  mockCityRecs.mockResolvedValue([]);
  mockViews.mockResolvedValue([]);
});

it('loads only recommendations from followed contributors for the Following feed', async () => {
  await expect(getFeed({ city: 'Seattle', followingOnly: true })).resolves.toEqual({ items: [] });
  expect(mockFollowees).toHaveBeenCalledWith('user-a');
  expect(mockAuthors).toHaveBeenCalledWith(['user-b']);
  expect(mockPlaces).toHaveBeenCalledWith('Seattle', null);
  expect(mockCityRecs).not.toHaveBeenCalled();
});

it('returns an empty Following feed when no contributors are followed', async () => {
  mockFollowees.mockResolvedValue([]);
  await expect(getFeed({ city: 'Seattle', followingOnly: true })).resolves.toEqual({ items: [] });
  expect(mockAuthors).not.toHaveBeenCalled();
});

it('preserves the general city feed and requires authentication for Following', async () => {
  await getFeed({ city: 'Seattle' });
  expect(mockCityRecs).toHaveBeenCalledWith(['place-seattle']);
  mockCurrentUserId.mockReturnValue(null);
  await expect(getFeed({ city: 'Seattle', followingOnly: true })).rejects.toMatchObject({
    code: 'unauthenticated',
  });
});
