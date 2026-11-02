import type {
  EnsureProfileRequest,
  EnsureProfileResponse,
  GetProfileRequest,
  GetProfileResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from '@roami/shared';

import { ApiError } from '../api';
import { getCurrentUser, getCurrentUserId } from '../auth/AuthService';
import {
  createProfileIfMissing,
  getProfileById,
  updateProfileFields,
  type ProfileFields,
} from '../repositories/UserRepository';

// These limits match validProfile in firestore.rules. Checking them here gives
// the user a clear message instead of a permission-denied error.
const MAX_NAME = 60;
const MAX_BIO = 500;
const MAX_INTERESTS = 20;
const MAX_INTEREST_LENGTH = 40;
const DEFAULT_NAME = 'Traveler';

function requireUserId(): string {
  const userId = getCurrentUserId();
  if (!userId) throw new ApiError('unauthenticated', 'Sign in first.');
  return userId;
}

function cleanName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new ApiError('invalid-argument', 'Enter a name.');
  if (trimmed.length > MAX_NAME) {
    throw new ApiError('invalid-argument', `Names can be at most ${MAX_NAME} characters.`);
  }
  return trimmed;
}

function cleanBio(bio: string): string {
  const trimmed = bio.trim();
  if (trimmed.length > MAX_BIO) {
    throw new ApiError('invalid-argument', `Bios can be at most ${MAX_BIO} characters.`);
  }
  return trimmed;
}

/** Trims, drops empty entries, and removes duplicates that differ only in capitalization. */
function cleanInterests(interests: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of interests) {
    const interest = String(raw).trim();
    const key = interest.toLowerCase();
    if (interest.length === 0 || seen.has(key)) continue;
    if (interest.length > MAX_INTEREST_LENGTH) {
      throw new ApiError(
        'invalid-argument',
        `Interests can be at most ${MAX_INTEREST_LENGTH} characters.`,
      );
    }
    seen.add(key);
    result.push(interest);
  }
  if (result.length > MAX_INTERESTS) {
    throw new ApiError('invalid-argument', `Choose at most ${MAX_INTERESTS} interests.`);
  }
  return result;
}

/**
 * Call after sign-up and sign-in. Creates the profile if it doesn't exist yet,
 * named from displayName, then the account's name, then a default. Never stores
 * email. An existing profile is returned unchanged.
 */
export async function ensureProfile(request: EnsureProfileRequest): Promise<EnsureProfileResponse> {
  const user = getCurrentUser();
  if (!user) throw new ApiError('unauthenticated', 'Sign in first.');

  const candidate = request.displayName?.trim() || user.displayName?.trim() || DEFAULT_NAME;
  const fields: ProfileFields = {
    name: cleanName(candidate.slice(0, MAX_NAME)),
    bio: '',
    interests: [],
  };
  return createProfileIfMissing(user.uid, fields, new Date().toISOString());
}

export async function getProfile(request: GetProfileRequest): Promise<GetProfileResponse> {
  const myId = requireUserId();
  const userId = request.userId?.trim() || myId;
  const profile = await getProfileById(userId);
  if (!profile) {
    throw new ApiError(
      'not-found',
      userId === myId ? 'Your profile has not been created yet.' : 'No such user.',
    );
  }
  return { profile };
}

export async function updateProfile(request: UpdateProfileRequest): Promise<UpdateProfileResponse> {
  const userId = requireUserId();

  const changes: Partial<ProfileFields> = {};
  if (request.name !== undefined) changes.name = cleanName(request.name);
  if (request.bio !== undefined) changes.bio = cleanBio(request.bio);
  if (request.interests !== undefined) {
    if (!Array.isArray(request.interests)) {
      throw new ApiError('invalid-argument', 'Interests must be a list.');
    }
    changes.interests = cleanInterests(request.interests);
  }

  const profile = await updateProfileFields(userId, changes);
  if (!profile) throw new ApiError('not-found', 'Your profile has not been created yet.');
  return { profile };
}
