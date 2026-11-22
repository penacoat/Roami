import type { Ranking, Visit } from '@roami/shared';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { db } from './firestore';

export async function readJournal(userId: string) {
  const [visits, rankings] = await Promise.all([
    getDocs(query(collection(db, 'visits'), where('userId', '==', userId))),
    getDocs(query(collection(db, 'rankings'), where('userId', '==', userId))),
  ]);
  return {
    visits: visits.docs.map((item) => ({ ...item.data(), id: item.id }) as Visit),
    rankings: rankings.docs.map((item) => ({ ...item.data(), id: item.id }) as Ranking),
  };
}

export function writeVisit(visit: Visit) {
  return setDoc(doc(db, 'visits', visit.id), visit);
}

export function writeRanking(ranking: Ranking) {
  return setDoc(doc(db, 'rankings', ranking.id), ranking);
}
