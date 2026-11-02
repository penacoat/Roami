// Temporary developer check: runs every live profile, search, trip, map, and feed call through
// callApi, the same way screens will, and reports each step. In live mode this
// exercises the real services against Firestore and its security rules. It creates
// a test trip each time it runs, so use it against the emulator only.
import { ApiError, callApi } from '../api';

export interface CheckLine {
  ok: boolean;
  text: string;
}

function isoDate(daysFromToday: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function describeError(error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'unknown';
  const message = error instanceof Error ? error.message : String(error);
  return `${code}: ${message}`;
}

/** Runs the steps in order and stops at the first failure. Returns every line reported. */
export async function runBackendCheck(
  report: (line: CheckLine) => void = () => {},
): Promise<CheckLine[]> {
  const lines: CheckLine[] = [];
  const say = (ok: boolean, text: string) => {
    const line = { ok, text };
    lines.push(line);
    report(line);
  };
  const step = async <T>(name: string, run: () => Promise<T>, summary: (r: T) => string) => {
    const result = await run();
    say(true, `${name}: ${summary(result)}`);
    return result;
  };

  try {
    await step(
      'ensureProfile',
      () => callApi('ensureProfile', {}),
      (r) => `${r.profile.name} (${r.created ? 'created' : 'already existed'})`,
    );
    const { profile } = await step(
      'getProfile',
      () => callApi('getProfile', {}),
      (r) => `${r.profile.name}, ${r.profile.interests.length} interests`,
    );
    await step(
      'updateProfile',
      // Saves the same interests back, so the check exercises the write without
      // changing anything.
      () => callApi('updateProfile', { interests: profile.interests }),
      (r) => `saved, still ${r.profile.interests.length} interests`,
    );

    const { places } = await step(
      'listPlaces',
      () => callApi('listPlaces', { city: 'Seattle' }),
      (r) => `${r.places.length} places`,
    );
    if (places.length < 3) throw new Error('Need at least 3 places. Run the seed script.');
    const [first, second, third] = places;

    await step(
      'getPlace',
      () => callApi('getPlace', { placeId: first.id }),
      (r) => `${r.place.name}, ${r.recommendations.length} recommendations`,
    );
    await step(
      'getFeed',
      () => callApi('getFeed', { city: 'Seattle', limit: 5 }),
      (r) => `${r.items.length} items`,
    );
    await step(
      'searchRecommendations',
      () => callApi('searchRecommendations', { text: 'jazz', interests: [], city: 'Seattle' }),
      (r) => {
        const exact = r.results.filter((x) => x.matchLevel === 'exact').length;
        const first = r.results[0]?.reasons[0];
        const why = first ? `, first matched "${first.matched}" (${first.kind})` : '';
        return `${exact} exact, ${r.results.length - exact} broader${why}`;
      },
    );

    let { trip } = await step(
      'createTrip',
      () =>
        callApi('createTrip', {
          city: 'Seattle',
          startDate: isoDate(1),
          endDate: isoDate(2),
          dailyWindow: { start: '09:00', end: '21:00' },
        }),
      (r) => `revision ${r.trip.trip.revision}`,
    );
    const tripId = trip.trip.id;

    ({ trip } = await step(
      'addCandidate',
      () => callApi('addCandidate', { tripId, placeId: first.id }),
      (r) => `${r.trip.candidates.length} candidate, revision ${r.trip.trip.revision}`,
    ));
    ({ trip } = await step(
      'addStop',
      () =>
        callApi('addStop', {
          tripId,
          expectedRevision: trip.trip.revision,
          placeId: second.id,
          day: 1,
          visitMinutes: 60,
        }),
      (r) => `${r.trip.stops.length} stop, revision ${r.trip.trip.revision}`,
    ));
    const staleRevision = trip.trip.revision;
    ({ trip } = await step(
      'addStop at the front',
      () =>
        callApi('addStop', {
          tripId,
          expectedRevision: trip.trip.revision,
          placeId: third.id,
          day: 1,
          order: 1,
          visitMinutes: 45,
        }),
      (r) => r.trip.stops.map((s) => s.place?.name ?? s.title).join(', '),
    ));
    const moving = trip.stops.find((s) => s.placeId === third.id);
    if (!moving) throw new Error('The new stop is missing from the trip.');
    ({ trip } = await step(
      'moveStop to day 2',
      () =>
        callApi('moveStop', {
          tripId,
          expectedRevision: trip.trip.revision,
          stopId: moving.id,
          day: 2,
          order: 1,
        }),
      (r) => r.trip.stops.map((s) => `day ${s.day} #${s.order}`).join(', '),
    ));

    try {
      await callApi('addStop', {
        tripId,
        expectedRevision: staleRevision,
        placeId: first.id,
        day: 2,
        visitMinutes: 30,
      });
      say(false, 'stale edit: was saved, but it should have been refused');
      return lines;
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'aborted') throw error;
      say(true, 'stale edit: refused with "aborted", as expected');
    }

    ({ trip } = await step(
      'removeStop',
      () =>
        callApi('removeStop', {
          tripId,
          expectedRevision: trip.trip.revision,
          stopId: moving.id,
        }),
      (r) => `${r.trip.stops.length} stop left, revision ${r.trip.trip.revision}`,
    ));
    await step(
      'listTrips',
      () => callApi('listTrips', {}),
      (r) => {
        const summary = r.trips.find((t) => t.id === tripId);
        if (!summary) throw new Error('The new trip is missing from listTrips.');
        return `${r.trips.length} trips; this one has ${summary.stopCount} stop`;
      },
    );
    await step(
      'getTrip',
      () => callApi('getTrip', { tripId }),
      (r) => `revision ${r.trip.trip.revision}, ${r.trip.stops.length} stop`,
    );
    say(true, 'All steps passed.');
  } catch (error) {
    say(false, `Failed: ${describeError(error)}`);
  }
  return lines;
}
