import {readFileSync} from "fs";
import {resolve} from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {deleteDoc, doc, getDoc, setDoc, updateDoc} from "firebase/firestore";

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
