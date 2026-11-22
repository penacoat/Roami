import type { SavePreparationRequest, StopPreparationRequest } from '@roami/shared';
import { ApiError } from '../api';
import { planPreparation, taskWithReview } from '../logic/preparation';
import {
  deletePreparation,
  newTaskId,
  preparationForStop,
  readPreparation,
  writePreparation,
} from '../repositories/PreparationRepository';
import { getTrip, listStops } from '../repositories/TripRepository';
import { requireOwnedTrip, requireTripId, requireUserId } from './TripService';

async function ownedStop(request: StopPreparationRequest) {
  const uid = requireUserId();
  const id = requireTripId(request.tripId);
  requireOwnedTrip(await getTrip(id), uid);
  const stops = await listStops(id);
  const stop = stops?.find((item) => item.id === request.stopId);
  if (!stop) throw new ApiError('not-found', 'That activity is no longer in this trip.');
  return stop;
}

async function ownedTask(taskId: string, stopId: string) {
  if (!taskId || taskId.includes('/'))
    throw new ApiError('invalid-argument', 'Choose a checklist item.');
  const task = await readPreparation(taskId);
  if (!task || task.tripStopId !== stopId)
    throw new ApiError('not-found', 'That checklist item is unavailable.');
  return task;
}

export async function listPreparation(request: StopPreparationRequest) {
  const stop = await ownedStop(request);
  const tasks = await preparationForStop(stop.id);
  return { tasks: tasks.map((task) => taskWithReview(task, stop)) };
}

export async function savePreparation(request: SavePreparationRequest) {
  const stop = await ownedStop(request);
  const current = request.taskId ? await ownedTask(request.taskId, stop.id) : undefined;
  const planned = planPreparation(request, stop, current?.id ?? newTaskId(), current);
  if (!planned.ok) throw new ApiError('invalid-argument', planned.error);
  await writePreparation(planned.value);
  return { task: taskWithReview(planned.value, stop) };
}

export async function removePreparation(request: StopPreparationRequest & { taskId: string }) {
  const stop = await ownedStop(request);
  const task = await ownedTask(request.taskId, stop.id);
  await deletePreparation(task.id);
  return { deleted: true as const };
}
