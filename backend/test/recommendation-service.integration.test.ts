import { readFileSync } from "fs";
import { resolve } from "path";
import {
  assertFails,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import {
  deleteApp,
  initializeApp,
} from "../../mobile/node_modules/firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  initializeAuth,
  inMemoryPersistence,
  signOut,
  type Auth,
} from "../../mobile/node_modules/firebase/auth";
import {
  connectFirestoreEmulator,
  doc as mobileDoc,
  getDoc as mobileGetDoc,
  getFirestore,
  setDoc as mobileSetDoc,
  type Firestore,
} from "../../mobile/node_modules/firebase/firestore";

import { recommendationIntegrationContext } from "./recommendationIntegrationContext";

jest.mock("../../mobile/src/repositories/firestore", () => ({
  get db() {
    return require("./recommendationIntegrationContext")
      .recommendationIntegrationContext.db;
  },
}));
jest.mock("../../mobile/src/auth/AuthService", () => ({
  getCurrentUserId: () =>
    require("./recommendationIntegrationContext")
      .recommendationIntegrationContext.userId,
}));

import { createRecommendation } from "../../mobile/src/services/RecommendationService";

let env: RulesTestEnvironment;
let mobileAuth: Auth;
let mobileDb: Firestore;
let mobileApp: ReturnType<typeof initializeApp>;
let userId: string;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "roami-recommendation-integration",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });

  mobileApp = initializeApp(
    { apiKey: "demo-api-key", projectId: "roami-recommendation-integration" },
    "recommendation-service-integration",
  );
  mobileAuth = initializeAuth(mobileApp, { persistence: inMemoryPersistence });
  connectAuthEmulator(mobileAuth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  mobileDb = getFirestore(mobileApp);
  connectFirestoreEmulator(mobileDb, "127.0.0.1", 8080);
  const credential = await createUserWithEmailAndPassword(
    mobileAuth,
    "recommendation-test@example.com",
    "integration-test-password",
  );
  userId = credential.user.uid;
});

afterAll(async () => {
  recommendationIntegrationContext.db = null;
  recommendationIntegrationContext.userId = null;
  await signOut(mobileAuth);
  await deleteApp(mobileApp);
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "places/p1"), {
      id: "p1",
      name: "Cafe",
      city: "Seattle",
      latitude: 47.6,
      longitude: -122.3,
      category: "cafe",
      openingHours: null,
      missingFields: ["openingHours"],
      source: {
        provider: "manual",
        providerId: null,
        retrievedAt: "2026-10-01T12:00:00Z",
      },
      updatedAt: "2026-10-01T12:00:00Z",
    });
    await setDoc(doc(db, `users/${userId}`), {
      id: userId,
      name: "Alice",
      bio: "",
      interests: [],
      createdAt: "2026-10-01T12:00:00Z",
    });
  });
  recommendationIntegrationContext.userId = userId;
  recommendationIntegrationContext.db = mobileDb;
});

describe("createRecommendation against Firestore emulator", () => {
  it("writes through the real repository and returns the persisted recommendation view", async () => {
    const response = await createRecommendation({
      placeId: "p1",
      description: "A welcoming cafe.",
      tags: ["coffee"],
    });

    expect(response.recommendation).toMatchObject({
      status: "available",
      place: { id: "p1", name: "Cafe" },
      author: { id: userId, name: "Alice" },
      description: "A welcoming cafe.",
      tags: ["coffee"],
      visitDate: null,
      sourceLinks: [],
    });
    const saved = await mobileGetDoc(
      mobileDoc(mobileDb, "recommendations", response.recommendation.id),
    );
    expect(saved.data()).toMatchObject({
      id: response.recommendation.id,
      authorId: userId,
      placeId: "p1",
      moderationStatus: "active",
    });
  });

  it("does not write when the referenced place is missing", async () => {
    await expect(
      createRecommendation({
        placeId: "missing",
        description: "A place.",
        tags: [],
      }),
    ).rejects.toMatchObject({ code: "not-found" });
    let isEmpty = false;
    await env.withSecurityRulesDisabled(async (ctx) => {
      const snapshot = await getDocs(
        collection(ctx.firestore(), "recommendations"),
      );
      isEmpty = snapshot.empty;
    });
    expect(isEmpty).toBe(true);
  });

  it("Task 8 rules reject a spoofed author and a missing-place document", async () => {
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(
      setDoc(doc(bob, "recommendations/spoofed"), {
        id: "spoofed",
        authorId: "spoofed-user",
        placeId: "p1",
        description: "Not Bob's recommendation.",
        tags: [],
        visitDate: null,
        sourceLinks: [],
        moderationStatus: "active",
        createdAt: new Date().toISOString(),
      }),
    );

    await assertFails(
      mobileSetDoc(mobileDoc(mobileDb, "recommendations/missing-place"), {
        id: "missing-place",
        authorId: userId,
        placeId: "missing",
        description: "This place is not in the catalog.",
        tags: [],
        visitDate: null,
        sourceLinks: [],
        moderationStatus: "active",
        createdAt: new Date().toISOString(),
      }),
    );
  });
});
