import { deleteApp, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import {
  requireFirestoreEmulatorHost,
  seedEmulator,
} from "../src/scripts/seed";
import { SEED_PLACES, SEED_RECOMMENDATIONS } from "../src/scripts/seedData";

const PROJECT_ID = "roami-seed-script-test";
let db: Firestore;
let app: ReturnType<typeof initializeApp>;

beforeAll(() => {
  requireFirestoreEmulatorHost();
  app = initializeApp({ projectId: PROJECT_ID }, "seed-data-integration");
  db = getFirestore(app);
});

afterAll(async () => {
  await db.terminate();
  await deleteApp(app);
});

describe("seed script against Firestore emulator", () => {
  it("can seed twice without creating duplicates and leaves exact collection counts", async () => {
    await expect(seedEmulator(db)).resolves.toEqual({
      users: 2,
      places: 50,
      recommendations: 75,
    });
    await expect(seedEmulator(db)).resolves.toEqual({
      users: 2,
      places: 50,
      recommendations: 75,
    });

    const [users, places, recommendations] = await Promise.all([
      db.collection("users").get(),
      db.collection("places").get(),
      db.collection("recommendations").get(),
    ]);
    expect(users.size).toBe(2);
    expect(places.size).toBe(50);
    expect(recommendations.size).toBe(75);

    const placeIds = new Set(places.docs.map(({ id }) => id));
    expect(new Set(places.docs.map(({ id }) => id)).size).toBe(
      SEED_PLACES.length,
    );
    expect(new Set(recommendations.docs.map(({ id }) => id)).size).toBe(
      SEED_RECOMMENDATIONS.length,
    );
    for (const recommendation of recommendations.docs) {
      expect(placeIds.has(String(recommendation.get("placeId")))).toBe(true);
    }
  });
});
