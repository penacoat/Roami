import type {
  FollowUserRequest,
  FollowUserResponse,
  GetFollowingResponse,
  UnfollowUserRequest,
  UnfollowUserResponse,
} from '@roami/shared';
import { ApiError } from '../api';
import { getCurrentUserId } from '../auth/AuthService';
import { createFollow, deleteFollow, listFolloweeIds } from '../repositories/FollowRepository';

function currentUserId(): string {
  const userId = getCurrentUserId();
  if (!userId) throw new ApiError('unauthenticated', 'Sign in to continue.');
  return userId;
}

function targetUserId(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError('invalid-argument', 'Choose a contributor to follow.');
  }
  const userId = value.trim();
  if (userId === currentUserId()) {
    throw new ApiError('invalid-argument', 'You cannot follow yourself.');
  }
  return userId;
}

export async function getFollowing(): Promise<GetFollowingResponse> {
  const userId = currentUserId();
  return { userId, userIds: await listFolloweeIds(userId) };
}

export async function followUser(request: FollowUserRequest): Promise<FollowUserResponse> {
  const followerId = currentUserId();
  const followeeId = targetUserId(request.userId);
  await createFollow(followerId, followeeId);
  return { followed: true };
}

export async function unfollowUser(request: UnfollowUserRequest): Promise<UnfollowUserResponse> {
  const followerId = currentUserId();
  const followeeId = targetUserId(request.userId);
  await deleteFollow(followerId, followeeId);
  return { unfollowed: true };
}
