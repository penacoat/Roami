import type { PreparationTask } from '@roami/shared';
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firestore';

const TASKS = 'preparationTasks';

function toTask(snapshot: DocumentSnapshot): PreparationTask {
  return { ...snapshot.data(), id: snapshot.id } as PreparationTask;
}

export async function preparationForStop(stopId: string): Promise<PreparationTask[]> {
  const snapshot = await getDocs(query(collection(db, TASKS), where('tripStopId', '==', stopId)));
  return snapshot.docs.map(toTask);
}

export async function readPreparation(id: string) {
  const snapshot = await getDoc(doc(db, TASKS, id));
  return snapshot.exists() ? toTask(snapshot) : undefined;
}

export function newTaskId() {
  return doc(collection(db, TASKS)).id;
}

export function writePreparation(task: PreparationTask) {
  return setDoc(doc(db, TASKS, task.id), task);
}

export function deletePreparation(id: string) {
  return deleteDoc(doc(db, TASKS, id));
}
