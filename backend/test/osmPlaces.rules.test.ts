// Rules for places and cityImports written by the app's OpenStreetMap import.
// Run with the Firestore emulator (see README):
//   npx --yes firebase-tools emulators:exec --only firestore "npm --prefix backend run test:rules -- --runInBand"
import {readFileSync} from "fs";
import {resolve} from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {deleteDoc, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc} from "firebase/firestore";

import {OSM_CATEGORIES} from "../../mobile/src/logic/osmPlaces";

const RULES = readFileSync(resolve(__dirname, "../../firestore.rules"), "utf8");
const DAY = 24 * 60 * 60 * 1000;

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "roami-osm-rules-test",
    firestore: {rules: RULES},
  });
});
afterAll(async () => {
  await env.cleanup();
});
beforeEach(async () => {
  await env.clearFirestore();
});

const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();
const daysAgo = (days: number) => Timestamp.fromMillis(Date.now() - days * DAY);

function osmPlace(overrides: Record<string, unknown> = {}) {
  return {
    id: "osm-node-123",
    name: "Portland Art Museum",
    city: "Portland",
    cityId: "osm-relation-186579",
    latitude: 45.5163,
    longitude: -122.6834,
    category: "museum",
    openingHours: "Tu-Su 10:00-17:00",
    missingFields: [],
    source: {provider: "osm", providerId: "node/123", retrievedAt: "2026-11-22T12:00:00.000Z"},
    updatedAt: "2026-11-22T12:00:00.000Z",
    importedAt: serverTimestamp(),
    ...overrides,
  };
}

function cityImport(overrides: Record<string, unknown> = {}) {
  return {
    cityId: "osm-relation-186579",
    name: "Portland",
    placeCount: 1,
    importedAt: serverTimestamp(),
    ...overrides,
  };
}

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

describe("importing places from OpenStreetMap", () => {
  it("lets a signed-in user create a well-formed OSM place", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "places/osm-node-123"), osmPlace()));
  });

  it("accepts unknown opening hours as null", async () => {
    await assertSucceeds(setDoc(
      doc(as("alice"), "places/osm-node-123"),
      osmPlace({openingHours: null, missingFields: ["openingHours"]}),
    ));
  });

  it("refuses signed-out users", async () => {
    await assertFails(setDoc(doc(anonymous(), "places/osm-node-123"), osmPlace()));
  });

  it.each([
    ["an ID that is not an OSM ID", "places/p-fake", {id: "p-fake"}],
    ["an ID that doesn't match the OSM element", "places/osm-node-123", {source: {provider: "osm", providerId: "node/999", retrievedAt: "x"}}],
    ["a hand-made source", "places/osm-node-123", {source: {provider: "manual", providerId: "node/123", retrievedAt: "x"}}],
    ["a category the app doesn't import", "places/osm-node-123", {category: "casino"}],
    ["an empty name", "places/osm-node-123", {name: ""}],
    ["an overlong name", "places/osm-node-123", {name: "x".repeat(201)}],
    ["coordinates off the map", "places/osm-node-123", {latitude: 91}],
    ["a city ID that isn't an OSM city", "places/osm-node-123", {cityId: "Portland"}],
    ["extra fields such as a link", "places/osm-node-123", {website: "https://spam.example"}],
    ["a cost", "places/osm-node-123", {cost: {amount: 5, currency: "USD"}}],
    ["a backdated import time", "places/osm-node-123", {importedAt: daysAgo(60)}],
  ])("refuses a place with %s", async (_why, path, overrides) => {
    await assertFails(setDoc(doc(as("alice"), path), osmPlace(overrides)));
  });

  it("allows exactly the categories the importer produces", async () => {
    for (const category of OSM_CATEGORIES) expect(RULES).toContain(`'${category}'`);
  });

  it("refuses rewriting a place imported recently", async () => {
    await seed("places/osm-node-123", osmPlace({importedAt: daysAgo(5)}));
    await assertFails(setDoc(doc(as("bob"), "places/osm-node-123"), osmPlace({name: "Fake Pizza"})));
  });

  it("lets a stale place be refreshed", async () => {
    await seed("places/osm-node-123", osmPlace({importedAt: daysAgo(31)}));
    await assertSucceeds(setDoc(doc(as("bob"), "places/osm-node-123"), osmPlace({name: "Portland Art Museum (renamed)"})));
  });

  it("refuses moving a stale place to another city", async () => {
    await seed("places/osm-node-123", osmPlace({importedAt: daysAgo(31)}));
    await assertFails(setDoc(doc(as("bob"), "places/osm-node-123"), osmPlace({cityId: "osm-relation-1"})));
  });

  it("never lets the app change or delete hand-made places", async () => {
    await seed("places/p-pike", {
      id: "p-pike", name: "Pike Place Market", city: "Seattle", latitude: 47.6, longitude: -122.3,
      category: "market", openingHours: null, missingFields: ["openingHours"],
      source: {provider: "manual", providerId: null, retrievedAt: "2026-10-01T12:00:00Z"},
      updatedAt: "2026-10-01T12:00:00Z",
    });
    await assertFails(updateDoc(doc(as("alice"), "places/p-pike"), {name: "Changed"}));
    await assertFails(setDoc(doc(as("alice"), "places/p-pike"), osmPlace({id: "p-pike"})));
    await assertFails(deleteDoc(doc(as("alice"), "places/p-pike")));
  });

  it("never lets the app delete an imported place", async () => {
    await seed("places/osm-node-123", osmPlace({importedAt: daysAgo(90)}));
    await assertFails(deleteDoc(doc(as("alice"), "places/osm-node-123")));
  });
});

describe("city import records", () => {
  it("lets a signed-in user read and create one", async () => {
    await assertSucceeds(setDoc(doc(as("alice"), "cityImports/osm-relation-186579"), cityImport()));
    await assertSucceeds(getDoc(doc(as("bob"), "cityImports/osm-relation-186579")));
    await assertFails(getDoc(doc(anonymous(), "cityImports/osm-relation-186579")));
  });

  it.each([
    ["an ID that doesn't match", {cityId: "osm-relation-1"}],
    ["too many places", {placeCount: 401}],
    ["a backdated import time", {importedAt: daysAgo(60)}],
    ["extra fields", {note: "hi"}],
  ])("refuses one with %s", async (_why, overrides) => {
    await assertFails(setDoc(doc(as("alice"), "cityImports/osm-relation-186579"), cityImport(overrides)));
  });

  it("refuses a city ID that isn't an OSM city", async () => {
    await assertFails(setDoc(doc(as("alice"), "cityImports/Portland"), cityImport({cityId: "Portland"})));
  });

  it("only lets a city be marked imported again once it is due for a refresh", async () => {
    await seed("cityImports/osm-relation-186579", cityImport({importedAt: daysAgo(5)}));
    await assertFails(setDoc(doc(as("bob"), "cityImports/osm-relation-186579"), cityImport()));
    await seed("cityImports/osm-relation-186579", cityImport({importedAt: daysAgo(31)}));
    await assertSucceeds(setDoc(doc(as("bob"), "cityImports/osm-relation-186579"), cityImport()));
  });

  it("can't be deleted from the app", async () => {
    await seed("cityImports/osm-relation-186579", cityImport({importedAt: daysAgo(31)}));
    await assertFails(deleteDoc(doc(as("alice"), "cityImports/osm-relation-186579")));
  });
});
