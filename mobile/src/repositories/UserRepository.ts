import type { PublicUser } from '@roami/shared';
import { doc, getDoc, runTransaction, type DocumentData } from 'firebase/firestore';

import { db } from './firestore';

// Matches COLLECTIONS.users in shared/src/models.ts.
const USERS = 'users';

/** The profile fields a user can set. The rules reject anything else (such as email). */
export interface ProfileFields {
  name: string;
  bio: string;
  interests: string[];
}

function toPublicUser(id: string, data: DocumentData): PublicUser {
  return {
    id,
    name: String(data.name ?? ''),
    bio: typeof data.bio === 'string' ? data.bio : '',
    interests: Array.isArray(data.interests) ? data.interests.map(String) : [],
  };
}

/**
 * Display names for these users, keyed by ID. Users without a profile document
 * are left out.
 */
export async function getUserNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds)].filter((id) => id.length > 0);
  const snapshots = await Promise.all(unique.map((id) => getDoc(doc(db, USERS, id))));
  const names = new Map<string, string>();
  for (const snapshot of snapshots) {
    const name = snapshot.exists() ? snapshot.data().name : undefined;
    if (typeof name === 'string' && name.length > 0) names.set(snapshot.id, name);
  }
  return names;
}

export async function getProfileById(userId: string): Promise<PublicUser | null> {
  const snapshot = await getDoc(doc(db, USERS, userId));
  return snapshot.exists() ? toPublicUser(snapshot.id, snapshot.data()) : null;
}

/**
 * Creates the profile if it doesn't exist yet. Runs in a transaction so two
 * calls at once (sign-up and app start, say) can't both create it.
 */
export async function createProfileIfMissing(
  userId: string,
  fields: ProfileFields,
  createdAt: string,
): Promise<{ profile: PublicUser; created: boolean }> {
  const ref = doc(db, USERS, userId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists()) {
      return { profile: toPublicUser(snapshot.id, snapshot.data()), created: false };
    }
    transaction.set(ref, { id: userId, ...fields, createdAt });
    return { profile: { id: userId, ...fields }, created: true };
  });
}

/**
 * Changes some profile fields and returns the saved profile, or null if the
 * profile doesn't exist. Writes the whole document so id and createdAt are kept
 * exactly as they were, which the rules require.
 */
export async function updateProfileFields(
  userId: string,
  changes: Partial<ProfileFields>,
): Promise<PublicUser | null> {
  const ref = doc(db, USERS, userId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    const next: PublicUser = { ...toPublicUser(snapshot.id, data), ...changes };
    transaction.set(ref, {
      id: userId,
      name: next.name,
      bio: next.bio,
      interests: next.interests,
      createdAt: String(data.createdAt ?? ''),
    });
    return next;
  });
}
