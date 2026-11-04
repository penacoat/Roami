// In-memory stand-in for the parts of 'firebase/firestore' the repositories use,
// for Jest tests. It also mimics the security rules that matter for trips, stops,
// and recommendations (firestore.rules), so a write or query the real rules would
// refuse fails here too. It is not a full Firestore: keep it in step with
// firestore.rules when either changes, and still check against the emulator.
//
// Use it in a test file with:
//   jest.mock('firebase/firestore', () => require('../test-utils/fakeFirestore').firestoreModule);
//   jest.mock('../src/repositories/firestore', () => ({ db: {} }));

type Data = Record<string, unknown>;

const TRIP_FIELDS = [
  'id',
  'ownerId',
  'city',
  'startDate',
  'endDate',
  'dailyWindow',
  'startingPoints',
  'candidatePlaceIds',
  'revision',
  'createdAt',
  'updatedAt',
];
const STOP_FIELDS = [
  'id',
  'tripId',
  'placeId',
  'title',
  'recommendationIds',
  'day',
  'order',
  'startTime',
  'visitMinutes',
  'walkingMinutesFromPrevious',
  'isFixed',
  'isRequired',
  'warnings',
];
const RECOMMENDATION_FIELDS = [
  'id',
  'authorId',
  'placeId',
  'description',
  'tags',
  'visitDate',
  'sourceLinks',
  'moderationStatus',
  'createdAt',
];

class FakeFirestoreError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const deny = (why: string) => new FakeFirestoreError('permission-denied', `Rules deny: ${why}`);

interface DocRef {
  kind: 'doc';
  collection: string;
  id: string;
  path: string;
}
interface CollectionRef {
  kind: 'collection';
  collection: string;
}
interface Filter {
  field: string;
  op: '==' | 'in';
  value: unknown;
}
interface Query {
  kind: 'query';
  collection: string;
  filters: Filter[];
}

/** Test controls: the data, the signed-in user, and a log of operations. */
export const fake = {
  docs: new Map<string, Data>(),
  uid: null as string | null,
  /** Number of document reads, so tests can check read costs. */
  reads: 0,
  reset() {
    this.docs = new Map();
    this.uid = null;
    this.reads = 0;
    autoId = 0;
  },
  /** Writes directly, skipping the rules (like withSecurityRulesDisabled). */
  seed(path: string, data: Data) {
    this.docs.set(path, structuredClone(data));
  },
  get(path: string): Data | undefined {
    const data = this.docs.get(path);
    return data ? structuredClone(data) : undefined;
  },
  all(collectionName: string): Data[] {
    return [...this.docs.entries()]
      .filter(([path]) => path.startsWith(`${collectionName}/`))
      .map(([, data]) => structuredClone(data));
  },
};

let autoId = 0;

function sameKeys(data: Data, fields: string[]): boolean {
  const keys = Object.keys(data).sort();
  return keys.length === fields.length && [...fields].sort().every((f, i) => f === keys[i]);
}

// ---------- Rules (a simplified copy of firestore.rules) ----------

function signedIn(): string {
  if (!fake.uid) throw deny('not signed in');
  return fake.uid;
}

function tripOwner(state: Map<string, Data>, tripId: unknown): unknown {
  const trip = state.get(`trips/${String(tripId)}`);
  if (!trip) throw deny(`get() of missing trip ${String(tripId)}`);
  return trip.ownerId;
}

function canViewTrip(tripId: unknown): boolean {
  const uid = signedIn();
  if (tripOwner(fake.docs, tripId) === uid) return true;
  const share = fake.docs.get(`tripShares/${String(tripId)}`);
  return Array.isArray(share?.viewerIds) && share.viewerIds.includes(uid);
}

function checkRead(ref: DocRef, data: Data | undefined) {
  const uid = signedIn();
  switch (ref.collection) {
    case 'places':
    case 'users':
      return;
    case 'trips':
      if (!data) throw deny('reading a trip that does not exist');
      if (data.ownerId !== uid && !canViewTrip(ref.id)) throw deny('not your trip');
      return;
    case 'recommendations':
      if (data && data.moderationStatus !== 'active' && data.authorId !== uid) {
        throw deny('recommendation is not active');
      }
      return;
    case 'savedPlaces':
      if (ref.id.split('_')[0] !== uid) throw deny('saved places are private');
      return;
    default:
      throw deny(`no read rule for ${ref.collection} in the fake`);
  }
}

function checkQuery(q: Query) {
  const uid = signedIn();
  const eq = (field: string) => q.filters.find((f) => f.field === field && f.op === '==');
  switch (q.collection) {
    case 'places':
      return;
    case 'trips':
      if (eq('ownerId')?.value !== uid) throw deny('trip queries need where ownerId == me');
      return;
    case 'tripStops': {
      const tripId = eq('tripId');
      if (!tripId) throw deny('stop queries need where tripId == ...');
      if (!canViewTrip(tripId.value)) throw deny('cannot view that trip');
      return;
    }
    case 'recommendations':
      if (eq('moderationStatus')?.value !== 'active') {
        throw deny("recommendation queries need where moderationStatus == 'active'");
      }
      return;
    case 'savedPlaces':
      if (eq('userId')?.value !== uid) throw deny('saved place queries need where userId == me');
      return;
    default:
      throw deny(`no list rule for ${q.collection} in the fake`);
  }
}

/** Checks one write against the state before and after the whole batch. */
function checkWrite(
  path: string,
  next: Data | null,
  before: Map<string, Data>,
  after: Map<string, Data>,
) {
  const uid = signedIn();
  const [collectionName, id] = path.split('/');
  const previous = before.get(path);

  if (collectionName === 'trips') {
    if (!next) throw deny('trips cannot be deleted');
    if (!sameKeys(next, TRIP_FIELDS)) throw deny(`trip fields ${Object.keys(next).join(',')}`);
    if (next.id !== id) throw deny('trip id must match the document ID');
    if (typeof next.revision !== 'number' || !Number.isInteger(next.revision)) {
      throw deny('revision must be an int');
    }
    if (!previous) {
      if (next.ownerId !== uid) throw deny('trip owner must be you');
      if (next.revision !== 1) throw deny('new trips start at revision 1');
      return;
    }
    if (previous.ownerId !== uid) throw deny('only the owner can change a trip');
    if (next.ownerId !== previous.ownerId) throw deny('owner cannot change');
    if (next.createdAt !== previous.createdAt) throw deny('createdAt cannot change');
    if (next.revision !== (previous.revision as number) + 1) {
      throw deny('every trip change raises the revision by exactly one');
    }
    if ((next.candidatePlaceIds as unknown[]).length > 50) throw deny('too many candidates');
    return;
  }

  if (collectionName === 'tripStops') {
    const tripId = next ? next.tripId : previous?.tripId;
    if (tripOwner(before, tripId) !== uid) throw deny('only the trip owner can change stops');
    if (previous && next && next.tripId !== previous.tripId) throw deny('stop cannot change trip');
    const tripBefore = before.get(`trips/${String(tripId)}`) as Data;
    const tripAfter = after.get(`trips/${String(tripId)}`) as Data;
    if (tripAfter.revision !== (tripBefore.revision as number) + 1) {
      throw deny('a stop change must raise the trip revision by one in the same batch');
    }
    if (!next) return;
    if (!sameKeys(next, STOP_FIELDS)) throw deny(`stop fields ${Object.keys(next).join(',')}`);
    if (next.id !== id) throw deny('stop id must match the document ID');
    const day = next.day as number;
    const order = next.order as number;
    if (!Number.isInteger(day) || day < 1 || day > 7) throw deny('day must be 1 to 7');
    if (!Number.isInteger(order) || order < 1 || order > 5) throw deny('order must be 1 to 5');
    const minutes = next.visitMinutes as number;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 720) {
      throw deny('visitMinutes out of range');
    }
    if (next.placeId === null && next.title === null) throw deny('stop needs a place or title');
    return;
  }

  if (collectionName === 'users') {
    if (id !== uid) throw deny('you can only write your own profile');
    if (!next) throw deny('profiles cannot be deleted');
    const allowed = ['id', 'name', 'bio', 'interests', 'createdAt'];
    if (Object.keys(next).some((k) => !allowed.includes(k))) {
      throw deny(`profile fields ${Object.keys(next).join(',')}`);
    }
    if (next.id !== id) throw deny('profile id must match the document ID');
    const name = next.name;
    if (typeof name !== 'string' || name.length < 1 || name.length > 60) throw deny('bad name');
    if (typeof next.bio !== 'string' || next.bio.length > 500) throw deny('bad bio');
    if (!Array.isArray(next.interests) || next.interests.length > 20) throw deny('bad interests');
    if (typeof next.createdAt !== 'string') throw deny('createdAt must be a string');
    if (previous && next.createdAt !== previous.createdAt) throw deny('createdAt cannot change');
    return;
  }

  if (collectionName === 'savedPlaces') {
    if (!next) {
      if (!previous) throw deny('deleting a save that does not exist');
      if (previous.userId !== uid) throw deny('only the owner can delete a save');
      return;
    }
    const allowed = ['id', 'userId', 'placeId', 'recommendationIds', 'personalNote', 'createdAt'];
    if (Object.keys(next).some((k) => !allowed.includes(k))) {
      throw deny(`save fields ${Object.keys(next).join(',')}`);
    }
    if (next.id !== id) throw deny('save id must match the document ID');
    if (id !== `${String(next.userId)}_${String(next.placeId)}`) {
      throw deny('save ID must be userId_placeId');
    }
    if (typeof next.placeId !== 'string' || next.placeId.length < 1) throw deny('bad placeId');
    const recIds = next.recommendationIds;
    if (!Array.isArray(recIds) || recIds.length > 25) throw deny('bad recommendationIds');
    const note = next.personalNote;
    if (typeof note !== 'string' || note.length > 2000) throw deny('bad personalNote');
    if (typeof next.createdAt !== 'string') throw deny('createdAt must be a string');
    if (!previous) {
      if (next.userId !== uid) throw deny('you can only save for yourself');
      if (!before.has(`places/${next.placeId}`)) throw deny('the place must exist');
      return;
    }
    if (previous.userId !== uid) throw deny('only the owner can change a save');
    for (const field of ['userId', 'placeId', 'createdAt']) {
      if (next[field] !== previous[field]) throw deny(`${field} cannot change`);
    }
    return;
  }

  if (collectionName === 'recommendations') {
    if (!next) {
      if (!previous || previous.authorId !== uid) {
        throw deny('only the author can delete a recommendation');
      }
      return;
    }
    if (!sameKeys(next, RECOMMENDATION_FIELDS)) {
      throw deny(`recommendation fields ${Object.keys(next).join(',')}`);
    }
    if (next.id !== id) throw deny('recommendation ID must match the document ID');
    if (
      typeof next.authorId !== 'string' ||
      typeof next.placeId !== 'string' ||
      typeof next.description !== 'string' ||
      next.description.length === 0 ||
      !Array.isArray(next.tags) ||
      (next.visitDate !== null && typeof next.visitDate !== 'string') ||
      !Array.isArray(next.sourceLinks) ||
      !['active', 'hidden', 'removed'].includes(String(next.moderationStatus)) ||
      typeof next.createdAt !== 'string'
    ) {
      throw deny('recommendation fields are malformed');
    }
    if (!previous) {
      if (next.authorId !== uid) throw deny('recommendation author must be you');
      if (next.moderationStatus !== 'active') throw deny('new recommendations must be active');
      if (!before.has(`places/${next.placeId}`)) {
        throw deny('recommendation place must exist');
      }
      return;
    }
    if (previous.authorId !== uid) throw deny('only the author can change a recommendation');
    for (const field of ['authorId', 'placeId', 'createdAt', 'moderationStatus']) {
      if (next[field] !== previous[field]) throw deny(`${field} cannot change`);
    }
    return;
  }

  throw deny(`no write rule for ${collectionName} in the fake`);
}

function commit(writes: Map<string, Data | null>) {
  const before = fake.docs;
  const after = new Map(before);
  for (const [path, data] of writes) {
    if (data) after.set(path, data);
    else after.delete(path);
  }
  for (const [path, data] of writes) checkWrite(path, data, before, after);
  fake.docs = after;
}

// ---------- The module API ----------

function matches(data: Data, filter: Filter): boolean {
  const value = data[filter.field];
  return filter.op === '==' ? value === filter.value : (filter.value as unknown[]).includes(value);
}

function snapshot(ref: DocRef, data: Data | undefined) {
  return {
    id: ref.id,
    exists: () => data !== undefined,
    data: () => (data ? structuredClone(data) : undefined),
  };
}

function readDoc(ref: DocRef) {
  const data = fake.docs.get(ref.path);
  checkRead(ref, data);
  fake.reads += 1;
  return snapshot(ref, data);
}

export const firestoreModule = {
  collection(_db: unknown, name: string): CollectionRef {
    return { kind: 'collection', collection: name };
  },
  doc(parent: CollectionRef | unknown, ...segments: string[]): DocRef {
    if ((parent as CollectionRef)?.kind === 'collection') {
      const id = segments[0] ?? `auto${++autoId}`;
      const name = (parent as CollectionRef).collection;
      return { kind: 'doc', collection: name, id, path: `${name}/${id}` };
    }
    const [name, id] = segments;
    return { kind: 'doc', collection: name, id, path: `${name}/${id}` };
  },
  where(field: string, op: '==' | 'in', value: unknown): Filter {
    if (op !== '==' && op !== 'in') throw new Error(`fake supports only == and in, not ${op}`);
    if (op === 'in' && (!Array.isArray(value) || value.length === 0 || value.length > 30)) {
      throw new FakeFirestoreError('invalid-argument', "'in' needs 1 to 30 values");
    }
    return { field, op, value };
  },
  query(ref: CollectionRef, ...filters: Filter[]): Query {
    return { kind: 'query', collection: ref.collection, filters };
  },
  async getDoc(ref: DocRef) {
    return readDoc(ref);
  },
  async getDocs(q: Query | CollectionRef) {
    const filters = q.kind === 'query' ? q.filters : [];
    const asQuery: Query = { kind: 'query', collection: q.collection, filters };
    checkQuery(asQuery);
    const docs = [...fake.docs.entries()]
      .filter(([path]) => path.startsWith(`${q.collection}/`))
      .filter(([, data]) => filters.every((f) => matches(data, f)))
      .map(([path, data]) => {
        fake.reads += 1;
        const id = path.split('/')[1];
        return snapshot({ kind: 'doc', collection: q.collection, id, path }, data);
      });
    return { docs, size: docs.length, empty: docs.length === 0 };
  },
  async setDoc(ref: DocRef, data: Data) {
    commit(new Map([[ref.path, structuredClone(data)]]));
  },
  async runTransaction<T>(_db: unknown, update: (tx: unknown) => Promise<T>): Promise<T> {
    const writes = new Map<string, Data | null>();
    const tx = {
      async get(ref: DocRef) {
        if (writes.size > 0) throw new Error('Firestore transactions must read before writing');
        return readDoc(ref);
      },
      set(ref: DocRef, data: Data) {
        writes.set(ref.path, structuredClone(data));
        return tx;
      },
      update(ref: DocRef, patch: Data) {
        const current = writes.get(ref.path) ?? fake.docs.get(ref.path);
        if (!current) throw new FakeFirestoreError('not-found', `no document ${ref.path}`);
        writes.set(ref.path, { ...structuredClone(current), ...structuredClone(patch) });
        return tx;
      },
      delete(ref: DocRef) {
        writes.set(ref.path, null);
        return tx;
      },
    };
    const result = await update(tx);
    commit(writes);
    return result;
  },
};
