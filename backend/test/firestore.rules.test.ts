import {readFileSync} from "fs";
import {resolve} from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {doc, getDoc, setDoc} from "firebase/firestore";

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

describe("the app cannot write directly", () => {
  it("rejects a write from the owner", async () => {
    await assertFails(setDoc(doc(as("alice"), "savedPlaces/alice_p2"), {userId: "alice"}));
  });
  it("rejects a user creating a report", async () => {
    await assertFails(setDoc(doc(as("bob"), "reports/new"), {reporterId: "bob"}));
  });
});