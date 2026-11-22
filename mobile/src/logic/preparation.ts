import type { PreparationTask, SavePreparationRequest, TripStop } from '@roami/shared';
import { isValidDate, type Result } from './trips';

export function validBookingUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      ['https:', 'http:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

export function taskWithReview(task: PreparationTask, stop: TripStop): PreparationTask {
  const reviewed = task.reviewedSchedule;
  return {
    ...task,
    completed: task.completed ?? false,
    needsReview:
      task.needsReview ||
      Boolean(
        reviewed &&
        (reviewed.day !== stop.day ||
          reviewed.startTime !== stop.startTime ||
          reviewed.visitMinutes !== stop.visitMinutes),
      ),
  };
}

export function planPreparation(
  request: SavePreparationRequest,
  stop: TripStop,
  id: string,
  current?: PreparationTask,
): Result<PreparationTask> {
  const title = typeof request.title === 'string' ? request.title.trim() : '';
  if (!title || title.length > 200)
    return { ok: false, error: 'Enter a checklist item of up to 200 characters.' };
  if (
    request.bookingUrl !== null &&
    (!validBookingUrl(request.bookingUrl) || request.bookingUrl.length > 2048)
  )
    return { ok: false, error: 'Enter a full booking link beginning with https:// or http://.' };
  if (request.deadline !== null && !isValidDate(request.deadline))
    return { ok: false, error: 'Enter the due date as YYYY-MM-DD.' };
  if (typeof request.completed !== 'boolean')
    return { ok: false, error: 'Choose whether this item is complete.' };
  const task: PreparationTask = {
    id,
    tripStopId: stop.id,
    title,
    bookingUrl: request.bookingUrl,
    source: current?.source ?? null,
    deadline: request.deadline,
    completed: request.completed,
    needsReview: request.reviewSchedule ? false : (current?.needsReview ?? false),
  };
  const schedule =
    !current || request.reviewSchedule
      ? { day: stop.day, startTime: stop.startTime, visitMinutes: stop.visitMinutes }
      : current.reviewedSchedule;
  if (schedule) task.reviewedSchedule = schedule;
  return { ok: true, value: task };
}
