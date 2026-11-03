import {readFileSync} from "fs";
import {resolve} from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, writeBatch} from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "roami-rules-test",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "savedPlaces/alice_p1"), {userId: "alice", placeId: "p1"});
    await setDoc(doc(db, "trips/trip1"), {ownerId: "alice", revision: 1});
    await setDoc(doc(db, "tripShares/trip1"), {tripId: "trip1", viewerIds: ["bob"]});
    await setDoc(doc(db, "tripStops/stop1"), {tripId: "trip1", day: 1});
    await setDoc(doc(db, "preparationTasks/task1"), {tripStopId: "stop1"});
    await setDoc(doc(db, "recommendations/recActive"), {authorId: "alice", moderationStatus: "active"});
    await setDoc(doc(db, "recommendations/recRemoved"), {authorId: "alice", moderationStatus: "removed"});
    await setDoc(doc(db, "blocks/alice_bob"), {userId: "alice", blockedUserId: "bob"});
    await setDoc(doc(db, "reports/report1"), {reporterId: "bob"});
  });
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();

describe("saved places are private", () => {
  it("lets the owner read their save", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "savedPlaces/alice_p1")));
  });
  it("blocks other users", async () => {
    await assertFails(getDoc(doc(as("bob"), "savedPlaces/alice_p1")));
  });
  it("blocks signed-out users", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "savedPlaces/alice_p1")));
  });
});

describe("trips are private unless shared, and shared means view-only", () => {
  it("lets the owner read the trip", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "trips/trip1")));
  });
  it("lets a selected viewer read the trip and its stops", async () => {
    await assertSucceeds(getDoc(doc(as("bob"), "trips/trip1")));
    await assertSucceeds(getDoc(doc(as("bob"), "tripStops/stop1")));
  });
  it("blocks someone the trip was not shared with", async () => {
    await assertFails(getDoc(doc(as("carol"), "trips/trip1")));
    await assertFails(getDoc(doc(as("carol"), "tripStops/stop1")));
  });
  it("blocks viewers from editing the trip", async () => {
    await assertFails(setDoc(doc(as("bob"), "trips/trip1"), {ownerId: "alice", revision: 2}));
  });
});

describe("preparation tasks are owner-only", () => {
  it("lets the trip owner read them", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "preparationTasks/task1")));
  });
  it("blocks viewers of a shared trip", async () => {
    await assertFails(getDoc(doc(as("bob"), "preparationTasks/task1")));
  });
});

describe("recommendations respect moderation status", () => {
  it("shows active recommendations to signed-in users", async () => {
    await assertSucceeds(getDoc(doc(as("bob"), "recommendations/recActive")));
  });
  it("hides removed recommendations from other users", async () => {
    await assertFails(getDoc(doc(as("bob"), "recommendations/recRemoved")));
  });
  it("still lets the author see their removed recommendation", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "recommendations/recRemoved")));
  });
});

describe("blocks and reports", () => {
  it("lets a user read only their own blocks", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "blocks/alice_bob")));
    await assertFails(getDoc(doc(as("bob"), "blocks/alice_bob")));
  });
  it("hides reports from every app user", async () => {
    await assertFails(getDoc(doc(as("bob"), "reports/report1")));
    await assertFails(getDoc(doc(as("alice"), "reports/report1")));
  });
});


const now = "2026-10-30T12:00:00Z";

const profile = (uid: string) => ({
  id: uid, name: "Test User", bio: "", interests: ["jazz"], createdAt: now,
});

const save = (uid: string, placeId: string) => ({
  id: `${uid}_${placeId}`, userId: uid, placeId,
  recommendationIds: [] as string[], personalNote: "", createdAt: now,
});

const report = (uid: string) => ({
  id: "r1", reporterId: uid, contentType: "recommendation", contentId: "recActive",
  reason: "spam", status: "open", reviewedBy: null, createdAt: now,
});

const seed = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });

const recommendation = (id: string, authorId: string, overrides: Record<string, unknown> = {}) => ({
  id,
  authorId,
  placeId: "p1",
  description: "A great place to visit.",
  tags: ["coffee"],
  visitDate: null,
  sourceLinks: [],
  moderationStatus: "active",
  createdAt: now,
  ...overrides,
});

describe("recommendation writes", () => {
  it("lets a signed-in user create an active recommendation for an existing place", async () => {
    await seed("places/p1", {name: "Cafe"});
    await assertSucceeds(
      setDoc(doc(as("alice"), "recommendations/rec1"), recommendation("rec1", "alice")),
    );
  });

  it("blocks signed-out users and users writing as someone else", async () => {
    await seed("places/p1", {name: "Cafe"});
    await assertFails(
      setDoc(
        doc(env.unauthenticatedContext().firestore(), "recommendations/rec1"),
        recommendation("rec1", "alice"),
      ),
    );
    await assertFails(
      setDoc(doc(as("bob"), "recommendations/rec1"), recommendation("rec1", "alice")),
    );
  });

  it("requires an existing place and a nonempty description", async () => {
    await seed("places/p1", {name: "Cafe"});
    await assertFails(
      setDoc(
        doc(as("alice"), "recommendations/missingPlace"),
        recommendation("missingPlace", "alice", {placeId: "missing"}),
      ),
    );
    await assertFails(
      setDoc(
        doc(as("alice"), "recommendations/emptyDescription"),
        recommendation("emptyDescription", "alice", {description: ""}),
      ),
    );
  });

  it("blocks extra fields and client-selected non-active moderation states", async () => {
    await seed("places/p1", {name: "Cafe"});
    await assertFails(
      setDoc(
        doc(as("alice"), "recommendations/extraField"),
        {...recommendation("extraField", "alice"), isFeatured: true},
      ),
    );
    await assertFails(
      setDoc(
        doc(as("alice"), "recommendations/hidden"),
        recommendation("hidden", "alice", {moderationStatus: "hidden"}),
      ),
    );
  });

  it("lets the author edit content but not identity, place, or moderation status", async () => {
    await seed("places/p1", {name: "Cafe"});
    await seed("places/p2", {name: "Park"});
    await seed("recommendations/rec1", recommendation("rec1", "alice"));
    const ref = doc(as("alice"), "recommendations/rec1");

    await assertSucceeds(updateDoc(ref, {description: "Visit in the morning."}));
    await assertFails(updateDoc(ref, {authorId: "bob"}));
    await assertFails(updateDoc(ref, {placeId: "p2"}));
    await assertFails(updateDoc(ref, {moderationStatus: "removed"}));
  });

  it("blocks another user from editing or deleting a recommendation", async () => {
    await seed("recommendations/rec1", recommendation("rec1", "alice"));
    const ref = doc(as("bob"), "recommendations/rec1");

    await assertFails(updateDoc(ref, {description: "Changed"}));
    await assertFails(deleteDoc(ref));
  });

  it("lets the author delete their recommendation", async () => {
    await seed("recommendations/rec1", recommendation("rec1", "alice"));
    await assertSucceeds(deleteDoc(doc(as("alice"), "recommendations/rec1")));
  });
});

describe("profiles", () => {
  it("lets a user create their own profile", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "users/alice"), profile("alice")));
  });
  it("blocks creating someone else's profile", async () => {
    await assertFails(setDoc(doc(as("bob"), "users/alice"), profile("alice")));
  });
  it("blocks extra fields such as email", async () => {
    await assertFails(
      setDoc(doc(as("alice"), "users/alice"), {...profile("alice"), email: "a@example.com"}),
    );
  });
  it("lets the owner edit a profile but not createdAt", async () => {
    await seed("users/alice", profile("alice"));
    await assertSucceeds(updateDoc(doc(as("alice"), "users/alice"), {name: "New Name"}));
    await assertFails(updateDoc(doc(as("alice"), "users/alice"), {createdAt: "2027-01-01T00:00:00Z"}));
  });
  it("lets any signed-in user read a profile", async () => {
    await seed("users/alice", profile("alice"));
    await assertSucceeds(getDoc(doc(as("bob"), "users/alice")));
  });
  it("blocks deleting a profile", async () => {
    await seed("users/alice", profile("alice"));
    await assertFails(deleteDoc(doc(as("alice"), "users/alice")));
  });
});

describe("saved places", () => {
  it("lets a user save an existing place", async () => {
    await seed("places/p2", {name: "Cafe"});
    await assertSucceeds(setDoc(doc(as("alice"), "savedPlaces/alice_p2"), save("alice", "p2")));
  });
  it("blocks saving a place that is not in the catalog", async () => {
    await assertFails(setDoc(doc(as("alice"), "savedPlaces/alice_nope"), save("alice", "nope")));
  });
  it("blocks a document ID that is not userId_placeId", async () => {
    await seed("places/p2", {name: "Cafe"});
    await assertFails(setDoc(doc(as("alice"), "savedPlaces/alice_other"), save("alice", "p2")));
  });
  it("blocks saving on behalf of another user", async () => {
    await seed("places/p2", {name: "Cafe"});
    await assertFails(setDoc(doc(as("bob"), "savedPlaces/alice_p2"), save("alice", "p2")));
  });
  it("lets the owner edit a note but not change the place", async () => {
    await seed("places/p3", {name: "Park"});
    await seed("savedPlaces/alice_p3", save("alice", "p3"));
    await assertSucceeds(updateDoc(doc(as("alice"), "savedPlaces/alice_p3"), {personalNote: "Go early"}));
    await assertFails(updateDoc(doc(as("alice"), "savedPlaces/alice_p3"), {placeId: "p4"}));
  });
  it("blocks other users from editing or deleting a save", async () => {
    await seed("places/p3", {name: "Park"});
    await seed("savedPlaces/alice_p3", save("alice", "p3"));
    await assertFails(updateDoc(doc(as("bob"), "savedPlaces/alice_p3"), {personalNote: "x"}));
    await assertFails(deleteDoc(doc(as("bob"), "savedPlaces/alice_p3")));
  });
  it("lets the owner delete a save", async () => {
    await seed("places/p3", {name: "Park"});
    await seed("savedPlaces/alice_p3", save("alice", "p3"));
    await assertSucceeds(deleteDoc(doc(as("alice"), "savedPlaces/alice_p3")));
  });
  it("lets a user check whether their own save exists", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "savedPlaces/alice_missing")));
  });
});

describe("reports", () => {
  it("lets a signed-in user file a report as themselves", async () => {
    await assertSucceeds(setDoc(doc(as("bob"), "reports/r1"), report("bob")));
  });
  it("blocks filing a report as someone else", async () => {
    await assertFails(setDoc(doc(as("bob"), "reports/r1"), report("alice")));
  });
  it("blocks a report that is already marked actioned", async () => {
    await assertFails(setDoc(doc(as("bob"), "reports/r1"), {...report("bob"), status: "actioned"}));
  });
  it("blocks reading or editing a report from the app", async () => {
    await seed("reports/r1", report("bob"));
    await assertFails(getDoc(doc(as("bob"), "reports/r1")));
    await assertFails(updateDoc(doc(as("bob"), "reports/r1"), {status: "dismissed"}));
  });
});

const trip = (uid: string, id: string, revision: number) => ({
  id, ownerId: uid, city: "Seattle", startDate: "2026-11-01", endDate: "2026-11-03",
  dailyWindow: {start: "09:00", end: "21:00"}, startingPoints: [] as unknown[],
  candidatePlaceIds: [] as string[], revision, createdAt: now, updatedAt: now,
});

const stop = (id: string, tripId: string, placeId: string | null) => ({
  id, tripId, placeId, title: placeId ? null : "Dinner reservation",
  recommendationIds: [] as string[], day: 1, order: 1, startTime: null,
  visitMinutes: 60, walkingMinutesFromPrevious: null, isFixed: false,
  isRequired: false, warnings: [] as string[],
});

// Writes a stop and raises the trip's revision in one batch, like the app will.
const writeStopWithRevision = (uid: string, data: ReturnType<typeof stop>, revision: number) => {
  const db = as(uid);
  const batch = writeBatch(db);
  batch.update(doc(db, `trips/${data.tripId}`), {revision, updatedAt: now});
  batch.set(doc(db, `tripStops/${data.id}`), data);
  return batch.commit();
};

describe("trips: who can write and how", () => {
  it("lets a user create their own trip at revision 1", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "trips/t1"), trip("alice", "t1", 1)));
  });
  it("blocks creating a trip for someone else", async () => {
    await assertFails(setDoc(doc(as("bob"), "trips/t1"), trip("alice", "t1", 1)));
  });
  it("blocks creating a trip that starts above revision 1", async () => {
    await assertFails(setDoc(doc(as("alice"), "trips/t1"), trip("alice", "t1", 5)));
  });
  it("lets the owner save a change that raises the revision by one", async () => {
    await seed("trips/t1", trip("alice", "t1", 1));
    await assertSucceeds(updateDoc(doc(as("alice"), "trips/t1"), {revision: 2, city: "Portland"}));
  });
  it("blocks a save that does not raise the revision", async () => {
    await seed("trips/t1", trip("alice", "t1", 1));
    await assertFails(updateDoc(doc(as("alice"), "trips/t1"), {city: "Portland"}));
  });
  it("blocks a save that skips a revision", async () => {
    await seed("trips/t1", trip("alice", "t1", 1));
    await assertFails(updateDoc(doc(as("alice"), "trips/t1"), {revision: 3}));
  });
  it("blocks changing the owner of a trip", async () => {
    await seed("trips/t1", trip("alice", "t1", 1));
    await assertFails(updateDoc(doc(as("alice"), "trips/t1"), {revision: 2, ownerId: "bob"}));
  });
  it("blocks a viewer from editing a shared trip", async () => {
    await seed("trips/t1", trip("alice", "t1", 1));
    await seed("tripShares/t1", {tripId: "t1", viewerIds: ["bob"]});
    await assertFails(updateDoc(doc(as("bob"), "trips/t1"), {revision: 2}));
  });
  it("blocks deleting a trip from the app", async () => {
    await seed("trips/t1", trip("alice", "t1", 1));
    await assertFails(deleteDoc(doc(as("alice"), "trips/t1")));
  });
});

describe("trip stops: tied to the trip revision", () => {
  beforeEach(async () => {
    await seed("trips/t1", trip("alice", "t1", 1));
    await seed("trips/t2", trip("alice", "t2", 1));
    await seed("places/p5", {name: "Museum"});
  });

  it("lets the owner add a stop while raising the revision", async () => {
    await assertSucceeds(writeStopWithRevision("alice", stop("s1", "t1", "p5"), 2));
  });
  it("lets the owner add a fixed commitment with no place", async () => {
    await assertSucceeds(writeStopWithRevision("alice", stop("s1", "t1", null), 2));
  });
  it("blocks adding a stop without raising the revision", async () => {
    await assertFails(setDoc(doc(as("alice"), "tripStops/s1"), stop("s1", "t1", "p5")));
  });
  it("blocks adding a stop that raises the revision by two", async () => {
    await assertFails(writeStopWithRevision("alice", stop("s1", "t1", "p5"), 3));
  });
  it("blocks a viewer from adding a stop", async () => {
    await seed("tripShares/t1", {tripId: "t1", viewerIds: ["bob"]});
    await assertFails(writeStopWithRevision("bob", stop("s1", "t1", "p5"), 2));
  });
  it("blocks a stop on day 9", async () => {
    await assertFails(writeStopWithRevision("alice", {...stop("s1", "t1", "p5"), day: 9}, 2));
  });
  it("lets the owner move a stop while raising the revision", async () => {
    await seed("tripStops/s1", stop("s1", "t1", "p5"));
    const db = as("alice");
    const batch = writeBatch(db);
    batch.update(doc(db, "trips/t1"), {revision: 2, updatedAt: now});
    batch.update(doc(db, "tripStops/s1"), {day: 2, order: 3});
    await assertSucceeds(batch.commit());
  });
  it("blocks moving a stop onto a different trip", async () => {
    await seed("tripStops/s1", stop("s1", "t1", "p5"));
    const db = as("alice");
    const batch = writeBatch(db);
    batch.update(doc(db, "trips/t1"), {revision: 2, updatedAt: now});
    batch.update(doc(db, "tripStops/s1"), {tripId: "t2"});
    await assertFails(batch.commit());
  });
  it("lets the owner delete a stop while raising the revision", async () => {
    await seed("tripStops/s1", stop("s1", "t1", "p5"));
    const db = as("alice");
    const batch = writeBatch(db);
    batch.update(doc(db, "trips/t1"), {revision: 2, updatedAt: now});
    batch.delete(doc(db, "tripStops/s1"));
    await assertSucceeds(batch.commit());
  });
  it("blocks deleting a stop without raising the revision", async () => {
    await seed("tripStops/s1", stop("s1", "t1", "p5"));
    await assertFails(deleteDoc(doc(as("alice"), "tripStops/s1")));
  });
});

describe("trip sharing", () => {
  beforeEach(async () => {
    await seed("trips/t1", trip("alice", "t1", 1));
  });

  it("lets the owner choose who can view", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "tripShares/t1"), {tripId: "t1", viewerIds: ["bob"]}));
  });
  it("blocks someone else from sharing the owner's trip", async () => {
    await assertFails(setDoc(doc(as("bob"), "tripShares/t1"), {tripId: "t1", viewerIds: ["bob"]}));
  });
  it("lets a viewer read their share but not change it", async () => {
    await seed("tripShares/t1", {tripId: "t1", viewerIds: ["bob"]});
    await assertSucceeds(getDoc(doc(as("bob"), "tripShares/t1")));
    await assertFails(setDoc(doc(as("bob"), "tripShares/t1"), {tripId: "t1", viewerIds: ["bob", "carol"]}));
  });
  it("lets the owner check a share that does not exist yet", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "tripShares/t1")));
  });
});

describe("saved place privacy", () => {
  it("does not reveal whether another user saved a place", async () => {
    await assertFails(getDoc(doc(as("bob"), "savedPlaces/alice_p3")));
  });
});

describe("large revisions", () => {
  it("lets the owner write a full 7-day, 35-stop plan in one revision", async () => {
    await seed("trips/t1", trip("alice", "t1", 1));
    for (let i = 0; i < 35; i++) {
      await seed(`places/big${i}`, {name: `Place ${i}`});
    }
    const db = as("alice");
    const batch = writeBatch(db);
    batch.update(doc(db, "trips/t1"), {revision: 2, updatedAt: now});
    for (let i = 0; i < 35; i++) {
      const s = {...stop(`big${i}`, "t1", `big${i}`), day: 1 + Math.floor(i / 5), order: 1 + (i % 5)};
      batch.set(doc(db, `tripStops/big${i}`), s);
    }
    await assertSucceeds(batch.commit());
  });
});

describe("queries the app will run", () => {
  beforeEach(async () => {
    await seed("trips/t1", trip("alice", "t1", 1));
    await seed("tripShares/t1", {tripId: "t1", viewerIds: ["bob"]});
    await seed("tripStops/s1", stop("s1", "t1", null));
  });

  it("lets a user list their own saved places", async () => {
    await assertSucceeds(getDocs(query(collection(as("alice"), "savedPlaces"), where("userId", "==", "alice"))));
  });
  it("blocks listing saved places without the userId filter", async () => {
    await assertFails(getDocs(collection(as("alice"), "savedPlaces")));
  });
  it("blocks listing another user's saved places", async () => {
    await assertFails(getDocs(query(collection(as("bob"), "savedPlaces"), where("userId", "==", "alice"))));
  });
  it("lets a user list their own trips", async () => {
    await assertSucceeds(getDocs(query(collection(as("alice"), "trips"), where("ownerId", "==", "alice"))));
  });
  it("lets a viewer list the stops of a shared trip", async () => {
    await assertSucceeds(getDocs(query(collection(as("bob"), "tripStops"), where("tripId", "==", "t1"))));
  });
  it("blocks a stranger from listing a trip's stops", async () => {
    await assertFails(getDocs(query(collection(as("carol"), "tripStops"), where("tripId", "==", "t1"))));
  });
  it("lets a user list active recommendations", async () => {
    await assertSucceeds(getDocs(query(collection(as("bob"), "recommendations"), where("moderationStatus", "==", "active"))));
  });
  it("blocks listing recommendations without the active filter", async () => {
    await assertFails(getDocs(collection(as("bob"), "recommendations")));
  });
});

const comment = (id: string, authorId: string, overrides: Record<string, unknown> = {}) => ({
  id,
  authorId,
  targetType: "place",
  targetId: "p1",
  text: "A useful detail.",
  parentCommentId: null,
  isQuestion: false,
  replyPlaceId: null,
  moderationStatus: "active",
  createdAt: now,
  ...overrides,
});

const collectionData = (id: string, ownerId: string, overrides: Record<string, unknown> = {}) => ({
  id,
  ownerId,
  title: "Coffee stops",
  placeIds: ["p1"],
  recommendationIds: ["recActive"],
  isPublished: false,
  createdAt: now,
  ...overrides,
});

const visit = (id: string, userId: string, overrides: Record<string, unknown> = {}) => ({
  id,
  userId,
  placeId: "p1",
  visitDate: "2026-10-30",
  ...overrides,
});

const ranking = (id: string, userId: string, overrides: Record<string, unknown> = {}) => ({
  id,
  userId,
  category: "coffee",
  placeIds: ["p1"],
  ...overrides,
});

const preparationTask = (id: string, tripStopId: string, overrides: Record<string, unknown> = {}) => ({
  id,
  tripStopId,
  title: "Book a table",
  bookingUrl: "https://example.com/booking",
  source: "Restaurant website",
  deadline: "2026-11-01",
  needsReview: false,
  ...overrides,
});

describe("comments", () => {
  it("lets a signed-in author comment on an existing place or active recommendation", async () => {
    await seed("places/p1", {name: "Cafe"});
    await seed("comments/parent", comment("parent", "bob"));
    await assertSucceeds(setDoc(doc(as("alice"), "comments/c1"), comment("c1", "alice")));
    await assertSucceeds(
      setDoc(
        doc(as("alice"), "comments/c2"),
        comment("c2", "alice", {targetType: "recommendation", targetId: "recActive"}),
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(as("alice"), "comments/reply"),
        comment("reply", "alice", {parentCommentId: "parent"}),
      ),
    );
  });

  it("blocks comments on missing or non-active targets and non-active new comments", async () => {
    await seed("places/p1", {name: "Cafe"});
    await seed("comments/hiddenParent", comment("hiddenParent", "bob", {moderationStatus: "hidden"}));
    await assertFails(
      setDoc(
        doc(as("alice"), "comments/missing"),
        comment("missing", "alice", {targetId: "missing-place"}),
      ),
    );
    await assertFails(
      setDoc(
        doc(as("alice"), "comments/removed"),
        comment("removed", "alice", {targetType: "recommendation", targetId: "recRemoved"}),
      ),
    );
    await assertFails(
      setDoc(
        doc(as("alice"), "comments/hidden"),
        comment("hidden", "alice", {moderationStatus: "hidden"}),
      ),
    );
    await assertFails(
      setDoc(
        doc(as("alice"), "comments/replyHidden"),
        comment("replyHidden", "alice", {parentCommentId: "hiddenParent"}),
      ),
    );
  });

  it("lets an author edit or delete their comment without changing its identity or moderation", async () => {
    await seed("places/p1", {name: "Cafe"});
    await seed("comments/c1", comment("c1", "alice"));
    const ref = doc(as("alice"), "comments/c1");

    await assertSucceeds(updateDoc(ref, {text: "Updated detail."}));
    await assertFails(updateDoc(ref, {authorId: "bob"}));
    await assertFails(updateDoc(ref, {targetId: "p2"}));
    await assertFails(updateDoc(ref, {moderationStatus: "removed"}));
    await assertSucceeds(deleteDoc(ref));
  });

  it("blocks another author, empty text, and extra fields", async () => {
    await seed("places/p1", {name: "Cafe"});
    await seed("comments/c1", comment("c1", "alice"));
    await assertFails(updateDoc(doc(as("bob"), "comments/c1"), {text: "Changed"}));
    await assertFails(deleteDoc(doc(as("bob"), "comments/c1")));
    await assertFails(
      setDoc(doc(as("alice"), "comments/empty"), comment("empty", "alice", {text: ""})),
    );
    await assertFails(
      setDoc(
        doc(as("alice"), "comments/extra"),
        {...comment("extra", "alice"), isAdmin: true},
      ),
    );
  });
});

describe("likes", () => {
  it("lets a user create and remove their own like on an active recommendation", async () => {
    const data = {userId: "bob", recommendationId: "recActive", createdAt: now};
    await assertSucceeds(setDoc(doc(as("bob"), "likes/like1"), data));
    await assertSucceeds(deleteDoc(doc(as("bob"), "likes/like1")));
  });

  it("blocks likes for inactive or missing recommendations and likes as another user", async () => {
    await assertFails(
      setDoc(doc(as("bob"), "likes/removed"), {
        userId: "bob", recommendationId: "recRemoved", createdAt: now,
      }),
    );
    await assertFails(
      setDoc(doc(as("bob"), "likes/missing"), {
        userId: "bob", recommendationId: "missing", createdAt: now,
      }),
    );
    await assertFails(
      setDoc(doc(as("bob"), "likes/forAlice"), {
        userId: "alice", recommendationId: "recActive", createdAt: now,
      }),
    );
  });

  it("does not allow updating a like or removing another user's like", async () => {
    await seed("likes/like1", {
      userId: "alice", recommendationId: "recActive", createdAt: now,
    });
    await assertFails(updateDoc(doc(as("alice"), "likes/like1"), {createdAt: now}));
    await assertFails(deleteDoc(doc(as("bob"), "likes/like1")));
  });
});

describe("follows", () => {
  it("lets a user follow and unfollow another user", async () => {
    await seed("users/bob", {id: "bob"});
    const data = {followerId: "alice", followeeId: "bob", createdAt: now};
    await assertSucceeds(setDoc(doc(as("alice"), "follows/f1"), data));
    await assertSucceeds(deleteDoc(doc(as("alice"), "follows/f1")));
  });

  it("blocks self-follows and creating a follow for someone else", async () => {
    await assertFails(
      setDoc(doc(as("alice"), "follows/self"), {
        followerId: "alice", followeeId: "alice", createdAt: now,
      }),
    );
    await assertFails(
      setDoc(doc(as("alice"), "follows/forBob"), {
        followerId: "bob", followeeId: "alice", createdAt: now,
      }),
    );
    await assertFails(
      setDoc(doc(as("alice"), "follows/missingUser"), {
        followerId: "alice", followeeId: "missing", createdAt: now,
      }),
    );
  });

  it("does not allow follow updates or unfollowing on another user's behalf", async () => {
    await seed("follows/f1", {followerId: "alice", followeeId: "bob", createdAt: now});
    await assertFails(updateDoc(doc(as("alice"), "follows/f1"), {followeeId: "carol"}));
    await assertFails(deleteDoc(doc(as("bob"), "follows/f1")));
  });
});

describe("collections", () => {
  it("lets an owner create, update, and delete their collection", async () => {
    await assertSucceeds(
      setDoc(doc(as("alice"), "collections/c1"), collectionData("c1", "alice")),
    );
    await assertSucceeds(updateDoc(doc(as("alice"), "collections/c1"), {title: "Coffee and tea"}));
    await assertSucceeds(deleteDoc(doc(as("alice"), "collections/c1")));
  });

  it("blocks another owner, owner changes, and invalid collection fields", async () => {
    await seed("collections/c1", collectionData("c1", "alice"));
    await assertFails(updateDoc(doc(as("bob"), "collections/c1"), {title: "Stolen"}));
    await assertFails(deleteDoc(doc(as("bob"), "collections/c1")));
    await assertFails(updateDoc(doc(as("alice"), "collections/c1"), {ownerId: "bob"}));
    await assertFails(
      setDoc(
        doc(as("alice"), "collections/extra"),
        {...collectionData("extra", "alice"), private: true},
      ),
    );
    await assertFails(
      setDoc(
        doc(as("alice"), "collections/badList"),
        collectionData("badList", "alice", {placeIds: "p1"}),
      ),
    );
  });
});

describe("visits", () => {
  it("lets a user create, update, and delete their visit for an existing place", async () => {
    await seed("places/p1", {name: "Cafe"});
    await assertSucceeds(setDoc(doc(as("alice"), "visits/v1"), visit("v1", "alice")));
    await assertSucceeds(updateDoc(doc(as("alice"), "visits/v1"), {visitDate: "2026-11-01"}));
    await assertSucceeds(deleteDoc(doc(as("alice"), "visits/v1")));
  });

  it("blocks visits for missing places, mismatched owners or IDs, and extra fields", async () => {
    await assertFails(
      setDoc(doc(as("alice"), "visits/missing"), visit("missing", "alice", {placeId: "missing"})),
    );
    await seed("places/p1", {name: "Cafe"});
    await assertFails(
      setDoc(doc(as("bob"), "visits/forAlice"), visit("forAlice", "alice")),
    );
    await assertFails(
      setDoc(doc(as("alice"), "visits/wrongId"), visit("different", "alice")),
    );
    await assertFails(
      setDoc(
        doc(as("alice"), "visits/extra"),
        {...visit("extra", "alice"), notes: "private"},
      ),
    );
  });

  it("blocks another user from editing or deleting a visit", async () => {
    await seed("visits/v1", visit("v1", "alice"));
    await assertFails(updateDoc(doc(as("bob"), "visits/v1"), {visitDate: "2026-11-01"}));
    await assertFails(deleteDoc(doc(as("bob"), "visits/v1")));
  });
});

describe("rankings", () => {
  it("lets an owner create, update, and delete a ranking with its documented ID", async () => {
    const id = "alice_coffee";
    await assertSucceeds(setDoc(doc(as("alice"), `rankings/${id}`), ranking(id, "alice")));
    await assertSucceeds(updateDoc(doc(as("alice"), `rankings/${id}`), {placeIds: ["p2", "p1"]}));
    await assertSucceeds(deleteDoc(doc(as("alice"), `rankings/${id}`)));
  });

  it("blocks mismatched owners, IDs, and invalid ranking lists", async () => {
    await assertFails(
      setDoc(doc(as("bob"), "rankings/alice_coffee"), ranking("alice_coffee", "alice")),
    );
    await assertFails(
      setDoc(doc(as("alice"), "rankings/wrong"), ranking("wrong", "alice")),
    );
    await assertFails(
      setDoc(
        doc(as("alice"), "rankings/alice_coffee"),
        ranking("alice_coffee", "alice", {placeIds: "p1"}),
      ),
    );
  });

  it("blocks another user from editing or deleting a ranking", async () => {
    await seed("rankings/alice_coffee", ranking("alice_coffee", "alice"));
    await assertFails(
      updateDoc(doc(as("bob"), "rankings/alice_coffee"), {placeIds: ["p2"]}),
    );
    await assertFails(deleteDoc(doc(as("bob"), "rankings/alice_coffee")));
  });
});

describe("blocks", () => {
  it("lets a user create and remove their own block", async () => {
    await seed("users/bob", {id: "bob"});
    const data = {userId: "alice", blockedUserId: "bob", createdAt: now};
    await assertSucceeds(setDoc(doc(as("alice"), "blocks/new"), data));
    await assertSucceeds(deleteDoc(doc(as("alice"), "blocks/new")));
  });

  it("blocks self-blocks, mismatched users, and extra fields", async () => {
    await assertFails(
      setDoc(doc(as("alice"), "blocks/self"), {
        userId: "alice", blockedUserId: "alice", createdAt: now,
      }),
    );
    await assertFails(
      setDoc(doc(as("alice"), "blocks/forBob"), {
        userId: "bob", blockedUserId: "alice", createdAt: now,
      }),
    );
    await assertFails(
      setDoc(doc(as("alice"), "blocks/missingUser"), {
        userId: "alice", blockedUserId: "missing", createdAt: now,
      }),
    );
    await assertFails(
      setDoc(doc(as("alice"), "blocks/extra"), {
        userId: "alice", blockedUserId: "bob", createdAt: now, reason: "spam",
      }),
    );
  });

  it("does not allow updating a block or removing another user's block", async () => {
    await seed("blocks/alice_bob", {
      userId: "alice", blockedUserId: "bob", createdAt: now,
    });
    await assertFails(updateDoc(doc(as("alice"), "blocks/alice_bob"), {blockedUserId: "carol"}));
    await assertFails(deleteDoc(doc(as("bob"), "blocks/alice_bob")));
  });
});

describe("preparation task writes are trip-owner-only", () => {
  it("lets the trip owner create, update, and delete a task on the owner's stop", async () => {
    await assertSucceeds(
      setDoc(doc(as("alice"), "preparationTasks/task2"), preparationTask("task2", "stop1")),
    );
    await assertSucceeds(
      updateDoc(doc(as("alice"), "preparationTasks/task2"), {title: "Confirm reservation"}),
    );
    await assertSucceeds(deleteDoc(doc(as("alice"), "preparationTasks/task2")));
  });

  it("blocks shared viewers, missing stops, moved tasks, and extra fields", async () => {
    await assertFails(
      setDoc(
        doc(as("bob"), "preparationTasks/task2"),
        preparationTask("task2", "stop1"),
      ),
    );
    await assertFails(
      setDoc(
        doc(as("alice"), "preparationTasks/missingStop"),
        preparationTask("missingStop", "missing"),
      ),
    );
    await seed("preparationTasks/task2", preparationTask("task2", "stop1"));
    await assertFails(
      updateDoc(doc(as("alice"), "preparationTasks/task2"), {tripStopId: "stop2"}),
    );
    await assertFails(
      setDoc(
        doc(as("alice"), "preparationTasks/extra"),
        {...preparationTask("extra", "stop1"), cost: 50},
      ),
    );
  });
});

describe("Task 8 read policies", () => {
  beforeEach(async () => {
    await seed("comments/active", comment("active", "alice"));
    await seed("comments/hidden", comment("hidden", "alice", {moderationStatus: "hidden"}));
    await seed("collections/public", collectionData("public", "alice", {isPublished: true}));
    await seed("collections/private", collectionData("private", "alice"));
    await seed("visits/v1", visit("v1", "alice"));
    await seed("rankings/alice_coffee", ranking("alice_coffee", "alice"));
    await seed("likes/alice_like", {
      userId: "alice", recommendationId: "recActive", createdAt: now,
    });
    await seed("follows/f1", {followerId: "alice", followeeId: "bob", createdAt: now});
  });

  it("keeps comments moderation-aware and collections private unless published", async () => {
    await assertSucceeds(getDoc(doc(as("bob"), "comments/active")));
    await assertFails(getDoc(doc(as("bob"), "comments/hidden")));
    await assertSucceeds(getDoc(doc(as("alice"), "comments/hidden")));
    await assertSucceeds(getDoc(doc(as("bob"), "collections/public")));
    await assertFails(getDoc(doc(as("bob"), "collections/private")));
    await assertSucceeds(getDoc(doc(as("alice"), "collections/private")));
  });

  it("keeps visits, rankings, and likes owner-only", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "visits/v1")));
    await assertFails(getDoc(doc(as("bob"), "visits/v1")));
    await assertSucceeds(getDoc(doc(as("alice"), "rankings/alice_coffee")));
    await assertFails(getDoc(doc(as("bob"), "rankings/alice_coffee")));
    await assertSucceeds(getDoc(doc(as("alice"), "likes/alice_like")));
    await assertFails(getDoc(doc(as("bob"), "likes/alice_like")));
  });

  it("lets either participant read a follow, but not unrelated users", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "follows/f1")));
    await assertSucceeds(getDoc(doc(as("bob"), "follows/f1")));
    await assertFails(getDoc(doc(as("carol"), "follows/f1")));
  });
});
