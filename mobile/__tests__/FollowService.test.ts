import { beforeEach, expect, it, jest } from '@jest/globals';
import { ApiError } from '../src/api';
import { getCurrentUserId } from '../src/auth/AuthService';
import { createFollow, deleteFollow, listFolloweeIds } from '../src/repositories/FollowRepository';
import { followUser, getFollowing, unfollowUser } from '../src/services/FollowService';

jest.mock('../src/auth/AuthService', () => ({ getCurrentUserId: jest.fn() }));
jest.mock('../src/repositories/FollowRepository', () => ({
  createFollow: jest.fn(),
  deleteFollow: jest.fn(),
  listFolloweeIds: jest.fn(),
}));

const mockCurrentUserId = jest.mocked(getCurrentUserId);
const mockCreateFollow = jest.mocked(createFollow);
const mockDeleteFollow = jest.mocked(deleteFollow);
const mockListFolloweeIds = jest.mocked(listFolloweeIds);

beforeEach(() => {
  jest.resetAllMocks();
  mockCurrentUserId.mockReturnValue('user-a');
  mockCreateFollow.mockResolvedValue();
  mockDeleteFollow.mockResolvedValue();
  mockListFolloweeIds.mockResolvedValue(['user-b']);
});

it('lists the signed-in user and followed contributors', async () => {
  await expect(getFollowing()).resolves.toEqual({ userId: 'user-a', userIds: ['user-b'] });
  expect(mockListFolloweeIds).toHaveBeenCalledWith('user-a');
});

it('creates and removes only the signed-in user’s follow relationship', async () => {
  await expect(followUser({ userId: 'user-b' })).resolves.toEqual({ followed: true });
  await expect(unfollowUser({ userId: 'user-b' })).resolves.toEqual({ unfollowed: true });
  expect(mockCreateFollow).toHaveBeenCalledWith('user-a', 'user-b');
  expect(mockDeleteFollow).toHaveBeenCalledWith('user-a', 'user-b');
});

it('rejects self-follows and signed-out requests', async () => {
  await expect(followUser({ userId: 'user-a' })).rejects.toMatchObject({
    code: 'invalid-argument',
  } satisfies Partial<ApiError>);
  mockCurrentUserId.mockReturnValue(null);
  await expect(getFollowing()).rejects.toMatchObject({ code: 'unauthenticated' });
  await expect(followUser({ userId: 'user-b' })).rejects.toMatchObject({
    code: 'unauthenticated',
  });
  expect(mockCreateFollow).not.toHaveBeenCalled();
});
