import { collection, doc, getDocs, query, setDoc, where, deleteDoc } from 'firebase/firestore';
import { db } from './firestore';

const FOLLOWS = 'follows';

export async function listFolloweeIds(followerId: string): Promise<string[]> {
  const snapshot = await getDocs(
    query(collection(db, FOLLOWS), where('followerId', '==', followerId)),
  );
  return snapshot.docs.map((entry) => String(entry.data().followeeId));
}

export async function createFollow(followerId: string, followeeId: string): Promise<void> {
  await setDoc(doc(db, FOLLOWS, `${followerId}_${followeeId}`), {
    followerId,
    followeeId,
    createdAt: new Date().toISOString(),
  });
}

export async function deleteFollow(followerId: string, followeeId: string): Promise<void> {
  await deleteDoc(doc(db, FOLLOWS, `${followerId}_${followeeId}`));
}
