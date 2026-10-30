import {readFileSync} from "fs";
import {resolve} from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch} from "firebase/firestore";

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
  it("blocks a stop for a place that is not in the catalog", async () => {
    await assertFails(writeStopWithRevision("alice", stop("s1", "t1", "nope"), 2));
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
