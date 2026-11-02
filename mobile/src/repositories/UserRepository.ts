import { doc, getDoc } from 'firebase/firestore';

import { db } from './firestore';

// Matches COLLECTIONS.users in shared/src/models.ts.
const USERS = 'users';

/**
 * Display names for these users, keyed by ID. Users without a profile document
 * are left out (accounts get a profile once ensureProfile is live).
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
